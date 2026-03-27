# How to Split routes.ts Into Two Files (Step-by-Step for Beginners)

Your `server/routes.ts` file is currently **17,239 lines** long. That's huge — it slows down your code editor, makes it harder to find things, and uses more memory than it needs to. We're going to split it into two files:

1. **`server/routes.ts`** — The main app (tasks, calendar, settings, weather, ticker, files, Spotify, etc.) — roughly lines 1–7,430
2. **`server/catWashRoutes.ts`** — Everything related to the cat washroom study reading system, media playback, webhooks, and HA automations — roughly lines 7,430–17,239

After the split, the app will work **exactly the same** — nothing changes from the user's perspective. It's just organized better.

---

## What You Need

- A code editor (VS Code, Notepad++, or even Notepad)
- The `server/routes.ts` file open
- About 30–45 minutes

---

## Step 1: Find the Split Point

Open `server/routes.ts` and scroll to **line 7,433** (or search for `SERVER_START_TIME`). You'll see something like this:

```typescript
  const SERVER_START_TIME = Date.now();
  const SERVER_STARTUP_COOLDOWN_MS = 60 * 1000;

  // ===== HA Connectivity Health Monitor =====
```

**Everything from this line downward** is the cat washroom / media / webhook code. That's what we're moving to the new file.

---

## Step 2: Create the New File

Create a new file called `server/catWashRoutes.ts`. This file will contain all the cat washroom code.

Start the file with this header:

```typescript
import type { Express } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { getWeekNumber, type FileRecord, appState, announcements } from "@shared/schema";
import { z } from "zod";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { textToSpeech } from "./replit_integrations/audio/client";
import { sendEchoVoiceAnnouncement } from "./email";
import { listOneDriveItems, getOneDriveFile, getOneDriveItemByPath } from "./onedrive";
import * as spotifyApi from "./spotify";
import { torontoDate, torontoNow } from "./timezone";
```

(Don't worry if some of these imports aren't needed — TypeScript will tell you which ones to remove later. It's better to have too many than too few.)

---

## Step 3: Copy the Shared Constants

Some constants are used by BOTH files (like the HA entity names). You need to either:

**Option A (Easiest):** Copy the constants block into BOTH files. Yes, it's duplicated, but it works and is simple.

**Option B (Cleaner):** Create a third file called `server/constants.ts`, put the constants there, and import from both files.

### Option A — Just copy this block into the TOP of `catWashRoutes.ts` (after the imports):

```typescript
const DEPLOYED_APP_URL = process.env.DEPLOYED_APP_URL || "https://home-view--bkh416.replit.app";
const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
const tokenFromEnv = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnv = process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = tokenFromEnv.startsWith("eyJ") ? tokenFromEnv : (urlFromEnv.startsWith("eyJ") ? urlFromEnv : tokenFromEnv);

const BATHROOM_ECHO_ENTITY = "media_player.bathroom_speaker";
const KITCHEN_ECHO_ENTITY = "media_player.echo_kitchen_studio_black_am";
const NEST_SPEAKER_ENTITY = "media_player.bathroom_speaker";
const CAT_WR_HA_VOICE_ENTITY = "media_player.home_assistant_voice_097c38_media_player";
const NON_ALEXA_ENTITIES = [NEST_SPEAKER_ENTITY, CAT_WR_HA_VOICE_ENTITY];
const MODULE_READING_PENDING = "input_boolean.module_reading_pending";
const MODULE_READING_CONFIRMED = "input_boolean.module_reading_confirmed";
const PARTNER_PHONE_ENTITY = "device_tracker.y_phone_app";
const HA_CLOUD_TTS_ENTITY = "tts.home_assistant_cloud";
const CAT_LIGHTS_ENTITY = "light.cat_lights";
const CAT_TV_ENTITY = "media_player.tv_cat_wr";
const FIRE_STICK_ADB_ENTITY = "media_player.fire_tv_172_24_0_88";
const CAT_WR_MEDIA_GROUP = "media_player.cat_washroom_media_group";
const CAT_ECHO_ENTITIES = [
  "media_player.echo_cat_left_am",
  "media_player.echo_cat_right_am",
  "media_player.echo_cat_washroom_middle",
];
const SPOTIFYPLUS_ENTITY = "media_player.spotifyplus_byhomeyyz";
const EVERYWHERE_GROUP_ENTITY = "media_player.byhome";
```

### Option B — Create `server/constants.ts`:

```typescript
// server/constants.ts — Shared constants used by routes.ts and catWashRoutes.ts

export const DEPLOYED_APP_URL = process.env.DEPLOYED_APP_URL || "https://home-view--bkh416.replit.app";
export const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL_OVERRIDE || "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";

const tokenFromEnv = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnv = process.env.HOME_ASSISTANT_URL || "";
export const HOME_ASSISTANT_TOKEN = tokenFromEnv.startsWith("eyJ") ? tokenFromEnv : (urlFromEnv.startsWith("eyJ") ? urlFromEnv : tokenFromEnv);

export const BATHROOM_ECHO_ENTITY = "media_player.bathroom_speaker";
export const KITCHEN_ECHO_ENTITY = "media_player.echo_kitchen_studio_black_am";
export const NEST_SPEAKER_ENTITY = "media_player.bathroom_speaker";
export const CAT_WR_HA_VOICE_ENTITY = "media_player.home_assistant_voice_097c38_media_player";
export const NON_ALEXA_ENTITIES = [NEST_SPEAKER_ENTITY, CAT_WR_HA_VOICE_ENTITY];
export const MODULE_READING_PENDING = "input_boolean.module_reading_pending";
export const MODULE_READING_CONFIRMED = "input_boolean.module_reading_confirmed";
export const PARTNER_PHONE_ENTITY = "device_tracker.y_phone_app";
export const HA_CLOUD_TTS_ENTITY = "tts.home_assistant_cloud";
export const CAT_LIGHTS_ENTITY = "light.cat_lights";
export const CAT_TV_ENTITY = "media_player.tv_cat_wr";
export const FIRE_STICK_ADB_ENTITY = "media_player.fire_tv_172_24_0_88";
export const CAT_WR_MEDIA_GROUP = "media_player.cat_washroom_media_group";
export const CAT_ECHO_ENTITIES = [
  "media_player.echo_cat_left_am",
  "media_player.echo_cat_right_am",
  "media_player.echo_cat_washroom_middle",
];
export const SPOTIFYPLUS_ENTITY = "media_player.spotifyplus_byhomeyyz";
export const EVERYWHERE_GROUP_ENTITY = "media_player.byhome";
```

Then in BOTH `routes.ts` and `catWashRoutes.ts`, replace the constants with:
```typescript
import { DEPLOYED_APP_URL, HOME_ASSISTANT_URL, HOME_ASSISTANT_TOKEN, BATHROOM_ECHO_ENTITY, KITCHEN_ECHO_ENTITY, NEST_SPEAKER_ENTITY, CAT_WR_HA_VOICE_ENTITY, NON_ALEXA_ENTITIES, MODULE_READING_PENDING, MODULE_READING_CONFIRMED, PARTNER_PHONE_ENTITY, HA_CLOUD_TTS_ENTITY, CAT_LIGHTS_ENTITY, CAT_TV_ENTITY, FIRE_STICK_ADB_ENTITY, CAT_WR_MEDIA_GROUP, CAT_ECHO_ENTITIES, SPOTIFYPLUS_ENTITY, EVERYWHERE_GROUP_ENTITY } from "./constants";
```

---

## Step 4: Copy the Shared Helper Functions

These functions are used by the cat washroom code but are defined at the top of `routes.ts`. You need to copy them into `catWashRoutes.ts` as well (or put them in a shared helpers file):

1. **`haFetch`** (around line 116) — Makes HTTP calls to Home Assistant with retries
2. **`haServiceCall`** (around line 145) — Calls HA services
3. **`haServiceCallSafe`** (around line 197) — Same but fire-and-forget (won't crash if it fails)
4. **`processHACommandQueue`** (around line 166) — Queues HA commands
5. **`generateAndSaveTTSAudio`** (around line 364) — Generates TTS audio files
6. **`cleanTextForTTS`** (around line 429) — Cleans text for speech
7. **`getChunkWithSentenceBoundary`** (around line 622) — Splits text at sentence boundaries
8. **`stopTTSSession`** (around line 639) — Stops a TTS session
9. **`sendNextChunk`** (around line 651) — Sends the next TTS chunk
10. **`scheduleNextChunk`** (around line 801) — Schedules the next chunk with timing
11. **`parsePublicObjectPath`** (around line 421) — Parses object storage paths
12. **`formatLocalDate`** (around line 217) — Formats dates for Toronto timezone

Copy all of these functions into `catWashRoutes.ts` after the constants.

**Tip:** Search for each function name in the file. If you see it's ONLY used in the cat washroom section (below line 7,433), you can REMOVE it from `routes.ts` after copying. If it's used in BOTH halves, leave it in both files.

---

## Step 5: Move the Route Handlers

Now for the main event. In `catWashRoutes.ts`, create the function that will hold all the cat washroom routes:

```typescript
export function registerCatWashRoutes(app: Express) {
  // PASTE EVERYTHING FROM LINE 7,433 TO THE END OF THE registerRoutes FUNCTION HERE
  // (That's roughly lines 7,433 through ~17,200)
}
```

### What to move (these are the sections):

| Section | What It Contains |
|---------|-----------------|
| HA Connectivity Health Monitor | Health checks for HA connection |
| Cat Washroom Webhooks | `/api/webhook/cat-lights`, `cat-shower-button`, `cat-lights-confirm`, `cat-wash-stop`, `cat-volume`, `cat-knob-press`, `voice-command` |
| Kitchen Volume Webhook | `/api/webhook/kitchen-volume` |
| Play Urgent PDF Webhook | `/api/webhook/play-urgent-pdf` |
| Shower/Media Routes | `/api/shower/*`, `/api/media/*`, `/api/kitchen/*` |
| TTS Routes | `/api/tts/*` |
| File Upload/Sync | `/api/course-week-upload`, `/api/files/prepare-audio`, `/api/shower/sync-onedrive` |
| Echo TTS | `/api/echo/tts` |
| Partner Status | `/api/partner-status`, `/api/ha/service` |
| Tablet Command Polling | `/api/tablet-command/*` |
| Playback Session | All the playback state management |

### How to do the cut-and-paste:

1. In `routes.ts`, go to **line 7,433** (the `const SERVER_START_TIME = Date.now();` line)
2. Select from there all the way down to the **last closing brace** of the `registerRoutes` function (but NOT the closing brace itself — that stays in `routes.ts`)
3. **Cut** (Ctrl+X) all that selected text
4. **Paste** (Ctrl+V) it inside the `registerCatWashRoutes` function in `catWashRoutes.ts`
5. In `routes.ts`, the `registerRoutes` function should now end cleanly with just a `}` after the remaining routes

---

## Step 6: Update routes.ts to Call the New File

At the **top** of `routes.ts`, add this import:

```typescript
import { registerCatWashRoutes } from "./catWashRoutes";
```

Then at the **bottom** of the `registerRoutes` function (just before the final `}`), add:

```typescript
  // Register cat washroom & media routes from separate file
  registerCatWashRoutes(app);
```

So the end of `routes.ts` should look like:

```typescript
  // ... last route in the main file ...

  // Register cat washroom & media routes from separate file
  registerCatWashRoutes(app);
}
```

---

## Step 7: Test It

1. Save both files
2. Restart the app
3. If you get errors, they'll tell you exactly what's missing — usually a function or variable that one file needs but is defined in the other
4. Fix each error by either:
   - Copying the missing function/variable to the new file, OR
   - Moving it to `server/constants.ts` and importing from both

### Common errors you might see:

| Error Message | What It Means | Fix |
|--------------|---------------|-----|
| `Cannot find name 'haFetch'` | The `haFetch` function is used in `catWashRoutes.ts` but wasn't copied over | Copy the `haFetch` function into `catWashRoutes.ts` |
| `Cannot find name 'HOME_ASSISTANT_URL'` | A constant is missing | Copy the constant or import from `constants.ts` |
| `Cannot find name 'catWashPlaybackActive'` | A state variable is missing | Copy the `let catWashPlaybackActive = ...` line over |
| `Module '"./catWashRoutes"' has no exported member...` | You forgot to add `export` to the function | Add `export` before `function registerCatWashRoutes` |

---

## Step 8: Verify Everything Works

Test these things to make sure nothing broke:

1. **Dashboard loads** — Open the app in your browser
2. **Tasks work** — Create, edit, complete a task
3. **Calendar shows events** — Check Outlook and Google calendars
4. **Cat washroom webhook works** — Turn the cat lights on/off and check the logs
5. **Spotify player works** — Play/pause music
6. **PDF reader works** — Open a reading file
7. **Weather/ticker loads** — Check the bottom ticker bar

If all of those work, you're done!

---

## Quick Summary

| Before | After |
|--------|-------|
| 1 file, 17,239 lines | 2 files, ~9,800 + ~7,400 lines each |
| `server/routes.ts` (everything) | `server/routes.ts` (main app) + `server/catWashRoutes.ts` (cat washroom + media) |

### What goes where:

| File | Contains |
|------|----------|
| `routes.ts` | Tasks, semesters, calendar, weather, ticker, news, Spotify, files, settings, scholarships, contacts, notes, degree tracking, OneDrive browsing, Outlook sync, feedback |
| `catWashRoutes.ts` | All `/api/webhook/*` endpoints, `/api/shower/*`, `/api/media/*`, `/api/kitchen/*`, `/api/tts/*`, `/api/partner-status`, `/api/tablet-command/*`, HA health monitor, playback state, TTS engine, toothbrush polling, voice commands |

### Optional: If you want to go further

You could also split out:
- **`server/spotifyRoutes.ts`** — All the `/api/spotify/*` endpoints (~900 lines)
- **`server/tickerRoutes.ts`** — Weather, news, pollen, ticker endpoints (~500 lines)
- **`server/outlookRoutes.ts`** — Outlook sync and email filing endpoints (~200 lines)

Same process — create the file, move the routes, add an import and call in `routes.ts`.

---

## If Something Goes Wrong

Don't panic. You still have the original `routes.ts` with everything in it. If the split causes issues you can't fix:

1. Delete `catWashRoutes.ts`
2. Undo your changes to `routes.ts` (Ctrl+Z, or re-download from Replit/GitHub)
3. You're back to where you started

Nothing is lost. The split is purely organizational — no data, no database, no settings are affected.
