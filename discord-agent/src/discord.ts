import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  AttachmentBuilder,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials,
  type SendableChannels,
} from "discord.js";
import { config } from "./config.js";
import { enqueueTurn, handleCommand, registerTransport, startScheduler, type Responder, type Transport } from "./core.js";
import { chunkMessage, truncate } from "./discord-utils.js";

export function startDiscord() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  const namePrefix = () => new RegExp(`^\\s*${config.agentName}\\b[,:!\\s]*`, "i");

  function shouldHandle(msg: Message): boolean {
    if (msg.author.bot) return false;
    if (!config.discord.ownerIds.has(msg.author.id)) return false;
    const isDM = msg.channel.type === ChannelType.DM;
    if (config.discord.channelIds.size > 0) return isDM || config.discord.channelIds.has(msg.channelId);
    return isDM || msg.mentions.has(client.user!) || namePrefix().test(msg.content);
  }

  function cleanContent(msg: Message): string {
    return msg.content
      .replace(new RegExp(`<@!?${client.user!.id}>`, "g"), "")
      .replace(namePrefix(), "")
      .trim();
  }

  async function downloadAttachments(msg: Message): Promise<string[]> {
    const dir = path.join(config.workspace, "inbox");
    fs.mkdirSync(dir, { recursive: true });
    const saved: string[] = [];
    for (const att of msg.attachments.values()) {
      const res = await fetch(att.url);
      if (!res.ok || !res.body) continue;
      const dest = path.join(dir, `${Date.now()}-${att.name}`);
      await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(dest));
      saved.push(dest);
    }
    return saved;
  }

  const transport: Transport = {
    prefix: "discord",
    async openResponder(channelId): Promise<Responder | null> {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isSendable()) return null;
      const sendable = channel as SendableChannels;
      const status = await sendable.send("💭 Working…").catch(() => null);
      const typing = setInterval(() => sendable.sendTyping().catch(() => {}), 8000);

      const done = () => clearInterval(typing);

      return {
        onTool() {
          // Intentionally silent: show only "Working…" then the final answer.
        },
        async finalize(text, files) {
          done();
          const chunks = chunkMessage(text);
          if (status) await status.edit(chunks[0]).catch(async () => void (await sendable.send(chunks[0])));
          else await sendable.send(chunks[0]);
          for (const c of chunks.slice(1)) await sendable.send(c);
          if (files.length > 0) await sendable.send({ files: files.map((p) => new AttachmentBuilder(p)) });
        },
        async fail(message) {
          done();
          const msg = `❌ ${truncate(message, 1900)}`;
          if (status) await status.edit(msg).catch(async () => void (await sendable.send(msg)));
          else await sendable.send(msg);
        },
      };
    },
  };
  registerTransport(transport);

  client.once(Events.ClientReady, (c) => {
    console.log(`✅ Discord: ${config.agentName} online as ${c.user.tag} (owners ${[...config.discord.ownerIds].join(",")})`);
    const perms = 1024 + 2048 + 64 + 32768 + 65536; // view, send, react, attach, read history
    console.log(`   Invite: https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot&permissions=${perms}`);
    startScheduler();
  });

  client.on(Events.MessageCreate, async (msg) => {
    if (!shouldHandle(msg)) return;
    const text = cleanContent(msg);
    const convId = `discord:${msg.channelId}`;
    const reply = await handleCommand(convId, text);
    if (reply !== null) {
      await msg.reply(reply).catch(() => {});
      return;
    }
    if (!text && msg.attachments.size === 0) return;
    const files = await downloadAttachments(msg);
    const prompt = files.length > 0 ? `${text}\n\n[Attached files saved to: ${files.join(", ")}]` : text;
    enqueueTurn(convId, prompt);
  });

  client.login(config.discord.token);
}
