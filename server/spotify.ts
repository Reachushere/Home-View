// Spotify integration using user's own Spotify app with full OAuth flow
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.spotify-token.json');

interface SpotifyTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function loadTokenFromDisk(): SpotifyTokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      return data;
    }
  } catch {}
  return null;
}

function saveTokenToDisk(token: SpotifyTokenData) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
}

let cachedToken: SpotifyTokenData | null = loadTokenFromDisk();

export function getAuthUrl(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error('SPOTIFY_CLIENT_ID not set');

  const host = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co';
  const redirectUri = `https://${host}/api/spotify/callback`;

  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-read-email',
    'user-read-private',
    'user-library-read',
    'user-top-read',
    'streaming',
    'playlist-read-private',
    'playlist-read-collaborative',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    show_dialog: 'true',
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleCallback(code: string): Promise<void> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');

  const host = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co';
  const redirectUri = `https://${host}/api/spotify/callback`;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  saveTokenToDisk(cachedToken);
}

async function refreshAccessToken(): Promise<string> {
  if (!cachedToken?.refreshToken) throw new Error('No refresh token - connect Spotify first');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cachedToken.refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    cachedToken = null;
    try { fs.unlinkSync(TOKEN_FILE); } catch {}
    throw new Error(`Token refresh failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || cachedToken.refreshToken,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  saveTokenToDisk(cachedToken);
  return cachedToken.accessToken;
}

async function getSpotifyAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  if (cachedToken?.refreshToken) {
    return refreshAccessToken();
  }

  throw new Error('Spotify not connected - visit /api/spotify/login to connect');
}

export function isConnected(): boolean {
  return !!cachedToken?.refreshToken;
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
  if (res.status === 401) {
    cachedToken = null;
    throw new Error('Spotify token expired - reconnect at /api/spotify/login');
  }
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

export async function getPlaylists(limit: number = 50) {
  return spotifyFetch(`/me/playlists?limit=${limit}`);
}

export async function getSavedAlbums(limit: number = 50) {
  return spotifyFetch(`/me/albums?limit=${limit}`);
}

export async function getTopArtists(limit: number = 50) {
  return spotifyFetch(`/me/top/artists?limit=${limit}&time_range=medium_term`);
}

export async function getSavedTracks(limit: number = 50) {
  return spotifyFetch(`/me/tracks?limit=${limit}`);
}

export async function setVolume(volumePercent: number) {
  return spotifyFetch(`/me/player/volume?volume_percent=${Math.round(volumePercent)}`, 'PUT');
}

export async function getDevices() {
  return spotifyFetch('/me/player/devices');
}

export async function playContext(contextUri: string, offset?: number) {
  const body: any = { context_uri: contextUri };
  if (offset !== undefined) body.offset = { position: offset };
  return spotifyFetch('/me/player/play', 'PUT', body);
}

export async function playTracks(uris: string[]) {
  return spotifyFetch('/me/player/play', 'PUT', { uris });
}

export async function setShuffle(state: boolean) {
  return spotifyFetch(`/me/player/shuffle?state=${state}`, 'PUT');
}

export async function setRepeat(state: string) {
  return spotifyFetch(`/me/player/repeat?state=${state}`, 'PUT');
}

export async function getPlaybackState() {
  return spotifyFetch('/me/player');
}

export async function search(query: string, types: string = 'track,artist,album,playlist', limit: number = 20) {
  return spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=${types}&limit=${limit}`);
}

export async function transferPlayback(deviceId: string, play: boolean = true) {
  return spotifyFetch('/me/player', 'PUT', { device_ids: [deviceId], play });
}
