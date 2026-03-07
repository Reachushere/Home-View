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
