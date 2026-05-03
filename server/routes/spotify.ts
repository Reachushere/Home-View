import type { Express } from "express";
import * as spotifyApi from "../spotify";
import {
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN,
  DEPLOYED_APP_URL,
  SPOTIFYPLUS_ENTITY,
  EVERYWHERE_GROUP_ENTITY,
  FLICK_DEVICES,
  haServiceCall,
  type FlickDevice,
} from "../serverHelpers";
import { spotifyActivePlaybacks } from "../helpers/spotifyState";

export function registerSpotifyRoutes(app: Express) {
  app.get("/api/spotify/status", async (_req, res) => {
    res.json({ connected: spotifyApi.isConnected() });
  });

  app.get("/api/spotify/login", async (req, res) => {
    try {
      const authUrl = spotifyApi.getAuthUrl();
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).send("Failed to start Spotify login: " + error.message);
    }
  });

  app.get("/api/spotify/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("No authorization code received");
      }
      await spotifyApi.handleCallback(code);
      res.redirect("/?auth=5747&spotify=connected");
    } catch (error: any) {
      console.error("Spotify callback error:", error?.message || error);
      res.status(500).send("Spotify connection failed: " + error.message);
    }
  });

  app.get("/api/spotify/now-playing", async (_req, res) => {
    try {
      const playback = await spotifyApi.getNowPlaying();
      if (!playback || !playback.item) {
        return res.json({ playing: false });
      }
      const track = playback.item as any;
      res.json({
        playing: playback.is_playing,
        name: track.name,
        artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
        album: track.album?.name || "",
        albumArt: track.album?.images?.[0]?.url || "",
        albumArtSmall: track.album?.images?.[track.album.images.length - 1]?.url || "",
        progress: playback.progress_ms,
        duration: track.duration_ms,
        trackUrl: track.external_urls?.spotify || "",
      });
    } catch (error: any) {
      console.error("Spotify now-playing error:", error?.message || error);
      res.status(500).json({ error: "Failed to get Spotify status" });
    }
  });

  app.get("/api/spotify/recent", async (_req, res) => {
    try {
      const recent = await spotifyApi.getRecentTracks(5);
      const tracks = (recent?.items || []).map((item: any) => ({
        name: item.track.name,
        artist: item.track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
        album: item.track.album?.name || "",
        albumArt: item.track.album?.images?.[0]?.url || "",
        albumArtSmall: item.track.album?.images?.[item.track.album.images.length - 1]?.url || "",
        playedAt: item.played_at,
        trackUrl: item.track.external_urls?.spotify || "",
      }));
      res.json(tracks);
    } catch (error: any) {
      console.error("Spotify recent error:", error?.message || error);
      res.status(500).json({ error: "Failed to get recent tracks" });
    }
  });

  app.put("/api/spotify/play", async (_req, res) => {
    try {
      await spotifyApi.play();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify play error:", error?.message || error);
      res.status(500).json({ error: "Failed to play" });
    }
  });

  app.put("/api/spotify/pause", async (_req, res) => {
    try {
      await spotifyApi.pause();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify pause error:", error?.message || error);
      res.status(500).json({ error: "Failed to pause" });
    }
  });

  app.post("/api/spotify/next", async (_req, res) => {
    try {
      await spotifyApi.next();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify next error:", error?.message || error);
      res.status(500).json({ error: "Failed to skip" });
    }
  });

  app.post("/api/spotify/previous", async (_req, res) => {
    try {
      await spotifyApi.previous();
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Spotify previous error:", error?.message || error);
      res.status(500).json({ error: "Failed to go back" });
    }
  });

  app.get("/api/spotify/playlists", async (_req, res) => {
    try {
      const data = await spotifyApi.getPlaylists();
      const items = (data?.items || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url || "",
        imageSmall: p.images?.[p.images.length - 1]?.url || p.images?.[0]?.url || "",
        trackCount: p.tracks?.total || 0,
        uri: p.uri,
        owner: p.owner?.display_name || "",
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch playlists" });
    }
  });

  app.get("/api/spotify/albums", async (_req, res) => {
    try {
      const data = await spotifyApi.getSavedAlbums();
      const items = (data?.items || []).map((item: any) => ({
        id: item.album.id,
        name: item.album.name,
        artist: item.album.artists?.map((a: any) => a.name).join(", ") || "",
        image: item.album.images?.[0]?.url || "",
        imageSmall: item.album.images?.[item.album.images.length - 1]?.url || item.album.images?.[0]?.url || "",
        trackCount: item.album.total_tracks || 0,
        uri: item.album.uri,
        year: item.album.release_date?.substring(0, 4) || "",
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch albums" });
    }
  });

  app.get("/api/spotify/artists", async (_req, res) => {
    try {
      const data = await spotifyApi.getTopArtists();
      const items = (data?.items || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url || "",
        imageSmall: a.images?.[a.images.length - 1]?.url || a.images?.[0]?.url || "",
        genres: a.genres?.slice(0, 3) || [],
        uri: a.uri,
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch artists" });
    }
  });

  app.get("/api/spotify/tracks", async (_req, res) => {
    try {
      const data = await spotifyApi.getSavedTracks();
      const items = (data?.items || []).map((item: any) => ({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists?.map((a: any) => a.name).join(", ") || "",
        album: item.track.album?.name || "",
        image: item.track.album?.images?.[0]?.url || "",
        imageSmall: item.track.album?.images?.[item.track.album.images.length - 1]?.url || "",
        duration: item.track.duration_ms || 0,
        uri: item.track.uri,
      }));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tracks" });
    }
  });

  app.put("/api/spotify/volume", async (req, res) => {
    try {
      const { volume } = req.body;
      await spotifyApi.setVolume(volume);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to set volume" });
    }
  });

  app.put("/api/spotify/play-context", async (req, res) => {
    try {
      const { uri, offset } = req.body;
      await spotifyApi.playContext(uri, offset);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to play" });
    }
  });

  app.put("/api/spotify/play-tracks", async (req, res) => {
    try {
      const { uris } = req.body;
      await spotifyApi.playTracks(uris);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to play tracks" });
    }
  });

  app.put("/api/spotify/shuffle", async (req, res) => {
    try {
      const { state } = req.body;
      await spotifyApi.setShuffle(state);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to set shuffle" });
    }
  });

  app.put("/api/spotify/repeat", async (req, res) => {
    try {
      const { state } = req.body;
      await spotifyApi.setRepeat(state);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to set repeat" });
    }
  });

  app.get("/api/spotify/playback-state", async (_req, res) => {
    try {
      const data = await spotifyApi.getPlaybackState();
      if (!data) {
        res.json({ active: false });
        return;
      }
      res.json({
        active: true,
        volume: data.device?.volume_percent ?? 50,
        shuffle: data.shuffle_state ?? false,
        repeat: data.repeat_state ?? "off",
        deviceName: data.device?.name || "Unknown",
        deviceType: data.device?.type || "Unknown",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get playback state" });
    }
  });

  app.get("/api/spotify/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) { res.json({ tracks: [], artists: [], albums: [], playlists: [] }); return; }
      const data = await spotifyApi.search(q);
      res.json({
        tracks: (data?.tracks?.items || []).map((t: any) => ({
          id: t.id, name: t.name,
          artist: t.artists?.map((a: any) => a.name).join(", ") || "",
          album: t.album?.name || "",
          image: t.album?.images?.[0]?.url || "",
          imageSmall: t.album?.images?.[t.album.images.length - 1]?.url || "",
          duration: t.duration_ms || 0, uri: t.uri,
        })),
        artists: (data?.artists?.items || []).map((a: any) => ({
          id: a.id, name: a.name,
          image: a.images?.[0]?.url || "",
          imageSmall: a.images?.[a.images.length - 1]?.url || "",
          genres: a.genres?.slice(0, 3) || [], uri: a.uri,
        })),
        albums: (data?.albums?.items || []).map((a: any) => ({
          id: a.id, name: a.name,
          artist: a.artists?.map((ar: any) => ar.name).join(", ") || "",
          image: a.images?.[0]?.url || "",
          imageSmall: a.images?.[a.images.length - 1]?.url || "",
          year: a.release_date?.substring(0, 4) || "", uri: a.uri,
        })),
        playlists: (data?.playlists?.items || []).map((p: any) => ({
          id: p.id, name: p.name,
          image: p.images?.[0]?.url || "",
          imageSmall: p.images?.[p.images.length - 1]?.url || p.images?.[0]?.url || "",
          owner: p.owner?.display_name || "", uri: p.uri,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to search" });
    }
  });

  app.get("/api/spotify/related-artists", async (req, res) => {
    try {
      const artistId = req.query.artistId as string;
      if (!artistId) return res.json({ artists: [] });
      const data = await spotifyApi.getRelatedArtists(artistId);
      const artists = (data?.artists || []).slice(0, 8).map((a: any) => ({
        id: a.id, name: a.name,
        image: a.images?.[0]?.url || "",
        imageSmall: a.images?.[a.images.length - 1]?.url || "",
        genres: a.genres?.slice(0, 3) || [],
        uri: a.uri,
      }));
      res.json({ artists });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get related artists" });
    }
  });

  app.post("/api/spotify/bulk-images", async (req, res) => {
    try {
      const { items } = req.body as { items: { name: string; uri: string; searchQuery?: string }[] };
      if (!items || !Array.isArray(items)) return res.json({ images: {} });
      const images: Record<string, string> = {};
      const ids: Record<string, string> = {};
      for (const item of items) {
        try {
          const parts = item.uri.split(":");
          const type = parts[1];
          const id = parts[2];
          if (type === "artist") {
            try {
              const data = await spotifyApi.getArtistById(id);
              if (data?.images?.[0]?.url) images[item.name] = data.images[0].url;
              if (data?.id) ids[item.name] = data.id;
            } catch {}
            if (!images[item.name]) {
              const q = item.searchQuery || item.name;
              const searchData = await spotifyApi.search(q, 'artist', 3);
              const artists = searchData?.artists?.items || [];
              for (const a of artists) {
                if (a?.images?.[0]?.url) {
                  images[item.name] = a.images[0].url;
                  if (a.id) ids[item.name] = a.id;
                  break;
                }
              }
            }
          } else if (type === "playlist") {
            const data = await spotifyApi.getPlaylistById(id);
            if (data?.images?.[0]?.url) images[item.name] = data.images[0].url;
          } else if (type === "track") {
            try {
              const trackData = await spotifyApi.getTrackById(id);
              if (trackData?.album?.images?.[0]?.url) images[item.name] = trackData.album.images[0].url;
              if (trackData?.artists?.[0]?.id) ids[item.name] = trackData.artists[0].id;
            } catch {
              const q = item.searchQuery || item.name;
              const searchData = await spotifyApi.search(q, 'track', 1);
              const track = searchData?.tracks?.items?.[0];
              if (track?.album?.images?.[0]?.url) images[item.name] = track.album.images[0].url;
            }
          }
        } catch (e: any) {
          console.error(`[Spotify] Bulk image fetch failed for ${item.name}:`, e.message);
        }
      }
      const found = Object.keys(images);
      const missing = items.map(i => i.name).filter(n => !images[n]);
      console.log(`[Spotify] Bulk images: ${found.length} found, ${missing.length} missing${missing.length ? ': ' + missing.join(', ') : ''}`);
      res.json({ images, ids });
    } catch (error: any) {
      console.error("[Spotify] Bulk images error:", error.message);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.get("/api/spotify/devices", async (_req, res) => {
    try {
      const data = await spotifyApi.getDevices();
      const devices = (data?.devices || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        isActive: d.is_active,
        volume: d.volume_percent,
      }));
      res.json(devices);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get devices" });
    }
  });

  app.put("/api/spotify/transfer", async (req, res) => {
    try {
      const { deviceId } = req.body;
      await spotifyApi.transferPlayback(deviceId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to transfer playback" });
    }
  });

  app.get("/api/spotify/rooms", async (_req, res) => {
    try {
      const rooms = FLICK_DEVICES.map(g => ({
        room: g.room,
        icon: g.icon,
        speakers: g.devices.filter(d => d.type === "echo" || d.type === "echo_show" || d.type === "speaker" || d.type === "group").map(d => ({
          id: d.id,
          name: d.name,
          entityId: d.entityId,
          type: d.type,
          room: d.room,
        })),
      })).filter(g => g.speakers.length > 0);
      res.json(rooms);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get rooms" });
    }
  });

  app.post("/api/spotify/play-on-speaker", async (req, res) => {
    try {
      const { entityId, spotifyUri, artistName, searchQuery, deviceType, announceMessage, command } = req.body;
      if (!entityId) return res.status(400).json({ error: "entityId required" });
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      if (command === "pause" || command === "stop") {
        
        console.log(`[Spotify] ${command} command for entity: ${entityId}`);
        try {
          await fetch(`${haUrl}/api/services/media_player/media_${command === "stop" ? "stop" : "pause"}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
          });
          console.log(`[Spotify] SpotifyPlus ${command} sent`);
        } catch (e: any) {
          console.log(`[Spotify] SpotifyPlus ${command} failed: ${e.message}`);
        }
        try {
          await fetch(`${haUrl}/api/services/media_player/media_${command === "stop" ? "stop" : "pause"}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: entityId }),
          });
          console.log(`[Spotify] ${command} sent to ${entityId}`);
        } catch (e: any) {
          console.log(`[Spotify] ${command} on ${entityId} failed: ${e.message}`);
        }
        if (command === "stop") {
          spotifyActivePlaybacks.delete(entityId);
          if (spotifyActivePlaybacks.size === 0) clearSpotifyStaleTimer();
        } else {
          startSpotifyStaleTimer();
        }
        return res.json({ ok: true, action: command });
      }

      const isEcho = entityId.includes("echo") || entityId.includes("_am") || deviceType === "echo" || deviceType === "echo_show";

      if (isEcho) {
        let targetEntity = entityId;
        if (entityId === EVERYWHERE_GROUP_ENTITY) {
          const anyEcho = FLICK_DEVICES.flatMap(g => g.devices).find(d => d.type === "echo" && d.entityId.includes("_am"));
          if (anyEcho) {
            console.log(`[Spotify] BYhome group → using Echo for voice command: ${anyEcho.entityId}`);
            targetEntity = anyEcho.entityId;
          }
        } else if (entityId.includes("_group") || entityId.includes("_media_group")) {
          const roomGroup = FLICK_DEVICES.find(g => 
            g.devices.some(d => d.entityId === entityId) ||
            g.speakers?.some((s: any) => s.entityId === entityId)
          );
          if (roomGroup) {
            const echoDevice = roomGroup.devices.find(d => d.type === "echo" && d.entityId.includes("_am"));
            if (echoDevice) {
              console.log(`[Spotify] Resolved group ${entityId} → individual Echo: ${echoDevice.entityId}`);
              targetEntity = echoDevice.entityId;
            }
          }
          if (targetEntity === entityId) {
            for (const group of FLICK_DEVICES) {
              for (const dev of group.devices) {
                if (dev.type === "group" && dev.entityId === entityId) {
                  const echoInRoom = group.devices.find(d => d.type === "echo" && d.entityId.includes("_am"));
                  if (echoInRoom) {
                    console.log(`[Spotify] Resolved group ${entityId} → Echo in ${group.room}: ${echoInRoom.entityId}`);
                    targetEntity = echoInRoom.entityId;
                  }
                  break;
                }
              }
              if (targetEntity !== entityId) break;
            }
          }
        }

        if (announceMessage) {
          const isEverywhereGroup = entityId === EVERYWHERE_GROUP_ENTITY;
          if (isEverywhereGroup) {
            const onePerRoom = FLICK_DEVICES
              .filter(g => g.room !== "Balcony")
              .map(g => {
                const echo = g.devices.find(d => (d.type === "echo" || d.type === "echo_show") && d.entityId.includes("_am"));
                return echo?.entityId;
              })
              .filter(Boolean) as string[];
            console.log(`[Spotify] TTS announce on ${onePerRoom.length} speakers (one per room): "${announceMessage}"`);
            try {
              await fetch(`${haUrl}/api/services/notify/alexa_media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: announceMessage,
                  data: { type: "tts" },
                  target: onePerRoom,
                }),
              });
              await new Promise(resolve => setTimeout(resolve, 2500));
            } catch (ttsErr: any) {
              console.log(`[Spotify] TTS announce on room speakers failed (continuing): ${ttsErr.message}`);
            }
          } else {
            console.log(`[Spotify] TTS announce on ${targetEntity}: "${announceMessage}"`);
            try {
              await fetch(`${haUrl}/api/services/notify/alexa_media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: announceMessage,
                  data: { type: "tts" },
                  target: [targetEntity],
                }),
              });
              await new Promise(resolve => setTimeout(resolve, 2500));
            } catch (ttsErr: any) {
              console.log(`[Spotify] TTS announce failed (continuing): ${ttsErr.message}`);
            }
          }
        }

        
        
        const spotifyPlusSourceMap: Record<string, string> = {
          [EVERYWHERE_GROUP_ENTITY]: "BYhome",
          "media_player.king_bedroom_media_group": "King Bedroom",
          "media_player.queen_bedroom_media_group": "Queen Bedroom",
          "media_player.living_room_media_group": "Echo - LR Studio White AM",
          "media_player.kitchen_media_group": "Echo - Kitchen Studio Black AM",
          "media_player.hallway_media_group": "Echo - Hallway Corner",
          "media_player.closet_media_group": "Echo - Closet AM",
          "media_player.pug_media_group": "Echo Show - Pug AM",
          "media_player.echo_closet_am": "Echo - Closet AM",
          "media_player.echo_show_pug_am": "Echo Show - Pug AM",
          "media_player.echo_lr_couch_l_am": "Echo - LR Couch (L) AM",  
          "media_player.echo_lr_studio_white_am": "Echo - LR Studio White AM",
          "media_player.echo_king_l_am": "Echo - King (L) AM",
          "media_player.echo_king_r_am": "Echo - King (R) AM",
          "media_player.echo_king_tv_am": "Echo - King TV AM",
          "media_player.echo_queen_bed_l_am": "Echo - Queen Bed (L) AM",
          "media_player.echo_queen_bed_r_am": "Echo - Queen Bed (R) AM",
          "media_player.echo_queen_balcony_am": "Echo - Queen Balcony AM",
          "media_player.echo_kitchen_island_corner_am": "Echo - Kitchen Island Corner AM",
          "media_player.echo_kitchen_studio_black_am": "Echo - Kitchen Studio Black AM",
          "media_player.echo_kitchen_cupboards_left_am": "Echo - Kitchen Cupboards (Left) AM",
          "media_player.echo_kitchen_cupboards_r_am": "Echo - Kitchen Cupboards (R) AM",
          "media_player.echo_kitchen_hutch_am": "Echo - Kitchen Hutch AM",
          "media_player.echo_kitchen_fridge_am": "Echo - Kitchen Fridge AM",
          "media_player.echo_hallway_entrance_am": "Echo - Hallway Corner",
          "media_player.echo_lr_hub_am": "Echo - LR Hub AM",
          "media_player.echo_lr_tv_shelf_am": "Echo - LR TV Shelf AM",
        };

        const groupEntityId = entityId !== targetEntity ? entityId : null;
        const spSource = spotifyPlusSourceMap[entityId] || spotifyPlusSourceMap[targetEntity];
        
        const isRadioCommand = !spotifyUri && searchQuery && (searchQuery.toLowerCase().includes("fm") || searchQuery.toLowerCase().includes("radio") || searchQuery.toLowerCase().includes("tunein") || searchQuery.toLowerCase().includes("chum"));
        if (isRadioCommand) {
          const voiceCommand = `play ${searchQuery}${entityId === EVERYWHERE_GROUP_ENTITY ? " on byhome" : ""}`;
          const radioTarget = entityId === EVERYWHERE_GROUP_ENTITY ? targetEntity : targetEntity;
          console.log(`[Spotify] Radio/TuneIn content detected, sending voice command to ${radioTarget}: "${voiceCommand}"`);
          try {
            await fetch(`${haUrl}/api/services/media_player/turn_on`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: radioTarget }),
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (wakeErr: any) {
            console.log(`[Spotify] Wake-up failed (continuing): ${wakeErr.message}`);
          }
          await fetch(`${haUrl}/api/services/media_player/play_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: radioTarget, media_content_id: voiceCommand, media_content_type: "custom" }),
          });
          trackSpotifyPlayback(entityId, artistName);
          clearSpotifyStaleTimer();
        } else if (spSource && spotifyUri) {
          console.log(`[Spotify] Using SpotifyPlus: source="${spSource}", uri=${spotifyUri}`);
          
          try {
            await fetch(`${haUrl}/api/services/media_player/turn_on`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e: any) {
            console.log(`[Spotify] SpotifyPlus turn_on failed (continuing): ${e.message}`);
          }

          const selectResp = await fetch(`${haUrl}/api/services/media_player/select_source`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entity_id: SPOTIFYPLUS_ENTITY,
              source: spSource,
            }),
          });
          console.log(`[Spotify] SpotifyPlus select_source "${spSource}": ${selectResp.status}`);
          await new Promise(resolve => setTimeout(resolve, 2000));

          const isArtistUri = spotifyUri.startsWith("spotify:artist:");
          if (isArtistUri) {
            console.log(`[Spotify] Artist URI detected, using player_media_play_context for shuffle play`);
            const playResp = await fetch(`${haUrl}/api/services/spotifyplus/player_media_play_context`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entity_id: SPOTIFYPLUS_ENTITY,
                context_uri: spotifyUri,
                position_ms: 0,
                delay: 0.50,
              }),
            });
            const playText = await playResp.text();
            console.log(`[Spotify] SpotifyPlus player_media_play_context response: ${playResp.status} body=${playText.substring(0, 300)}`);
            if (!playResp.ok) {
              console.log(`[Spotify] player_media_play_context failed, falling back to voice command`);
              const searchTerm = searchQuery || artistName || "music";
              const voiceCommand = `play ${searchTerm} on Spotify`;
              const commandTarget = entityId === EVERYWHERE_GROUP_ENTITY ? EVERYWHERE_GROUP_ENTITY : targetEntity;
              console.log(`[Spotify] Sending alexa_media command to ${commandTarget}: "${voiceCommand}"`);
              await fetch(`${haUrl}/api/services/notify/alexa_media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: voiceCommand, target: commandTarget, data: { type: "command" } }),
              });
            }
          } else {
            const playResp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entity_id: SPOTIFYPLUS_ENTITY,
                media_content_id: spotifyUri,
                media_content_type: "spotify",
              }),
            });
            const playText = await playResp.text();
            console.log(`[Spotify] SpotifyPlus play response: ${playResp.status} body=${playText.substring(0, 300)}`);
          }
          trackSpotifyPlayback(entityId, artistName);
          clearSpotifyStaleTimer();
        } else {
          console.log(`[Spotify] No SpotifyPlus source for ${entityId}, using voice command fallback`);
          const searchTerm = searchQuery || artistName || "music";
          const voiceCommand = `play ${searchTerm} on Spotify`;
          const commandTarget = entityId === EVERYWHERE_GROUP_ENTITY ? EVERYWHERE_GROUP_ENTITY : targetEntity;
          
          console.log(`[Spotify] Sending alexa_media command to ${commandTarget}: "${voiceCommand}"`);
          await fetch(`${haUrl}/api/services/notify/alexa_media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: voiceCommand, target: commandTarget, data: { type: "command" } }),
          });
        }
      } else {
        const searchTerm = searchQuery || artistName || "music";
        const voiceCmd = `play ${searchTerm} on Spotify`;
        console.log(`[Spotify] Non-echo device, sending voice command to ${entityId}: "${voiceCmd}"`);
        await fetch(`${haUrl}/api/services/media_player/play_media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: entityId, media_content_id: voiceCmd, media_content_type: "custom" }),
        });
      }
      console.log(`[Spotify] Play command complete for ${entityId}: "${searchQuery || artistName}"`);
      trackSpotifyPlayback(entityId, artistName);
      clearSpotifyStaleTimer();

      const volumeTarget = entityId;
      try {
        await fetch(`${haUrl}/api/services/media_player/volume_set`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: volumeTarget, volume_level: 0.35 }),
        });
        console.log(`[Spotify] Set volume to 35% on ${volumeTarget}`);
      } catch (volErr: any) {
        console.log(`[Spotify] Volume set failed (continuing): ${volErr.message}`);
      }

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Spotify] Play on speaker error:", error);
      res.status(500).json({ error: "Failed to play on speaker" });
    }
  });

  app.post("/api/spotify/group-speakers", async (req, res) => {
    try {
      const { sourceEntityId, targetEntityId } = req.body;
      if (!sourceEntityId || !targetEntityId) return res.status(400).json({ error: "Both entity IDs required" });
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      await fetch(`${haUrl}/api/services/media_player/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: sourceEntityId, group_members: [targetEntityId] }),
      });
      console.log(`[Spotify] Grouped ${targetEntityId} into ${sourceEntityId}`);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Spotify] Group speakers error:", error);
      res.status(500).json({ error: "Failed to group speakers" });
    }
  });

  // spotifyActivePlaybacks is imported from helpers/spotifyState (shared with routes.ts)
  let spotifyStaleTimer: NodeJS.Timeout | null = null;
  const SPOTIFY_STALE_TIMEOUT_MS = 10 * 60 * 1000;

  function trackSpotifyPlayback(entityId: string, artistName?: string) {
    spotifyActivePlaybacks.set(entityId, { entityId, startedAt: Date.now(), artistName });
    console.log(`[Spotify] Tracking playback on ${entityId} (${artistName || 'unknown'}). Active: ${spotifyActivePlaybacks.size}`);
  }

  function clearSpotifyStaleTimer() {
    if (spotifyStaleTimer) {
      clearTimeout(spotifyStaleTimer);
      spotifyStaleTimer = null;
    }
  }

  function startSpotifyStaleTimer() {
    clearSpotifyStaleTimer();
    spotifyStaleTimer = setTimeout(async () => {
      if (spotifyActivePlaybacks.size === 0) return;
      console.log(`[Spotify] Stale timeout (${SPOTIFY_STALE_TIMEOUT_MS / 1000}s) reached. Clearing ${spotifyActivePlaybacks.size} stale playback(s).`);
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      try {
        await fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
        });
        console.log(`[Spotify] Stale cleanup: SpotifyPlus stopped`);
      } catch (e: any) {
        console.log(`[Spotify] Stale cleanup: SpotifyPlus stop failed: ${e.message}`);
      }
      for (const [, pb] of spotifyActivePlaybacks) {
        try {
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: pb.entityId }),
          });
          console.log(`[Spotify] Stale cleanup: stopped ${pb.entityId}`);
        } catch (e: any) {
          console.log(`[Spotify] Stale cleanup: ${pb.entityId} stop failed: ${e.message}`);
        }
      }
      spotifyActivePlaybacks.clear();
      console.log(`[Spotify] All stale playbacks cleared`);
    }, SPOTIFY_STALE_TIMEOUT_MS);
    console.log(`[Spotify] Stale timer started (${SPOTIFY_STALE_TIMEOUT_MS / 1000}s)`);
  }

  app.post("/api/spotify/stop-all", async (_req, res) => {
    try {
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      
      const results: string[] = [];
      clearSpotifyStaleTimer();

      try {
        await fetch(`${haUrl}/api/services/media_player/media_stop`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_id: SPOTIFYPLUS_ENTITY }),
        });
        results.push("SpotifyPlus stopped");
      } catch (e: any) {
        results.push(`SpotifyPlus stop failed: ${e.message}`);
      }

      for (const [, pb] of spotifyActivePlaybacks) {
        try {
          await fetch(`${haUrl}/api/services/media_player/media_stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: pb.entityId }),
          });
          results.push(`Stopped ${pb.entityId}`);
        } catch (e: any) {
          results.push(`${pb.entityId} stop failed: ${e.message}`);
        }
      }

      try {
        await spotifyApi.pause();
        results.push("Spotify API paused");
      } catch (e: any) {
        results.push(`Spotify API pause failed: ${e.message}`);
      }

      const count = spotifyActivePlaybacks.size;
      spotifyActivePlaybacks.clear();
      console.log(`[Spotify] Stop-all: cleared ${count} tracked playbacks. Results: ${results.join(', ')}`);
      res.json({ ok: true, cleared: count, results });
    } catch (error: any) {
      console.error("[Spotify] Stop-all error:", error);
      res.status(500).json({ error: "Failed to stop all" });
    }
  });

  app.post("/api/spotify/flick", async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

      let device: FlickDevice | undefined;
      let deviceRoom = "";
      for (const group of FLICK_DEVICES) {
        const found = group.devices.find(d => d.id === deviceId);
        if (found) { device = found; deviceRoom = group.room; break; }
      }
      if (!device) return res.status(404).json({ error: "Device not found" });

      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const appUrl = `https://${req.get('host') || new URL(DEPLOYED_APP_URL).host}`;
      const authParam = req.query.auth || "bryn";
      const spotifyUrl = `${appUrl}/spotify?auth=${authParam}`;
      console.log(`[Spotify Flick] Sending to ${device.name} (${deviceRoom}): ${spotifyUrl}`);

      const navigateDevice = async (targetDevice: FlickDevice) => {
        if (!targetDevice.canDisplay) return;
        try {
          if (targetDevice.type === "tablet" || targetDevice.type === "echo_show") {
            const navResp = await fetch(`${haUrl}/api/services/browser_mod/navigate`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ browser_id: targetDevice.entityId, path: spotifyUrl }),
            });
            console.log(`[Spotify Flick] Navigated ${targetDevice.entityId} via browser_mod: ${navResp.status}`);
          } else if (targetDevice.type === "tv") {
            const castResp = await fetch(`${haUrl}/api/services/media_player/play_media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_id: targetDevice.entityId, media_content_id: spotifyUrl, media_content_type: "url" }),
            });
            console.log(`[Spotify Flick] Cast to TV ${targetDevice.entityId}: ${castResp.status}`);
          }
        } catch (navErr: any) {
          console.error(`[Spotify Flick] Navigation failed for ${targetDevice.name}: ${navErr.message}`);
        }
      };

      if (device.canDisplay) {
        await navigateDevice(device);
      } else if (device.type === "group") {
        const roomGroup = FLICK_DEVICES.find(g => g.devices.some(d => d.id === device!.id));
        if (roomGroup) {
          const screenDevices = roomGroup.devices.filter(d => d.canDisplay && d.id !== device!.id);
          for (const screenDevice of screenDevices) {
            await navigateDevice(screenDevice);
          }
        }
      }

      res.json({ success: true, device: device.name, room: deviceRoom });
    } catch (error: any) {
      console.error("[Spotify Flick] Error:", error);
      res.status(500).json({ error: "Failed to flick", details: error.message });
    }
  });

  app.post("/api/spotify/ungroup-speaker", async (req, res) => {
    try {
      const { entityId } = req.body;
      if (!entityId) return res.status(400).json({ error: "entityId required" });
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');

      await fetch(`${haUrl}/api/services/media_player/unjoin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId }),
      });
      console.log(`[Spotify] Ungrouped ${entityId}`);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Spotify] Ungroup speaker error:", error);
      res.status(500).json({ error: "Failed to ungroup speaker" });
    }
  });

  app.post("/api/spotify/go-home", async (req, res) => {
    try {
      const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
      const homeUrl = "http://172.24.0.2:8123/lovelace/test-home";
      const tabletWrapperUrl = `${DEPLOYED_APP_URL}/tablet`;
      const tabletAdbEntities = [
        { entity: "media_player.tablet_hallway_entrance", name: "Hallway Entrance" },
        { entity: "media_player.tablet_hallway", name: "Hallway Main" },
        { entity: "media_player.tablet_11", name: "Living Room" },
        { entity: "media_player.bd24bb29_04a116d8_king", name: "King Bedroom" },
        { entity: "media_player.tablet_queen", name: "Queen Bedroom" },
        { entity: "media_player.tablet_kitchen_island", name: "Kitchen Island" },
        { entity: "media_player.tablet_cat", name: "Cat Washroom" },
      ];
      console.log(`[Spotify Home] Navigating ${tabletAdbEntities.length} tablets to ${homeUrl} via ADB`);
      res.json({ ok: true, navigating: tabletAdbEntities.length });

      await Promise.allSettled(
        tabletAdbEntities.map(async (tablet) => {
          try {
            await haServiceCall('androidtv/adb_command', {
              entity_id: tablet.entity,
              command: `am start --activity-clear-task -a android.intent.action.VIEW -d "${homeUrl}" com.amazon.cloud9`
            }, `Spotify Home ADB ${tablet.name}`);
            console.log(`[Spotify Home] ${tablet.name} → ADB navigate sent`);
          } catch (e: any) {
            console.log(`[Spotify Home] ${tablet.name} → ADB failed: ${e.message}`);
          }
        })
      );
    } catch (error: any) {
      console.error("[Spotify Home] Error:", error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });
}
