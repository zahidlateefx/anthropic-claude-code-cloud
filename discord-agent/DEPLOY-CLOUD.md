# Friday in the cloud (24/7) + PC worker

Friday ka "dimaag" cloud par 24/7 chalega (PC off ho tab bhi). PC-only kaam
(shell, screen, local files) ke liye tumhare PC par ek chhota **worker** chalta
hai jo cloud se connect rehta hai. PC off/offline ho to Friday khud bata dega
ke PC connected nahi, baaki cloud kaam chalta rahega.

```
WhatsApp / Discord ─▶ Cloud Friday (Oracle Free VM, 24/7)
                          │  web, code, GitHub, research, scheduling
                          └─(WebSocket :8787)─▶ PC Worker (tumhara PC)
                                                  pc_bash, screen, local files
```

## Part A — Cloud (Oracle Cloud Free VM)

### 1. Free VM banao
1. https://www.oracle.com/cloud/free/ → account banao (card verify hota hai, charge nahi).
2. Console → **Compute → Instances → Create Instance**.
   - Image: **Ubuntu 22.04**
   - Shape: **Ampere (Always Free)** — `VM.Standard.A1.Flex`, 1-2 OCPU / 6-12 GB
   - SSH key: apni public key add karo (ya naya key pair download karo)
3. Create. Public IP note karo (e.g. `140.x.x.x`).

### 2. Bridge port kholo
- Console → instance ki **Subnet → Security List → Add Ingress Rule**:
  Source `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **8787**.

### 3. VM par setup (SSH se)
```bash
ssh ubuntu@YOUR_CLOUD_IP

# Node + git + build tools
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential
sudo npm i -g pm2 @anthropic-ai/claude-code

# firewall (Ubuntu par bhi port khol do)
sudo iptables -I INPUT -p tcp --dport 8787 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

# repo
git clone -b claude/instagram-reel-discord-agent-ooifkn https://github.com/zahidlateefx/anthropic-claude-code-cloud.git ~/friday
cd ~/friday/discord-agent
npm install
npm run build

# Claude login (subscription). Browser wala URL kholo, code paste karo.
claude login
```

### 4. `.env` banao (cloud)
```bash
cat > .env <<'ENV'
DISCORD_TOKEN=...
DISCORD_OWNER_IDS=...
WHATSAPP_OWNER_NUMBERS=923417258293,923079517487
AGENT_TIMEZONE=Asia/Karachi
BRIDGE_TOKEN=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
BRIDGE_PORT=8787
ENV
chmod 600 .env
```
`BRIDGE_TOKEN` ek lamba random secret rakho (yahi worker par bhi jayega).

### 5. Start
```bash
pm2 start dist/index.js --name friday --time
pm2 save
pm2 startup   # jo command bataye, use chala do (reboot par auto-start)
pm2 logs friday
```
WhatsApp QR logs mein aayega → dedicated number se scan. Bridge line:
`🌉 Bridge listening on port 8787`.

## Part B — PC worker (tumhare Windows PC par)

```powershell
cd $HOME\friday-agent\discord-agent
git pull
npm install
npm run build

# worker config
@"
CLOUD_URL=ws://YOUR_CLOUD_IP:8787
BRIDGE_TOKEN=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
"@ | Set-Content worker.env

# run worker with pm2 (alag naam)
pm2 delete friday 2>$null   # ab bot cloud par hai; PC par sirf worker chalega
pm2 start dist/worker.js --name friday-worker --time
pm2 save
pm2 logs friday-worker
```
`✅ PC worker connected to ws://...` aaye to PC linked hai.

macOS/Linux worker ke liye screen tools: `brew install cliclick` (mac) ya
`sudo apt install xdotool imagemagick` (linux). Windows par kuch nahi chahiye.

## Test
- WhatsApp par: `mera Downloads folder list karo` → PC on ho to list aayegi;
  PC off ho to Friday bolega "PC connected nahi".
- `koi bhi cloud kaam` (e.g. "fetch top HN posts") PC off hone par bhi chalega.

## Notes
- **Auth:** subscription (`claude login`) cloud par periodically expire ho sakta
  hai. Tootne par SSH se dobara `claude login` + `pm2 restart friday`. Reliable
  chahiye to `.env` mein `ANTHROPIC_API_KEY=sk-ant-...` daal do (phir login ki
  zaroorat nahi).
- **Security:** `BRIDGE_TOKEN` kisi ko na do. Traffic abhi plain ws:// hai; extra
  security chahiye to aage Caddy/nginx se wss:// (TLS) laga sakte hain.
- **Update:** dono jagah `git pull && npm install && npm run build && pm2 restart <name>`.
