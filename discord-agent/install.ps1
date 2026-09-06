# One-command installer for the Discord Claude agent (Windows PowerShell).
#
#   git clone -b claude/instagram-reel-discord-agent-ooifkn https://github.com/zahidlateefx/anthropic-claude-code-cloud.git $HOME\friday-agent
#   powershell -ExecutionPolicy Bypass -File $HOME\friday-agent\discord-agent\install.ps1
#
# Optional env vars to skip the prompts: $env:DISCORD_TOKEN, $env:DISCORD_OWNER_IDS
$ErrorActionPreference = "Stop"

$Repo   = "https://github.com/zahidlateefx/anthropic-claude-code-cloud.git"
$Branch = "claude/instagram-reel-discord-agent-ooifkn"
$Dir    = Join-Path $HOME "friday-agent"

function Say($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Need($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

# --- Git + Node ------------------------------------------------------------
if (-not (Need "winget")) { throw "winget not found. Install 'App Installer' from the Microsoft Store, then re-run." }
if (-not (Need "git")) { Say "Installing Git"; winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements }
$nodeOk = $false
if (Need "node") { $nodeOk = ([int]((node -v).TrimStart("v").Split(".")[0]) -ge 20) }
if (-not $nodeOk) { Say "Installing Node.js LTS"; winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements }
# Refresh PATH for this session
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
Say "Node $(node -v) OK"

# --- Claude Code CLI -------------------------------------------------------
if (-not (Need "claude")) { Say "Installing Claude Code CLI"; npm install -g @anthropic-ai/claude-code }

# --- Repo ------------------------------------------------------------------
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "package.json"))) {
  $Dir = Split-Path $PSScriptRoot -Parent
  Say "Using checkout at $Dir"
} elseif (Test-Path (Join-Path $Dir ".git")) {
  Say "Updating $Dir"
  git -C $Dir fetch origin $Branch
  git -C $Dir checkout -q $Branch
  git -C $Dir pull -q origin $Branch
} else {
  Say "Cloning into $Dir"
  git clone -q --branch $Branch $Repo $Dir
}
Set-Location (Join-Path $Dir "discord-agent")

# --- .env ------------------------------------------------------------------
if (-not (Test-Path ".env")) {
  Say "Configuration"
  $token = if ($env:DISCORD_TOKEN) { $env:DISCORD_TOKEN } else { Read-Host "Discord bot token (blank to skip)" }
  $owner = if ($token) { if ($env:DISCORD_OWNER_IDS) { $env:DISCORD_OWNER_IDS } else { Read-Host "Your Discord user ID" } } else { "" }
  $wa    = if ($env:WHATSAPP_OWNER_NUMBERS) { $env:WHATSAPP_OWNER_NUMBERS } else { Read-Host "WhatsApp number with country code (blank to skip)" }
  if (-not (($token -and $owner) -or $wa)) { throw "configure Discord (token + user ID) and/or a WhatsApp number" }
  $lines = @()
  if ($token) { $lines += "DISCORD_TOKEN=$token"; $lines += "DISCORD_OWNER_IDS=$owner" }
  if ($wa) { $lines += "WHATSAPP_OWNER_NUMBERS=$wa" }
  if ($env:ANTHROPIC_API_KEY) { $lines += "ANTHROPIC_API_KEY=$($env:ANTHROPIC_API_KEY)" }
  Set-Content -Path ".env" -Value $lines -Encoding ascii
  Say "Wrote $Dir\discord-agent\.env"
} else { Say "Keeping existing .env" }

# --- Build -----------------------------------------------------------------
Say "Installing dependencies"; npm install --no-audit --no-fund
Say "Building"; npm run build

# --- Claude auth -----------------------------------------------------------
$hasKey = $env:ANTHROPIC_API_KEY -or (Select-String -Path .env -Pattern '^ANTHROPIC_API_KEY=.+' -Quiet)
if (-not $hasKey) {
  claude auth status *> $null
  if ($LASTEXITCODE -ne 0) { Say "Log in to Claude (opens a browser)"; claude login }
}

# --- Run forever with pm2 --------------------------------------------------
Say "Starting bot with pm2"
if (-not (Need "pm2")) { npm install -g pm2 }
pm2 delete friday *> $null
pm2 start dist/index.js --name friday --time
pm2 save *> $null
Start-Sleep -Seconds 4
pm2 logs friday --lines 40 --nostream

Write-Host @"

Done. Useful commands:
  pm2 logs friday      # live logs (Discord invite link + WhatsApp QR appear here)
  pm2 restart friday   # after editing AGENT.md or .env
  pm2 stop friday

To auto-start after reboot on Windows: npm i -g pm2-windows-startup ; pm2-startup install
Next steps:
  - Discord: open the invite link from the logs, add the bot to a server, then DM it.
  - WhatsApp: run 'pm2 logs friday' and scan the QR (WhatsApp -> Linked Devices -> Link a Device).
"@
