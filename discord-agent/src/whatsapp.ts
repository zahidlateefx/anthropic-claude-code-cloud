import fs from "node:fs";
import path from "node:path";
import {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { config } from "./config.js";
import { enqueueTurn, handleCommand, registerTransport, startScheduler, type Responder, type Transport } from "./core.js";
import { chunkMessage } from "./discord-utils.js";

const logger = pino({ level: "silent" });
const WA_LIMIT = 4000; // keep WhatsApp messages readable

const digits = (jid: string) => (jid.split("@")[0] ?? "").split(":")[0].replace(/\D/g, "");

function extractText(msg: any): string {
  const m = msg.message ?? {};
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ??
    ""
  );
}

function mediaKind(msg: any): string | null {
  const m = msg.message ?? {};
  if (m.imageMessage) return "image";
  if (m.videoMessage) return "video";
  if (m.audioMessage) return "audio";
  if (m.documentMessage || m.documentWithCaptionMessage) return "document";
  return null;
}

export function startWhatsApp() {
  const authDir = path.join(config.dataDir, "wa-auth");
  fs.mkdirSync(authDir, { recursive: true });

  async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: [config.agentName, "Chrome", "1.0"], // shown in WhatsApp > Linked Devices
      markOnlineOnConnect: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u: any) => {
      if (u.qr) {
        console.log("\n📱 WhatsApp: scan this QR in WhatsApp → Settings → Linked Devices → Link a Device\n");
        qrcode.generate(u.qr, { small: true });
      }
      if (u.connection === "open") {
        console.log(`✅ WhatsApp: ${config.agentName} linked (owners ${[...config.whatsapp.owners].join(",")})`);
        startScheduler();
      }
      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.error("WhatsApp logged out. Delete data/wa-auth and restart to re-link.");
        } else {
          console.log("WhatsApp connection dropped, reconnecting…");
          setTimeout(() => connect().catch(console.error), 3000);
        }
      }
    });

    async function saveMedia(msg: any): Promise<string[]> {
      if (!mediaKind(msg)) return [];
      const dir = path.join(config.workspace, "inbox");
      fs.mkdirSync(dir, { recursive: true });
      try {
        const buf = (await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage })) as Buffer;
        const m = msg.message ?? {};
        const name =
          m.documentMessage?.fileName ??
          m.documentWithCaptionMessage?.message?.documentMessage?.fileName ??
          `${mediaKind(msg)}-${Date.now()}`;
        const dest = path.join(dir, `${Date.now()}-${name}`);
        fs.writeFileSync(dest, buf);
        return [dest];
      } catch {
        return [];
      }
    }

    // IDs of messages this bot sent, so its own replies (which are `fromMe`
    // in the owner's self-chat) never get re-processed as new commands.
    const sentIds = new Set<string>();
    async function waSend(jid: string, content: any): Promise<any> {
      const r = await sock.sendMessage(jid, content).catch(() => null);
      if (r?.key?.id) {
        sentIds.add(r.key.id);
        if (sentIds.size > 500) sentIds.clear();
      }
      return r;
    }

    const transport: Transport = {
      prefix: "whatsapp",
      async openResponder(jid): Promise<Responder | null> {
        await sock.sendPresenceUpdate("composing", jid).catch(() => {});
        const status = await waSend(jid, { text: "💭 Working…" });
        let lastEdit = 0;

        const editStatus = (text: string) =>
          status ? waSend(jid, { text, edit: status.key }) : waSend(jid, { text });

        return {
          onTool(summary) {
            const now = Date.now();
            if (now - lastEdit < 2500) return; // WhatsApp edits are heavier than Discord
            lastEdit = now;
            void editStatus(`🔧 ${summary}`.slice(0, 700));
            void sock.sendPresenceUpdate("composing", jid).catch(() => {});
          },
          async finalize(text, files) {
            const chunks = chunkMessage(text, WA_LIMIT);
            await editStatus(chunks[0]);
            for (const c of chunks.slice(1)) await waSend(jid, { text: c });
            for (const p of files) {
              const buf = fs.readFileSync(p);
              const base = path.basename(p);
              const isImg = /\.(png|jpe?g|gif|webp)$/i.test(base);
              await waSend(jid, isImg ? { image: buf } : { document: buf, fileName: base, mimetype: "application/octet-stream" });
            }
            await sock.sendPresenceUpdate("paused", jid).catch(() => {});
          },
          async fail(message) {
            await editStatus(`❌ ${message}`.slice(0, 700));
          },
        };
      },
    };
    registerTransport(transport);

    sock.ev.on("messages.upsert", async (up: any) => {
      if (up.type !== "notify") return;
      const selfNum = digits(sock.user?.id ?? "");
      for (const msg of up.messages) {
        if (!msg.message) continue;
        if (msg.key.id && sentIds.has(msg.key.id)) continue; // our own reply
        const jid: string = msg.key.remoteJid ?? "";
        if (jid.endsWith("@g.us") || jid === "status@broadcast") continue; // 1:1 chats only

        // Authorize. The bot runs on the owner's own WhatsApp, so the owner
        // commands it from the self-chat (messages there are `fromMe`).
        const isSelfChat = digits(jid) === selfNum;
        if (msg.key.fromMe) {
          if (!isSelfChat || !config.whatsapp.owners.has(selfNum)) continue;
        } else {
          if (!config.whatsapp.owners.has(digits(jid))) continue;
        }

        const text = extractText(msg).trim();
        const convId = `whatsapp:${jid}`;
        const reply = await handleCommand(convId, text);
        if (reply !== null) {
          await waSend(jid, { text: reply });
          continue;
        }
        const files = await saveMedia(msg);
        if (!text && files.length === 0) continue;
        const prompt = files.length > 0 ? `${text}\n\n[Attached files saved to: ${files.join(", ")}]` : text;
        enqueueTurn(convId, prompt);
      }
    });
  }

  connect().catch((err) => console.error("WhatsApp failed to start:", err));
}
