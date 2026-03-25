# Home Assistant Integration — Complete Technical Report
**Generated:** March 25, 2026
**App:** home-view--bkh416.replit.app
**HA Instance:** https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa (Nabu Casa) / http://172.24.0.2:8123 (local)

> **Source Code Visibility:** This report is generated entirely from reading the application source code. The agent **CAN** read and identify all server-side code (`server/routes.ts`, `server/haTickerWebhook.ts`, `server/spotify.ts`) and client-side code (`client/src/pages/spotify-player.tsx`). The agent **CANNOT** directly read your Home Assistant `configuration.yaml`, `automations.yaml`, `scripts.yaml`, or any other files stored on your HA instance — only what is embedded or referenced in this app's codebase.

---

## TABLE OF CONTENTS

1. [REST Commands (YAML for HA)](#1-rest-commands-yaml-for-ha)
2. [REST Sensors (Pushed from App → HA)](#2-rest-sensors-pushed-from-app--ha)
3. [Input Booleans](#3-input-booleans)
4. [All HA Entity IDs by Room](#4-all-ha-entity-ids-by-room)
5. [Webhook Endpoints & Automation Flows](#5-webhook-endpoints--automation-flows)
6. [Volume Defaults & Settings](#6-volume-defaults--settings)
7. [Speaker Groups & Device Registry](#7-speaker-groups--device-registry)
8. [Spotify Player — Room Hotspots & Profiles](#8-spotify-player--room-hotspots--profiles)
9. [HA Service Calls — Full Trace](#9-ha-service-calls--full-trace)
10. [TTS Configuration](#10-tts-configuration)
11. [ADB Tablet Commands](#11-adb-tablet-commands)
12. [HA Automation Created by App](#12-ha-automation-created-by-app)
13. [Constants & Defaults Summary](#13-constants--defaults-summary)

---

## 1. REST Commands (YAML for HA)

**Source file:** `.local/ha-rest-commands.yaml`
**Purpose:** These YAML definitions go into your HA `configuration.yaml` (or included file) so HA automations can call your app's webhook endpoints.

| Code | Explanation |
|------|-------------|
| `rest_command:` | Top-level HA configuration block for REST commands |
| | |
| `  cat_lights_webhook:` | REST command triggered by HA when cat washroom lights change |
| `    url: "https://home-view--bkh416.replit.app/api/webhook/cat-lights"` | Calls the app's cat-lights webhook on the published URL |
| `    method: POST` | HTTP POST request |
| `    headers:` | |
| `      Content-Type: "application/json"` | JSON content type header |
| | |
| `  cat_lights_confirm_webhook:` | REST command for confirming the TTS prompt ("yes, play it") |
| `    url: "https://home-view--bkh416.replit.app/api/webhook/cat-lights-confirm"` | Confirms the "Would you like to play...?" voice prompt |
| `    method: POST` | |
| | |
| `  cat_knob_press_webhook:` | REST command for the physical knob/button press (master STOP) |
| `    url: "https://home-view--bkh416.replit.app/api/webhook/cat-knob-press"` | Stops all playback in cat washroom |
| `    method: POST` | |
| | |
| `  cat_volume_webhook:` | REST command for rotary encoder volume control |
| `    url: "https://home-view--bkh416.replit.app/api/webhook/cat-volume"` | Adjusts volume on active cat washroom speakers |
| `    method: POST` | |
| `    payload: '{"direction":"{{ direction }}"}'` | **Variable:** `direction` — **Current options:** `"up"` or `"down"` |
| | |
| `  cat_wash_webhook:` | REST command for the shower button |
| `    url: "https://home-view--bkh416.replit.app/api/webhook/cat-wash"` | Alternative trigger for cat washroom playback |
| `    method: POST` | |

---

## 2. REST Sensors (Pushed from App → HA)

**Source file:** `server/haTickerWebhook.ts`
**Method:** The app pushes data to HA via `POST /api/states/{entity_id}` every 5 minutes.

### sensor.dashboard_ticker

| Code | Explanation |
|------|-------------|
| `pushSensorToHA('sensor.dashboard_ticker', fullTickerText.slice(0, 255), {` | Pushes ticker sensor — state is first 255 chars of combined text |
| `  friendly_name: 'Dashboard News Ticker',` | Display name in HA |
| `  icon: 'mdi:newspaper-variant-outline',` | MDI icon |
| `  full_text: fullTickerText,` | Complete ticker text (all segments joined with `\|\|\|`) |
| `  segment_count: segments.length,` | Number of ticker segments |
| `  segments,` | Array of individual ticker segments |
| `  weather: weatherState,` | e.g. `"1°C — Clear \| Wind: 12 km/h"` |
| `  forecast_3day: forecastDays.join(' • '),` | e.g. `"Mon: 4°/-1° • Tue: 13°/2° • Wed: 3°/-4°"` |
| `  forecast_brief: forecastBrief,` | Natural language forecast summary |
| `  pollen: pollenText,` | e.g. `"Low (Tree: Low, Grass: Low, Weed: Low) \| AQI: 27"` |
| `  alerts: alertItems,` | Array of weather alert titles (empty if none) |
| `  announcements: announcementTexts,` | Array of course announcements (filtered by week) |
| `  news: newsItems.slice(0, 30)...,` | Array of formatted news strings `"Source: Title (Xh)"` |
| `  news_detailed: newsItems.slice(0, 30),` | Array of objects: `{ title, source, link, ago }` |
| `})` | |

### sensor.dashboard_weather

| Code | Explanation |
|------|-------------|
| `pushSensorToHA('sensor.dashboard_weather', weatherState, {` | State = current weather string |
| `  friendly_name: 'Dashboard Weather',` | |
| `  icon: 'mdi:weather-partly-cloudy',` | |
| `  forecast_3day,` | 3-day forecast |
| `  forecast_brief,` | Natural language brief |
| `  pollen: pollenText,` | Pollen levels |
| `  alerts: alertItems,` | Weather alerts |
| `})` | |

### sensor.dashboard_news

| Code | Explanation |
|------|-------------|
| `pushSensorToHA('sensor.dashboard_news', '${newsItems.length} headlines', {` | State = headline count |
| `  friendly_name: 'Dashboard News',` | |
| `  icon: 'mdi:newspaper',` | |
| `  headlines: [...],` | Formatted headline strings |
| `  headlines_detailed: [...],` | Objects with title, source, link, ago |
| `})` | |

**News source ordering:** Canadian → US → BBC (interleaved).
- **Canadian sources:** CTV, CBC, Global
- **US sources:** CNN, Politico, Raw Story, MSNBC, ABC News, Fox News
- **UK sources:** BBC

**Update interval:** Every **5 minutes** (`5 * 60 * 1000 ms`), configured in `server/haTickerWebhook.ts` line 202.

---

## 3. Input Booleans

These must exist in your HA instance. The app reads and writes them during the cat washroom flow.

| Entity ID | Constant Name | Purpose |
|-----------|---------------|---------|
| `input_boolean.module_reading_pending` | `MODULE_READING_PENDING` | Set to ON when TTS prompt is playing, OFF after timeout or confirmation |
| `input_boolean.module_reading_confirmed` | `MODULE_READING_CONFIRMED` | Polled every 1.5s during confirmation wait; if ON, playback begins |

**Flow:**
1. Lights ON → `module_reading_pending` = ON, `module_reading_confirmed` = OFF
2. Wait up to 23 seconds, polling `module_reading_confirmed` every 1.5s
3. If confirmed → both reset to OFF, playback starts
4. If timeout → both reset to OFF, CHUM FM plays instead

---

## 4. All HA Entity IDs by Room

### 🚪 Hallway
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.tablet_hallway_entrance` | Tablet (Entrance) | tablet |
| `media_player.tablet_hallway` | Tablet (Main) | tablet |
| `media_player.echo_hallway_entrance_am` | Echo (Entrance) | echo |
| `media_player.hallway_media_group` | All Hallway | group |
| `media_player.hallway_2` | Hallway (Spotify hotspot) | echo |

### 🛋️ Living Room
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.tablet_11` | Fire Tablet (11) | tablet |
| `media_player.echo_lr_couch_l_am` | Echo (Couch L) | echo |
| `media_player.echo_lr_couch_r_am` | Echo (Couch R) | echo |
| `media_player.echo_lr_hub_am` | Echo (Hub) | echo |
| `media_player.echo_lr_studio_white_am` | Echo Studio (White) | echo |
| `media_player.echo_lr_tv_shelf_am` | Echo (TV Shelf) | echo |
| `media_player.tv_living_room_70` | TV (70") | tv |
| `media_player.living_room_media_group` | All Living Room | group |

### 🛏️ King Bedroom
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.bd24bb29_04a116d8_king` | Tablet | tablet |
| `media_player.echo_king_l_am` | Echo (Left) | echo |
| `media_player.echo_king_r_am` | Echo (Right) | echo |
| `media_player.echo_king_tv_am` | Echo (TV) | echo |
| `media_player.tv_king` | TV | tv |
| `media_player.king_bedroom_media_group` | All King Bedroom | group |

### 👑 Queen Bedroom
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.tablet_queen` | Tablet | tablet |
| `media_player.echo_queen_balcony_am` | Echo (Balcony) | echo |
| `media_player.echo_queen_bed_l_am` | Echo (Bed L) | echo |
| `media_player.echo_queen_bed_r_am` | Echo (Bed R) | echo |
| `media_player.queen_bedroom_media_group` | All Queen Bedroom | group |

### 🍳 Kitchen
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.tablet_kitchen_island` | Tablet (Kitchen Island) | tablet |
| `media_player.echo_kitchen_cupboards_left_am` | Echo (Cupboards L) | echo |
| `media_player.echo_kitchen_cupboards_r_am` | Echo (Cupboards R) | echo |
| `media_player.echo_kitchen_fridge_am` | Echo (Fridge) | echo |
| `media_player.echo_kitchen_hutch_am` | Echo (Hutch) | echo |
| `media_player.echo_kitchen_island_corner_am` | Echo (Island Corner) | echo |
| `media_player.echo_kitchen_studio_black_am` | Echo Studio (Black) | echo |
| `media_player.tv_kitchen` | TV | tv |
| `media_player.kitchen_media_group` | All Kitchen | group |
| `media_player.kitchen_lr` | Kitchen/LR (Spotify hotspot) | echo |

### 🐱 Cat Washroom
| Entity ID | Device Name | Type | Constant |
|-----------|-------------|------|----------|
| `media_player.tablet_cat` | Tablet | tablet | — |
| `media_player.echo_cat_washroom_middle` | Echo (Middle) | echo | `CAT_ECHO_ENTITIES[2]` |
| `media_player.echo_cat_left_am` | Echo (Left) | echo | `CAT_ECHO_ENTITIES[0]` |
| `media_player.echo_cat_right_am` | Echo (Right) | echo | `CAT_ECHO_ENTITIES[1]` |
| `media_player.nestaudio6787` | Nest Speaker / Google Home | speaker | `NEST_SPEAKER_ENTITY` / `BATHROOM_ECHO_ENTITY` |
| `media_player.home_assistant_voice_097c38_media_player` | HA Voice (ESPHome) | speaker | `CAT_WR_HA_VOICE_ENTITY` |
| `media_player.tv_cat_wr` | Samsung TV | tv | — |
| `media_player.fire_tv_172_24_0_88` | Fire Stick (TV) | tv | — |
| `media_player.cat_washroom_media_group` | All Cat Washroom | group | — |
| `media_player.cat_speakers` | Cat Speakers (Spotify hotspot) | echo | — |

### 🐶 Pug Washroom
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.echo_show_pug_am` | Echo Show | echo_show |
| `media_player.pug_media_group` | All Pug Washroom | group |

### 👔 Closet
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.echo_closet_am` | Echo | echo |
| `media_player.closet_media_group` | All Closet | group |

### 🏠 Everywhere
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.byhome` | All Speakers (Apartment-wide) | group |

### 🌿 Balcony
| Entity ID | Device Name | Type |
|-----------|-------------|------|
| `media_player.balcony_speaker` | Balcony Speaker | echo |
| `media_player.balcony_media_group` | All Balcony | group |

### Other Entities (Non-Speaker)
| Entity ID | Type | Purpose |
|-----------|------|---------|
| `light.cat_lights` | light | Cat washroom light — triggers cat wash automation |
| `sensor.toothbrush_bryn_toothbrush_state` | sensor | Bryn's toothbrush state — stops playback when "brushing" |
| `device_tracker.y_phone_app` | device_tracker | Yasu's phone — partner location tracking |
| `notify.mobile_app_iphone_10` | notify | Push notifications to Bryn's iPhone |
| `tts.home_assistant_cloud` | tts | HA Cloud TTS (Nabu Casa) — fallback TTS engine |
| `media_player.spotifyplus_byhomeyyz` | media_player | SpotifyPlus integration entity |

---

## 5. Webhook Endpoints & Automation Flows

### POST /api/webhook/cat-lights
**HA Trigger:** `light.cat_lights` state change (ON/OFF)
**REST Command:** `cat_lights_webhook`

```
LIGHT OFF:
├── Stop active CPPA playback (if any) → stopNestPlaybackWithGoodbye('light_off')
│   ├── media_player/media_stop → NEST_SPEAKER_ENTITY
│   ├── media_player/turn_off → media_player.fire_tv_172_24_0_88
│   └── media_player/turn_off → media_player.samsung_tv
├── Stop TTS session (if any)
├── stopAllCatWashroomSpeakers(haUrl)
│   ├── media_player/media_stop → NEST_SPEAKER_ENTITY
│   ├── media_player/media_stop → CAT_ECHO_ENTITIES (Left, Right, Middle)
│   └── media_player/media_stop → media_player.cat_washroom_media_group
└── Return { action: "stopped" }

LIGHT ON:
├── Check cooldowns and existing playback
├── ★ NEW: stopAllCatWashroomSpeakers() → Stops CHUM FM or any leftover media
├── Find next unlistened CPPA file for current week
│   ├── If NO file found → playChumFmRadio()
│   │   └── media_player/play_media → media_player.cat_washroom_media_group
│   │       content_id: "play 104.5 chum fm"
│   │       content_type: "custom"
│   │   └── Return
│   └── If file found → Continue to TTS prompt
├── Set input_boolean/turn_off → MODULE_READING_CONFIRMED
├── Set input_boolean/turn_on → MODULE_READING_PENDING
├── media_player/volume_set → CAT_WR_HA_VOICE_ENTITY @ 0.85
├── media_player/volume_set → NEST_SPEAKER_ENTITY @ 0.85
├── Generate TTS audio: "Would you like to play [file description]?"
├── Play TTS on HA Voice → CAT_WR_HA_VOICE_ENTITY
│   ├── Fallback 1: Play on Nest → NEST_SPEAKER_ENTITY
│   └── Fallback 2: tts/speak → tts.home_assistant_cloud → CAT_WR_HA_VOICE_ENTITY
├── Wait 2 seconds
├── Wait up to 23 seconds for confirmation
│   ├── Poll input_boolean.module_reading_confirmed every 1.5s
│   └── OR receive POST /api/webhook/cat-lights-confirm
│
├── IF CONFIRMED → startConfirmedPlaybackFlow()
│   ├── Set tablet-nav for "master" tablet + "tv"
│   ├── ADB wake tablet_cat + brightness 255 + navigate Silk to PDF reader
│   ├── Turn on Fire Stick + Samsung TV
│   ├── Switch Samsung TV to HDMI1
│   ├── Open PDF reader URL on Fire Stick via ADB
│   ├── Play confirmation TTS: "Okay, I will now play [file]"
│   ├── media_player/volume_set → CAT_WR_HA_VOICE_ENTITY @ 0.75
│   ├── media_player/volume_set → NEST_SPEAKER_ENTITY @ 0.75
│   └── startNestChunkPlayback() → plays chunks one by one on Nest
│
└── IF NOT CONFIRMED (23s timeout)
    └── playChumFmRadio() → CHUM FM on media_player.cat_washroom_media_group
```

### POST /api/webhook/cat-lights-confirm
**HA Trigger:** Voice confirmation or physical button
**REST Command:** `cat_lights_confirm_webhook`

```
├── Resolve pending confirmation promise → true
├── media_player/media_stop → CAT_ECHO_ENTITIES (clear Echo speakers)
└── Return { action: "confirmed" }
```

### POST /api/webhook/cat-knob-press
**HA Trigger:** Physical knob press in cat washroom
**REST Command:** `cat_knob_press_webhook`

```
├── IF CPPA playback active:
│   └── stopNestPlaybackWithGoodbye()
│       ├── Save chunk progress to database
│       ├── media_player/media_stop → NEST_SPEAKER_ENTITY
│       ├── media_player/turn_off → Fire Stick + Samsung TV
│       └── Stop TTS session
├── ELSE:
│   └── stopAllCatWashroomSpeakers()
│       ├── media_player/media_stop → NEST_SPEAKER_ENTITY
│       ├── media_player/media_stop → CAT_ECHO_ENTITIES
│       └── media_player/media_stop → cat_washroom_media_group
└── Return { action: "stopped" }
```

### POST /api/webhook/cat-volume
**HA Trigger:** Rotary encoder in cat washroom
**REST Command:** `cat_volume_webhook`
**Payload:** `{"direction": "up"}` or `{"direction": "down"}`

```
├── Query state of all cat washroom speakers
│   └── GET /api/states/ → NEST_SPEAKER_ENTITY, CAT_ECHO_ENTITIES, cat_washroom_media_group, CAT_WR_HA_VOICE_ENTITY
├── Find which speakers are currently "playing"
├── Adjust volume:
│   ├── Normal step: ±0.05
│   └── Fast step: ±0.15
└── media_player/volume_set → [active speaker entity] @ newVolume
```

### POST /api/webhook/cat-wash-stop
**HA Trigger:** Toothbrush state changes from idle/charging to "brushing"
**Sensor polled:** `sensor.toothbrush_bryn_toothbrush_state`

```
├── Stop Nest playback
├── Save chunk progress
├── Stop TTS session
└── Return { action: "stopped" }
```

### POST /api/webhook/cat-shower-button
**HA Trigger:** Physical shower button press

```
├── Check for active semester
│   ├── No semester → playChumFmRadio()
│   └── Semester active → find next unlistened file
│       ├── No files → playChumFmRadio()
│       └── File found → startConfirmedPlaybackFlow() (no TTS prompt, immediate start)
```

### POST /api/webhook/kitchen-volume
**HA Trigger:** Kitchen volume automation
**Payload:** `{"direction": "up"}` or `{"direction": "down"}`

```
├── Get current volume of KITCHEN_ECHO_ENTITY (media_player.echo_kitchen_studio_black_am)
├── Adjust by ±0.05
└── media_player/volume_set → KITCHEN_ECHO_ENTITY @ newVolume
```

### POST /api/webhook/voice-command
**HA Trigger:** Custom voice assistant phrases

```
├── Command: "pause" / "stop reading"
│   ├── Pause Nest playback
│   ├── Save progress
│   └── Start 10-minute auto-stop timer
│
├── Command: "resume" / "continue reading"
│   ├── Find last file being played
│   └── startConfirmedPlaybackFlow() from saved chunk
│
├── Command: "stop" / "stop everything"
│   ├── stopNestPlaybackWithGoodbye()
│   ├── Turn off Fire Stick + Samsung TV
│   └── Clear all state
│
├── Command: "skip" / "next"
│   ├── Mark current file as complete
│   ├── Find next unlistened file
│   └── startConfirmedPlaybackFlow() with next file
│
├── Command: "restart" / "start over"
│   ├── Reset current file to chunk 0
│   └── startConfirmedPlaybackFlow() from beginning
│
└── Command: "reset"
    ├── Reset file progress (clear all checked chunks)
    └── startConfirmedPlaybackFlow() from chunk 0
```

### POST /api/webhook/email
**HA Trigger:** Gmail webhook / email forwarding

```
├── Route based on email content/subject:
│   ├── /api/webhook/ticker → Create scrolling ticker announcement
│   ├── /api/webhook/reminder → Create task/reminder in database
│   ├── /api/webhook/delete → Delete matching items
│   └── /api/webhook/email-homework → Parse homework assignments
```

### POST /api/webhook/play-urgent-pdf
**HA Trigger:** Manual or scheduled
**REST Command (in HA):**
```yaml
rest_command:
  play_urgent_pdf:
    url: "https://home-view--bkh416.replit.app/api/webhook/play-urgent-pdf"
    method: "POST"
    content_type: "application/json"
    headers:
      "x-webhook-secret": "[SITE_PASSWORD]"
    payload: '{"entity_id": "media_player.nestaudio6787"}'
```

```
├── Find most urgent unlistened PDF across all courses
├── If found → startConfirmedPlaybackFlow()
└── If not found → playChumFmRadio()
```

---

## 6. Volume Defaults & Settings

| Context | Entity | Volume Level | File Line |
|---------|--------|-------------|-----------|
| TTS Prompt (before asking question) | `CAT_WR_HA_VOICE_ENTITY` | **0.85** | routes.ts:8864 |
| TTS Prompt (before asking question) | `NEST_SPEAKER_ENTITY` | **0.85** | routes.ts:8865 |
| CPPA Playback (during reading) | `CAT_WR_HA_VOICE_ENTITY` | **0.75** | routes.ts:7263 |
| CPPA Playback (during reading) | `NEST_SPEAKER_ENTITY` | **0.75** | routes.ts:7267 |
| Nest retry logic | `NEST_SPEAKER_ENTITY` | **0.75** | routes.ts:7544 |
| Stop/cleanup (TTS stop, playback stop) | Target entity | **0.50** | routes.ts:10375, 11918, 12069, 12172 |
| Spotify playback start | Volume target | **0.35** | routes.ts:14684 |
| Cat volume knob — normal step | Active speaker | **±0.05** per turn | routes.ts (cat-volume) |
| Cat volume knob — fast step | Active speaker | **±0.15** per turn | routes.ts (cat-volume) |
| Kitchen volume — step | Kitchen Echo Studio | **±0.05** per turn | routes.ts (kitchen-volume) |

---

## 7. Speaker Groups & Device Registry

### Named Constants (server/routes.ts top)

| Constant | Value | Purpose |
|----------|-------|---------|
| `BATHROOM_ECHO_ENTITY` | `media_player.nestaudio6787` | Bathroom/Cat WR Nest speaker |
| `KITCHEN_ECHO_ENTITY` | `media_player.echo_kitchen_studio_black_am` | Kitchen Echo Studio (Black) |
| `NEST_SPEAKER_ENTITY` | `media_player.nestaudio6787` | Nest/Google speaker for CPPA TTS playback |
| `CAT_WR_HA_VOICE_ENTITY` | `media_player.home_assistant_voice_097c38_media_player` | ESPHome HA Voice device — primary TTS prompt speaker |
| `PARTNER_PHONE_ENTITY` | `device_tracker.y_phone_app` | Yasu's phone for location tracking |
| `SPOTIFYPLUS_ENTITY` | `media_player.spotifyplus_byhomeyyz` | SpotifyPlus integration entity |

### Grouped Constants

| Constant | Entities | Purpose |
|----------|----------|---------|
| `NON_ALEXA_ENTITIES` | `[NEST_SPEAKER_ENTITY, CAT_WR_HA_VOICE_ENTITY]` | Speakers that are NOT Alexa — excluded from Alexa-specific commands |
| `CAT_ECHO_ENTITIES` | `["media_player.echo_cat_left_am", "media_player.echo_cat_right_am", "media_player.echo_cat_washroom_middle"]` | Cat washroom Echo speakers (3 units) |

### stopAllCatWashroomSpeakers() — What Gets Stopped

```
IF Spotify "Everywhere" group is playing:
├── media_player/media_stop → NEST_SPEAKER_ENTITY (Nest only)
└── media_player/media_stop → media_player.cat_washroom_media_group
    (Preserves Echo speakers so apartment-wide Spotify isn't interrupted)

ELSE (normal stop):
├── media_player/media_stop → NEST_SPEAKER_ENTITY
├── media_player/media_stop → CAT_ECHO_ENTITIES (all 3 Echos)
└── media_player/media_stop → media_player.cat_washroom_media_group
```

---

## 8. Spotify Player — Room Hotspots & Profiles

### Room Hotspots (Floorplan Map)

**Source:** `client/src/pages/spotify-player.tsx` line 129

| Room | Position (x%, y%, w%, h%) | Entity ID (individual) | Group Entity ID | Device Type |
|------|--------------------------|----------------------|----------------|-------------|
| Balcony | 2, 72, 18, 25 | `media_player.balcony_speaker` | `media_player.balcony_media_group` | echo |
| Queen Bedroom | 2, 38, 18, 33 | `media_player.queen_bedroom` | `media_player.queen_bedroom_media_group` | echo |
| Pug Washroom | 2, 5, 16, 32 | `media_player.echo_show_pug_am` | `media_player.pug_media_group` | echo_show |
| Hallway | 19, 5, 16, 32 | `media_player.hallway_2` | `media_player.hallway_media_group` | echo |
| Kitchen | 36, 5, 28, 45 | `media_player.kitchen_lr` | `media_player.kitchen_media_group` | echo |
| Living Room | 36, 52, 28, 45 | `media_player.kitchen_lr` | `media_player.living_room_media_group` | echo |
| King Bedroom | 65, 30, 33, 50 | `media_player.king_bedroom` | `media_player.king_bedroom_media_group` | echo |
| Cat Washroom | 84, 3, 14, 26 | `media_player.cat_speakers` | `media_player.cat_washroom_media_group` | echo |
| Closet | 65, 3, 18, 26 | `media_player.echo_closet_am` | `media_player.closet_media_group` | echo |
| Everywhere | 84, 78, 14, 18 | `media_player.byhome` | `media_player.byhome` | echo |

### Spotify User Profiles

**Profile: Bryn** (accent: blue #3b82f6)
| Artist/Playlist | Spotify URI | Search Query |
|-----------------|-------------|-------------|
| Katy Perry | `spotify:artist:6jJ0s89eD6GaHleKKya26X` | "Katy Perry" |
| Pink | `spotify:artist:1KCSPY1glIKqW2TotWuXOR` | "Pink singer" |
| Lady Gaga | `spotify:artist:1HY2Jd0NmPuamShAr6KMms` | "Lady Gaga" |
| Cher | `spotify:artist:72OaDtakiy6yFqkt4TsiFt` | "Cher" |
| This Is Me | `spotify:track:2MYDnXBdJkFRuWgyOjpdth` | "This Is Me Greatest Showman" |
| CHUM FM | _(no URI — radio)_ | "104.5 Chum FM" |
| Disney | `spotify:playlist:37i9dQZF1DX8C585qnMYHP` | "Disney hits" |
| Chill Electro | `spotify:playlist:37i9dQZF1DX4E3UdUs7fUx` | "Chill electronic" |
| Dinner Jazz | `spotify:playlist:37i9dQZF1DX4wta20PHgwo` | "Dinner jazz" |

**Profile: Yasu** (accent: sky blue #38bdf8, theme: sakura)
| Artist/Playlist | Spotify URI | Search Query |
|-----------------|-------------|-------------|
| 中島みゆき | `spotify:artist:7IKFMPUxJDZhKxFGYOawBo` | "Miyuki Nakajima" |
| YOASOBI | `spotify:artist:64tJ2EAv1R6UaZqc4iOCyj` | "YOASOBI" |
| Kenshi Yonezu | `spotify:artist:1snhtMLeb2DYoMOcVkiKnR` | "Kenshi Yonezu" |
| Aimyon | `spotify:artist:5Lak6GhYbSqhRimRYhE0dP` | "Aimyon" |
| ONE OK ROCK | `spotify:artist:7q4KJIqziJOKnsTaFKpMII` | "ONE OK ROCK" |
| Official HIGE DANdism | `spotify:artist:3YMVszTadghiHjPOYaG3PM` | "Official HIGE DANdism" |
| Vaundy | `spotify:artist:6k4bHMbRIf97CqMqmU7Xk4` | "Vaundy" |
| King Gnu | `spotify:artist:6n70eCqbtJhbMgsMet1WVb` | "King Gnu" |
| Aimer | `spotify:artist:0bAsR2unSRpn6BOpSbGhAu` | "Aimer" |
| Tokyo Disney | `spotify:track:2PdJJkPFzhJiMqUOT1GKsj` | "Tokyo Disney music" |

**Profile: Guest** (accent: violet #a78bfa)
| Artist/Playlist | Spotify URI | Search Query |
|-----------------|-------------|-------------|
| Dua Lipa | `spotify:artist:6M2wZ9GZgrQXHCFfjv46we` | "Dua Lipa" |
| The Weeknd | `spotify:artist:1Xyo4u8uXC1ZmMpatF05PJ` | "The Weeknd" |
| Taylor Swift | `spotify:artist:06HL4z0CvFAxyc27GXpf02` | "Taylor Swift" |
| Ed Sheeran | `spotify:artist:6eUKZXaKkcviH0Ku9w2n3V` | "Ed Sheeran" |
| Billie Eilish | `spotify:artist:6qqNVTkY8uBg9cP3Jd7DAH` | "Billie Eilish" |
| Harry Styles | `spotify:artist:6KImCVD70vtIoJWnq6nGn3` | "Harry Styles" |
| Doja Cat | `spotify:artist:5cj0lLjcoR7YOSnhnX0Po5` | "Doja Cat" |
| SZA | `spotify:artist:7tYKF4w9nC0nq9CsPZTHyP` | "SZA" |

### Japanese Room Names (Yasu/Sakura theme)
| English | Japanese |
|---------|----------|
| Balcony | バルコニー |
| Queen Bedroom | クイーンベッド |
| Pug Washroom | パグ洗面所 |
| Hallway | 廊下 |
| Kitchen | キッチン |
| Living Room | リビング |
| King Bedroom | キングベッド |
| Cat Washroom | 猫洗面所 |
| Closet | クローゼット |
| Everywhere | 全室 |

---

## 9. HA Service Calls — Full Trace

Every HA service call goes through two wrapper functions with built-in retry logic:

### haFetch() — GET requests
```
haFetch(url, options, maxRetries=3, label)
├── Timeout: 12 seconds per attempt
├── Retry delay: 1500ms × attempt number (1.5s, 3s, 4.5s)
└── 3 attempts total before throwing
```

### haServiceCall() — POST requests
```
haServiceCall(service, data, label)
├── URL: ${HOME_ASSISTANT_URL}/api/services/${service}
├── Auth: Bearer ${HOME_ASSISTANT_TOKEN}
├── Uses haFetch internally (3 retries, 12s timeout)
└── Returns Response object
```

### Complete Service Call Inventory

| Service | Entity | Context | Purpose |
|---------|--------|---------|---------|
| `media_player/play_media` | `CAT_WR_HA_VOICE_ENTITY` | Cat Lights TTS | Play TTS audio prompt |
| `media_player/play_media` | `NEST_SPEAKER_ENTITY` | Cat Lights TTS Fallback | Fallback TTS on Nest |
| `media_player/play_media` | `NEST_SPEAKER_ENTITY` | Chunk Playback | Play CPPA module chunks |
| `media_player/play_media` | `cat_washroom_media_group` | CHUM FM | Play radio (content_id: "play 104.5 chum fm") |
| `media_player/media_stop` | `NEST_SPEAKER_ENTITY` | Stop Playback | Stop Nest audio |
| `media_player/media_stop` | `CAT_ECHO_ENTITIES` | Stop Speakers | Stop all 3 cat Echos |
| `media_player/media_stop` | `cat_washroom_media_group` | Stop Group | Stop entire group |
| `media_player/volume_set` | Various | Volume Control | Set volume (see Section 6) |
| `media_player/turn_on` | `fire_tv_172_24_0_88` | TV Setup | Wake Fire Stick |
| `media_player/turn_on` | `tv_cat_wr` | TV Setup | Wake Samsung TV |
| `media_player/turn_off` | `fire_tv_172_24_0_88` | Goodbye | Turn off Fire Stick |
| `media_player/turn_off` | `tv_cat_wr` | Goodbye | Turn off Samsung TV |
| `media_player/select_source` | `tv_cat_wr` | TV Setup | Switch to HDMI1 |
| `input_boolean/turn_on` | `module_reading_pending` | Cat Lights | Signal prompt is active |
| `input_boolean/turn_off` | `module_reading_pending` | Cat Lights | Clear pending state |
| `input_boolean/turn_off` | `module_reading_confirmed` | Cat Lights | Reset confirmation |
| `tts/speak` | `tts.home_assistant_cloud` | Cloud TTS Fallback | Last-resort TTS method |
| `androidtv/adb_command` | `tablet_cat` | Tablet Setup | Wake + navigate + fullscreen |
| `androidtv/adb_command` | `fire_tv_172_24_0_88` | TV Setup | Wake + open Silk + immersive |
| `androidtv/adb_command` | All 7 tablets | Spotify Home | Navigate all tablets to HA dashboard |
| `notify/mobile_app` | `notify.mobile_app_iphone_10` | Push Notification | Send task reminders to Bryn's iPhone |

---

## 10. TTS Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **Primary Engine** | Edge TTS (Microsoft) | Active because HA Cloud TTS is rate-limited |
| **Edge TTS Voice** | `en-US-AndrewMultilingualNeural` | Male voice, multilingual |
| **Rate Limit Until** | April 1, 2026 | After this date, HA Cloud TTS may be used again |
| **Fallback Chain** | 1. Edge TTS → 2. HA Voice device → 3. Nest speaker → 4. HA Cloud TTS | |
| **Chunk Size** | 2000 characters | Text split into chunks for Nest playback |
| **Characters/Second** | 13 | Used to estimate chunk playback duration |
| **Max Consecutive Errors** | 5 | Stops playback after 5 TTS failures |
| **Max Session Age** | 4 hours (14,400,000 ms) | Auto-stops stale playback sessions |

### TTS Playback Flow (Nest Speaker)
```
For each chunk in CPPA module text:
├── Check if pre-prepared audio exists (from background prep job)
│   ├── Yes → Use cached audio file path
│   └── No → generateAndSaveTTSAudio(chunkText)
│       └── Edge TTS → save as .mp3 in /tts/ directory
├── playOnNestSpeaker(audioUrl)
│   ├── media_player/media_stop → NEST_SPEAKER_ENTITY (clear previous)
│   ├── media_player/volume_set → NEST_SPEAKER_ENTITY @ 0.75
│   └── media_player/play_media → NEST_SPEAKER_ENTITY
├── Wait for estimated duration (wordCount / 175 wpm × 60s + 1s buffer)
├── Poll Nest state to confirm playback finished
├── Emit chunk progress via WebSocket to PDF reader on tablet/TV
├── Update database: lastChunkIndex, checkedChunks
└── Move to next chunk
```

---

## 11. ADB Tablet Commands

### Spotify Home Button (POST /api/spotify/go-home)
Navigates all 7 tablets to `http://172.24.0.2:8123/lovelace/test-home`

| Tablet Entity | Name |
|--------------|------|
| `media_player.tablet_hallway_entrance` | Hallway Entrance |
| `media_player.tablet_hallway` | Hallway Main |
| `media_player.tablet_11` | Living Room |
| `media_player.bd24bb29_04a116d8_king` | King Bedroom |
| `media_player.tablet_queen` | Queen Bedroom |
| `media_player.tablet_kitchen_island` | Kitchen Island |
| `media_player.tablet_cat` | Cat Washroom |

**ADB Command:** `am start --activity-clear-task -a android.intent.action.VIEW -d "{url}" com.amazon.cloud9`

### Cat Washroom Tablet Setup (startConfirmedPlaybackFlow)
```
ADB commands for media_player.tablet_cat:
1. input keyevent KEYCODE_WAKEUP                    → Wake screen
2. settings put system screen_brightness 255          → Max brightness
3. am start --activity-clear-task ... Silk browser    → Navigate to PDF reader URL
4. settings put global policy_control immersive.full= → Set immersive mode
5. input keyevent KEYCODE_F11                         → Toggle fullscreen
```

### Fire Stick Setup (openUrlOnFireStick)
```
ADB commands for media_player.fire_tv_172_24_0_88:
1. input keyevent KEYCODE_WAKEUP                    → Wake Fire Stick
2. am force-stop com.amazon.cloud9                   → Kill existing Silk browser
3. am start ... -d "{url}" com.amazon.cloud9          → Open PDF reader URL
4. settings put global policy_control immersive.full= → Immersive mode (attempt 1)
5. settings put global policy_control immersive.full= → Immersive mode (attempt 2)
6. input keyevent KEYCODE_DPAD_CENTER                → Press center (dismiss dialogs)
```

---

## 12. HA Automation Created by App

### Partner Leaves Work Notification
**Endpoint:** POST /api/ha/automation/partner-leaves-work
**Purpose:** Creates an HA automation that notifies Bryn when Yasu leaves work

```
Automation config pushed to HA:
├── Trigger: device_tracker.y_phone_app state changes FROM "work zone" state
├── Condition: Time is between 15:00 and 22:00
├── Action: notify.mobile_app_iphone_10
│   └── Message: "Yasu just left work"
│   └── Title: "Partner Update"
```

---

## 13. Constants & Defaults Summary

### Server Configuration
| Constant | Value | Source |
|----------|-------|--------|
| `HOME_ASSISTANT_URL` | `https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa` | Hardcoded |
| `HOME_ASSISTANT_TOKEN` | From `process.env.HOME_ASSISTANT_TOKEN` | Secret |
| `SERVER_STARTUP_COOLDOWN_MS` | Prevents webhook fires during server restart | routes.ts |
| `CHARS_PER_SECOND` | 13 | TTS timing |
| `CHUNK_SIZE` | 2000 | Text chunking |
| `MAX_CONSECUTIVE_ERRORS` | 5 | Playback error limit |
| `MAX_SESSION_AGE_MS` | 14,400,000 (4 hours) | Stale session cleanup |
| Ticker update interval | 300,000 (5 minutes) | haTickerWebhook.ts |
| Confirmation wait timeout | 23,000 (23 seconds) | Cat lights prompt |
| Toothbrush poll interval | Periodic | Stop playback when brushing |

### Semester/Academic Constants (from shared/schema.ts)
| Constant | Value | Purpose |
|----------|-------|---------|
| `FIRST_WEEK` | 1 | First week of semester |
| `LAST_WEEK` | varies | Last week of semester |
| `DEFAULT_REMINDER_1` | 30 minutes | First task reminder |
| `DEFAULT_REMINDER_2` | 120 minutes (2 hours) | Second task reminder |
| `COURSES` | Array of course names | CPPA, CASL, etc. |

### App URLs
| URL | Purpose |
|-----|---------|
| `https://home-view--bkh416.replit.app` | Published/deployed app (used in all HA calls) |
| `http://172.24.0.2:8123/lovelace/test-home` | Local HA dashboard (tablet navigation target) |
| `https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa` | Nabu Casa cloud URL for HA API |

---

## Source Code Access Notes

| What | Can Agent Access? | Location |
|------|------------------|----------|
| Server routes & webhooks | **YES** | `server/routes.ts` (15,322 lines) |
| Ticker webhook | **YES** | `server/haTickerWebhook.ts` (222 lines) |
| Spotify integration | **YES** | `server/spotify.ts` (268 lines) |
| Spotify player UI | **YES** | `client/src/pages/spotify-player.tsx` (2,448 lines) |
| REST commands YAML | **YES** | `.local/ha-rest-commands.yaml` (32 lines) |
| HA configuration.yaml | **NO** | Lives on your HA instance, not in this codebase |
| HA automations.yaml | **NO** | Lives on your HA instance (only app-created ones visible) |
| HA scripts.yaml | **NO** | Lives on your HA instance |
| HA lovelace dashboards | **NO** | Lives on your HA instance |
| Card-mod configurations | **NO** | Would be in HA lovelace YAML, not in this codebase |
| HA scenes/helpers | **NO** | Lives on your HA instance |

The app interacts with your HA instance purely through the **REST API** — it does not store or manage your HA YAML configuration files. All automations, scripts, and dashboard configs on the HA side would need to be checked directly on your Home Assistant instance.
