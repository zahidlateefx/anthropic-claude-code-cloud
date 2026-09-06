#!/usr/bin/env bash
# One-command installer for the Discord Claude agent (macOS / Linux).
#
#   git clone -b claude/instagram-reel-discord-agent-ooifkn https://github.com/zahidlateefx/anthropic-claude-code-cloud.git ~/friday-agent
#   bash ~/friday-agent/discord-agent/install.sh
#
# Optional env vars to skip the prompts: DISCORD_TOKEN, DISCORD_OWNER_IDS
set -euo pipefail

REPO="https://github.com/zahidlateefx/anthropic-claude-code-cloud.git"
BRANCH="claude/instagram-reel-discord-agent-ooifkn"
DIR="$HOME/friday-agent"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# --- Node.js >= 20 ---------------------------------------------------------
need_node=1
if command -v node >/dev/null 2>&1; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  [ "$major" -ge 20 ] && need_node=0
fi
if [ "$need_node" = 1 ]; then
  say "Installing Node.js 22 (via nvm)"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
fi
say "Node $(node -v) OK"

# --- Claude Code CLI (for `claude login` / subscription auth) ---------------
if ! command -v claude >/dev/null 2>&1; then
  say "Installing Claude Code CLI"
  npm install -g @anthropic-ai/claude-code
fi

# --- Repo ------------------------------------------------------------------
# Running from inside a checkout (bash discord-agent/install.sh)? Use it as-is.
if [ -f "${BASH_SOURCE[0]:-}" ] && [ -f "$(dirname "${BASH_SOURCE[0]}")/package.json" ]; then
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  say "Using checkout at $DIR"
elif [ -d "$DIR/.git" ]; then
  say "Updating $DIR"
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" pull -q origin "$BRANCH"
else
  say "Cloning into $DIR"
  git clone -q --branch "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/discord-agent"

# --- .env ------------------------------------------------------------------
if [ ! -f .env ]; then
  say "Configuration"
  if [ -z "${DISCORD_TOKEN:-}" ]; then
    read -r -p "Discord bot token: " DISCORD_TOKEN </dev/tty
  fi
  if [ -z "${DISCORD_OWNER_IDS:-}" ]; then
    read -r -p "Your Discord user ID: " DISCORD_OWNER_IDS </dev/tty
  fi
  [ -n "$DISCORD_TOKEN" ] && [ -n "$DISCORD_OWNER_IDS" ] || die "token and user ID are required"
  {
    echo "DISCORD_TOKEN=$DISCORD_TOKEN"
    echo "DISCORD_OWNER_IDS=$DISCORD_OWNER_IDS"
    [ -n "${ANTHROPIC_API_KEY:-}" ] && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  } > .env
  chmod 600 .env
  say "Wrote $DIR/discord-agent/.env"
else
  say "Keeping existing .env"
fi

# --- Build -----------------------------------------------------------------
say "Installing dependencies"
npm install --no-audit --no-fund
say "Building"
npm run build

# --- Claude auth -----------------------------------------------------------
if [ -z "${ANTHROPIC_API_KEY:-}" ] && ! grep -q '^ANTHROPIC_API_KEY=.\+' .env 2>/dev/null; then
  if ! claude auth status >/dev/null 2>&1; then
    say "Log in to Claude (opens a browser)"
    claude login </dev/tty || die "claude login failed"
  fi
fi

# --- Run forever with pm2 --------------------------------------------------
say "Starting bot with pm2 (auto-restart, survives reboot)"
command -v pm2 >/dev/null 2>&1 || npm install -g pm2
pm2 delete friday >/dev/null 2>&1 || true
pm2 start dist/index.js --name friday --time
pm2 save >/dev/null
pm2 startup 2>/dev/null | grep -E '^sudo' | bash || true

sleep 3
pm2 logs friday --lines 15 --nostream

cat <<EOF

Done. Useful commands:
  pm2 logs friday      # live logs (invite link is printed here)
  pm2 restart friday   # after editing AGENT.md or .env
  pm2 stop friday

Next: open the invite link from the logs to add the bot to a server, then DM it on Discord.
EOF
