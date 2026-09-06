# Friday — Personal Claude Code Agent

Apna personal AI agent jo tum **Discord aur/ya WhatsApp** se (phone se bhi) control karte ho. Wahi setup jo reel mein tha (unka "Thor", tumhara "Friday"): Discord bot → tumhare computer par chalta hua full Claude Code agent (shell, files, web search, git/GitHub, jo bhi CLI installed hai).

```
Phone (Discord DM) ──▶ Bot (this repo) ──▶ Claude Agent SDK ──▶ tumhara laptop/server
                                                 │  Bash · Read/Write · WebSearch · gh · ...
                       ◀── reply + files ◀───────┘
```

## Kya kar sakta hai

- Code likhna, repo clone/push, PR banana (`gh` installed ho to)
- Files/spreadsheets/notes banana aur Discord par bhejna (`outbox/` folder se auto-attach)
- Web research, YouTube/Instagram analytics scrape, reports
- Tumhare bheje files (screenshots, PDFs, CSV) padhna (auto-saved to `workspace/inbox/`)
- Koi bhi command jo tum khud terminal mein chalate — wo bhi
- Har chat ki apni memory (session) hai, restart ke baad bhi yaad rehta hai
- **Reminders / recurring jobs**: "har subah 9 baje YouTube stats bhejo", "kal 5 baje yaad dilana" (bot restart ke baad bhi bache rehte hain)
- **Screen control**: screenshot lekar click/type karna, un GUI apps ke liye jinka CLI nahi hai

## Cloud 24/7 + PC worker

Friday ko cloud par 24/7 chalana hai (PC off ho tab bhi, PC-tasks ke liye ek chhota worker PC par)? Dekho **[DEPLOY-CLOUD.md](DEPLOY-CLOUD.md)** (Oracle Free VM + PC worker).

## Fastest setup (one command)

Discord token aur apna user ID (neeche step 1) hath mein rakho. Git installed ho (repo private hai, clone par GitHub login poochega).

**macOS / Linux**
```bash
git clone -b claude/instagram-reel-discord-agent-ooifkn https://github.com/zahidlateefx/anthropic-claude-code-cloud.git ~/friday-agent
bash ~/friday-agent/discord-agent/install.sh
```

**Windows (PowerShell)**
```powershell
git clone -b claude/instagram-reel-discord-agent-ooifkn https://github.com/zahidlateefx/anthropic-claude-code-cloud.git $HOME\friday-agent
powershell -ExecutionPolicy Bypass -File $HOME\friday-agent\discord-agent\install.ps1
```

Installer Node, Claude CLI, repo, build, `claude login` (agar zaroorat ho) aur pm2 sab khud karta hai. Aakhir mein logs mein bot ka **invite link** print hota hai, wo open karke bot apne server mein add karo.

## Manual setup (10 min)

### 1. Discord bot banao
1. https://discord.com/developers/applications → **New Application** → naam do (e.g. Friday)
2. **Bot** tab → **Reset Token** → token copy karo
3. Isi tab par **Privileged Gateway Intents** mein **Message Content Intent** ON karo
4. **OAuth2 → URL Generator**: scopes `bot`, permissions `Send Messages`, `Read Message History`, `Attach Files`, `Add Reactions` → URL open karke apne server mein add karo
5. Discord app: Settings → Advanced → **Developer Mode** ON → apne naam par right-click → **Copy User ID**

### 2. Claude access
Koi ek:
- **API key**: https://console.anthropic.com → key banao (pay-as-you-go), ya
- **Subscription**: `npm i -g @anthropic-ai/claude-code && claude login` (Pro/Max plan use hota hai, key ki zaroorat nahi)

### 3. Run
```bash
cd discord-agent
cp .env.example .env      # token, user ID, (api key) bharo
npm install
npm run build
npm start
```
Console mein `✅ Friday online` aaye to Discord par bot ko DM karo.

### 4. 24/7 chalana (optional)
```bash
npm i -g pm2
pm2 start dist/index.js --name friday
pm2 save && pm2 startup
```
Laptop band ho to bot band. Hamesha on chahiye to ek sasta VPS (Hetzner/DigitalOcean $5) ya ghar ka purana PC/Raspberry Pi use karo.

## Commands

| Discord message | Kaam |
|---|---|
| kuch bhi likho | task run hota hai, status message update hota rehta hai |
| `!reset` | nayi session, purana context clear |
| `!stop` | chal raha task rok do |
| `!schedules` | reminders / recurring jobs ki list |
| `!status` | model, permission mode, session id |
| `!help` | ye list |

Server channels mein bot ko `@mention` karna padta hai; DM mein direct likho.

## Config (`.env`)

| Var | Default | Note |
|---|---|---|
| `DISCORD_OWNER_IDS` | – | Discord chahiye to sirf ye users command de sakte hain |
| `WHATSAPP_OWNER_NUMBERS` | – | WhatsApp chahiye to ye number(s), country code ke sath (e.g. `923001234567`) |
| `AGENT_PERMISSION_MODE` | `bypassPermissions` | Full autonomy (reel jaisa). `acceptEdits` = sirf file edits auto, commands deny. `auto` = classifier decide kare |
| `AGENT_MODEL` | `claude-opus-5` | `claude-sonnet-5` sasta/tez, `claude-fable-5-1` sabse smart |
| `AGENT_WORKSPACE` | `./workspace` | Agent yahan kaam karta hai |
| `AGENT_MAX_TURNS` | `80` | Ek request mein max tool calls |
| `AGENT_TIMEZONE` | system tz | Reminders/cron ke liye, e.g. `Asia/Karachi` |

`AGENT.md` edit karke agent ko apne baare mein, apne projects, aur rules batao (system prompt mein append hota hai).

## WhatsApp

WhatsApp chalane ke liye `.env` mein `WHATSAPP_OWNER_NUMBERS` set karo (Discord optional ho jata hai — kam se kam ek transport chahiye). Baileys use hota hai: koi browser/Chromium nahi, sirf QR se link.

1. Bot start karo, phir `pm2 logs friday` — ek QR code print hoga.
2. Phone par WhatsApp → Settings → **Linked Devices** → **Link a Device** → QR scan karo.
3. Ab apne hi WhatsApp par (ya apne number ko "Message Yourself") likho — Friday jawab dega.

- Sirf `WHATSAPP_OWNER_NUMBERS` wale number command de sakte hain. Groups ignore hote hain (sirf 1:1 chat).
- Session `data/wa-auth/` mein save hota hai, restart ke baad dobara scan nahi karna.
- File bhejo to `workspace/inbox/` mein save hoti hai; Friday jo file bheje wo attach ho jati hai.

## Screen control (computer use) — prerequisites

Agent `screenshot`, `click`, `type_text`, `press_key`, `scroll` tools se screen chala sakta hai. Bot us user session mein chalna chahiye jiski screen dikh rahi ho (locked screen par kaam nahi karega).

| OS | Install |
|---|---|
| Windows | kuch nahi (PowerShell built-in) |
| macOS | `brew install cliclick`; phir System Settings → Privacy & Security → **Screen Recording** aur **Accessibility** mein Terminal/node ko allow karo |
| Linux (X11) | `sudo apt install xdotool imagemagick` |

Screenshots 1568px tak chhote karke model ko diye jate hain; coordinates bot khud map karta hai.

## Security — zaroor padho

- `bypassPermissions` ka matlab: agent **bina pooche** koi bhi command chala sakta hai jo tum chala sakte ho. Isliye sirf apni machine par, aur `DISCORD_OWNER_IDS` hamesha set rakho.
- Bot token aur API key kabhi commit/share mat karo (`.env` gitignored hai).
- Agent ko jo accounts chahiye (GitHub, YouTube API, etc.), unka login/CLI tum khud ek baar machine par karo; bot unhi ko use karega.
- Prompt injection: agent jo web pages/files padhta hai, unme instructions ho sakti hain. `AGENT.md` mein rule hai ke paisa/publish wale kaam se pehle confirm kare.

## Cost

Har request pe ~$0.05–$2 (Opus 5, task ki length par depend). Console log mein har run ka cost print hota hai. Subscription (Claude Max) use karo to per-request charge nahi.

## Structure

```
src/index.ts         Entry: starts configured transports
src/core.ts          Transport-agnostic: queue, commands, scheduler routing
src/discord.ts       Discord adapter
src/whatsapp.ts      WhatsApp adapter (Baileys, QR login)
src/agent.ts         Claude Agent SDK query(), tool progress, outbox
src/sessions.ts      channel → session id (data/sessions.json)
src/discord-utils.ts 2000-char safe chunking
src/scheduler.ts     cron + one-shot jobs (data/schedules.json)
src/tools.ts         in-process MCP tools: schedule_*, screenshot, click, type...
src/computer.ts      per-OS screen control (PowerShell / osascript+cliclick / xdotool)
src/bridge.ts        cloud WebSocket server + callPC (PC bridge)
src/pc-tools.ts      cloud agent tools that proxy to the PC worker
src/worker.ts        PC worker entrypoint (runs on the owner's PC)
AGENT.md             tumhari custom instructions
```
