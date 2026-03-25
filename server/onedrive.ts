// OneDrive integration for browsing and accessing PDF files
import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=onedrive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('OneDrive not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getOneDriveClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

// List files/folders in a directory
export async function listOneDriveItems(path: string = '/') {
  const client = await getOneDriveClient();
  
  try {
    let response;
    if (path === '/' || path === '') {
      // List root folder contents
      response = await client.api('/me/drive/root/children').get();
    } else {
      // List specific folder contents
      response = await client.api(`/me/drive/root:${path}:/children`).get();
    }
    
    return response.value.map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.folder ? 'folder' : 'file',
      mimeType: item.file?.mimeType,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
      path: item.parentReference?.path ? 
        item.parentReference.path.replace('/drive/root:', '') + '/' + item.name : 
        '/' + item.name
    }));
  } catch (error: any) {
    console.error('Error listing OneDrive items:', error);
    throw error;
  }
}

// Get file content/download URL
export async function getOneDriveFile(itemId: string) {
  const client = await getOneDriveClient();
  
  try {
    const item = await client.api(`/me/drive/items/${itemId}`).get();
    return {
      id: item.id,
      name: item.name,
      mimeType: item.file?.mimeType,
      size: item.size,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
      webUrl: item.webUrl
    };
  } catch (error: any) {
    console.error('Error getting OneDrive file:', error);
    throw error;
  }
}

// Get file content as stream
export async function getOneDriveFileContent(itemId: string) {
  const client = await getOneDriveClient();
  
  try {
    const content = await client.api(`/me/drive/items/${itemId}/content`).get();
    return content;
  } catch (error: any) {
    console.error('Error getting OneDrive file content:', error);
    throw error;
  }
}

export async function createOneDriveFolder(parentPath: string, folderName: string): Promise<any> {
  const client = await getOneDriveClient();
  try {
    const apiPath = (!parentPath || parentPath === '/')
      ? '/me/drive/root/children'
      : `/me/drive/root:${parentPath}:/children`;
    const response = await client.api(apiPath).post({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail'
    });
    return { id: response.id, name: response.name, created: true };
  } catch (error: any) {
    if (error.statusCode === 409 || error.code === 'nameAlreadyExists') {
      return { name: folderName, created: false, exists: true };
    }
    console.error(`Error creating folder "${folderName}" in "${parentPath}":`, error.message || error);
    throw error;
  }
}

export async function renameOneDriveFolder(folderPath: string, newName: string): Promise<{ renamed: boolean; error?: string }> {
  const client = await getOneDriveClient();
  try {
    const encodedPath = encodeURIComponent(folderPath).replace(/%2F/g, '/');
    await client.api(`/me/drive/root:${encodedPath}`).patch({ name: newName });
    return { renamed: true };
  } catch (error: any) {
    if (error.statusCode === 404) {
      return { renamed: false, error: 'Folder not found' };
    }
    console.error(`Error renaming folder "${folderPath}" to "${newName}":`, error.message || error);
    return { renamed: false, error: error.message };
  }
}

export async function checkOneDriveFolderExists(folderPath: string): Promise<boolean> {
  const client = await getOneDriveClient();
  try {
    const encodedPath = encodeURIComponent(folderPath).replace(/%2F/g, '/');
    await client.api(`/me/drive/root:${encodedPath}`).get();
    return true;
  } catch {
    return false;
  }
}

export async function listOneDriveFolderChildren(folderPath: string): Promise<any[]> {
  const client = await getOneDriveClient();
  try {
    const encodedPath = encodeURIComponent(folderPath).replace(/%2F/g, '/');
    const response = await client.api(`/me/drive/root:${encodedPath}:/children`).get();
    return (response.value || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      folder: !!item.folder,
    }));
  } catch (error: any) {
    console.error(`Error listing children of "${folderPath}":`, error.message || error);
    return [];
  }
}

export async function renameOneDriveItem(itemId: string, newName: string): Promise<void> {
  const client = await getOneDriveClient();
  await client.api(`/me/drive/items/${itemId}`).patch({ name: newName });
}

export async function getOneDriveFileContentAsText(itemId: string): Promise<string> {
  const client = await getOneDriveClient();
  try {
    const response = await client.api(`/me/drive/items/${itemId}/content`).get();
    if (typeof response === 'string') return response;
    if (response instanceof ArrayBuffer || response instanceof Buffer) {
      return Buffer.from(response).toString('utf-8');
    }
    if (response && typeof response.text === 'function') {
      return await response.text();
    }
    if (response && response.body && typeof response.body.read === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of response.body) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
    }
    return String(response);
  } catch (error: any) {
    console.error('Error getting OneDrive file content as text:', error.message || error);
    throw error;
  }
}

export async function getOneDriveItemByPath(path: string): Promise<any> {
  const client = await getOneDriveClient();
  try {
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
    const item = await client.api(`/me/drive/root:${encodedPath}`).get();
    return {
      id: item.id,
      name: item.name,
      mimeType: item.file?.mimeType,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
      webUrl: item.webUrl,
    };
  } catch (error: any) {
    console.error(`Error getting OneDrive item at path "${path}":`, error.message || error);
    throw error;
  }
}

export async function createOneDriveTextFile(parentPath: string, fileName: string, content: string): Promise<any> {
  const client = await getOneDriveClient();
  try {
    const encodedPath = encodeURIComponent(`${parentPath}/${fileName}`).replace(/%2F/g, '/');
    const response = await client.api(`/me/drive/root:${encodedPath}:/content`)
      .header('Content-Type', 'text/plain')
      .put(content);
    return {
      id: response.id,
      name: response.name,
      lastModified: response.lastModifiedDateTime,
      webUrl: response.webUrl,
    };
  } catch (error: any) {
    console.error(`Error creating text file "${fileName}":`, error.message || error);
    throw error;
  }
}

export async function updateOneDriveFileContent(itemId: string, content: string): Promise<any> {
  const client = await getOneDriveClient();
  try {
    const response = await client.api(`/me/drive/items/${itemId}/content`)
      .header('Content-Type', 'text/plain')
      .put(content);
    return {
      id: response.id,
      name: response.name,
      lastModified: response.lastModifiedDateTime,
      webUrl: response.webUrl,
    };
  } catch (error: any) {
    console.error(`Error updating file content:`, error.message || error);
    throw error;
  }
}

// Search for files
export async function searchOneDriveFiles(query: string) {
  const client = await getOneDriveClient();
  
  try {
    const response = await client.api(`/me/drive/root/search(q='${query}')`).get();
    
    return response.value.map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.folder ? 'folder' : 'file',
      mimeType: item.file?.mimeType,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
      path: item.parentReference?.path ? 
        item.parentReference.path.replace('/drive/root:', '') + '/' + item.name : 
        '/' + item.name
    }));
  } catch (error: any) {
    console.error('Error searching OneDrive:', error);
    throw error;
  }
}
