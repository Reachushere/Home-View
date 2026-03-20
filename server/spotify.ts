async function getSpotifyAccessToken(): Promise<string> {
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

  const accessToken = conn.settings?.access_token;
  if (!accessToken) throw new Error('No Spotify access token');

  return accessToken;
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
