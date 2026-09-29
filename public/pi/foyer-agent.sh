#!/usr/bin/env bash
#
# Foyer agent — runs every minute from a systemd timer (see install.sh).
#
# 1. Collects the Pi's vitals and POSTs them to
#      $FOYER_URL/api/display/$FOYER_DISPLAY_ID/agent
# 2. Carries out the one command the reply may contain:
#      reboot      → systemctl reboot
#      reload      → kill Chromium (the kiosk loop restarts it on the same URL)
#      screenshot  → capture the screen and POST it to .../screenshot
#      update      → re-download this script and the kiosk launcher
#
# Needs: curl, jq. Optional: grim (Wayland screenshots), scrot (X11).
# Config comes from /etc/foyer/foyer.env (EnvironmentFile in the unit).

set -u
AGENT_VERSION="1.0.0"

: "${FOYER_URL:?FOYER_URL is not set}"
: "${FOYER_DISPLAY_ID:?FOYER_DISPLAY_ID is not set}"
FOYER_USER="${FOYER_USER:-pi}"
BASE="$FOYER_URL/api/display/$FOYER_DISPLAY_ID"

log() { echo "$(date -Is) $*"; }

# ── Vitals ───────────────────────────────────────────────────────────────────
hostname_v="$(hostname 2>/dev/null || echo unknown)"
ip_v="$(hostname -I 2>/dev/null | awk '{print $1}')"
model_v="$(tr -d '\0' 2>/dev/null < /proc/device-tree/model || echo '')"
os_v="$(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-}")"
uptime_v="$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)"
temp_raw="$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo '')"
temp_v=""
[[ -n "$temp_raw" ]] && temp_v="$(awk -v t="$temp_raw" 'BEGIN{printf "%.1f", t/1000}')"
mem_v="$(free 2>/dev/null | awk '/^Mem:/{printf "%.0f", ($3/$2)*100}')"
disk_v="$(df -P / 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')"
throttled_v="$(vcgencmd get_throttled 2>/dev/null | sed 's/throttled=//' || echo '')"
if pgrep -f -- '--kiosk' >/dev/null 2>&1; then chromium_v=true; else chromium_v=false; fi

payload="$(jq -n \
  --arg agentVersion "$AGENT_VERSION" \
  --arg hostname "$hostname_v" \
  --arg ip "$ip_v" \
  --arg model "$model_v" \
  --arg os "$os_v" \
  --arg uptimeSec "$uptime_v" \
  --arg cpuTempC "$temp_v" \
  --arg memUsedPct "$mem_v" \
  --arg diskUsedPct "$disk_v" \
  --arg throttled "$throttled_v" \
  --argjson chromiumRunning "$chromium_v" \
  '{agentVersion:$agentVersion, hostname:$hostname, ip:$ip, model:$model, os:$os,
    uptimeSec:($uptimeSec|tonumber? // 0), cpuTempC:($cpuTempC|tonumber? // null),
    memUsedPct:($memUsedPct|tonumber? // null), diskUsedPct:($diskUsedPct|tonumber? // null),
    throttled:$throttled, chromiumRunning:$chromiumRunning}')"

# ── Check in ─────────────────────────────────────────────────────────────────
reply="$(curl -fsS --max-time 20 -X POST "$BASE/agent" \
  -H 'Content-Type: application/json' --data "$payload" 2>/dev/null)" || {
  log "check-in failed (network or server)"; exit 1
}
command_v="$(echo "$reply" | jq -r '.command // empty' 2>/dev/null || true)"
[[ -z "$command_v" ]] && exit 0
log "command: $command_v"

# Wayland socket of the kiosk user's session — needed by grim and for
# finding Chromium's environment.
user_uid="$(id -u "$FOYER_USER" 2>/dev/null || echo 1000)"
runtime_dir="/run/user/$user_uid"
wayland_sock="$(ls "$runtime_dir" 2>/dev/null | grep -m1 '^wayland-[0-9]*$' || true)"

take_screenshot() {
  local out="/tmp/foyer-screenshot.jpg"
  rm -f "$out"
  if [[ -n "$wayland_sock" ]] && command -v grim >/dev/null; then
    sudo -u "$FOYER_USER" env XDG_RUNTIME_DIR="$runtime_dir" WAYLAND_DISPLAY="$wayland_sock" \
      grim -s 0.5 -t jpeg -q 70 "$out" 2>/dev/null || true
  fi
  if [[ ! -s "$out" ]] && command -v scrot >/dev/null; then
    sudo -u "$FOYER_USER" env DISPLAY=:0 XAUTHORITY="$(getent passwd "$FOYER_USER" | cut -d: -f6)/.Xauthority" \
      scrot -q 70 -o "$out" 2>/dev/null || true
  fi
  if [[ -s "$out" ]]; then
    curl -fsS --max-time 30 -X POST "$BASE/screenshot" \
      -H 'Content-Type: image/jpeg' --data-binary "@$out" >/dev/null \
      && log "screenshot uploaded" || log "screenshot upload failed"
  else
    log "screenshot capture failed (no grim/scrot output)"
  fi
}

case "$command_v" in
  reboot)
    log "rebooting"; sleep 1; systemctl reboot ;;
  reload)
    pkill -f -- '--kiosk' && log "chromium killed; kiosk loop will restart it" \
      || log "no chromium process found" ;;
  screenshot)
    take_screenshot ;;
  update)
    tmp="$(mktemp)"
    if curl -fsSL "$FOYER_URL/pi/foyer-agent.sh" -o "$tmp"; then
      install -m 0755 "$tmp" /usr/local/bin/foyer-agent.sh && log "agent updated"
    fi
    rm -f "$tmp"
    curl -fsSL "$FOYER_URL/pi/install.sh" | bash -s -- --agent-only \
      --url "$FOYER_URL" --display "$FOYER_DISPLAY_ID" --user "$FOYER_USER" >/dev/null 2>&1 \
      && log "installer re-run ok" || log "installer re-run failed" ;;
  *)
    log "unknown command '$command_v'" ;;
esac
exit 0
