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

export async function uploadOneDriveFile(parentPath: string, fileName: string, fileBuffer: Buffer, contentType: string = 'application/pdf'): Promise<any> {
  const accessToken = await getAccessToken();
  try {
    const fullPath = `${parentPath}/${fileName}`;
    const encodedPath = encodeURIComponent(fullPath).replace(/%2F/g, '/');
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}:/content`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: fileBuffer,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OneDrive upload failed (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      lastModified: data.lastModifiedDateTime,
      webUrl: data.webUrl,
      size: data.size,
    };
  } catch (error: any) {
    console.error(`Error uploading file "${fileName}" to "${parentPath}":`, error.message || error);
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

export async function deleteOneDriveItem(itemId: string): Promise<void> {
  const client = await getOneDriveClient();
  try {
    await client.api(`/me/drive/items/${itemId}`).delete();
  } catch (error: any) {
    console.error(`Error deleting OneDrive item:`, error.message || error);
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

function extractUTF16Strings(data: Uint8Array, minLength = 3) {
  const results: { text: string; pos: number }[] = [];
  let current = '';
  let startPos = -1;

  for (let i = 0; i < data.length - 1; i += 2) {
    const ch = data[i] | (data[i + 1] << 8);
    if (ch >= 32 && ch < 127) {
      if (current === '') startPos = i;
      current += String.fromCharCode(ch);
    } else if (ch === 10 || ch === 13) {
      if (current === '') startPos = i;
      current += '\n';
    } else {
      if (current.trim().length >= minLength) {
        results.push({ text: current.trim(), pos: startPos });
      }
      current = '';
      startPos = -1;
    }
  }
  if (current.trim().length >= minLength) {
    results.push({ text: current.trim(), pos: startPos });
  }
  return results;
}

function isMetadata(text: string): boolean {
  const metaPatterns = [
    /^Bryn Kai-Hendricks$/,
    /^PageTitle$/,
    /^PageDateTime$/,
    /^Calibri/,
    /^var\(--/,
    /^<resolutionId/,
    /^IBM Plex/,
    /^4Č4/,
  ];
  return metaPatterns.some(p => p.test(text));
}

export interface OneNotePage {
  title: string;
  content: string;
  position: number;
}

export async function getOneNotePages(notebookPath: string, sectionFileName: string): Promise<OneNotePage[]> {
  const client = await getOneDriveClient();

  const itemPath = `${notebookPath}/${sectionFileName}`;
  const meta = await client.api(`/me/drive/root:${encodeURI(itemPath)}`).get();
  const downloadUrl = meta['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) throw new Error('No download URL for .one file');

  const response = await fetch(downloadUrl);
  const buf = await response.arrayBuffer();
  const bytes = new Uint8Array(buf);

  const strings = extractUTF16Strings(bytes, 3);

  const SKIP_PATTERNS = [
    /^Calibri/i, /^PageDateTime$/i, /^PageTitle$/i,
    /^Bryn Kai-Hendricks$/i, /^Bryn$/i,
    /^Times New Roman$/i, /^Arial$/i, /^Segoe/i, /^Consolas$/i,
    /^var\(--font/i, /^<resolutionId/,
    /^en-US$/, /^en-CA$/,
    /^\d{1,2}:\d{2}$/,
    /^Microsoft$/i, /^OneNote$/i,
    /^Windows Live$/i,
  ];

  function isSkippable(text: string): boolean {
    if (isMetadata(text)) return true;
    for (const p of SKIP_PATTERNS) {
      if (p.test(text)) return true;
    }
    const asciiCount = (text.match(/[\x20-\x7E]/g) || []).length;
    if (asciiCount <= text.length * 0.7) return true;
    return false;
  }

  const pageTitlePositions: number[] = [];
  for (let i = 0; i < bytes.length - 18; i++) {
    const target = 'PageTitle';
    let match = true;
    for (let j = 0; j < target.length; j++) {
      if (bytes[i + j * 2] !== target.charCodeAt(j) || bytes[i + j * 2 + 1] !== 0) {
        match = false;
        break;
      }
    }
    if (match) pageTitlePositions.push(i);
  }

  const contentStrings = strings.filter(s => !isSkippable(s.text) && s.text.length >= 3);

  if (pageTitlePositions.length === 0) {
    return [{
      title: sectionFileName.replace(/\.one$/i, ''),
      content: contentStrings.map(s => s.text).join('\n\n'),
      position: 0
    }];
  }

  const pages: OneNotePage[] = [];
  const seenTitles = new Map<string, number>();

  function isTitleLike(text: string): boolean {
    if (text.length < 2 || text.length > 80) return false;
    if (text.startsWith('- ') || text.startsWith('`')) return false;
    if (text.startsWith('HYPERLINK') || text.startsWith('http')) return false;
    if (text.includes('\n')) return false;
    if (/^\d+\.\s/.test(text)) return false;
    if (text.includes('(Weakness') || text.includes('(Opportunity') || text.includes('(Strength') || text.includes('(Threat')) return false;
    if (text.startsWith('The ') || text.startsWith('Add ') || text.startsWith('Build ')) return false;
    const wordCount = text.split(/\s+/).length;
    return wordCount <= 6;
  }

  for (let p = 0; p < pageTitlePositions.length; p++) {
    const markerPos = pageTitlePositions[p];
    const nextMarkerPos = p + 1 < pageTitlePositions.length
      ? pageTitlePositions[p + 1]
      : bytes.length;

    const pageContent = contentStrings.filter(
      s => s.pos > markerPos && s.pos < nextMarkerPos
    );

    if (pageContent.length === 0) continue;

    const subPages: { title: string; segments: typeof pageContent; pos: number }[] = [];
    let currentTitle = pageContent[0].text.split('\n')[0].substring(0, 100);
    let currentSegments: typeof pageContent = [];
    let currentPos = pageContent[0].pos;

    for (let i = 1; i < pageContent.length; i++) {
      const s = pageContent[i];
      const gap = i > 0 ? s.pos - pageContent[i - 1].pos : 0;

      if (gap > 10000 && isTitleLike(s.text)) {
        subPages.push({ title: currentTitle, segments: currentSegments, pos: currentPos });
        currentTitle = s.text.split('\n')[0].substring(0, 100);
        currentSegments = [];
        currentPos = s.pos;
      } else {
        currentSegments.push(s);
      }
    }
    subPages.push({ title: currentTitle, segments: currentSegments, pos: currentPos });

    for (const sp of subPages) {
      const content = sp.segments
        .map(s => {
          let t = s.text;
          t = t.replace(/^HYPERLINK\s+"([^"]+)"\s*/, (_, url) => `[${url}] `);
          return t;
        })
        .join('\n\n');

      const existingIdx = seenTitles.get(sp.title);
      if (existingIdx !== undefined) {
        if (content.length > pages[existingIdx].content.length) {
          pages[existingIdx] = { title: sp.title, content, position: sp.pos };
        }
      } else {
        seenTitles.set(sp.title, pages.length);
        pages.push({ title: sp.title, content, position: sp.pos });
      }
    }
  }

  return pages;
}

export async function getOneNotePagesViaApi(notebookDisplayName: string, sectionName: string): Promise<OneNotePage[]> {
  const client = await getOneDriveClient();

  try {
    const nbRes = await client.api('/me/onenote/notebooks').select('id,displayName').get();
    const nb = (nbRes.value || []).find((n: any) => n.displayName === notebookDisplayName);
    if (!nb) {
      console.log(`[OneNote API] Notebook "${notebookDisplayName}" not found`);
      return [];
    }

    const secRes = await client.api(`/me/onenote/notebooks/${nb.id}/sections`).select('id,displayName').get();
    const sec = (secRes.value || []).find((s: any) => s.displayName === sectionName);
    if (!sec) {
      console.log(`[OneNote API] Section "${sectionName}" not found in "${notebookDisplayName}"`);
      return [];
    }

    const pagesRes = await client.api(`/me/onenote/sections/${sec.id}/pages`)
      .select('id,title,createdDateTime,lastModifiedDateTime')
      .orderby('createdDateTime desc')
      .top(200)
      .get();

    const pages: OneNotePage[] = [];
    for (const p of (pagesRes.value || [])) {
      let content = '';
      try {
        const contentRes = await client.api(`/me/onenote/pages/${p.id}/content`).get();
        const html = typeof contentRes === 'string' ? contentRes : await contentRes.text?.() || '';
        content = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#\d+;/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      } catch (e: any) {
        console.log(`[OneNote API] Could not fetch content for "${p.title}": ${e.message}`);
      }
      pages.push({
        title: p.title || 'Untitled Page',
        content,
        position: pages.length,
      });
    }

    console.log(`[OneNote API] Found ${pages.length} pages in ${notebookDisplayName}/${sectionName}`);
    return pages;
  } catch (err: any) {
    console.error(`[OneNote API] Error listing pages:`, err.message || err);
    return [];
  }
}

export async function createOneNotePage(notebookDisplayName: string, sectionName: string, title: string, content: string): Promise<{ id: string; title: string } | null> {
  const client = await getOneDriveClient();

  try {
    const nbRes = await client.api('/me/onenote/notebooks').select('id,displayName').get();
    const nb = (nbRes.value || []).find((n: any) => n.displayName === notebookDisplayName);
    if (!nb) {
      throw new Error(`Notebook "${notebookDisplayName}" not found`);
    }

    const secRes = await client.api(`/me/onenote/notebooks/${nb.id}/sections`).select('id,displayName').get();
    const sec = (secRes.value || []).find((s: any) => s.displayName === sectionName);
    if (!sec) {
      throw new Error(`Section "${sectionName}" not found in "${notebookDisplayName}"`);
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title></head>
<body>
${content.split('\n').map(line => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('\n')}
</body>
</html>`;

    const page = await client.api(`/me/onenote/sections/${sec.id}/pages`)
      .header('Content-Type', 'text/html')
      .post(htmlContent);

    console.log(`[OneNote API] Created page "${title}" in ${notebookDisplayName}/${sectionName}`);
    return { id: page.id, title: page.title || title };
  } catch (err: any) {
    console.error(`[OneNote API] Error creating page:`, err.message || err);
    throw err;
  }
}

export async function deleteOneNotePage(notebookDisplayName: string, sectionName: string, pageTitle: string): Promise<boolean> {
  const client = await getOneDriveClient();

  try {
    const nbRes = await client.api('/me/onenote/notebooks').select('id,displayName').get();
    const nb = (nbRes.value || []).find((n: any) =>
      n.displayName === notebookDisplayName
    );
    if (!nb) {
      console.error(`[OneNote] Notebook "${notebookDisplayName}" not found in OneNote API`);
      return false;
    }

    const secRes = await client.api(`/me/onenote/notebooks/${nb.id}/sections`).select('id,displayName').get();
    const sec = (secRes.value || []).find((s: any) =>
      s.displayName === sectionName
    );
    if (!sec) {
      console.error(`[OneNote] Section "${sectionName}" not found in notebook "${notebookDisplayName}"`);
      return false;
    }

    const pagesRes = await client.api(`/me/onenote/sections/${sec.id}/pages`).select('id,title').top(100).get();
    const page = (pagesRes.value || []).find((p: any) =>
      p.title === pageTitle
    );
    if (!page) {
      console.error(`[OneNote] Page "${pageTitle}" not found in section "${sectionName}"`);
      return false;
    }

    await client.api(`/me/onenote/pages/${page.id}`).delete();
    console.log(`[OneNote] Deleted page "${pageTitle}" from ${notebookDisplayName}/${sectionName}`);
    return true;
  } catch (err: any) {
    console.error(`[OneNote] Delete page error:`, err.message || err);
    throw err;
  }
}

export async function listOneNoteNotebooks(): Promise<{ name: string; path: string; sections: { name: string; id: string }[] }[]> {
  const client = await getOneDriveClient();
  const notebooks: { name: string; path: string; sections: { name: string; id: string }[] }[] = [];

  try {
    const nbRes = await client.api('/me/onenote/notebooks').select('id,displayName').get();
    for (const nb of (nbRes.value || [])) {
      try {
        const secRes = await client.api(`/me/onenote/notebooks/${nb.id}/sections`).select('id,displayName').get();
        const sections = (secRes.value || []).map((s: any) => ({ name: s.displayName, id: s.id }));
        if (sections.length > 0) {
          notebooks.push({ name: nb.displayName, path: nb.id, sections });
        }
      } catch (secErr: any) {
        console.error(`[OneNote] Failed to list sections for ${nb.displayName}:`, secErr.message);
      }
    }
    console.log(`[OneNote] Found ${notebooks.length} notebooks via API`);
  } catch (e: any) {
    console.error(`[OneNote] Failed to list notebooks via API:`, e.message);
  }

  return notebooks;
}
