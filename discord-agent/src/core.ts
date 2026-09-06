import fs from "node:fs";
import { config } from "./config.js";
import { sessions } from "./sessions.js";
import { drainOutbox, isRunning, runAgent, stopAgent } from "./agent.js";
import { scheduler, nowLocal } from "./scheduler.js";
import { reloginActive, startRelogin, submitCode } from "./relogin.js";

/**
 * A conversation is addressed as "<transport>:<rawId>" (e.g. "discord:123",
 * "whatsapp:92300...@s.whatsapp.net"). Everything below is transport-agnostic;
 * each chat app provides a Transport that turns a conversation into a Responder.
 */
export interface Responder {
  /** Live progress line as tools run (throttled by the adapter). */
  onTool(summary: string): void;
  /** Post the final answer plus any files the agent produced. */
  finalize(text: string, files: string[]): Promise<void>;
  /** Something threw before finishing. */
  fail(message: string): Promise<void>;
}

export interface Transport {
  readonly prefix: string;
  /** Build a Responder for one turn, or null if the conversation is unreachable. */
  openResponder(rawId: string): Promise<Responder | null>;
}

const transports = new Map<string, Transport>();
export function registerTransport(t: Transport) {
  transports.set(t.prefix, t);
}

/** Per-conversation FIFO so two messages in the same chat never run at once. */
const queues = new Map<string, Promise<void>>();

export function enqueueTurn(convId: string, prompt: string) {
  const job = () => runConversation(convId, prompt);
  const prev = queues.get(convId) ?? Promise.resolve();
  const next = prev.then(job, job).finally(() => {
    if (queues.get(convId) === next) queues.delete(convId);
  });
  queues.set(convId, next);
}

async function runConversation(convId: string, prompt: string) {
  const sep = convId.indexOf(":");
  const transport = transports.get(convId.slice(0, sep));
  if (!transport) return;
  const responder = await transport.openResponder(convId.slice(sep + 1));
  if (!responder) return;

  try {
    const result = await runAgent(convId, `(${nowLocal()}) ${prompt}`, sessions.get(convId), {
      onTool: responder.onTool,
    });
    if (result.sessionId) sessions.set(convId, result.sessionId);
    const files = drainOutbox();
    await responder.finalize(result.text, files);
    for (const f of files) fs.rmSync(f, { force: true });
    console.log(`[${convId}] turns=${result.turns} cost=$${result.costUsd.toFixed(4)} error=${result.isError}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${convId}]`, err);
    await responder.fail(message).catch(() => {});
  }
}

let schedulerStarted = false;
export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  scheduler.start(async (job) => {
    enqueueTurn(job.channelId, `[Scheduled task "${job.description}" (id ${job.id}) fired]\n${job.prompt}`);
  });
}

/**
 * Handle a bare "!command". Returns a reply string to send, or null if the
 * text is not a command (and should go to the agent).
 */
export async function handleCommand(convId: string, text: string): Promise<string | null> {
  const raw = text.trim();
  const cmd = raw.toLowerCase();

  // Claude re-login from the phone (no SSH). !relogin -> URL; then the code.
  if (cmd === "!relogin" || cmd === "!login") {
    try {
      const url = await startRelogin();
      return [
        "🔐 Claude re-login (1-year token):",
        "1) Is link ko kholo, sign in aur authorize karo:",
        url,
        "2) Jo code dikhe wo yahin bhej do (paste kar do, ya `!code <code>`).",
      ].join("\n");
    } catch (err) {
      return `Re-login start nahi hua: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  if (reloginActive() && (cmd.startsWith("!code ") || !raw.startsWith("!"))) {
    const code = raw.replace(/^!code\s+/i, "").trim();
    try {
      const r = await submitCode(code);
      if (r.ok && r.tokenSaved) return "✅ Ho gaya! Naya 1-saal wala token save aur active. Ab expiry ~1 saal door hai. Apna kaam dobara bolo.";
      if (r.ok) return "⚠️ Login to hua par 1-saal token capture nahi hua. Dobara `!relogin` try karo (link → authorize → code bhejo).";
      return "❌ Code reject/galat. Dobara `!relogin` bhejo.";
    } catch (err) {
      return `Code submit fail: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (cmd === "!reset" || cmd === "!new") {
    sessions.clear(convId);
    return "🧹 Fresh session. Previous context cleared.";
  }
  if (cmd === "!stop") {
    return (await stopAgent(convId)) ? "🛑 Stopping current task." : "Nothing is running.";
  }
  if (cmd === "!schedules" || cmd === "!jobs") {
    const jobs = scheduler.list(convId);
    return jobs.length === 0
      ? "No scheduled tasks. Just ask, e.g. 'remind me tomorrow 9am to …' or 'every Monday send me …'."
      : jobs.map((j) => `• ${j.id} ${j.description} — ${j.cron ?? j.at} (next: ${j.nextRun ?? "-"})`).join("\n");
  }
  if (cmd === "!status") {
    return [
      `Agent: ${config.agentName} · model ${config.model}`,
      `Permission mode: ${config.permissionMode}`,
      `Timezone: ${config.timezone} · now ${nowLocal()}`,
      `Session: ${sessions.get(convId) ?? "none"}`,
      `Busy: ${isRunning(convId) ? "yes" : "no"} · scheduled jobs: ${scheduler.list(convId).length}`,
    ].join("\n");
  }
  if (cmd === "!help") {
    return [
      `Just type what you want done. I keep context per chat.`,
      `!reset – start a fresh session`,
      `!stop – interrupt the running task`,
      `!schedules – list reminders / recurring jobs`,
      `!relogin – Claude session expire ho to phone se dobara login`,
      `!status – show config/session`,
      `Attach files and I'll save them to the workspace inbox.`,
    ].join("\n");
  }
  return null;
}
