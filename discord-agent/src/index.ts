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
} from "discord.js";
import { config } from "./config.js";
import { sessions } from "./sessions.js";
import { drainOutbox, isRunning, runAgent, stopAgent } from "./agent.js";
import { chunkMessage, truncate } from "./discord-utils.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

/** Per-channel FIFO so two messages in the same chat never run concurrently. */
const queues = new Map<string, Promise<void>>();
function enqueue(channelId: string, job: () => Promise<void>) {
  const prev = queues.get(channelId) ?? Promise.resolve();
  const next = prev.then(job, job).finally(() => {
    if (queues.get(channelId) === next) queues.delete(channelId);
  });
  queues.set(channelId, next);
}

function shouldHandle(msg: Message): boolean {
  if (msg.author.bot) return false;
  if (!config.ownerIds.has(msg.author.id)) return false;
  const isDM = msg.channel.type === ChannelType.DM;
  if (config.channelIds.size > 0) return isDM || config.channelIds.has(msg.channelId);
  return isDM || msg.mentions.has(client.user!);
}

function cleanContent(msg: Message): string {
  return msg.content.replace(new RegExp(`<@!?${client.user!.id}>`, "g"), "").trim();
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

async function handleCommand(msg: Message, text: string): Promise<boolean> {
  const cmd = text.toLowerCase();
  if (cmd === "!reset" || cmd === "!new") {
    sessions.clear(msg.channelId);
    await msg.reply("🧹 Fresh session. Previous context cleared.");
    return true;
  }
  if (cmd === "!stop") {
    const stopped = await stopAgent(msg.channelId);
    await msg.reply(stopped ? "🛑 Stopping current task." : "Nothing is running.");
    return true;
  }
  if (cmd === "!status") {
    await msg.reply(
      [
        `Agent: ${config.agentName} · model ${config.model}`,
        `Permission mode: ${config.permissionMode}`,
        `Workspace: ${config.workspace}`,
        `Session: ${sessions.get(msg.channelId) ?? "none"}`,
        `Busy: ${isRunning(msg.channelId) ? "yes" : "no"}`,
      ].join("\n"),
    );
    return true;
  }
  if (cmd === "!help") {
    await msg.reply(
      [
        `Just type what you want done. I keep context per chat.`,
        `!reset – start a fresh session`,
        `!stop – interrupt the running task`,
        `!status – show config/session`,
        `Attach files and I'll save them to the workspace inbox.`,
      ].join("\n"),
    );
    return true;
  }
  return false;
}

async function handleMessage(msg: Message) {
  const text = cleanContent(msg);
  if (await handleCommand(msg, text)) return;
  if (!text && msg.attachments.size === 0) return;

  if (isRunning(msg.channelId)) {
    await msg.react("⏳").catch(() => {});
  }

  enqueue(msg.channelId, async () => {
    const channel = msg.channel;
    if (!channel.isSendable()) return;

    const files = await downloadAttachments(msg);
    const prompt =
      files.length > 0
        ? `${text}\n\n[Attached files saved to: ${files.join(", ")}]`
        : text;

    // Status message edited in place as tools run.
    const status = await msg.reply(`💭 Working…`);
    let lastEdit = 0;
    const setStatus = (s: string) => {
      const now = Date.now();
      if (now - lastEdit < 1500) return; // respect Discord edit rate limits
      lastEdit = now;
      status.edit(truncate(`🔧 ${s}`, 1900)).catch(() => {});
    };
    const typing = setInterval(() => channel.sendTyping().catch(() => {}), 8000);
    await channel.sendTyping().catch(() => {});

    try {
      const result = await runAgent(msg.channelId, prompt, sessions.get(msg.channelId), {
        onTool: setStatus,
      });
      if (result.sessionId) sessions.set(msg.channelId, result.sessionId);

      const attachments = drainOutbox().map((p) => new AttachmentBuilder(p));
      const chunks = chunkMessage(result.text);
      await status.edit(chunks[0]).catch(async () => channel.send(chunks[0]));
      for (const c of chunks.slice(1)) await channel.send(c);
      if (attachments.length > 0) {
        await channel.send({ files: attachments });
        for (const a of attachments) fs.rmSync(a.attachment as string, { force: true });
      }
      console.log(
        `[${msg.channelId}] turns=${result.turns} cost=$${result.costUsd.toFixed(4)} error=${result.isError}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      await status.edit(`❌ ${truncate(message, 1900)}`).catch(() => {});
    } finally {
      clearInterval(typing);
    }
  });
}

client.once(Events.ClientReady, (c) => {
  fs.mkdirSync(config.workspace, { recursive: true });
  console.log(`✅ ${config.agentName} online as ${c.user.tag}`);
  console.log(`   model=${config.model} permissions=${config.permissionMode} workspace=${config.workspace}`);
  console.log(`   owners=${[...config.ownerIds].join(",")}`);
});

client.on(Events.MessageCreate, (msg) => {
  if (!shouldHandle(msg)) return;
  handleMessage(msg).catch(console.error);
});

client.login(config.discordToken);
