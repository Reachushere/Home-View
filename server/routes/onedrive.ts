import type { Express } from "express";
import { storage } from "../storage";
import {
  isOneDriveConnected,
  listOneDriveItems,
  getOneDriveFile,
  searchOneDriveFiles,
  createOneDriveFolder,
  renameOneDriveFolder,
  checkOneDriveFolderExists,
  listOneDriveFolderChildren,
  renameOneDriveItem,
  getOneDriveFileContentAsText,
  getOneDriveItemByPath,
  createOneDriveTextFile,
  updateOneDriveFileContent,
  moveOneDriveItem,
  getOneDriveItemId,
  deleteOneDriveItem,
  getOneNotePages,
  getOneNotePagesViaApi,
  createOneNotePage,
  deleteOneNotePage,
  resolveSharedNotebookUrl,
  getPagesBySectionId,
  getSharedNotebookSections,
  listOneNoteNotebooks,
  startDeviceCodeFlow,
  pollDeviceCodeAuth,
} from "../onedrive";
import {
  buildCourseFolderName,
  getSemesterTypeFolder,
  generateWeekFolderNames,
} from "../serverHelpers";

export function registerOneDriveRoutes(app: Express, deps: { syncDegreeTrackingFromDb: () => Promise<void> }) {
  const { syncDegreeTrackingFromDb } = deps;

  // ============= ONEDRIVE AUTH ROUTES =============

  app.get("/api/onedrive/status", async (req, res) => {
    const hasToken = isOneDriveConnected();
    if (!hasToken) {
      (globalThis as any).__odLastVerify = { ts: Date.now(), result: { connected: false, hasToken: false, tokenWorks: false, reason: "No refresh token stored" } };
      return res.json((globalThis as any).__odLastVerify.result);
    }
    const cache = (globalThis as any).__odLastVerify;
    const force = req.query.force === '1' || req.query.force === 'true';
    if (!force && cache && (Date.now() - cache.ts) < 60_000) {
      return res.json(cache.result);
    }
    try {
      const { listOneDriveItems } = await import("../onedrive");
      await listOneDriveItems('/');
      const result = { connected: true, hasToken: true, tokenWorks: true };
      (globalThis as any).__odLastVerify = { ts: Date.now(), result };
      return res.json(result);
    } catch (e: any) {
      const msg = e?.message || String(e);
      const result = { connected: false, hasToken: true, tokenWorks: false, reason: `Token rejected by Microsoft: ${msg.substring(0, 200)}` };
      (globalThis as any).__odLastVerify = { ts: Date.now(), result };
      return res.json(result);
    }
  });

  app.get("/api/onedrive/auth", async (_req, res) => {
    const connected = isOneDriveConnected();
    res.send(`<!DOCTYPE html><html><head><title>OneDrive Connection</title>
<style>body{font-family:system-ui;background:#0a1929;color:#e0e0e0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.card{background:#132f4c;border-radius:12px;padding:40px;max-width:500px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.4)}
h1{color:#90caf9;margin-bottom:8px}
.status{margin:16px 0;padding:12px;border-radius:8px}
.connected{background:#1b5e20;color:#a5d6a7}
.disconnected{background:#b71c1c33;color:#ef9a9a}
button{background:#1976d2;color:white;border:none;padding:14px 32px;border-radius:8px;font-size:16px;cursor:pointer;margin-top:16px}
button:hover{background:#1565c0}
#code-display{display:none;margin-top:24px;padding:20px;background:#0a1929;border-radius:8px}
.user-code{font-size:36px;font-weight:bold;color:#90caf9;letter-spacing:4px;margin:16px 0}
a{color:#64b5f6}
.spinner{display:inline-block;width:20px;height:20px;border:3px solid #555;border-top-color:#90caf9;border-radius:50%;animation:spin 1s linear infinite;margin-left:8px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div class="card">
<h1>OneDrive Connection</h1>
<div class="status ${connected ? 'connected' : 'disconnected'}">${connected ? 'Connected' : 'Not connected'}</div>
<p>Click below to connect your Microsoft account. You will get a code to enter at Microsoft's login page.</p>
<button onclick="startAuth()" id="auth-btn">Connect OneDrive</button>
<div id="code-display">
<p>Go to:</p>
<p><a href="https://microsoft.com/devicelogin" target="_blank" style="font-size:18px">microsoft.com/devicelogin</a></p>
<p>Enter this code:</p>
<div class="user-code" id="user-code"></div>
<p>Waiting for you to complete sign-in<span class="spinner"></span></p>
<p style="color:#888;font-size:13px">After signing in, this page will update automatically. You can also close this and check back later.</p>
</div>
<div id="result" style="display:none;margin-top:20px;padding:16px;border-radius:8px"></div>
</div>
<script>
async function startAuth(){
  document.getElementById('auth-btn').disabled=true;
  document.getElementById('auth-btn').textContent='Starting...';
  try{
    const r=await fetch('/api/onedrive/auth',{method:'POST'});
    const d=await r.json();
    if(d.error){document.getElementById('result').style.display='block';document.getElementById('result').style.background='#b71c1c33';document.getElementById('result').textContent='Error: '+d.error;return}
    document.getElementById('user-code').textContent=d.user_code;
    document.getElementById('code-display').style.display='block';
    document.getElementById('auth-btn').style.display='none';
    pollStatus(d.expires_in);
  }catch(e){alert('Error: '+e.message)}
}
async function pollStatus(timeout){
  const end=Date.now()+timeout*1000;
  while(Date.now()<end){
    await new Promise(r=>setTimeout(r,5000));
    try{const r=await fetch('/api/onedrive/status');const d=await r.json();
    if(d.connected){document.getElementById('code-display').style.display='none';document.getElementById('result').style.display='block';document.getElementById('result').style.background='#1b5e20';document.getElementById('result').innerHTML='<b>Connected successfully!</b><br>You can close this page and refresh the app.';return}}catch{}
  }
}
</script></body></html>`);
  });

  app.post("/api/onedrive/auth", async (_req, res) => {
    try {
      const result = await startDeviceCodeFlow();
      pollDeviceCodeAuth(result.device_code, result.interval, result.expires_in)
        .then(success => {
          if (success) {
            console.log('[OneDrive Auth] Device code authentication completed successfully');
          } else {
            console.log('[OneDrive Auth] Device code authentication failed or expired');
          }
        })
        .catch(err => {
          console.error('[OneDrive Auth] Polling error:', err);
        });

      res.json({
        user_code: result.user_code,
        verification_uri: result.verification_uri,
        expires_in: result.expires_in,
      });
    } catch (err: any) {
      console.error('[OneDrive Auth] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============= ONEDRIVE ROUTES =============
  
  // GET /api/onedrive/files - List files in a OneDrive folder
  app.get("/api/onedrive/files", async (req, res) => {
    try {
      const path = (req.query.path as string) || '/';
      const items = await listOneDriveItems(path);
      res.json(items);
    } catch (err: any) {
      console.error("Error listing OneDrive files:", err);
      res.status(500).json({ error: err.message || "Failed to list OneDrive files" });
    }
  });

  app.get("/api/onedrive/validate-folder", async (req, res) => {
    try {
      const folderPath = req.query.path as string;
      if (!folderPath) return res.json({ valid: false, error: "No path provided" });
      const items = await listOneDriveItems(folderPath);
      res.json({ valid: true, folderCount: items.filter((i: any) => i.type === 'folder').length, fileCount: items.filter((i: any) => i.type === 'file').length });
    } catch (err: any) {
      res.json({ valid: false, error: err.message || "Folder not found" });
    }
  });

  app.get("/api/onedrive/browse-folders", async (req, res) => {
    try {
      const parentPath = (req.query.path as string) || '/';
      const items = await listOneDriveItems(parentPath);
      const folders = items
        .filter((i: any) => i.type === 'folder')
        .map((i: any) => ({ name: i.name, path: i.path }));
      res.json(folders);
    } catch (err: any) {
      console.error("Error browsing OneDrive folders:", err);
      res.status(500).json({ error: err.message || "Failed to browse folders" });
    }
  });

  // GET /api/onedrive/file/:id - Get file details and download URL
  app.get("/api/onedrive/file/:id", async (req, res) => {
    try {
      const itemId = req.params.id;
      const file = await getOneDriveFile(itemId);
      res.json(file);
    } catch (err: any) {
      console.error("Error getting OneDrive file:", err);
      res.status(500).json({ error: err.message || "Failed to get OneDrive file" });
    }
  });

  // GET /api/onedrive/search - Search for files
  app.get("/api/onedrive/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      const items = await searchOneDriveFiles(query);
      res.json(items);
    } catch (err: any) {
      console.error("Error searching OneDrive:", err);
      res.status(500).json({ error: err.message || "Failed to search OneDrive" });
    }
  });

  const QUICKNOTES_PATH = '/QuickNotes';
  const QUICKNOTES_DEFAULT_FILE = 'notes.txt';

  app.get("/api/quicknotes/debug", async (req, res) => {
    try {
      const path = (req.query.path as string) || QUICKNOTES_PATH;
      const items = await listOneDriveItems(path);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/quicknotes/files", async (_req, res) => {
    try {
      const items = await listOneDriveItems(QUICKNOTES_PATH);
      const notes = items.filter((f: any) => {
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html');
      });
      res.json(notes);
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === 'itemNotFound' || err.message?.includes('itemNotFound') || err.message?.includes('Resource not found')) {
        try {
          await createOneDriveFolder('/', 'QuickNotes');
          await createOneDriveTextFile(QUICKNOTES_PATH, QUICKNOTES_DEFAULT_FILE, 'Type your notes here from your phone using the OneDrive app.\nThis file syncs live to your dashboard.\n');
          const items = await listOneDriveItems(QUICKNOTES_PATH);
          const notes = items.filter((f: any) => {
            const name = (f.name || '').toLowerCase();
            return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html');
          });
          res.json(notes);
        } catch (createErr: any) {
          console.error("Error creating QuickNotes folder:", createErr);
          res.status(500).json({ error: createErr.message || "Failed to create QuickNotes folder" });
        }
      } else {
        console.error("Error listing QuickNotes:", err);
        res.status(500).json({ error: err.message || "Failed to list notes" });
      }
    }
  });

  app.get("/api/quicknotes/file/:id/content", async (req, res) => {
    try {
      const content = await getOneDriveFileContentAsText(req.params.id);
      res.json({ content });
    } catch (err: any) {
      console.error("Error getting QuickNotes content:", err);
      res.status(500).json({ error: err.message || "Failed to get note content" });
    }
  });

  app.get("/api/quicknotes/file/:id/meta", async (req, res) => {
    try {
      const meta = await getOneDriveFile(req.params.id);
      res.json(meta);
    } catch (err: any) {
      console.error("Error getting QuickNotes meta:", err);
      res.status(500).json({ error: err.message || "Failed to get note metadata" });
    }
  });

  app.put("/api/quicknotes/file/:id/content", async (req, res) => {
    try {
      const { content } = req.body;
      if (typeof content !== 'string') {
        return res.status(400).json({ error: "content field required" });
      }
      const result = await updateOneDriveFileContent(req.params.id, content);
      res.json(result);
    } catch (err: any) {
      console.error("Error saving QuickNotes content:", err);
      res.status(500).json({ error: err.message || "Failed to save note" });
    }
  });

  app.post("/api/quicknotes/files", async (req, res) => {
    try {
      const { name, content } = req.body;
      const fileName = name || `Note ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.txt`;
      const result = await createOneDriveTextFile(QUICKNOTES_PATH, fileName, content || '');
      res.json(result);
    } catch (err: any) {
      console.error("Error creating QuickNote:", err);
      res.status(500).json({ error: err.message || "Failed to create note" });
    }
  });

  app.patch("/api/quicknotes/file/:id/rename", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Name is required" });
      }
      const { renameOneDriveItem } = await import("../onedrive");
      await renameOneDriveItem(req.params.id, name);
      res.json({ success: true, name });
    } catch (err: any) {
      console.error("Error renaming QuickNote:", err);
      res.status(500).json({ error: err.message || "Failed to rename note" });
    }
  });

  app.delete("/api/quicknotes/file/:id", async (req, res) => {
    try {
      await deleteOneDriveItem(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting QuickNote:", err);
      res.status(500).json({ error: err.message || "Failed to delete note" });
    }
  });

  app.get("/api/quicknotes/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      if (!q.trim()) return res.json([]);
      const allFiles = await listOneDriveItems(QUICKNOTES_PATH);
      const textFiles = allFiles.filter((f: any) => {
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html');
      });
      const matching = textFiles.filter((f: any) => f.name.toLowerCase().includes(q.toLowerCase()));
      res.json(matching);
    } catch (err: any) {
      console.error("Error searching QuickNotes:", err);
      res.status(500).json({ error: err.message || "Failed to search notes" });
    }
  });

  app.post("/api/onenote/resolve-share-link", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL is required" });

      const https = await import("https");
      const http = await import("http");

      const resolveRedirects = (targetUrl: string, maxRedirects = 10): Promise<string> => {
        return new Promise((resolve, reject) => {
          if (maxRedirects <= 0) return resolve(targetUrl);
          const mod = targetUrl.startsWith("https") ? https : http;
          const req = mod.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              resolveRedirects(response.headers.location, maxRedirects - 1).then(resolve).catch(reject);
            } else {
              resolve(targetUrl);
            }
            response.resume();
          });
          req.on("error", reject);
          req.end();
        });
      };

      const resolvedUrl = await resolveRedirects(url);

      if (resolvedUrl.match(/onenote\.com/i)) {
        return res.json({ embedUrl: resolvedUrl, type: "onenote" });
      }

      if (resolvedUrl.includes('ithint=onenote') || resolvedUrl.includes('/:o:/')) {
        const residMatch = resolvedUrl.match(/[?&]resid=([^&]+)/i);
        if (residMatch) {
          const resid = decodeURIComponent(residMatch[1]);
          const authkeyMatch = resolvedUrl.match(/[?&]authkey=([^&]+)/i);
          const authkey = authkeyMatch ? decodeURIComponent(authkeyMatch[1]) : '';
          const embedUrl = `https://onedrive.live.com/embed?resid=${resid}&authkey=${authkey}&em=2&wdbipreview=true`;
          return res.json({ embedUrl, resolvedUrl, type: "onenote" });
        }
        return res.json({ embedUrl: resolvedUrl, type: "onenote" });
      }

      const oneDriveMatch = resolvedUrl.match(/onedrive\.live\.com.*[?&]id=([^&]+)/i);
      if (oneDriveMatch) {
        const resid = decodeURIComponent(oneDriveMatch[1]);
        const cidMatch = resolvedUrl.match(/[?&]cid=([^&]+)/i);
        const authkeyMatch = resolvedUrl.match(/[?&]authkey=([^&]+)/i);
        const cid = cidMatch ? decodeURIComponent(cidMatch[1]) : '';
        const authkey = authkeyMatch ? decodeURIComponent(authkeyMatch[1]) : '';
        const embedUrl = `https://onedrive.live.com/embed?cid=${cid}&resid=${resid}&authkey=${authkey}&em=2`;
        return res.json({ embedUrl, type: "onedrive" });
      }

      return res.json({ embedUrl: resolvedUrl, type: "unknown" });
    } catch (err: any) {
      console.error("Error resolving share link:", err);
      res.status(500).json({ error: err.message || "Failed to resolve share link" });
    }
  });

  app.get("/api/onenote/notebooks", async (req, res) => {
    try {
      const { listOneNoteNotebooks } = await import("../onedrive");
      const notebooks = await listOneNoteNotebooks();
      res.json(notebooks);
    } catch (err: any) {
      console.error("Error listing OneNote notebooks:", err);
      res.status(500).json({ error: err.message || "Failed to list notebooks" });
    }
  });

  app.get("/api/onenote/pages", async (req, res) => {
    try {
      const notebookPath = req.query.notebook as string;
      const section = req.query.section as string;
      const notebookName = req.query.notebookName as string;
      if (!section) {
        return res.status(400).json({ error: "section query param required" });
      }
      if (notebookName) {
        const { getOneNotePagesViaApi } = await import("../onedrive");
        const pages = await getOneNotePagesViaApi(notebookName, section);
        return res.json(pages);
      }
      if (!notebookPath) {
        return res.status(400).json({ error: "notebook or notebookName query param required" });
      }
      const { getOneNotePages } = await import("../onedrive");
      const pages = await getOneNotePages(notebookPath, section + '.one');
      res.json(pages);
    } catch (err: any) {
      console.error("Error getting OneNote pages:", err);
      res.status(500).json({ error: err.message || "Failed to get pages" });
    }
  });

  app.post("/api/onenote/pages", async (req, res) => {
    try {
      const { notebook, section, title, content } = req.body;
      if (!notebook || !section || !title) {
        return res.status(400).json({ error: "notebook, section, and title are required" });
      }
      const { createOneNotePage } = await import("../onedrive");
      const page = await createOneNotePage(notebook, section, title, content || '');
      if (page) {
        res.json({ success: true, page });
      } else {
        res.status(500).json({ error: "Failed to create page" });
      }
    } catch (err: any) {
      console.error("Error creating OneNote page:", err);
      res.status(500).json({ error: err.message || "Failed to create page" });
    }
  });

  app.delete("/api/onenote/page", async (req, res) => {
    try {
      const { notebook, section, title } = req.body;
      if (!notebook || !section || !title) {
        return res.status(400).json({ error: "notebook, section, and title are required" });
      }
      const { deleteOneNotePage } = await import("../onedrive");
      const deleted = await deleteOneNotePage(notebook, section, title);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Page not found in OneNote" });
      }
    } catch (err: any) {
      console.error("Error deleting OneNote page:", err);
      res.status(500).json({ error: err.message || "Failed to delete page" });
    }
  });

  app.get("/api/shared-notebook-links", async (req, res) => {
    try {
      const links = await storage.getSharedNotebookLinks();
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get shared notebook links" });
    }
  });

  app.post("/api/shared-notebook-links", async (req, res) => {
    try {
      const { name, url } = req.body;
      if (!name || !url) {
        return res.status(400).json({ error: "name and url are required" });
      }
      let notebookId: string | undefined;
      try {
        const resolved = await resolveSharedNotebookUrl(url);
        if (resolved) {
          notebookId = resolved.notebookId;
          console.log(`[SharedNotebook] Resolved "${name}" to notebook ID: ${notebookId}`);
        } else {
          console.log(`[SharedNotebook] Could not resolve "${name}" URL to a notebook ID — saving as link only`);
        }
      } catch (resolveErr: any) {
        console.log(`[SharedNotebook] Resolution failed for "${name}":`, resolveErr.message);
      }
      const link = await storage.createSharedNotebookLink({ name, url, notebookId });
      res.json(link);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create shared notebook link" });
    }
  });

  app.get("/api/onenote/sections/:sectionId/pages", async (req, res) => {
    try {
      const pages = await getPagesBySectionId(req.params.sectionId);
      res.json(pages);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get pages" });
    }
  });

  app.get("/api/shared-notebook-links/:id/sections", async (req, res) => {
    try {
      const links = await storage.getSharedNotebookLinks();
      const link = links.find(l => l.id === parseInt(req.params.id));
      if (!link) return res.status(404).json({ error: "Link not found" });
      if (!link.notebookId) return res.json([]);
      const sections = await getSharedNotebookSections(link.notebookId);
      res.json(sections);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get sections" });
    }
  });

  app.delete("/api/shared-notebook-links/:id", async (req, res) => {
    try {
      await storage.deleteSharedNotebookLink(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete shared notebook link" });
    }
  });

  app.post("/api/onedrive/ensure-semester-folders", async (req, res) => {
    try {
      const { semesterId } = req.body;
      let semester: any;
      if (semesterId) {
        const allSemesters = await storage.getAllSemesterSettings();
        semester = allSemesters.find((s: any) => s.id === semesterId);
      } else {
        semester = await storage.getActiveSemesterSettings();
      }
      if (!semester) return res.status(404).json({ error: "Semester not found" });

      const { createOneDriveFolder } = await import("../onedrive");
      const semType = getSemesterTypeFolder(semester.semesterType);
      const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
      const year = startDate.getFullYear();
      const basePath = `/School/1. TMU/Courses/${year}`;
      const semFolder = semType;

      await createOneDriveFolder(basePath, semFolder);
      const semPath = `${basePath}/${semFolder}`;

      const results: string[] = [];
      const isSpSu = (semester.semesterType || '').toLowerCase().includes('spring') || (semester.semesterType || '').toLowerCase().includes('summer');
      if (isSpSu) {
        await createOneDriveFolder(semPath, 'Full');
        await createOneDriveFolder(semPath, 'Spring - First Half');
        await createOneDriveFolder(semPath, 'Summer - Second Half');
      }

      for (let i = 1; i <= 3; i++) {
        const code = ((semester as any)[`course${i}Code`] || '').replace(/\s/g, '');
        if (!code) continue;
        const name = (semester as any)[`course${i}Name`] || '';
        const folderName = name ? `${code} - ${name}` : code;
        let courseParentPath = semPath;
        if (isSpSu) {
          const term = ((semester as any)[`course${i}SpringSummerTerm`] || 'full').toLowerCase();
          if (term === 'first_half') courseParentPath = `${semPath}/Spring - First Half`;
          else if (term === 'second_half') courseParentPath = `${semPath}/Summer - Second Half`;
          else courseParentPath = `${semPath}/Full`;
        }
        await createOneDriveFolder(courseParentPath, folderName);
        const coursePath = `${courseParentPath}/${folderName}`;

        const weekNames = generateWeekFolderNames(semester, i);
        for (const weekName of weekNames) {
          await createOneDriveFolder(coursePath, weekName);
          const weekPath = `${coursePath}/${weekName}`;
          await createOneDriveFolder(weekPath, "Module");
          await createOneDriveFolder(weekPath, "Reading");
        }
        results.push(`${folderName} (${weekNames.length} weeks)`);
      }

      console.log(`[OneDrive] Ensured semester folders for ${semester.semesterName}: ${results.join(', ')}`);
      res.json({ success: true, folders: results });
    } catch (err: any) {
      console.error("Error ensuring semester folders:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/rename-tbd-folder", async (req, res) => {
    try {
      const { semesterId, courseName, courseCode, springSummerTerm } = req.body;
      if (!courseName && !courseCode) {
        return res.status(400).json({ error: "Missing courseName or courseCode" });
      }

      let semester: any;
      if (semesterId) {
        const allSemesters = await storage.getAllSemesterSettings();
        semester = allSemesters.find((s: any) => s.id === semesterId);
      } else {
        semester = await storage.getActiveSemesterSettings();
      }
      if (!semester) return res.status(404).json({ error: "Semester not found" });

      const { listOneDriveFolderChildren, renameOneDriveItem, checkOneDriveFolderExists } = await import("../onedrive");
      const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
      const year = startDate.getFullYear();
      const basePath = `/School/1. TMU/Courses/${year}`;

      const semTypeVariants = (() => {
        const t = (semester.semesterType || 'winter').toLowerCase();
        if (t.includes('spring') || t.includes('summer')) return ['Spring-Summer', 'Spring-Summer', 'Spring_Summer'];
        if (t.includes('fall')) return ['Fall'];
        return ['Winter'];
      })();

      const term = (springSummerTerm || '').toLowerCase();
      const subFolderVariants: string[][] = [];
      if (term === 'first_half') subFolderVariants.push(['Spring - First Half', 'First Half', 'Spring']);
      else if (term === 'second_half') subFolderVariants.push(['Summer - Second Half', 'Second Half', 'Summer']);
      else if (term === 'full') subFolderVariants.push(['Full', 'Full Term']);

      let semPath = '';
      let children: any[] = [];
      for (const variant of semTypeVariants) {
        if (subFolderVariants.length > 0) {
          for (const sfGroup of subFolderVariants) {
            for (const sf of sfGroup) {
              const candidate = `${basePath}/${variant}/${sf}`;
              const exists = await checkOneDriveFolderExists(candidate);
              if (exists) {
                children = await listOneDriveFolderChildren(candidate);
                semPath = candidate;
                break;
              }
            }
            if (semPath) break;
          }
        } else {
          const candidate = `${basePath}/${variant}`;
          const exists = await checkOneDriveFolderExists(candidate);
          if (exists) {
            children = await listOneDriveFolderChildren(candidate);
            semPath = candidate;
            break;
          }
        }
        if (semPath) break;
      }

      if (!semPath) {
        console.log(`[OneDrive] No matching semester folder found for ${year}, type=${semester.semesterType}, term=${springSummerTerm}`);
        return res.json({ success: false, message: "Semester folder not found in OneDrive", triedVariants: semTypeVariants });
      }

      const tbd = children.find((c: any) => c.folder && /^TBD\d*(\s*-\s*.*)?$/i.test(c.name.trim()));

      if (!tbd) {
        return res.json({ success: false, message: "No TBD folder found", path: semPath, folders: children.map((c: any) => c.name) });
      }

      const code = (courseCode || '').replace(/\s/g, '');
      const newFolderName = courseName ? `${code} - ${courseName}` : code;

      try {
        await renameOneDriveItem(tbd.id, newFolderName);
      } catch (renameErr: any) {
        if (renameErr.message?.includes('Name already exists') || renameErr.statusCode === 409) {
          console.log(`[OneDrive] Folder "${newFolderName}" already exists in ${semPath}, skipping rename`);
          return res.json({ success: true, action: 'already_exists', folder: newFolderName, path: `${semPath}/${newFolderName}` });
        }
        throw renameErr;
      }
      console.log(`[OneDrive] Renamed TBD folder "${tbd.name}" → "${newFolderName}" in ${semPath}`);

      if (semester) {
        const codeNorm = code.toUpperCase();
        for (let i = 1; i <= 3; i++) {
          const slotCode = ((semester as any)[`course${i}Code`] || '').replace(/\s/g, '').toUpperCase();
          if (slotCode === codeNorm) {
            const prefix = `course${i}`;
            const updates: Record<string, any> = {};
            const modFolder = (semester as any)[`${prefix}ModuleFolder`] || '';
            const readFolder = (semester as any)[`${prefix}ReadingFolder`] || '';
            if (modFolder && modFolder.includes(`/${tbd.name}/`)) {
              updates[`${prefix}ModuleFolder`] = modFolder.replace(`/${tbd.name}/`, `/${newFolderName}/`);
            } else if (!modFolder) {
              updates[`${prefix}ModuleFolder`] = `${semPath}/${newFolderName}/Module`;
            }
            if (readFolder && readFolder.includes(`/${tbd.name}/`)) {
              updates[`${prefix}ReadingFolder`] = readFolder.replace(`/${tbd.name}/`, `/${newFolderName}/`);
            } else if (!readFolder) {
              updates[`${prefix}ReadingFolder`] = `${semPath}/${newFolderName}/Reading`;
            }
            if (courseName) {
              updates[`${prefix}Name`] = `${code} - ${courseName}`;
              const existingDN = ((semester as any)[`${prefix}DisplayName`] || '').trim();
              if (!existingDN || existingDN.startsWith('TBD')) {
                updates[`${prefix}DisplayName`] = courseName;
              }
            }
            if (Object.keys(updates).length > 0) {
              await storage.updateSemesterSettings(semester.id, updates);
              console.log(`[OneDrive] Updated folder paths for slot ${i}:`, updates);
            }
            syncDegreeTrackingFromDb().catch(() => {});
            break;
          }
        }
      }

      res.json({ success: true, from: tbd.name, to: newFolderName, path: `${semPath}/${newFolderName}` });
    } catch (err: any) {
      console.error("Error renaming TBD folder:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/revert-course-folder", async (req, res) => {
    try {
      const { semesterId, courseCode, courseName, springSummerTerm, slotNumber } = req.body;
      if (!courseCode) {
        return res.status(400).json({ error: "Missing courseCode" });
      }

      let semester: any;
      if (semesterId) {
        const allSemesters = await storage.getAllSemesterSettings();
        semester = allSemesters.find((s: any) => s.id === semesterId);
      }
      if (!semester) {
        semester = await storage.getActiveSemesterSettings();
      }
      if (!semester) return res.status(404).json({ error: "Semester not found" });

      const { renameOneDriveItem, checkOneDriveFolderExists, listOneDriveFolderChildren } = await import("../onedrive");

      const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
      const year = startDate.getFullYear();
      const basePath = `/School/1. TMU/Courses/${year}`;

      const semTypeVariants = (() => {
        const t = (semester.semesterType || 'winter').toLowerCase();
        if (t.includes('spring') || t.includes('summer')) return ['Spring-Summer', 'Spring-Summer', 'Spring_Summer'];
        if (t.includes('fall')) return ['Fall'];
        return ['Winter'];
      })();

      const term = (springSummerTerm || '').toLowerCase();
      const subFolderVariants: string[][] = [];
      if (term === 'first_half') subFolderVariants.push(['Spring - First Half', 'First Half', 'Spring']);
      else if (term === 'second_half') subFolderVariants.push(['Summer - Second Half', 'Second Half', 'Summer']);
      else if (term === 'full') subFolderVariants.push(['Full', 'Full Term']);

      let semPath = '';
      let children: any[] = [];
      for (const variant of semTypeVariants) {
        if (subFolderVariants.length > 0) {
          for (const sfGroup of subFolderVariants) {
            for (const sf of sfGroup) {
              const candidate = `${basePath}/${variant}/${sf}`;
              const exists = await checkOneDriveFolderExists(candidate);
              if (exists) {
                children = await listOneDriveFolderChildren(candidate);
                semPath = candidate;
                break;
              }
            }
            if (semPath) break;
          }
        } else {
          const candidate = `${basePath}/${variant}`;
          const exists = await checkOneDriveFolderExists(candidate);
          if (exists) {
            children = await listOneDriveFolderChildren(candidate);
            semPath = candidate;
            break;
          }
        }
        if (semPath) break;
      }

      if (!semPath) {
        return res.json({ success: false, message: "Semester folder not found in OneDrive" });
      }

      const code = (courseCode || '').replace(/\s/g, '');
      const folderName = courseName ? `${code} - ${courseName}` : code;

      const courseFolder = children.find((c: any) => c.folder && c.name === folderName);
      if (!courseFolder) {
        return res.json({ success: false, message: `Course folder "${folderName}" not found`, path: semPath });
      }

      const slot = slotNumber || 1;
      const existingTbdNums = children
        .filter((c: any) => c.folder && /^TBD\d+/i.test(c.name))
        .map((c: any) => {
          const m = c.name.match(/^TBD(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        });

      let tbdNum = slot;
      while (existingTbdNums.includes(tbdNum)) {
        tbdNum++;
      }
      const revertName = `TBD${tbdNum}`;

      try {
        await renameOneDriveItem(courseFolder.id, revertName);
      } catch (renameErr: any) {
        if (renameErr.message?.includes('Name already exists') || renameErr.statusCode === 409) {
          return res.json({ success: true, action: 'already_exists', folder: revertName });
        }
        throw renameErr;
      }

      console.log(`[OneDrive] Reverted course folder "${folderName}" → "${revertName}" in ${semPath}`);

      if (semester) {
        for (let i = 1; i <= 3; i++) {
          const slotCode = ((semester as any)[`course${i}Code`] || '').replace(/\s/g, '').toUpperCase();
          if (slotCode === code.toUpperCase()) {
            const prefix = `course${i}`;
            const updates: Record<string, any> = {};
            const modFolder = (semester as any)[`${prefix}ModuleFolder`] || '';
            const readFolder = (semester as any)[`${prefix}ReadingFolder`] || '';
            if (modFolder && modFolder.includes(`/${folderName}/`)) {
              updates[`${prefix}ModuleFolder`] = modFolder.replace(`/${folderName}/`, `/${revertName}/`);
            }
            if (readFolder && readFolder.includes(`/${folderName}/`)) {
              updates[`${prefix}ReadingFolder`] = readFolder.replace(`/${folderName}/`, `/${revertName}/`);
            }
            updates[`${prefix}Code`] = `TBD${tbdNum}`;
            updates[`${prefix}Name`] = `TBD${tbdNum}`;
            updates[`${prefix}DisplayName`] = `TBD${tbdNum}`;
            if (Object.keys(updates).length > 0) {
              await storage.updateSemesterSettings(semester.id, updates);
            }
            syncDegreeTrackingFromDb().catch(() => {});
            break;
          }
        }
      }

      res.json({ success: true, from: folderName, to: revertName, path: `${semPath}/${revertName}` });
    } catch (err: any) {
      console.error("Error reverting course folder:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/rename-course-folder", async (req, res) => {
    try {
      const { semesterId, courseIndex, oldCode, oldName, newCode, newName } = req.body;
      if (!courseIndex || (!newCode && !newName)) {
        return res.status(400).json({ error: "Missing courseIndex, newCode, or newName" });
      }

      let semester: any;
      if (semesterId) {
        const allSemesters = await storage.getAllSemesterSettings();
        semester = allSemesters.find((s: any) => s.id === semesterId);
      } else {
        semester = await storage.getActiveSemesterSettings();
      }
      if (!semester) return res.status(404).json({ error: "Semester not found" });

      const { renameOneDriveFolder, createOneDriveFolder, checkOneDriveFolderExists } = await import("../onedrive");
      const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
      const year = startDate.getFullYear();
      const isSpSuRename = (semester.semesterType || '').toLowerCase().includes('spring') || (semester.semesterType || '').toLowerCase().includes('summer');
      const semFolderVariants = (() => {
        const t = (semester.semesterType || 'winter').toLowerCase();
        if (t.includes('spring') || t.includes('summer')) return ['Spring-Summer', 'Spring-Summer', 'Spring_Summer', 'Spring Summer'];
        if (t.includes('fall')) return ['Fall'];
        return ['Winter'];
      })();
      let semPath = `/School/1. TMU/Courses/${year}/${semFolderVariants[0]}`;
      for (const variant of semFolderVariants) {
        const tryPath = `/School/1. TMU/Courses/${year}/${variant}`;
        if (await checkOneDriveFolderExists(tryPath)) { semPath = tryPath; break; }
      }

      const effectiveOldCode = (oldCode || '').replace(/\s/g, '');
      const effectiveNewCode = (newCode || '').replace(/\s/g, '');
      const oldFolderName = buildCourseFolderName(effectiveOldCode, oldName || '');
      const newFolderName = buildCourseFolderName(effectiveNewCode, newName || '');

      if (oldFolderName === newFolderName) {
        return res.json({ success: true, action: 'no_change' });
      }

      let searchPath = semPath;
      if (isSpSuRename && courseIndex) {
        const spsuTerm = ((semester as any)[`course${courseIndex}SpringSummerTerm`] || 'full').toLowerCase();
        const termFolders: Record<string, string[]> = {
          'full': ['Full', 'Full Term'],
          'first_half': ['Spring - First Half', 'First Half', 'Spring'],
          'second_half': ['Summer - Second Half', 'Second Half', 'Summer'],
        };
        for (const tf of (termFolders[spsuTerm] || ['Full'])) {
          const tryPath = `${semPath}/${tf}`;
          if (await checkOneDriveFolderExists(tryPath)) { searchPath = tryPath; break; }
        }
      }
      const oldPath = `${searchPath}/${oldFolderName}`;
      const oldExists = await checkOneDriveFolderExists(oldPath);

      if (oldExists) {
        const result = await renameOneDriveFolder(oldPath, newFolderName);
        console.log(`[OneDrive] Renamed folder: ${oldFolderName} → ${newFolderName}: ${JSON.stringify(result)}`);
        res.json({ success: true, action: 'renamed', from: oldFolderName, to: newFolderName, ...result });
      } else {
        await createOneDriveFolder(searchPath, newFolderName);
        const coursePath = `${searchPath}/${newFolderName}`;
        const weekNames = generateWeekFolderNames(semester, courseIndex);
        for (const weekName of weekNames) {
          await createOneDriveFolder(coursePath, weekName);
          const weekPath = `${coursePath}/${weekName}`;
          await createOneDriveFolder(weekPath, "Module");
          await createOneDriveFolder(weekPath, "Reading");
        }
        console.log(`[OneDrive] Created new folder structure: ${newFolderName} (${weekNames.length} weeks, old '${oldFolderName}' not found)`);
        res.json({ success: true, action: 'created', folder: newFolderName, weeks: weekNames.length });
      }
    } catch (err: any) {
      console.error("Error renaming course folder:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/create-semester-folders", async (req, res) => {
    try {
      const { semesterName, semesterFolder, year, courses, numWeeks } = req.body;
      if (!semesterFolder || !year || !courses || !numWeeks) {
        return res.status(400).json({ error: "Missing required fields: semesterFolder, year, courses, numWeeks" });
      }

      const basePath = `/School/1. TMU/Courses/${year}`;
      const results: any[] = [];

      const semFolderResult = await createOneDriveFolder(basePath, semesterFolder);
      results.push({ path: `${basePath}/${semesterFolder}`, ...semFolderResult });
      const semPath = `${basePath}/${semesterFolder}`;

      const semester = await storage.getActiveSemesterSettings();
      for (let ci = 0; ci < courses.length; ci++) {
        const course = courses[ci];
        const courseFolderName = buildCourseFolderName(course.code, course.name);
        const courseResult = await createOneDriveFolder(semPath, courseFolderName);
        results.push({ path: `${semPath}/${courseFolderName}`, ...courseResult });
        const coursePath = `${semPath}/${courseFolderName}`;

        const weekNames = semester ? generateWeekFolderNames(semester, ci + 1) : Array.from({ length: numWeeks }, (_, i) => `Week ${i + 1}`);
        for (const weekFolderName of weekNames) {
          const weekResult = await createOneDriveFolder(coursePath, weekFolderName);
          results.push({ path: `${coursePath}/${weekFolderName}`, ...weekResult });
          const weekPath = `${coursePath}/${weekFolderName}`;

          const moduleResult = await createOneDriveFolder(weekPath, "Module");
          results.push({ path: `${weekPath}/Module`, ...moduleResult });

          const readingResult = await createOneDriveFolder(weekPath, "Reading");
          results.push({ path: `${weekPath}/Reading`, ...readingResult });
        }
      }

      const created = results.filter(r => r.created).length;
      const existed = results.filter(r => r.exists).length;
      console.log(`[OneDrive] Created ${created} folders, ${existed} already existed for ${semesterName || semesterFolder}`);
      res.json({ success: true, created, existed, total: results.length, details: results });
    } catch (err: any) {
      console.error("Error creating semester folders:", err);
      res.status(500).json({ error: err.message || "Failed to create semester folders" });
    }
  });

  app.post("/api/onedrive/cleanup-duplicate-folders", async (req, res) => {
    try {
      const { listOneDriveFolderChildren, moveOneDriveItem, getOneDriveItemId, deleteOneDriveItem } = await import("../onedrive");
      const semester = await storage.getActiveSemesterSettings();
      if (!semester) return res.json({ message: "No active semester" });

      const year = semester.semesterYear || new Date().getFullYear();
      const cleanupSemVariants = (() => {
        const t = (semester.semesterType || 'winter').toLowerCase();
        if (t.includes('spring') || t.includes('summer')) return ['Spring-Summer', 'Spring-Summer', 'Spring_Summer', 'Spring Summer'];
        if (t.includes('fall')) return ['Fall'];
        return ['Winter'];
      })();
      let semBasePath = `/School/1. TMU/Courses/${year}/${cleanupSemVariants[0]}`;
      let semChildren: any[] = [];
      for (const v of cleanupSemVariants) {
        const tryPath = `/School/1. TMU/Courses/${year}/${v}`;
        try {
          semChildren = await listOneDriveFolderChildren(tryPath);
          semBasePath = tryPath;
          break;
        } catch {}
      }
      const folders = (semChildren || []).filter((f: any) => f.folder);

      const courseCodesInSem: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const code = semester[`course${i}Code` as keyof typeof semester];
        if (code) courseCodesInSem.push(String(code).toUpperCase());
      }

      const cleaned: string[] = [];
      for (const courseCode of courseCodesInSem) {
        const matching = folders.filter((f: any) => f.name.toUpperCase().startsWith(courseCode));
        if (matching.length <= 1) continue;

        const sorted = matching.sort((a: any, b: any) => a.name.length - b.name.length);
        const correctFolder = sorted[0];
        const duplicates = sorted.slice(1);

        for (const dup of duplicates) {
          const dupChildren = await listOneDriveFolderChildren(`${semBasePath}/${dup.name}`);
          for (const child of dupChildren) {
            const correctFolderChildren = await listOneDriveFolderChildren(`${semBasePath}/${correctFolder.name}`);
            const existsInCorrect = correctFolderChildren.some((c: any) => c.name === child.name);

            if (child.folder && existsInCorrect) {
              const subChildren = await listOneDriveFolderChildren(`${semBasePath}/${dup.name}/${child.name}`);
              if (subChildren.length === 0) {
                try {
                  await deleteOneDriveItem(child.id);
                  cleaned.push(`Deleted empty subfolder: ${dup.name}/${child.name}`);
                } catch (e: any) {
                  cleaned.push(`Failed to delete empty subfolder ${child.name}: ${e.message}`);
                }
              } else {
                const correctSubId = await getOneDriveItemId(`${semBasePath}/${correctFolder.name}/${child.name}`);
                if (correctSubId) {
                  for (const subChild of subChildren) {
                    try {
                      await moveOneDriveItem(subChild.id, correctSubId);
                      cleaned.push(`Moved ${dup.name}/${child.name}/${subChild.name} -> ${correctFolder.name}/${child.name}/`);
                    } catch (e: any) {
                      cleaned.push(`Failed to move ${subChild.name}: ${e.message}`);
                    }
                  }
                }
              }
            } else if (child.folder && !existsInCorrect) {
              try {
                await moveOneDriveItem(child.id, correctFolder.id);
                cleaned.push(`Moved folder ${dup.name}/${child.name} -> ${correctFolder.name}/`);
              } catch (e: any) {
                cleaned.push(`Failed to move folder ${child.name}: ${e.message}`);
              }
            } else {
              try {
                await moveOneDriveItem(child.id, correctFolder.id);
                cleaned.push(`Moved ${dup.name}/${child.name} -> ${correctFolder.name}/`);
              } catch (e: any) {
                cleaned.push(`Failed to move ${child.name}: ${e.message}`);
              }
            }
          }

          const remainingChildren = await listOneDriveFolderChildren(`${semBasePath}/${dup.name}`);
          if (remainingChildren.length === 0) {
            try {
              await deleteOneDriveItem(dup.id);
              cleaned.push(`Deleted empty duplicate folder: ${dup.name}`);
            } catch (e: any) {
              cleaned.push(`Failed to delete ${dup.name}: ${e.message}`);
            }
          } else {
            cleaned.push(`Duplicate folder ${dup.name} still has ${remainingChildren.length} items`);
          }
        }
      }

      res.json({ cleaned });
    } catch (error: any) {
      console.error("Cleanup duplicate folders error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/onedrive/upload-monthly-report", async (req, res) => {
    try {
      const { fileName, pdfBase64, year } = req.body || {};
      if (!fileName || !pdfBase64 || !year) {
        return res.status(400).json({ error: "fileName, pdfBase64 and year are required" });
      }
      const buf = Buffer.from(pdfBase64, "base64");
      const basePath = "/School/1. TMU/Administrative/Monthly Reports";
      const yearPath = `${basePath}/${year}`;
      const { uploadOneDriveFile, createOneDriveFolder } = await import("../onedrive");
      // Make sure parent folders exist (no-op if already present).
      try { await createOneDriveFolder("/School/1. TMU/Administrative", "Monthly Reports"); } catch {}
      try { await createOneDriveFolder(basePath, String(year)); } catch {}
      const result = await uploadOneDriveFile(yearPath, fileName, buf, "application/pdf");
      console.log(`[MonthlyReport] OneDrive upload: ${fileName} -> ${yearPath}`);
      res.json({ ok: true, path: `${yearPath}/${fileName}`, item: result });
    } catch (error: any) {
      console.error("Monthly report OneDrive upload error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/onedrive/ensure-all-semester-folders", async (req, res) => {
    try {
      const allSemesters = await storage.getAllSemesterSettings();

      const { createOneDriveFolder } = await import("../onedrive");
      const allResults: Array<{ semester: string; folders: string[] }> = [];

      if (allSemesters && allSemesters.length > 0) {
        for (const semester of allSemesters) {
          const semType = getSemesterTypeFolder(semester.semesterType);
          const startDate = semester.semesterStartDate ? new Date(semester.semesterStartDate) : new Date();
          const year = startDate.getFullYear();
          const basePath = `/School/1. TMU/Courses/${year}`;

          await createOneDriveFolder(basePath, semType);
          const semPath = `${basePath}/${semType}`;
          const courseResults: string[] = [];
          const isSpSuAll = (semester.semesterType || '').toLowerCase().includes('spring') || (semester.semesterType || '').toLowerCase().includes('summer');
          if (isSpSuAll) {
            await createOneDriveFolder(semPath, 'Full');
            await createOneDriveFolder(semPath, 'Spring - First Half');
            await createOneDriveFolder(semPath, 'Summer - Second Half');
          }

          for (let i = 1; i <= 3; i++) {
            const code = ((semester as any)[`course${i}Code`] || '').replace(/\s/g, '');
            if (!code) continue;
            const name = (semester as any)[`course${i}Name`] || '';
            const folderName = name ? `${code} - ${name}` : code;
            let courseParentPathAll = semPath;
            if (isSpSuAll) {
              const termAll = ((semester as any)[`course${i}SpringSummerTerm`] || 'full').toLowerCase();
              if (termAll === 'first_half') courseParentPathAll = `${semPath}/Spring - First Half`;
              else if (termAll === 'second_half') courseParentPathAll = `${semPath}/Summer - Second Half`;
              else courseParentPathAll = `${semPath}/Full`;
            }
            await createOneDriveFolder(courseParentPathAll, folderName);
            const coursePath = `${courseParentPathAll}/${folderName}`;

            const weekNames = generateWeekFolderNames(semester, i);
            for (const weekName of weekNames) {
              await createOneDriveFolder(coursePath, weekName);
              const weekPath = `${coursePath}/${weekName}`;
              await createOneDriveFolder(weekPath, "Module");
              await createOneDriveFolder(weekPath, "Reading");
            }
            courseResults.push(`${folderName} (${weekNames.length} weeks)`);
          }

          allResults.push({ semester: semester.semesterName || `${semType} ${year}`, folders: courseResults });
          console.log(`[OneDrive] Ensured folders for ${semester.semesterName}: ${courseResults.join(', ')}`);
        }
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const semesterTypes = ['Winter', 'Spring-Summer', 'Fall'];
      const existingKeys = new Set(
        (allSemesters || []).map((s: any) => {
          const semType = getSemesterTypeFolder(s.semesterType);
          const year = s.semesterStartDate ? new Date(s.semesterStartDate).getFullYear() : currentYear;
          return `${year}/${semType}`;
        })
      );

      const placeholderResults: string[] = [];
      for (let year = currentYear; year <= currentYear + 2; year++) {
        const yearPath = `/School/1. TMU/Courses/${year}`;
        try {
          await createOneDriveFolder('/School/1. TMU/Courses', String(year));
        } catch (e: any) {
          console.log(`[OneDrive] Year folder ${year}: ${e.message}`);
        }
        for (const semType of semesterTypes) {
          const key = `${year}/${semType}`;
          if (existingKeys.has(key)) continue;
          try {
            await createOneDriveFolder(yearPath, semType);
            placeholderResults.push(`${year}/${semType}`);
            console.log(`[OneDrive] Created placeholder folder: ${year}/${semType}`);
          } catch (e: any) {
            console.log(`[OneDrive] Placeholder ${year}/${semType}: ${e.message}`);
          }
        }
      }

      res.json({ success: true, semesters: allResults, placeholders: placeholderResults });
    } catch (err: any) {
      console.error("Error ensuring all semester folders:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/ensure-placeholder-folders", async (req, res) => {
    try {
      const allSemesters = await storage.getAllSemesterSettings();
      const { createOneDriveFolder } = await import("../onedrive");

      const now = new Date();
      const currentYear = now.getFullYear();
      const semesterTypes = ['Winter', 'Spring-Summer', 'Fall'];
      const existingKeys = new Set(
        (allSemesters || []).map((s: any) => {
          const semType = getSemesterTypeFolder(s.semesterType);
          const year = s.semesterStartDate ? new Date(s.semesterStartDate).getFullYear() : currentYear;
          return `${year}/${semType}`;
        })
      );

      const placeholderResults: string[] = [];
      for (let year = currentYear; year <= currentYear + 2; year++) {
        const yearPath = `/School/1. TMU/Courses/${year}`;
        try {
          await createOneDriveFolder('/School/1. TMU/Courses', String(year));
        } catch (e: any) {
          // ignore if year folder already exists
        }
        for (const semType of semesterTypes) {
          const key = `${year}/${semType}`;
          if (existingKeys.has(key)) continue;
          try {
            await createOneDriveFolder(yearPath, semType);
            placeholderResults.push(`${year}/${semType}`);
            console.log(`[OneDrive] Created placeholder folder: ${year}/${semType}`);
          } catch (e: any) {
            // ignore if folder already exists
          }
        }
      }

      res.json({ success: true, placeholders: placeholderResults });
    } catch (err: any) {
      console.error("Error ensuring placeholder folders:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onedrive/rename-week-folders", async (req, res) => {
    try {
      const { courseCode, courseName, weekStyle } = req.body;
      if (!courseCode || !weekStyle) {
        return res.status(400).json({ error: "courseCode and weekStyle are required" });
      }

      const allSemesters = await storage.getAllSemesterSettings();
      console.log(`[rename-week-folders] Looking for courseCode="${courseCode}", found ${(allSemesters || []).length} semesters`);
      for (const sem of allSemesters || []) {
        for (let ci = 1; ci <= 3; ci++) {
          const c = sem[`course${ci}Code` as keyof typeof sem];
          if (c) console.log(`[rename-week-folders] sem ${(sem as any).id}: course${ci}Code="${c}"`);
        }
      }
      const { listOneDriveFolderChildren, renameOneDriveItem } = await import("../onedrive");

      let targetSemester: any = null;
      let courseIndex = -1;
      for (const sem of allSemesters || []) {
        for (let i = 1; i <= 3; i++) {
          const code = sem[`course${i}Code` as keyof typeof sem];
          if (code && String(code).replace(/\s/g, '').toLowerCase() === courseCode.replace(/\s/g, '').toLowerCase()) {
            targetSemester = sem;
            courseIndex = i;
            break;
          }
        }
        if (targetSemester) break;
      }

      if (!targetSemester || courseIndex < 0) {
        return res.status(404).json({ error: "Course not found in any semester" });
      }

      const renameWeekSemVariants = (() => {
        const t = (targetSemester.semesterType || 'winter').toLowerCase();
        if (t.includes('spring') || t.includes('summer')) return ['Spring-Summer', 'Spring-Summer', 'Spring_Summer', 'Spring Summer'];
        if (t.includes('fall')) return ['Fall'];
        return ['Winter'];
      })();
      const year = targetSemester.semesterStartDate
        ? new Date(targetSemester.semesterStartDate).getFullYear()
        : new Date().getFullYear();
      const cName = targetSemester[`course${courseIndex}Name` as keyof typeof targetSemester] || courseName || courseCode;
      const cCode = String(targetSemester[`course${courseIndex}Code` as keyof typeof targetSemester] || courseCode);
      const courseFolderName = buildCourseFolderName(cCode, String(cName));
      let courseFolderPath = '';
      for (const v of renameWeekSemVariants) {
        const tryPath = `/School/1. TMU/Courses/${year}/${v}/${courseFolderName}`;
        try {
          await listOneDriveFolderChildren(tryPath);
          courseFolderPath = tryPath;
          break;
        } catch {}
      }
      if (!courseFolderPath) {
        courseFolderPath = `/School/1. TMU/Courses/${year}/${renameWeekSemVariants[0]}/${courseFolderName}`;
      }

      const children = await listOneDriveFolderChildren(courseFolderPath);
      const weekFolders = (children || []).filter((c: any) =>
        c.folder && (c.name.startsWith("Week ") || c.name.startsWith("Reading Week"))
      ).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      if (weekFolders.length === 0) {
        return res.json({ success: true, message: "No week folders found to rename.", renamed: 0 });
      }

      const newNames = generateWeekFolderNames(targetSemester, courseIndex);
      let renamedCount = 0;

      for (let i = 0; i < weekFolders.length && i < newNames.length; i++) {
        const folder = weekFolders[i];
        const newName = newNames[i];
        if (folder.name !== newName) {
          try {
            await renameOneDriveItem(folder.id, newName);
            renamedCount++;
            console.log(`[OneDrive] Renamed "${folder.name}" → "${newName}"`);
          } catch (e: any) {
            console.error(`[OneDrive] Failed to rename "${folder.name}":`, e.message);
          }
        }
      }

      res.json({ success: true, message: `Renamed ${renamedCount} week folders to "${weekStyle}" style.`, renamed: renamedCount });
    } catch (err: any) {
      console.error("Rename week folders error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============= END ONEDRIVE ROUTES =============

}
