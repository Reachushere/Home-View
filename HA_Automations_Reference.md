# Home Assistant Automations — Complete Reference
**Generated:** March 25, 2026
**App URL:** https://home-view--bkh416.replit.app

---

## HOW THIS WORKS

Your app acts as the "brain" — Home Assistant triggers webhooks on your app, and the app responds by calling HA services back. The HA side uses **REST commands** (defined in your `configuration.yaml`) to call your app's webhook endpoints. The app then makes **HA service calls** (media_player, input_boolean, androidtv, etc.) to control your devices.

```
[HA Automation] → REST Command → [App Webhook Endpoint] → HA Service Call → [Device]
```

---

## AUTOMATION 1: Cat Washroom Lights — CPPA Study Prompt

### What it does
When you turn on the cat washroom lights, the system checks if you have unlistened school readings for this week. If yes, it asks via voice: "Would you like to play [reading name]?" and waits for your answer. If you confirm, it starts reading the material aloud on the Nest speaker while displaying the text on your tablet and TV. If you don't confirm within 23 seconds, it plays CHUM FM 104.5 instead. When you turn the lights OFF, everything stops and your progress is saved.

### HA Side (what you need in configuration.yaml)
```yaml
rest_command:
  cat_lights_webhook:                                    # Name you call from HA automations
    url: "https://home-view--bkh416.replit.app/api/webhook/cat-lights"
    method: POST
    headers:
      Content-Type: "application/json"
```

### HA Automation (what triggers it)
```yaml
automation:
  - alias: "Cat Washroom Lights Changed"
    trigger:
      - platform: state                                  # Fires on any state change
        entity_id: light.cat_lights                      # The cat washroom light entity
    action:
      - service: rest_command.cat_lights_webhook          # Calls the app webhook
```

### App Side — LIGHTS OFF Flow
```
POST /api/webhook/cat-lights
│
├── Query light.cat_lights state from HA → "off"
│
├── IF CPPA playback is active:
│   └── stopNestPlaybackWithGoodbye('light_off')
│       ├── Save current chunk index to database
│       ├── media_player/media_stop → media_player.nestaudio6787
│       │   Stops the Nest speaker audio
│       ├── media_player/turn_off → media_player.fire_tv_172_24_0_88
│       │   Turns off the Fire Stick
│       └── media_player/turn_off → media_player.tv_cat_wr
│           Turns off the Samsung TV
│
├── IF TTS session is active:
│   └── stopTTSSession() — kills the chunk-by-chunk reading
│
├── stopAllCatWashroomSpeakers()
│   ├── media_player/media_stop → media_player.nestaudio6787
│   │   Stops Nest speaker (CHUM FM or anything else)
│   ├── media_player/media_stop → [echo_cat_left, echo_cat_right, echo_cat_middle]
│   │   Stops all 3 cat washroom Echo speakers
│   └── media_player/media_stop → media_player.cat_washroom_media_group
│       Stops the entire cat washroom speaker group
│
├── Reset state flags:
│   catLightsPromptPending = false
│   catWashPlaybackTrigger = null
│
└── Response: { action: "stopped", stoppedItems: [...] }
```

### App Side — LIGHTS ON Flow
```
POST /api/webhook/cat-lights
│
├── Query light.cat_lights state from HA → "on"
│
├── GUARD: Server startup cooldown (skip if server just restarted)
├── GUARD: Skip if playback already active
├── GUARD: Skip if another prompt is already pending
│
├── ★ STOP any leftover media (CHUM FM, etc):
│   └── stopAllCatWashroomSpeakers()
│       ├── media_player/media_stop → media_player.nestaudio6787
│       ├── media_player/media_stop → [all 3 Echo speakers]
│       └── media_player/media_stop → media_player.cat_washroom_media_group
│
├── Look up active semester settings from database
├── Calculate current week number (accounts for reading week)
├── Find next unlistened CPPA file for this week
│   ├── Check database cache first
│   └── If not cached → sync from OneDrive, then check again
│
├── IF no unlistened files found:
│   └── playChumFmRadio()
│       └── media_player/play_media → media_player.cat_washroom_media_group
│           content_type: "custom"
│           content_id: "play 104.5 chum fm"
│       └── DONE (no prompt needed)
│
├── Prepare TTS prompt:
│   message = "Would you like to play [file description]?"
│
├── Set HA booleans:
│   ├── input_boolean/turn_off → input_boolean.module_reading_confirmed
│   └── input_boolean/turn_on → input_boolean.module_reading_pending
│
├── Set speaker volumes for prompt:
│   ├── media_player/volume_set → media_player.home_assistant_voice_097c38 @ 0.85
│   └── media_player/volume_set → media_player.nestaudio6787 @ 0.85
│
├── Generate TTS audio (Edge TTS, voice: en-US-AndrewMultilingualNeural)
│
├── Play TTS prompt (with fallback chain):
│   ├── TRY 1: media_player/play_media → media_player.home_assistant_voice_097c38
│   │   Plays on HA Voice ESPHome device
│   ├── TRY 2: media_player/play_media → media_player.nestaudio6787
│   │   Falls back to Nest speaker
│   └── TRY 3: tts/speak → tts.home_assistant_cloud → HA Voice device
│       Last resort: HA Cloud TTS (Nabu Casa)
│
├── Wait 2 seconds (let prompt finish)
│
├── WAIT FOR CONFIRMATION (up to 23 seconds):
│   ├── Poll input_boolean.module_reading_confirmed every 1.5s
│   └── OR receive POST /api/webhook/cat-lights-confirm
│
├── Reset booleans:
│   ├── input_boolean/turn_off → input_boolean.module_reading_pending
│   └── input_boolean/turn_off → input_boolean.module_reading_confirmed
│
├── IF NOT CONFIRMED (23s timeout):
│   └── playChumFmRadio()
│       └── media_player/play_media → media_player.cat_washroom_media_group
│           Plays CHUM FM 104.5
│
└── IF CONFIRMED:
    └── startConfirmedPlaybackFlow() — See AUTOMATION 3
```

---

## AUTOMATION 2: Cat Washroom Lights — Confirmation

### What it does
When you say "yes" (or press a button) to confirm you want to hear the reading, this webhook resolves the pending prompt from Automation 1 and triggers the full playback flow.

### HA Side
```yaml
rest_command:
  cat_lights_confirm_webhook:
    url: "https://home-view--bkh416.replit.app/api/webhook/cat-lights-confirm"
    method: POST
    headers:
      Content-Type: "application/json"
```

### App Side
```
POST /api/webhook/cat-lights-confirm
│
├── Resolve the pending confirmation promise → true
│   (This unblocks the 23-second wait in Automation 1)
│
├── Stop media on cat washroom Echo speakers:
│   └── media_player/media_stop → [echo_cat_left, echo_cat_right, echo_cat_middle]
│       Clears any Echo audio so it doesn't compete with Nest playback
│
└── Response: { action: "confirmed" }
```

---

## AUTOMATION 3: Confirmed Playback Flow (CPPA Module Reading)

### What it does
This is the core reading flow. It navigates your tablet and TV to the PDF reader page, turns on the Fire Stick and Samsung TV, plays a confirmation message ("Okay, I will now play..."), and then starts reading the module text chunk by chunk on the Nest speaker. The tablet and TV display the text in sync.

### Triggered by
- Automation 1 (lights confirmation)
- Automation 5 (shower button)
- Automation 9 (voice commands: resume, restart, reset, skip)
- Automation 11 (play-urgent-pdf webhook)

### App Side
```
startConfirmedPlaybackFlow(file, logPrefix, voice='echo', confirmationTTS)
│
├── Calculate resume point:
│   savedChunk = file.lastChunkIndex (from database)
│   resumeFromChunk = max(0, savedChunk - 1)     ← goes back 1 chunk for context
│
├── Build URLs:
│   readerUrl = /pdf-reader/{fileId}?catWashFollow=true&resumeChunk={N}&voice=echo&fullscreen=true
│   tvFollowUrl = /pdf-reader/{fileId}?catWashFollow=true&followOnly=true&...
│
├── Set tablet navigation commands:
│   ├── tablet-nav "master" → readerUrl         (main tablet controls playback)
│   └── tablet-nav "tv" → tvFollowUrl           (TV follows along, display only)
│
├── PARALLEL SETUP (all happen simultaneously):
│
│   ├── TABLET SETUP (media_player.tablet_cat):
│   │   ├── androidtv/adb_command: input keyevent KEYCODE_WAKEUP
│   │   │   Wakes the tablet screen
│   │   ├── androidtv/adb_command: settings put system screen_brightness 255
│   │   │   Sets brightness to maximum
│   │   ├── Wait 1.5 seconds
│   │   ├── androidtv/adb_command: am start --activity-clear-task -a VIEW -d "{readerUrl}" com.amazon.cloud9
│   │   │   Opens the PDF reader URL in Silk browser
│   │   ├── Wait 1 second
│   │   ├── androidtv/adb_command: settings put global policy_control immersive.full=com.amazon.cloud9
│   │   │   Sets immersive mode (hides status/nav bars)
│   │   └── androidtv/adb_command: input keyevent KEYCODE_F11
│   │       Toggles fullscreen
│   │
│   ├── TV SETUP:
│   │   ├── media_player/turn_on → media_player.fire_tv_172_24_0_88
│   │   │   Wakes the Fire Stick
│   │   ├── media_player/turn_on → media_player.tv_cat_wr
│   │   │   Turns on the Samsung TV
│   │   ├── Wait 3 seconds (let TV boot)
│   │   ├── media_player/select_source → media_player.tv_cat_wr, source: "HDMI1"
│   │   │   Switches TV input to Fire Stick
│   │   └── openUrlOnFireStick():
│   │       ├── androidtv/adb_command: input keyevent KEYCODE_WAKEUP
│   │       ├── androidtv/adb_command: am force-stop com.amazon.cloud9
│   │       │   Kills existing Silk browser
│   │       ├── Store redirect URL at /api/cat-wash/tv-follow
│   │       ├── androidtv/adb_command: am start -a VIEW -d "{redirectUrl}" com.amazon.cloud9
│   │       │   Opens redirect URL (which then redirects to PDF reader)
│   │       ├── Wait 8 seconds
│   │       ├── androidtv/adb_command: settings put global policy_control immersive.full=...
│   │       │   Immersive mode attempt 1
│   │       ├── androidtv/adb_command: settings put global policy_control immersive.full=...
│   │       │   Immersive mode attempt 2
│   │       └── androidtv/adb_command: input keyevent KEYCODE_DPAD_CENTER
│   │           Press center button (dismiss any dialogs)
│   │
│   ├── PRE-GENERATE FIRST AUDIO CHUNK:
│   │   ├── Check if pre-prepared audio exists (from background audio prep job)
│   │   │   ├── Yes → use cached file path
│   │   │   └── No → generateAndSaveTTSAudio(chunkText)
│   │   │       Edge TTS → save as .mp3 in /tts/ directory
│   │
│   └── CONFIRMATION TTS:
│       ├── Generate TTS: "Okay, I will now play [file description]."
│       ├── playOnNestSpeaker(audioUrl)
│       │   ├── media_player/media_stop → media_player.nestaudio6787
│       │   ├── media_player/volume_set → media_player.nestaudio6787 @ 0.75
│       │   └── media_player/play_media → media_player.nestaudio6787
│       └── Wait for estimated TTS duration (word count / 140 wpm)
│
├── Set volume for playback:
│   ├── media_player/volume_set → media_player.home_assistant_voice_097c38 @ 0.75
│   └── media_player/volume_set → media_player.nestaudio6787 @ 0.75
│
├── Extract text from PDF file
├── Split into chunks (2000 chars each)
│
└── startNestChunkPlayback():
    │
    FOR EACH CHUNK (starting from resumeFromChunk):
    ├── Check if session is still valid (not cancelled, not stale)
    ├── Generate or use pre-prepared TTS audio for chunk
    ├── playOnNestSpeaker(audioUrl)
    │   ├── media_player/media_stop → media_player.nestaudio6787
    │   ├── media_player/volume_set → media_player.nestaudio6787 @ 0.75
    │   └── media_player/play_media → media_player.nestaudio6787
    ├── Wait for estimated chunk duration (word count / 175 wpm + 1s buffer)
    ├── Poll Nest speaker state to confirm playback finished
    ├── Update database: lastChunkIndex, checkedChunks
    ├── Emit progress to connected tablet/TV via polling endpoint
    └── Pre-generate NEXT chunk audio in background (pipeline)
    │
    WHEN ALL CHUNKS COMPLETE:
    ├── Mark file as "listened" in database
    ├── Play goodbye TTS: "All done with [file]. Great work Bryn!"
    ├── Find next unlistened file
    │   ├── If found → start next file automatically
    │   └── If none → stop playback, turn off TV/Fire Stick
    └── stopNestPlaybackWithGoodbye('complete')
```

---

## AUTOMATION 4: Cat Washroom Knob Press — Master STOP

### What it does
When you press the physical knob/button in the cat washroom, everything stops immediately. If CPPA playback is active, it saves your progress first. If nothing is playing, it kills any media on all washroom speakers (stops CHUM FM, etc.).

### HA Side
```yaml
rest_command:
  cat_knob_press_webhook:
    url: "https://home-view--bkh416.replit.app/api/webhook/cat-knob-press"
    method: POST
    headers:
      Content-Type: "application/json"
```

### App Side
```
POST /api/webhook/cat-knob-press
│
├── IF CPPA playback is active:
│   └── Internally calls POST /api/webhook/cat-wash-stop
│       ├── stopNestPlaybackWithGoodbye('knob_press')
│       │   ├── Save chunk progress to database
│       │   ├── media_player/media_stop → media_player.nestaudio6787
│       │   ├── media_player/turn_off → media_player.fire_tv_172_24_0_88
│       │   └── media_player/turn_off → media_player.tv_cat_wr
│       └── Stop TTS session if active
│
├── ELSE (no CPPA playing — just stop everything):
│   └── stopAllCatWashroomSpeakers()
│       ├── media_player/media_stop → media_player.nestaudio6787
│       ├── media_player/media_stop → [echo_cat_left, echo_cat_right, echo_cat_middle]
│       └── media_player/media_stop → media_player.cat_washroom_media_group
│
└── Response: { success: true, action: "stopped" }
```

---

## AUTOMATION 5: Cat Washroom Shower Button — Direct Play

### What it does
When you press the shower button, it skips the "would you like to play?" prompt and immediately starts the next unlistened CPPA reading. If there are no readings left for the week, it plays CHUM FM instead. If CPPA playback is already running, it does nothing (assumes you're just toggling the shower/fan).

### HA Side
```yaml
rest_command:
  cat_wash_webhook:
    url: "https://home-view--bkh416.replit.app/api/webhook/cat-wash"
    method: POST
    headers:
      Content-Type: "application/json"
```
Note: The shower button automation in HA should call `rest_command.cat_wash_webhook` or directly hit `/api/webhook/cat-shower-button`.

### App Side
```
POST /api/webhook/cat-shower-button
│
├── GUARD: Server startup cooldown
├── GUARD: Skip if CPPA playback already active
├── GUARD: Skip if lights prompt already pending
│
├── Look up active semester
│   ├── No active semester → playChumFmRadio()
│   │   └── media_player/play_media → media_player.cat_washroom_media_group
│   │       "play 104.5 chum fm"
│   └── Active semester → continue
│
├── Calculate current week, find next unlistened file
│   ├── Check database first
│   └── If not cached → sync from OneDrive
│
├── IF no files:
│   └── playChumFmRadio() → CHUM FM on speaker group
│
├── IF file found:
│   ├── Response: { action: "playing", file: {...} }
│   ├── Generate confirmation TTS: "Okay, I will now play [file]."
│   └── startConfirmedPlaybackFlow() — See AUTOMATION 3
│       (No prompt/wait — goes directly into playback)
```

---

## AUTOMATION 6: Cat Washroom Volume Knob

### What it does
When you turn the rotary encoder in the cat washroom, it adjusts the volume on whichever speakers are currently playing. It checks which speakers are active (Nest, Echo group, etc.) and adjusts only those. Normal rotation = ±5% per click, fast rotation = ±15%.

### HA Side
```yaml
rest_command:
  cat_volume_webhook:
    url: "https://home-view--bkh416.replit.app/api/webhook/cat-volume"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"direction":"{{ direction }}"}'
```
**Variable `direction`:** `"up"` or `"down"` — set by your HA automation based on encoder rotation.

### App Side
```
POST /api/webhook/cat-volume
Body: { direction: "up" | "down", speed: "normal" | "fast" }
│
├── Query state of cat washroom speakers:
│   ├── GET /api/states/media_player.nestaudio6787
│   └── GET /api/states/media_player.cat_washroom_media_group
│
├── Find which are currently "playing", "paused", or "buffering"
│   └── If none active → default to Nest speaker
│
├── Calculate new volume:
│   ├── Normal step: current ± 0.05
│   └── Fast step: current ± 0.15
│   └── Clamped to 0.0 – 1.0
│
├── For each active speaker:
│   └── media_player/volume_set → {speaker entity} @ newVolume
│
└── Response: { success: true, direction, speed }
```

---

## AUTOMATION 7: Toothbrush Detection — Auto Stop

### What it does
When the app detects your toothbrush has started running (state changes from "idle" or "charging" to "brushing"), it automatically stops the CPPA playback and saves your progress. This way you don't need to manually stop the reading when you start brushing.

### How it works
This is NOT triggered by an HA automation — the app polls the toothbrush sensor directly.

### App Side
```
startToothbrushPolling() — Started whenever CPPA playback begins
│
├── Poll sensor.toothbrush_bryn_toothbrush_state every few seconds
│   └── GET /api/states/sensor.toothbrush_bryn_toothbrush_state
│
├── IF state = "running" or "brushing":
│   └── Internally triggers cat-wash-stop logic
│       ├── stopNestPlaybackWithGoodbye('toothbrush')
│       │   ├── Save progress to database
│       │   ├── media_player/media_stop → media_player.nestaudio6787
│       │   ├── media_player/turn_off → Fire Stick
│       │   └── media_player/turn_off → Samsung TV
│       └── Play goodbye TTS: "Stopping playback. Your progress has been saved."
│
└── Polling stops when playback ends
```

### Webhook alternative
```
POST /api/webhook/cat-wash-stop
Body: { trigger: "toothbrush" }
│
├── IF CPPA playback active:
│   └── stopNestPlaybackWithGoodbye('toothbrush')
│       ├── Save chunk progress
│       ├── media_player/media_stop → media_player.nestaudio6787
│       ├── media_player/turn_off → media_player.fire_tv_172_24_0_88
│       └── media_player/turn_off → media_player.tv_cat_wr
│
├── IF TTS session active:
│   └── stopTTSSession()
│
└── Response: { action: "stopped", stoppedItems: [...] }
```

---

## AUTOMATION 8: Kitchen Volume Control

### What it does
Controls the Kitchen Echo Studio (Black) volume via a rotary encoder or HA automation.

### App Side
```
POST /api/webhook/kitchen-volume
Body: { direction: "up" | "down", speed: "normal" | "fast" }
│
├── GET current volume of media_player.echo_kitchen_studio_black_am
│
├── Calculate new volume:
│   ├── Normal: ± 0.05
│   └── Fast: ± 0.15
│
└── media_player/volume_set → media_player.echo_kitchen_studio_black_am @ newVolume
```

---

## AUTOMATION 9: Voice Commands

### What it does
Handles voice commands spoken in the cat washroom. You can pause, resume, stop, skip, restart, or reset the current CPPA reading. Each command gives voice feedback via the Nest speaker.

### HA Side
The HA voice assistant (or a custom intent) should call:
```yaml
rest_command:
  voice_command_webhook:
    url: "https://home-view--bkh416.replit.app/api/webhook/voice-command"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"command":"{{ command }}"}'
```

### App Side — PAUSE
```
POST /api/webhook/voice-command
Body: { command: "pause" }
│
├── IF nothing playing:
│   └── TTS: "Nothing is playing right now."
│
├── Save current chunk progress to database
├── Stop Nest speaker: media_player/media_stop → media_player.nestaudio6787
├── Stop word advancement (text highlighting on tablet)
├── Set playback state to inactive
├── Stop toothbrush polling
│
├── Start 10-MINUTE AUTO-STOP TIMER:
│   └── After 10 minutes with no "resume":
│       ├── Send stop command to tablet + TV
│       ├── media_player/turn_off → media_player.fire_tv_172_24_0_88
│       ├── media_player/turn_off → media_player.samsung_tv
│       └── TTS: "Pause timed out. Playback has been stopped. Your progress has been saved."
│
├── TTS: "Paused. Say resume to continue, or I'll stop in 10 minutes."
│
└── Response: { action: "paused", file: "...", chunk: N }
```

### App Side — RESUME
```
POST /api/webhook/voice-command
Body: { command: "resume" }
│
├── IF nothing is paused:
│   └── TTS: "Nothing is paused right now."
│
├── Clear auto-stop timer
├── Look up paused file from database
│
├── Clear Echo speakers:
│   └── media_player/media_stop → [echo_cat_left, echo_cat_right, echo_cat_middle]
│
├── TTS: "Resuming [file name]."
│
└── startConfirmedPlaybackFlow(file) — See AUTOMATION 3
    (Resumes from saved chunk position)
```

### App Side — STOP
```
POST /api/webhook/voice-command
Body: { command: "stop" }
│
├── IF nothing playing or paused:
│   └── TTS: "Nothing is playing."
│
├── IF CPPA playback active:
│   └── stopNestPlaybackWithGoodbye('voice_command_stop')
│       ├── Save progress
│       ├── media_player/media_stop → Nest
│       ├── media_player/turn_off → Fire Stick
│       ├── media_player/turn_off → Samsung TV
│       └── TTS goodbye: "Stopped. Your progress has been saved. See you next time Bryn."
│
├── IF paused (not actively playing):
│   ├── Send stop to tablet + TV displays
│   ├── media_player/turn_off → media_player.fire_tv_172_24_0_88
│   ├── media_player/turn_off → media_player.samsung_tv
│   └── TTS: "Stopped. Your progress has been saved. See you next time Bryn."
│
└── Stop TTS session if active
```

### App Side — SKIP (next file)
```
POST /api/webhook/voice-command
Body: { command: "skip" }
│
├── IF nothing playing:
│   └── TTS: "Nothing is playing to skip."
│
├── Mark current file as "listened" (complete) in database
├── Stop current Nest playback
│
├── Find next unlistened file for this week
│   ├── IF no more files:
│   │   ├── media_player/turn_off → Fire Stick + Samsung TV
│   │   └── TTS: "Skipped. No more readings for this week. Great work Bryn!"
│   │
│   └── IF next file found:
│       ├── Clear Echo speakers
│       ├── TTS: "Skipped. Now playing [next file]."
│       └── startConfirmedPlaybackFlow(nextFile) — See AUTOMATION 3
```

### App Side — RESTART (go back one chunk)
```
POST /api/webhook/voice-command
Body: { command: "restart" }  (also accepts "go_back")
│
├── IF nothing playing:
│   └── TTS: "Nothing is playing to restart."
│
├── Calculate target chunk = current chunk - 1 (minimum 0)
├── Stop current playback
├── Save new chunk position to database
│
├── Clear Echo speakers
├── TTS: "Going back. Restarting from an earlier section."
│
└── startConfirmedPlaybackFlow(file, fromChunk) — See AUTOMATION 3
```

### App Side — RESET (start from beginning)
```
POST /api/webhook/voice-command
Body: { command: "reset" }
│
├── IF nothing playing:
│   └── TTS: "Nothing is playing to reset."
│
├── Reset file progress in database:
│   lastChunkIndex = 0
│   checkedChunks = '[]'
├── Stop current playback
│
├── Clear Echo speakers
├── TTS: "Resetting [file]. Starting from the beginning."
│
└── startConfirmedPlaybackFlow(file, fromChunk=0) — See AUTOMATION 3
```

---

## AUTOMATION 10: Dashboard Ticker — Push to HA Sensors

### What it does
Every 5 minutes, the app fetches weather, news, pollen data, and course announcements, then pushes them to 3 HA sensors. These sensors can be used in your Lovelace dashboard cards to display a scrolling news ticker, weather info, etc.

### App Side (runs automatically)
```
pushTickerToHA() — runs every 5 minutes (300,000 ms)
│
├── Fetch from internal APIs:
│   ├── GET /api/weather-alerts     (3s timeout)
│   ├── GET /api/weather            (3s timeout)
│   ├── GET /api/pollen             (3s timeout)
│   └── GET /api/news               (4s timeout)
│
├── Fetch course announcements from database
│
├── Build ticker segments:
│   ├── ⚠️ Weather alerts (if any)
│   ├── 🌡️ Current temperature + conditions
│   ├── 📅 3-day forecast
│   ├── 🌿 Pollen levels + AQI
│   ├── 📢 Course announcements (within current week)
│   └── 📰 News headlines (Canadian → US → BBC, interleaved)
│
├── Push to HA via POST /api/states/{entity}:
│
│   ├── sensor.dashboard_ticker
│   │   State: first 255 chars of combined text
│   │   Attributes: full_text, segments[], weather, forecast_3day,
│   │               forecast_brief, pollen, alerts[], announcements[],
│   │               news[], news_detailed[]
│   │
│   ├── sensor.dashboard_weather
│   │   State: "1°C — Clear | Wind: 12 km/h"
│   │   Attributes: forecast_3day, forecast_brief, pollen, alerts[]
│   │
│   └── sensor.dashboard_news
│       State: "28 headlines"
│       Attributes: headlines[], headlines_detailed[]
│
└── Log: "[HA Ticker] Pushed 32 segments to HA (weather: yes, news: 28, alerts: 0)"
```

---

## AUTOMATION 11: Play Urgent PDF — On-Demand Webhook

### What it does
When called from HA (via a script, button, or automation), immediately finds and starts playing the most urgent unlistened PDF reading. Prioritizes CPPA modules first, then other modules, then CPPA readings, then other readings.

### HA Side
```yaml
rest_command:
  play_urgent_pdf:
    url: "https://home-view--bkh416.replit.app/api/webhook/play-urgent-pdf"
    method: POST
    content_type: "application/json"
    headers:
      x-webhook-secret: "[YOUR_SITE_PASSWORD]"
    payload: '{"entity_id": "media_player.nestaudio6787"}'
```

### App Side
```
POST /api/webhook/play-urgent-pdf
Body: { entity_id: "media_player.nestaudio6787" }  (optional, defaults to Nest)
│
├── Authenticate via x-webhook-secret header
│
├── Validate entity_id against allowed speaker list
│   Allowed: Nest, HA Voice, Kitchen Echo, all 3 cat Echos,
│            Closet Echo, LR Couch Echo, Hallway Echo,
│            King L/R/TV Echos, Kitchen Cupboards/Fridge/Hutch/Island/Studio Echos, LR Hub Echo
│   Default: media_player.nestaudio6787 (Nest speaker)
│
├── Get current semester week
├── Find all unlistened files, ordered by priority:
│   1. CPPA module files (highest priority)
│   2. Other course module files
│   3. CPPA reading files
│   4. Other course reading files
│
├── IF no files:
│   ├── IF target is Nest/HA Voice:
│   │   └── TTS: "All week N readings are complete. Great job!"
│   │       media_player/play_media → target entity
│   └── IF target is Alexa device:
│       └── notify/alexa_media → target entity
│           "All week N readings are complete."
│
└── IF file found:
    └── startConfirmedPlaybackFlow(file) — See AUTOMATION 3
```

---

## AUTOMATION 12: Partner Leaves Work Notification

### What it does
Creates an HA automation that sends a push notification to Bryn's iPhone when Yasu's phone leaves the "work" zone.

### App Side (creates the automation in HA)
```
POST /api/ha/automation/partner-leaves-work
│
├── Build automation config:
│   alias: "Notify when Yasu leaves work"
│   trigger:
│     platform: zone
│     entity_id: device_tracker.y_phone_app    ← Yasu's phone
│     zone: zone.work
│     event: "leave"
│   action:
│     service: notify.mobile_app_iphone_10     ← Bryn's iPhone
│     data:
│       title: "Yasu Left Work"
│       message: "Yasu just left the work zone."
│       push: sound: "default", interruption_level: "time-sensitive"
│
├── TRY 1: POST /api/services/automation/create
│   Push automation config to HA
│
├── TRY 2 (if first fails):
│   POST /api/config/automation/config/uni_cal_partner_leaves_work
│   Push via config endpoint instead
│
└── Response: { success: true }
```

---

## AUTOMATION 13: Spotify — Stop All Playback

### What it does
Stops Spotify playback on all speakers in the apartment. Sends media_stop to the SpotifyPlus entity and every speaker that has active Spotify playback, then pauses the Spotify API itself.

### App Side
```
POST /api/spotify/stop-all
│
├── media_player/media_stop → media_player.spotifyplus_byhomeyyz
│   Stops the SpotifyPlus integration entity
│
├── For each tracked active playback:
│   └── media_player/media_stop → {speaker entity}
│       Stops Spotify on that individual speaker
│
├── Spotify API: pause()
│   Pauses playback via the Spotify Web API
│
├── Clear all tracked playback state
│
└── Response: { ok: true, cleared: N, results: [...] }
```

---

## AUTOMATION 14: Spotify — Flick to Device

### What it does
"Flicks" (transfers) the Spotify player UI to a specific tablet or TV in the apartment. Uses ADB commands to navigate the device's Silk browser to the Spotify player page.

### App Side
```
POST /api/spotify/flick
Body: { deviceId: "lr_tablet" }   ← matches FLICK_DEVICES id
│
├── Look up device from FLICK_DEVICES registry
├── Build Spotify URL: /spotify?auth=bryn
│
├── IF device can display (tablet/TV):
│   └── androidtv/adb_command → {device entity}
│       am start --activity-clear-task -a VIEW -d "{spotifyUrl}" com.amazon.cloud9
│       Opens Spotify player in Silk browser on that device
│
└── Response: { ok: true, device: "..." }
```

---

## AUTOMATION 15: Spotify — Home Button (Navigate All Tablets Home)

### What it does
When you press the Home button on the Spotify player, it navigates ALL 7 tablets back to the Home Assistant dashboard and navigates your current browser to the HA dashboard too.

### App Side
```
POST /api/spotify/go-home
│
├── For each of 7 tablets (in parallel):
│   ├── media_player.tablet_hallway_entrance (Hallway Entrance)
│   ├── media_player.tablet_hallway (Hallway Main)
│   ├── media_player.tablet_11 (Living Room)
│   ├── media_player.bd24bb29_04a116d8_king (King Bedroom)
│   ├── media_player.tablet_queen (Queen Bedroom)
│   ├── media_player.tablet_kitchen_island (Kitchen Island)
│   └── media_player.tablet_cat (Cat Washroom)
│
│   Each tablet:
│   └── androidtv/adb_command → {tablet entity}
│       am start --activity-clear-task -a VIEW -d "http://172.24.0.2:8123/lovelace/test-home" com.amazon.cloud9
│       Opens HA dashboard in Silk browser
│
└── Response: { ok: true, navigating: 7 }

CLIENT SIDE (browser):
├── If on dev environment → navigate to "/"
└── If on production → navigate to "http://172.24.0.2:8123/lovelace/test-home"
```

---

## AUTOMATION 16: Voice Announcements & Push Notifications

### What it does
Sends voice announcements to Echo speakers and push notifications to Bryn's iPhone for task reminders.

### Voice Announcement
```
POST /api/ha-announce
Body: { message: "Your assignment is due in 30 minutes!" }
│
└── sendEchoVoiceAnnouncement(message)
    └── Sends TTS announcement to Echo speakers via Alexa Media Player
```

### Push Notification Reminder
```
POST /api/ha-push/reminder
Body: { taskId: 123 }
│
├── Look up task from database
│
└── sendHaTaskReminder({...})
    └── notify.mobile_app_iphone_10
        title: "[Course] [Type] Due"
        message: "[Task title] - due [time]"
        push: sound: "default", interruption_level: "time-sensitive"
```

---

## AUTOMATION 17: Alexa Reminder Announcements

### What it does
Runs every 60 seconds in the background. Checks if any tasks have reminders due within the current minute and sends voice announcements to Echo speakers and push notifications.

### App Side (background process)
```
Alexa Reminder Scheduler — checks every 60 seconds
│
├── Get all incomplete tasks from database
├── For each task, check reminder times:
│   ├── reminder1: 30 minutes before due
│   ├── reminder2: 120 minutes (2 hours) before due
│   ├── reminder3: custom (if set)
│   └── reminder4: custom (if set)
│
├── IF a reminder is due now (within the current minute):
│   ├── Send Echo voice announcement
│   │   └── sendEchoVoiceAnnouncement("Reminder: [task] is due in [time]")
│   └── Send push notification
│       └── notify.mobile_app_iphone_10
│
└── Track sent reminders to avoid duplicates
```

---

## AUTOMATION 18: Spotify Light-Off Auto-Navigate

### What it does
When the Spotify player page is open on a tablet and the associated room's lights turn off, the tablet automatically navigates home. This prevents tablets from staying on the Spotify page after you leave a room.

### Client Side (runs in browser on each tablet)
```
useEffect — polls every 3 seconds
│
├── GET /api/ha-entity-state?entity={lightEntity}
│   (lightEntity is passed as URL parameter to the Spotify page)
│
├── IF light state = "off":
│   ├── POST /api/spotify/go-home
│   │   Sends ADB command to ALL tablets → navigate to HA dashboard
│   └── Current browser → navigate to HA dashboard
│
└── IF light state = "on":
    └── Do nothing, keep Spotify page open
```
