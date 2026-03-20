// Spotify integration using Replit connector token + user's own Spotify app credentials
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getConnectorRefreshToken(): Promise<{ refreshToken: string; accessToken: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found');
  }

  const data = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json());

  const conn = data.items?.[0];
  if (!conn) throw new Error('Spotify not connected');

  const refreshToken = conn.settings?.oauth?.credentials?.refresh_token;
  const accessToken = conn.settings?.access_token || conn.settings?.oauth?.credentials?.access_token;
  
  if (!refreshToken && !accessToken) throw new Error('No Spotify tokens available');

  return { refreshToken: refreshToken || '', accessToken: accessToken || '' };
}

async function getSpotifyAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const { refreshToken, accessToken: connectorToken } = await getConnectorRefreshToken();

  if (clientId && clientSecret && refreshToken) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    });

    if (res.ok) {
      const data = await res.json();
      cachedToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };
      return cachedToken.accessToken;
    }
    console.error('[Spotify] Token refresh failed:', res.status, await res.text());
  }

  if (connectorToken) {
    return connectorToken;
  }

  throw new Error('Could not obtain Spotify access token');
}

async function spotifyFetch(endpoint: string, method: string = 'GET', body?: any) {
  const token = await getSpotifyAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      cachedToken = null;
    }
    throw new Error(`Spotify API ${res.status}: ${errText}`);
  }
  return res.json();
}

export async function getNowPlaying() {
  return spotifyFetch('/me/player/currently-playing');
}

export async function getRecentTracks(limit: number = 5) {
  return spotifyFetch(`/me/player/recently-played?limit=${limit}`);
}

export async function play() {
  return spotifyFetch('/me/player/play', 'PUT');
}

export async function pause() {
  return spotifyFetch('/me/player/pause', 'PUT');
}

export async function next() {
  return spotifyFetch('/me/player/next', 'POST');
}

export async function previous() {
  return spotifyFetch('/me/player/previous', 'POST');
}
