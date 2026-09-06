#!/usr/bin/env bash
# One-command cloud setup for Friday (Ubuntu VM, e.g. Oracle Free Tier).
# Run ON the VM after you SSH in:
#   curl -fsSL https://raw.githubusercontent.com/zahidlateefx/anthropic-claude-code-cloud/claude/instagram-reel-discord-agent-ooifkn/discord-agent/install-cloud.sh | bash
# (repo private? clone first, then run: bash ~/friday/discord-agent/install-cloud.sh)
#
# Prompts for Discord/WhatsApp; auto-generates the bridge token; prints the
# exact PC-worker command at the end.
set -euo pipefail

REPO="https://github.com/zahidlateefx/anthropic-claude-code-cloud.git"
BRANCH="claude/instagram-reel-discord-agent-ooifkn"
DIR="$HOME/friday"
PORT="${BRIDGE_PORT:-8787}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# --- packages --------------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 20 ]; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
say "Installing git, build tools, pm2, Claude CLI"
sudo apt-get install -y git build-essential >/dev/null
sudo npm i -g pm2 @anthropic-ai/claude-code >/dev/null

# --- firewall (VM side; also add the ingress rule in the Oracle console) ----
say "Opening port $PORT on the VM firewall"
sudo iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || sudo bash -c 'iptables-save > /etc/iptables/rules.v4' 2>/dev/null || true

# --- repo ------------------------------------------------------------------
if [ -d "$DIR/.git" ]; then
  say "Updating repo"; git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q origin "$BRANCH"
else
  say "Cloning repo"; git clone -q --branch "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/discord-agent"
say "Installing deps + building"
npm install --no-audit --no-fund >/dev/null
npm run build >/dev/null

# --- .env ------------------------------------------------------------------
if [ ! -f .env ]; then
  say "Configuration"
  read -r -p "Discord bot token (blank to skip Discord): " DTOK </dev/tty || true
  DOWN=""; [ -n "$DTOK" ] && read -r -p "Your Discord user ID: " DOWN </dev/tty
  read -r -p "WhatsApp owner number(s), comma separated (blank to skip): " WA </dev/tty || true
  TOKEN="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
  {
    [ -n "$DTOK" ] && echo "DISCORD_TOKEN=$DTOK"
    [ -n "$DOWN" ] && echo "DISCORD_OWNER_IDS=$DOWN"
    [ -n "$WA" ] && echo "WHATSAPP_OWNER_NUMBERS=$WA"
    echo "AGENT_TIMEZONE=${AGENT_TIMEZONE:-Asia/Karachi}"
    echo "BRIDGE_TOKEN=$TOKEN"
    echo "BRIDGE_PORT=$PORT"
  } > .env
  chmod 600 .env
  say "Wrote .env (bridge token generated)"
else
  say "Keeping existing .env"
fi
TOKEN="$(grep '^BRIDGE_TOKEN=' .env | cut -d= -f2-)"

# --- Claude auth -----------------------------------------------------------
if ! grep -q '^ANTHROPIC_API_KEY=.\+' .env 2>/dev/null && ! claude auth status >/dev/null 2>&1; then
  say "Log in to Claude (opens a device-code URL — open it in your browser)"
  claude login </dev/tty || { echo "claude login failed — re-run 'claude login' later"; }
fi

# --- start -----------------------------------------------------------------
say "Starting Friday with pm2"
pm2 delete friday >/dev/null 2>&1 || true
pm2 start dist/index.js --name friday --time
pm2 save >/dev/null
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

IP="$(curl -fsS4 ifconfig.me 2>/dev/null || echo YOUR_CLOUD_IP)"
sleep 4
pm2 logs friday --lines 25 --nostream || true

cat <<EOF

============================================================
 Friday cloud is up.
 - WhatsApp: run 'pm2 logs friday' and scan the QR (Linked Devices).
 - Discord: open the invite link shown in the logs above.

 PC WORKER — run this on your Windows PC (in the repo's discord-agent folder):
   @"
   CLOUD_URL=ws://$IP:$PORT
   BRIDGE_TOKEN=$TOKEN
   "@ | Set-Content worker.env
   pm2 delete friday 2>\$null
   pm2 start dist/worker.js --name friday-worker --time ; pm2 save

 IMPORTANT: in the Oracle Console add an Ingress rule for TCP port $PORT
 (Subnet -> Security List -> Add Ingress Rule, source 0.0.0.0/0).
============================================================
EOF
