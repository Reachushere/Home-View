// Cross-section Spotify playback state extracted from server/routes.ts
// (MODULE_SPLIT_PLAN Phase 5). Exposed as a module-scope Map so that both
// server/routes.ts (cat-wash speaker logic) and server/routes/spotify.ts
// (Spotify route handlers) read/write the same playback registry.

export const spotifyActivePlaybacks: Map<string, { entityId: string; startedAt: number; artistName?: string }> = new Map();
