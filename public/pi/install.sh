#!/usr/bin/env bash
#
# Foyer kiosk installer for Raspberry Pi
# ======================================
#
# Turns a Raspberry Pi running Raspberry Pi OS 64-bit (Lite or Desktop,
# Bookworm or newer) into a fullscreen signage player for one Foyer display,
# and installs the small agent that reports the Pi's health to the Foyer
# admin and carries out remote reboot / reload / screenshot requests.
#
# Raspberry Pi OS Lite is the recommended base: the installer adds the
# labwc Wayland compositor and starts it straight from the console on tty1
# (no display manager, no desktop), which boots faster and has less to go
# wrong. On the Desktop edition it hooks into the existing session instead.
#
# Usage (run on the Pi, from the Displays page "Set up a Raspberry Pi"):
#
#   curl -fsSL https://YOUR-FOYER-HOST/pi/install.sh | sudo bash -s -- \
#     --url https://YOUR-FOYER-HOST --display DISPLAY-UUID [--rotate 90] [--reboot]
#
# Options:
#   --url URL          Foyer base URL (no trailing slash)
#   --display UUID     The display id from the admin (the last part of the kiosk URL)
#   --rotate DEG       Screen rotation for a portrait TV: 90 (default), 270, or 0 for landscape
#   --user NAME        Desktop user that auto-logs in (default: the user who ran sudo, or "pi")
#   --hostname NAME    Optional: set the Pi's hostname (e.g. foyer-lobby)
#   --agent-only       Only (re)install the agent; leave the kiosk setup alone
#   --reboot           Reboot when done
#
# What it does:
#   1. Installs Chromium, wlr-randr, grim, jq, curl (and labwc + seatd on Lite).
#   2. Writes /etc/foyer/foyer.env with the URL, display id and rotation.
#   3. Installs /usr/local/bin/foyer-kiosk.sh and hooks it into the session
#      autostart (labwc, wayfire and X11/LXDE are all covered — only the
#      active one runs).
#   4. Lite: console auto-login on tty1 that execs labwc. Desktop: auto-login
#      to the desktop. Both: screen blanking off.
#   5. Installs the agent as a systemd timer (every 60 s).
#   6. Adds a weekly 4 AM reboot (Mondays) as a belt-and-braces refresh.
#
# Re-running is safe: every file is rewritten in place.

set -euo pipefail

FOYER_URL=""
DISPLAY_ID=""
ROTATE="90"
KIOSK_USER="${SUDO_USER:-pi}"
NEW_HOSTNAME=""
AGENT_ONLY=0
DO_REBOOT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) FOYER_URL="${2%/}"; shift 2 ;;
    --display) DISPLAY_ID="$2"; shift 2 ;;
    --rotate) ROTATE="$2"; shift 2 ;;
    --user) KIOSK_USER="$2"; shift 2 ;;
    --hostname) NEW_HOSTNAME="$2"; shift 2 ;;
    --agent-only) AGENT_ONLY=1; shift ;;
    --reboot) DO_REBOOT=1; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2; exit 1
fi
if [[ -z "$FOYER_URL" || -z "$DISPLAY_ID" ]]; then
  echo "Both --url and --display are required." >&2; exit 1
fi
if ! [[ "$DISPLAY_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "--display should be the display UUID (36 characters)." >&2; exit 1
fi
if ! [[ "$ROTATE" =~ ^(0|90|180|270)$ ]]; then
  echo "--rotate must be 0, 90, 180 or 270." >&2; exit 1
fi
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
  echo "User '$KIOSK_USER' does not exist. Pass --user." >&2; exit 1
fi

KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
as_user() { sudo -u "$KIOSK_USER" -H "$@"; }

# Desktop edition ships lightdm; Lite does not. On Lite we bring our own
# compositor (labwc) and start it from the console.
if dpkg -s lightdm >/dev/null 2>&1; then EDITION=desktop; else EDITION=lite; fi

# ── 1. Packages ──────────────────────────────────────────────────────────────
say "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# Chromium is "chromium" on Trixie and "chromium-browser" on Bookworm.
apt-get install -y -qq --no-install-recommends curl jq wlr-randr grim >/dev/null || true
apt-get install -y -qq --no-install-recommends chromium >/dev/null 2>&1 \
  || apt-get install -y -qq --no-install-recommends chromium-browser >/dev/null
# X11 fallbacks (harmless if the session is Wayland).
apt-get install -y -qq --no-install-recommends x11-xserver-utils scrot unclutter >/dev/null 2>&1 || true
if [[ "$EDITION" == "lite" ]]; then
  # Minimal Wayland stack: labwc (wlroots compositor — supports wlr-randr
  # rotation and grim screenshots), seatd for seat/DRM access, a font.
  apt-get install -y -qq --no-install-recommends labwc seatd fonts-dejavu-core >/dev/null
  systemctl enable --now seatd >/dev/null 2>&1 || true
  for g in video render input seat tty; do usermod -aG "$g" "$KIOSK_USER" 2>/dev/null || true; done
fi

CHROMIUM_BIN="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "Chromium did not install; check apt output." >&2; exit 1
fi

# ── 2. Config ────────────────────────────────────────────────────────────────
say "Writing /etc/foyer/foyer.env"
install -d -m 0755 /etc/foyer
cat > /etc/foyer/foyer.env <<EOF
# Written by install.sh — edit and reboot to change.
FOYER_URL=$FOYER_URL
FOYER_DISPLAY_ID=$DISPLAY_ID
FOYER_ROTATE=$ROTATE
FOYER_USER=$KIOSK_USER
FOYER_CHROMIUM=$CHROMIUM_BIN
EOF
chmod 0644 /etc/foyer/foyer.env

if [[ -n "$NEW_HOSTNAME" ]]; then
  say "Setting hostname to $NEW_HOSTNAME"
  hostnamectl set-hostname "$NEW_HOSTNAME" || true
  sed -i "s/127.0.1.1.*/127.0.1.1\t$NEW_HOSTNAME/" /etc/hosts || true
fi

# ── 3. Kiosk launcher ────────────────────────────────────────────────────────
if [[ $AGENT_ONLY -eq 0 ]]; then
say "Installing kiosk launcher"
cat > /usr/local/bin/foyer-kiosk.sh <<'EOF'
#!/usr/bin/env bash
# Launched by the desktop session autostart. Rotates the output, then keeps
# Chromium running in kiosk mode on the display URL. If Chromium exits (a
# crash, or the agent killing it for a "reload"), it comes straight back.
set -u
source /etc/foyer/foyer.env
URL="$FOYER_URL/display/$FOYER_DISPLAY_ID"
LOG=/tmp/foyer-kiosk.log

rotate() {
  local deg="${FOYER_ROTATE:-0}"
  if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wlr-randr >/dev/null; then
    # First connected output (e.g. HDMI-A-1).
    local out
    out="$(wlr-randr 2>/dev/null | awk '/^[A-Za-z]/{print $1; exit}')"
    [[ -n "$out" ]] && wlr-randr --output "$out" --transform "$deg" >>"$LOG" 2>&1 || true
  elif [[ -n "${DISPLAY:-}" ]] && command -v xrandr >/dev/null; then
    local out xdeg
    out="$(xrandr --query 2>/dev/null | awk '/ connected/{print $1; exit}')"
    case "$deg" in 90) xdeg=right ;; 270) xdeg=left ;; 180) xdeg=inverted ;; *) xdeg=normal ;; esac
    [[ -n "$out" ]] && xrandr --output "$out" --rotate "$xdeg" >>"$LOG" 2>&1 || true
    xset s off -dpms >>"$LOG" 2>&1 || true
    command -v unclutter >/dev/null && (unclutter -idle 1 -root &) || true
  fi
}

# Give the compositor a moment to bring the output up, then rotate.
sleep 3
rotate

PROFILE="$HOME/.config/foyer-chromium"
mkdir -p "$PROFILE"
# Clear the "Chromium didn't shut down correctly" state so no bubble ever shows.
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
  "$PROFILE/Default/Preferences" 2>/dev/null || true

FLAGS=(
  --kiosk "$URL"
  --user-data-dir="$PROFILE"
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble
  --disable-features=TranslateUI,Translate
  --autoplay-policy=no-user-gesture-required
  --check-for-update-interval=31536000
  --disk-cache-size=536870912
  --overscroll-history-navigation=0
  --disable-pinch --no-first-run --password-store=basic
  --enable-features=OverlayScrollbar
)
# Chromium runs under XWayland on Wayland sessions by default, which works on
# every Pi OS build. Forcing --ozone-platform=wayland is faster on some builds
# but exits immediately on others; set FOYER_OZONE_WAYLAND=1 in foyer.env to try it.
[[ -n "${WAYLAND_DISPLAY:-}" && "${FOYER_OZONE_WAYLAND:-0}" == "1" ]] && FLAGS+=(--ozone-platform=wayland)

# Don't hand Chromium a URL it can't reach — after a power cut the Pi is
# often up before the Wi-Fi/router is. Wait (black screen) until Foyer
# answers, then launch; same again if Chromium ever exits.
wait_for_foyer() {
  local n=0
  until curl -fsS --max-time 5 -o /dev/null "$FOYER_URL/api/display/$FOYER_DISPLAY_ID"; do
    n=$((n + 1)); [[ $n -eq 1 || $((n % 12)) -eq 0 ]] && echo "$(date -Is) waiting for $FOYER_URL (network?)" >>"$LOG"
    sleep 5
  done
}

while true; do
  wait_for_foyer
  "$FOYER_CHROMIUM" "${FLAGS[@]}" >>"$LOG" 2>&1
  echo "$(date -Is) chromium exited ($?), restarting in 2s" >>"$LOG"
  sleep 2
done
EOF
chmod 0755 /usr/local/bin/foyer-kiosk.sh

say "Hooking into the session autostart"
# labwc (default compositor on current Raspberry Pi OS)
as_user mkdir -p "$KIOSK_HOME/.config/labwc"
touch "$KIOSK_HOME/.config/labwc/autostart"
grep -q foyer-kiosk "$KIOSK_HOME/.config/labwc/autostart" \
  || echo '/usr/local/bin/foyer-kiosk.sh &' >> "$KIOSK_HOME/.config/labwc/autostart"
# wayfire (Bookworm's original Wayland compositor)
as_user mkdir -p "$KIOSK_HOME/.config"
WAYFIRE_INI="$KIOSK_HOME/.config/wayfire.ini"
if [[ -f "$WAYFIRE_INI" ]] && ! grep -q foyer-kiosk "$WAYFIRE_INI"; then
  printf '\n[autostart]\nfoyer = /usr/local/bin/foyer-kiosk.sh\n' >> "$WAYFIRE_INI"
elif [[ ! -f "$WAYFIRE_INI" ]]; then
  printf '[autostart]\nfoyer = /usr/local/bin/foyer-kiosk.sh\n' > "$WAYFIRE_INI"
fi
# X11 / LXDE-pi
as_user mkdir -p "$KIOSK_HOME/.config/lxsession/LXDE-pi"
LX_AUTOSTART="$KIOSK_HOME/.config/lxsession/LXDE-pi/autostart"
touch "$LX_AUTOSTART"
grep -q foyer-kiosk "$LX_AUTOSTART" || echo '@/usr/local/bin/foyer-kiosk.sh' >> "$LX_AUTOSTART"
chown -R "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.config"

if [[ "$EDITION" == "desktop" ]]; then
  say "Auto-login to desktop, no screen blanking"
  if command -v raspi-config >/dev/null; then
    raspi-config nonint do_boot_behaviour B4 >/dev/null 2>&1 || true   # desktop, auto-login
    raspi-config nonint do_blanking 1 >/dev/null 2>&1 || true          # 1 = disable blanking
    raspi-config nonint do_boot_splash 0 >/dev/null 2>&1 || true       # splash on (hides boot text)
  fi
else
  say "Console auto-login on tty1; labwc starts the kiosk"
  if command -v raspi-config >/dev/null; then
    raspi-config nonint do_boot_behaviour B2 >/dev/null 2>&1 || true   # console, auto-login
  else
    install -d /etc/systemd/system/getty@tty1.service.d
    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF
  fi
  # When the auto-logged-in shell lands on tty1 with no compositor, exec
  # labwc. Its autostart file (written above) launches the kiosk.
  PROFILE_FILE="$KIOSK_HOME/.bash_profile"
  touch "$PROFILE_FILE"
  if ! grep -q 'foyer: start labwc' "$PROFILE_FILE"; then
    cat >> "$PROFILE_FILE" <<'EOF'

# foyer: start labwc on tty1 (kiosk). Remove this block to get a plain shell.
if [[ -z "$WAYLAND_DISPLAY" && -z "$DISPLAY" && "$(tty)" == "/dev/tty1" ]]; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
  exec labwc >/tmp/foyer-labwc.log 2>&1
fi
EOF
  fi
  chown "$KIOSK_USER:$KIOSK_USER" "$PROFILE_FILE"
  # No console blanking either.
  if [[ -f /boot/firmware/cmdline.txt ]] && ! grep -q consoleblank= /boot/firmware/cmdline.txt; then
    sed -i '1 s/$/ consoleblank=0/' /boot/firmware/cmdline.txt
  fi
  # Minimal labwc config: no window decorations, no gaps, fixed position.
  as_user mkdir -p "$KIOSK_HOME/.config/labwc"
  if [[ ! -f "$KIOSK_HOME/.config/labwc/rc.xml" ]]; then
    cat > "$KIOSK_HOME/.config/labwc/rc.xml" <<'EOF'
<?xml version="1.0"?>
<labwc_config>
  <core><decoration>none</decoration><gap>0</gap></core>
  <theme><cornerRadius>0</cornerRadius></theme>
  <windowRules>
    <windowRule identifier="*" serverDecoration="no" fixedPosition="yes" />
  </windowRules>
</labwc_config>
EOF
    chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.config/labwc/rc.xml"
  fi
fi

# Weekly reboot, Monday 4 AM local — keeps memory fresh on a 24/7 box.
cat > /etc/cron.d/foyer-weekly-reboot <<'EOF'
0 4 * * 1 root /sbin/shutdown -r now "Foyer weekly reboot"
EOF
chmod 0644 /etc/cron.d/foyer-weekly-reboot
fi # AGENT_ONLY

# ── 4. Agent ─────────────────────────────────────────────────────────────────
say "Installing the Foyer agent"
if ! curl -fsSL "$FOYER_URL/pi/foyer-agent.sh" -o /usr/local/bin/foyer-agent.sh; then
  echo "Could not download $FOYER_URL/pi/foyer-agent.sh" >&2; exit 1
fi
chmod 0755 /usr/local/bin/foyer-agent.sh

cat > /etc/systemd/system/foyer-agent.service <<'EOF'
[Unit]
Description=Foyer signage agent (check-in + remote commands)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/foyer/foyer.env
ExecStart=/usr/local/bin/foyer-agent.sh
EOF

cat > /etc/systemd/system/foyer-agent.timer <<'EOF'
[Unit]
Description=Run the Foyer agent every minute

[Timer]
OnBootSec=45s
OnUnitActiveSec=60s
AccuracySec=5s

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now foyer-agent.timer >/dev/null

say "Checking in for the first time"
if /usr/local/bin/foyer-agent.sh; then
  echo "The display should now show as a Raspberry Pi in the Foyer admin."
else
  echo "First check-in failed — check the URL and display id in /etc/foyer/foyer.env." >&2
fi

say "Done"
echo "Kiosk URL: $FOYER_URL/display/$DISPLAY_ID"
echo "Rotation:  $ROTATE°   User: $KIOSK_USER   Edition: $EDITION"
echo "Logs:      /tmp/foyer-kiosk.log (kiosk), journalctl -u foyer-agent (agent)"
if [[ $DO_REBOOT -eq 1 ]]; then
  echo "Rebooting…"; sleep 2; systemctl reboot
else
  echo "Reboot the Pi to start the kiosk:  sudo reboot"
fi
