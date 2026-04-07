#!/bin/bash
#
# Bluetooth Storm Monitor for Raspberry Pi
# Monitors BLE advertisement activity per device and alerts when a device
# exceeds the threshold (potential storm source).
#
# Usage:
#   sudo ./bt-storm-monitor.sh              # Run in foreground
#   sudo ./bt-storm-monitor.sh --daemon     # Run as background daemon
#   sudo ./bt-storm-monitor.sh --status     # Show current device counts
#   sudo ./bt-storm-monitor.sh --stop       # Stop daemon
#
# Requires: bluetoothctl, hcitool (bluez package)
# Install: sudo apt-get install -y bluez

LOG_DIR="/var/log/bt-monitor"
LOG_FILE="$LOG_DIR/bt-storm.log"
COUNT_FILE="$LOG_DIR/bt-counts.json"
PID_FILE="/var/run/bt-storm-monitor.pid"
ALERT_LOG="$LOG_DIR/bt-alerts.log"

WINDOW_SECONDS=60
THRESHOLD_PER_WINDOW=200
CHECK_INTERVAL=10
DASHBOARD_URL="http://localhost:5000"

HA_URL="${HA_URL:-}"
HA_TOKEN="${HA_TOKEN:-}"

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
    local mac="$1"
    local count="$2"
    local name="$3"
    local msg="BT STORM ALERT: $mac ($name) sent $count advertisements in ${WINDOW_SECONDS}s (threshold: $THRESHOLD_PER_WINDOW)"

    log "ALERT: $msg"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $msg" >> "$ALERT_LOG"

    if [ -n "$HA_URL" ] && [ -n "$HA_TOKEN" ]; then
        curl -s -X POST "$HA_URL/api/services/notify/persistent_notification" \
            -H "Authorization: Bearer $HA_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"title\":\"Bluetooth Storm Detected\",\"message\":\"$msg\"}" \
            > /dev/null 2>&1
    fi

    curl -s -X POST "$DASHBOARD_URL/api/bt-storm-alert" \
        -H "Content-Type: application/json" \
        -d "{\"mac\":\"$mac\",\"name\":\"$name\",\"count\":$count,\"window\":$WINDOW_SECONDS,\"threshold\":$THRESHOLD_PER_WINDOW,\"timestamp\":\"$(date -Iseconds)\"}" \
        > /dev/null 2>&1
}

declare -A device_counts
declare -A device_names
declare -A device_timestamps
declare -A alerted_devices

scan_and_count() {
    local now=$(date +%s)
    local cutoff=$((now - WINDOW_SECONDS))

    while IFS= read -r line; do
        if [[ "$line" =~ ([0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}) ]]; then
            local mac="${BASH_REMATCH[1]}"
            local name=""

            if [[ "$line" =~ "Name: " ]]; then
                name=$(echo "$line" | sed 's/.*Name: //' | tr -d '\n')
            fi

            if [ -n "$name" ] && [ "$name" != "(unknown)" ]; then
                device_names[$mac]="$name"
            fi

            local key="${mac}_${now}"
            device_counts[$mac]=$(( ${device_counts[$mac]:-0} + 1 ))
            device_timestamps[$mac]="$now"
        fi
    done
}

check_thresholds() {
    local now=$(date +%s)

    for mac in "${!device_counts[@]}"; do
        local count=${device_counts[$mac]}
        local name="${device_names[$mac]:-unknown}"
        local last_ts=${device_timestamps[$mac]:-0}

        if [ $count -ge $THRESHOLD_PER_WINDOW ]; then
            local alert_key="${mac}_$(( now / 300 ))"
            if [ -z "${alerted_devices[$alert_key]}" ]; then
                alert "$mac" "$count" "$name"
                alerted_devices[$alert_key]=1
            fi
        fi
    done
}

reset_counts() {
    for mac in "${!device_counts[@]}"; do
        device_counts[$mac]=0
    done
}

save_counts() {
    local json="{"
    local first=true
    local now=$(date +%s)

    for mac in "${!device_counts[@]}"; do
        local count=${device_counts[$mac]}
        local name="${device_names[$mac]:-unknown}"
        if [ "$first" = true ]; then
            first=false
        else
            json+=","
        fi
        json+="\"$mac\":{\"count\":$count,\"name\":\"$name\",\"lastSeen\":${device_timestamps[$mac]:-0}}"
    done

    json+=",\"_meta\":{\"timestamp\":$now,\"window\":$WINDOW_SECONDS,\"threshold\":$THRESHOLD_PER_WINDOW}}"
    echo "$json" > "$COUNT_FILE"
}

show_status() {
    if [ ! -f "$COUNT_FILE" ]; then
        echo "No monitoring data yet. Is the monitor running?"
        exit 1
    fi

    echo "=== Bluetooth Device Activity ==="
    echo ""

    if command -v python3 &> /dev/null; then
        python3 -c "
import json, sys
from datetime import datetime

with open('$COUNT_FILE') as f:
    data = json.load(f)

meta = data.pop('_meta', {})
print(f'Last update: {datetime.fromtimestamp(meta.get(\"timestamp\", 0))}')
print(f'Window: {meta.get(\"window\", 60)}s | Threshold: {meta.get(\"threshold\", 200)}')
print()
print(f'{\"MAC Address\":<20} {\"Name\":<30} {\"Count\":<10} {\"Last Seen\":<20}')
print('-' * 80)

sorted_devs = sorted(data.items(), key=lambda x: x[1].get('count', 0), reverse=True)
for mac, info in sorted_devs:
    count = info.get('count', 0)
    name = info.get('name', 'unknown')
    last = datetime.fromtimestamp(info.get('lastSeen', 0)).strftime('%H:%M:%S') if info.get('lastSeen') else 'never'
    flag = ' *** STORM ***' if count >= meta.get('threshold', 200) else ''
    print(f'{mac:<20} {name:<30} {count:<10} {last:<20}{flag}')
"
    else
        cat "$COUNT_FILE"
    fi

    echo ""
    if [ -f "$ALERT_LOG" ]; then
        echo "=== Recent Alerts ==="
        tail -10 "$ALERT_LOG"
    fi
}

stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm -f "$PID_FILE"
            echo "Bluetooth storm monitor stopped (PID $pid)"
        else
            rm -f "$PID_FILE"
            echo "Monitor was not running (stale PID file removed)"
        fi
    else
        echo "No PID file found. Monitor may not be running."
    fi
}

run_monitor() {
    log "Bluetooth storm monitor started (window=${WINDOW_SECONDS}s, threshold=${THRESHOLD_PER_WINDOW})"

    if ! command -v hcitool &> /dev/null; then
        log "ERROR: hcitool not found. Install with: sudo apt-get install -y bluez"
        exit 1
    fi

    local cycle=0

    while true; do
        local scan_output
        scan_output=$(timeout "$CHECK_INTERVAL" hcitool lescan --duplicates 2>/dev/null || true)

        if [ -n "$scan_output" ]; then
            echo "$scan_output" | scan_and_count
        fi

        cycle=$(( cycle + 1 ))

        if [ $(( cycle % (WINDOW_SECONDS / CHECK_INTERVAL) )) -eq 0 ]; then
            check_thresholds
            save_counts
            reset_counts
            cycle=0
        else
            save_counts
        fi
    done
}

case "${1:-}" in
    --status)
        show_status
        ;;
    --stop)
        stop_daemon
        ;;
    --daemon)
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "Monitor already running (PID $(cat "$PID_FILE"))"
            exit 1
        fi
        run_monitor &
        echo $! > "$PID_FILE"
        echo "Bluetooth storm monitor started in background (PID $!)"
        echo "Logs: $LOG_FILE"
        echo "Alerts: $ALERT_LOG"
        echo "Status: sudo $0 --status"
        echo "Stop: sudo $0 --stop"
        ;;
    --help|-h)
        echo "Usage: sudo $0 [--daemon|--status|--stop|--help]"
        echo ""
        echo "  (no args)   Run in foreground"
        echo "  --daemon    Run as background process"
        echo "  --status    Show current device activity counts"
        echo "  --stop      Stop the background daemon"
        echo ""
        echo "Environment variables:"
        echo "  HA_URL      Home Assistant URL (for push notifications)"
        echo "  HA_TOKEN    Home Assistant long-lived access token"
        echo ""
        echo "Config (edit this script):"
        echo "  WINDOW_SECONDS=$WINDOW_SECONDS    Counting window"
        echo "  THRESHOLD_PER_WINDOW=$THRESHOLD_PER_WINDOW  Alert threshold"
        echo "  CHECK_INTERVAL=$CHECK_INTERVAL      Scan interval"
        ;;
    *)
        run_monitor
        ;;
esac
