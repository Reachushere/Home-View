# Rascal Insulin Timer — Home Assistant Drop-in Package

Goal:
- Remove the Bryn meds timer (purple-circled in `image_1776480147259.png`).
- Delete the existing Rascal/dogs timer.
- In the spot where Bryn meds was, put a duplicate of the blank grey button
  (purple-circled on the right side in `image_1776480171165.png`) with a cat
  icon overlay.
- Number below = time until next 7:30 (am or pm).
- Daily 7:30 AM and 7:30 PM Alexa announcement (same style as Yasu med script).
- When timer hits 0: cat icon blinks AND red border around the dashboard
  blinks.
- Tapping the icon resets the timer to the *next* 7:30 (am or pm).

---

## 1. Upload the cat icon to HA

Copy `public/ha-assets/cat.png` (this repo) into HA at:

```
/config/www/lovelace/icons/cat.png
```

It will then be reachable from Lovelace as `/local/lovelace/icons/cat.png`.

You'll also want a blink/animated version. Easiest: create a 2-frame GIF that
swaps between the cat icon and a transparent (or red-tinted) frame at ~500ms.
Save as:

```
/config/www/lovelace/icons/cat_blink.gif
```

If you don't have time to make the GIF, the card-mod CSS animation below will
blink the static PNG just by toggling opacity — no GIF needed.

---

## 2. `configuration.yaml` (or `timers.yaml` if you split)

Add the timer. Duration 12h covers the gap between 7:30am ↔ 7:30pm.

```yaml
timer:
  rascal_insulin:
    duration: "12:00:00"
    restore: true   # survives HA restart
    icon: mdi:cat
```

If you already have a `timer:` block, just add `rascal_insulin:` under it.
**Remove** the old `timer.dogs` (or whatever the existing Rascal timer was
called) from the same block.

---

## 3. `scripts.yaml` — Alexa announcement + reset script

```yaml
rascal_insulin_alert:
  alias: Rascal Insulin Reminder Script
  mode: parallel
  max: 100
  sequence:
    - action: notify.alexa_media
      data:
        data:
          type: tts
        title: Rascal Insulin Overdue
        message: >-
          Rascal is overdue for his insulin shot. Please give it to him as soon
          as possible. I repeat, Rascal is overdue for his insulin shot. Please
          give it to him as soon as possible.
        target:
          - media_player.echo_cat_l_am
          - media_player.echo_hallway_entrance_am
          - media_player.echo_queen_bed_l_am
          - media_player.echo_show_pug_am
          - media_player.echo_kitchen_cupboards_l_am
          - media_player.echo_lr_hub_am
          - media_player.echo_kitchen_fridge_am
          - media_player.echo_cat_r_am
          - media_player.echo_lr_studio_white_am
    - action: notify.mobile_app_y_phone
      data:
        message: >-
          Rascal is overdue for his insulin shot. Please give it to him
          immediately.

rascal_reset_script:
  alias: Rascal Insulin Reset (next 7:30)
  mode: single
  sequence:
    # Calculate seconds until the next 7:30 AM or 7:30 PM, whichever comes first.
    - variables:
        now_h: "{{ now().hour }}"
        now_m: "{{ now().minute }}"
        now_s: "{{ now().second }}"
        # Minutes from local midnight right now
        cur_min: "{{ now_h * 60 + now_m }}"
        morning: 450    # 7:30 AM = 7*60+30
        evening: 1170   # 7:30 PM = 19*60+30
        # Pick the next 7:30 (rolls over to tomorrow morning if both passed today)
        next_min: >-
          {% if cur_min < morning %}{{ morning }}
          {% elif cur_min < evening %}{{ evening }}
          {% else %}{{ morning + 1440 }}{% endif %}
        # Seconds until that target (subtract current seconds-of-minute)
        seconds_left: "{{ ((next_min | int - cur_min | int) * 60) - now_s | int }}"
    - action: timer.start
      target:
        entity_id: timer.rascal_insulin
      data:
        duration: "{{ seconds_left }}"
    # Cancel any in-progress overdue Alexa loop
    - action: script.turn_off
      target:
        entity_id: script.rascal_insulin_alert
```

---

## 4. `automations.yaml` — fire at 7:30am, 7:30pm, and on timer.finished

```yaml
- id: rascal_insulin_730am
  alias: Rascal Insulin — 7:30 AM Reminder
  trigger:
    - platform: time
      at: "07:30:00"
  action:
    - action: script.rascal_insulin_alert
    # Restart the 12h countdown so the card shows time until 7:30 PM
    - action: timer.start
      target:
        entity_id: timer.rascal_insulin
      data:
        duration: "12:00:00"

- id: rascal_insulin_730pm
  alias: Rascal Insulin — 7:30 PM Reminder
  trigger:
    - platform: time
      at: "19:30:00"
  action:
    - action: script.rascal_insulin_alert
    - action: timer.start
      target:
        entity_id: timer.rascal_insulin
      data:
        duration: "12:00:00"

# If the timer ever runs out without a fresh start (HA was down at 7:30, etc.),
# fire the reminder anyway.
- id: rascal_insulin_timer_finished
  alias: Rascal Insulin — Timer Finished Fallback
  trigger:
    - platform: event
      event_type: timer.finished
      event_data:
        entity_id: timer.rascal_insulin
  action:
    - action: script.rascal_insulin_alert
```

---

## 5. Lovelace — replace the Bryn meds card

In your picture-elements card (the same one with `entity: timer.dogs`), find
the Bryn meds element (the one circled in purple) and **replace its entire
block** with the cat-button below. Use the same `left`/`top`/`width` values
that the Bryn meds button currently uses so it lands in the same spot.

```yaml
- type: image
  entity: timer.rascal_insulin
  text-align: center
  tap_action:
    action: call-service
    service: script.rascal_reset_script
    data:
      skip_condition: true
    target:
      entity_id: script.rascal_reset_script
  style:
    # Copy the exact left/top/width from the OLD Bryn meds element here
    left: 0%
    top: "-0.2%"
    width: 100%
    transform: scale(1, .98)
  # Use the same blank grey button background as the right-side button
  state_image:
    active: /local/lovelace/overlays/Round Menu/5/Border6.gif   # grey base, no blink
    idle:   /local/lovelace/overlays/Round Menu/5/Border6.gif   # same grey base
  # Cat icon overlay + blink on idle (timer expired)
  card_mod:
    style: |
      ha-card {
        background-image: url('/local/lovelace/icons/cat.png');
        background-repeat: no-repeat;
        background-position: center 30%;
        background-size: 55% auto;
      }
      {% if is_state('timer.rascal_insulin', 'idle') %}
      ha-card {
        animation: cat-blink 0.6s steps(2, start) infinite;
      }
      @keyframes cat-blink {
        to { opacity: 0.15; }
      }
      {% endif %}
```

(If you don't use `card-mod`, install it from HACS — it's the cleanest way to
get the icon overlay and the blink. If you'd rather avoid HACS, swap the
`background-image` for a stacked `picture-elements` child:

```yaml
- type: image
  image: /local/lovelace/icons/cat.png
  style:
    left: 50%
    top: 35%
    width: 55%
```

…and use a 2-frame `cat_blink.gif` for the blinking variant via `state_image`.)

---

## 6. Red border around the dashboard — blinks when timer is idle

Add this once at the **root** of your dashboard view (top-level `card_mod` or
inside a `vertical-stack` wrapper):

```yaml
card_mod:
  style: |
    {% if is_state('timer.rascal_insulin', 'idle') %}
    :host {
      box-shadow: inset 0 0 0 6px red !important;
      animation: red-border-blink 0.6s steps(2, start) infinite;
    }
    @keyframes red-border-blink {
      to { box-shadow: inset 0 0 0 6px transparent; }
    }
    {% endif %}
```

When the timer is `active` (counting down) the border is invisible. When it
flips to `idle` (hit 0 → overdue) the red border + cat icon both blink in sync
until you tap the icon, which calls `script.rascal_reset_script` and the
border turns off.

---

## 7. Delete the old stuff

1. **Bryn meds card element** — remove its entire YAML block from the
   picture-elements card.
2. **Old Rascal/dogs timer** — remove `timer.dogs:` from `configuration.yaml`
   and remove `script.dogs_reset_script` from `scripts.yaml` if nothing else
   references them. (Search your config for `dogs_reset_script` and
   `timer.dogs` first to make sure nothing else uses them.)

---

## 8. Restart sequence

1. Developer Tools → YAML → Check Configuration → green ✓
2. Reload: Timers, Scripts, Automations
3. Hard refresh the dashboard tab (Ctrl+Shift+R on the iPad: pull down to
   reload)
4. From Developer Tools → Services, fire `script.rascal_reset_script` once to
   prime the timer to the next 7:30. The card should now show a countdown.
