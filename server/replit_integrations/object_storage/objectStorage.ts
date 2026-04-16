import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as pathModule from "path";
import { Readable } from "stream";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const LOCAL_STORAGE_DIR = pathModule.join(process.cwd(), "local-object-storage");

let _isReplitEnv: boolean | null = null;

async function isReplitEnvironment(): Promise<boolean> {
  if (_isReplitEnv !== null) return _isReplitEnv;
  if (process.env.REPL_ID) {
    try {
      const resp = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/credential`, { signal: AbortSignal.timeout(1000) });
      _isReplitEnv = resp.ok;
    } catch {
      _isReplitEnv = false;
    }
  } else {
    _isReplitEnv = false;
  }
  if (!_isReplitEnv) {
    console.log("[ObjectStorage] Running in LOCAL mode — using filesystem at", LOCAL_STORAGE_DIR);
  }
  return _isReplitEnv;
}

function ensureLocalDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureLocalDir(LOCAL_STORAGE_DIR);

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

class LocalFile {
  localPath: string;
  name: string;
  constructor(localPath: string) {
    this.localPath = localPath;
    this.name = pathModule.basename(localPath);
  }
  async exists(): Promise<[boolean]> {
    return [fs.existsSync(this.localPath)];
  }
  async getMetadata(): Promise<[any]> {
    const stat = await fsPromises.stat(this.localPath);
    const ext = pathModule.extname(this.localPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
      '.json': 'application/json', '.txt': 'text/plain', '.html': 'text/html',
      '.css': 'text/css', '.js': 'application/javascript',
    };
    return [{ contentType: mimeMap[ext] || 'application/octet-stream', size: stat.size }];
  }
  createReadStream(): Readable {
    return fs.createReadStream(this.localPath);
  }
  async download(): Promise<[Buffer]> {
    const buf = await fsPromises.readFile(this.localPath);
    return [buf];
  }
  async save(data: Buffer, options?: any): Promise<void> {
    ensureLocalDir(pathModule.dirname(this.localPath));
    await fsPromises.writeFile(this.localPath, data);
  }
  async delete(): Promise<void> {
    if (fs.existsSync(this.localPath)) await fsPromises.unlink(this.localPath);
  }
  metadata: any = {};
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      return [pathModule.join(LOCAL_STORAGE_DIR, "public")];
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      const localPrivate = pathModule.join(LOCAL_STORAGE_DIR, ".private");
      ensureLocalDir(localPrivate);
      return localPrivate;
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    const useReplit = await isReplitEnvironment();
    if (!useReplit) {
      for (const searchPath of this.getPublicObjectSearchPaths()) {
        const localPath = pathModule.join(searchPath.startsWith('/') ? searchPath : pathModule.join(LOCAL_STORAGE_DIR, searchPath), filePath);
        if (fs.existsSync(localPath)) {
          return new LocalFile(localPath) as any;
        }
      }
      return null;
    }
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async downloadObject(file: File | any, res: Response, cacheTtlSec: number = 3600) {
    try {
      if (file instanceof LocalFile) {
        const [metadata] = await file.getMetadata();
        res.set({
          "Content-Type": metadata.contentType || "application/octet-stream",
          "Content-Length": String(metadata.size),
          "Cache-Control": `public, max-age=${cacheTtlSec}`,
        });
        const stream = file.createReadStream();
        stream.on("error", (err: any) => {
          console.error("Local stream error:", err);
          if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
        });
        stream.pipe(res);
        return;
      }
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });
      const stream = file.createReadStream();
      stream.on("error", (err: any) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const useReplit = await isReplitEnvironment();
    if (!useReplit) {
      const objectId = randomUUID();
      const uploadDir = pathModule.join(LOCAL_STORAGE_DIR, ".private", "uploads");
      ensureLocalDir(uploadDir);
      const localPath = pathModule.join(uploadDir, objectId);
      return `local://${localPath}`;
    }
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error("PRIVATE_OBJECT_DIR not set.");
    }
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signObjectURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });
  }

  async getObjectEntityFile(objectPath: string): Promise<File | any> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join("/");

    const useReplit = await isReplitEnvironment();
    if (!useReplit) {
      const localPath = pathModule.join(LOCAL_STORAGE_DIR, ".private", entityId);
      if (!fs.existsSync(localPath)) {
        const altPath = pathModule.join(process.cwd(), "local-uploads", parts[parts.length - 1]);
        if (fs.existsSync(altPath)) return new LocalFile(altPath) as any;
        throw new ObjectNotFoundError();
      }
      return new LocalFile(localPath) as any;
    }

    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) throw new ObjectNotFoundError();
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("local://")) {
      const localPath = rawPath.replace("local://", "");
      const filename = pathModule.basename(localPath);
      return `/objects/uploads/${filename}`;
    }
    if (!rawPath.startsWith("https://storage.googleapis.com/")) return rawPath;
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) objectEntityDir = `${objectEntityDir}/`;
    if (!rawObjectPath.startsWith(objectEntityDir)) return rawObjectPath;
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    const useReplit = await isReplitEnvironment();
    if (!useReplit) return normalizedPath;
    if (!normalizedPath.startsWith("/")) return normalizedPath;
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    const useReplit = await isReplitEnvironment();
    if (!useReplit) return true;
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async saveLocal(objectPath: string, data: Buffer, contentType?: string): Promise<string> {
    const parts = objectPath.replace(/^\/objects\//, '');
    const localPath = pathModule.join(LOCAL_STORAGE_DIR, ".private", parts);
    ensureLocalDir(pathModule.dirname(localPath));
    await fsPromises.writeFile(localPath, data);
    console.log(`[ObjectStorage] Local save: ${localPath} (${data.length} bytes)`);
    return `/objects/${parts}`;
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) path = `/${path}`;
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  return { bucketName: pathParts[1], objectName: pathParts.slice(2).join("/") };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
