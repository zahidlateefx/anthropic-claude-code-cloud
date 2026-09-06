# Discord Claude Agent

Apna personal AI agent jo tum Discord se (phone se bhi) control karte ho. Wahi setup jo reel mein tha (unka "Thor", tumhara "Friday"): Discord bot → tumhare computer par chalta hua full Claude Code agent (shell, files, web search, git/GitHub, jo bhi CLI installed hai).

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

## Setup (10 min)

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
| `!status` | model, permission mode, session id |
| `!help` | ye list |

Server channels mein bot ko `@mention` karna padta hai; DM mein direct likho.

## Config (`.env`)

| Var | Default | Note |
|---|---|---|
| `DISCORD_OWNER_IDS` | – | **Required.** Sirf ye users command de sakte hain |
| `AGENT_PERMISSION_MODE` | `bypassPermissions` | Full autonomy (reel jaisa). `acceptEdits` = sirf file edits auto, commands deny. `auto` = classifier decide kare |
| `AGENT_MODEL` | `claude-opus-5` | `claude-sonnet-5` sasta/tez, `claude-fable-5-1` sabse smart |
| `AGENT_WORKSPACE` | `./workspace` | Agent yahan kaam karta hai |
| `AGENT_MAX_TURNS` | `80` | Ek request mein max tool calls |

`AGENT.md` edit karke agent ko apne baare mein, apne projects, aur rules batao (system prompt mein append hota hai).

## Security — zaroor padho

- `bypassPermissions` ka matlab: agent **bina pooche** koi bhi command chala sakta hai jo tum chala sakte ho. Isliye sirf apni machine par, aur `DISCORD_OWNER_IDS` hamesha set rakho.
- Bot token aur API key kabhi commit/share mat karo (`.env` gitignored hai).
- Agent ko jo accounts chahiye (GitHub, YouTube API, etc.), unka login/CLI tum khud ek baar machine par karo; bot unhi ko use karega.
- Prompt injection: agent jo web pages/files padhta hai, unme instructions ho sakti hain. `AGENT.md` mein rule hai ke paisa/publish wale kaam se pehle confirm kare.

## Cost

Har request pe ~$0.05–$2 (Opus 5, task ki length par depend). Console log mein har run ka cost print hota hai. Subscription (Claude Max) use karo to per-request charge nahi.

## Structure

```
src/index.ts         Discord client, queue per channel, attachments, status edits
src/agent.ts         Claude Agent SDK query(), tool progress, outbox
src/sessions.ts      channel → session id (data/sessions.json)
src/discord-utils.ts 2000-char safe chunking
AGENT.md             tumhari custom instructions
```
