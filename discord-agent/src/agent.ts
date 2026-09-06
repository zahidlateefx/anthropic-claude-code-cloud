import fs from "node:fs";
import path from "node:path";
import { query, type Options, type Query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./config.js";
import { buildToolsServer, TOOLS_SERVER_NAME } from "./tools.js";

export interface AgentEvents {
  /** Called whenever the agent starts using a tool (for "typing..." style status). */
  onTool?: (summary: string) => void;
  /** Called with intermediate assistant text (before the final answer). */
  onText?: (text: string) => void;
}

export interface AgentResult {
  text: string;
  sessionId: string | undefined;
  costUsd: number;
  turns: number;
  isError: boolean;
}

export const OUTBOX_DIR = "outbox";

function systemPrompt(): string {
  const promptFile = path.resolve("AGENT.md");
  const custom = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, "utf8") : "";
  return [
    `You are ${config.agentName}, a personal AI agent your owner controls from Discord and WhatsApp (usually from a phone).`,
    `You run 24/7 on a cloud server. Your own Bash/Read/Write/web/git/GitHub tools run in the CLOUD, not on the owner's PC. Working directory: ${config.workspace}.`,
    `The owner's PC is reachable only through the pc_* tools when it is online. Anything that must happen ON the owner's computer — open an app, control the screen, play local music, read/write their local files — needs a pc_* tool. If the PC is offline, those tools say so; tell the owner their PC isn't connected and offer to do it once it is back. Cloud work (web, code, research, GitHub, scheduling) always works regardless of the PC.`,
    ``,
    `Discord rules:`,
    `- Replies are shown in Discord. Keep them short and mobile-friendly. Use plain text, short bullets, and code blocks only for code/commands. No giant headers.`,
    `- To send the owner a file (spreadsheet, image, PDF, script...), copy it into the "${OUTBOX_DIR}/" folder inside the workspace. Everything in it is attached to your reply automatically.`,
    `- The owner may write in English, Roman Urdu/Hindi, or a mix. Reply in the same language style they used.`,
    `- If a task is ambiguous, ask ONE short clarifying question instead of guessing wildly. If it is clear, just do it and report the result.`,
    `- Long tasks are fine. Work through them fully, then summarize what you did and where the output is.`,
    ``,
    `Stay invisible on the owner's PC (via pc_bash / pc_* tools):`,
    `- Run PC work in the background. Never open a terminal/console/PowerShell window (no Start-Process powershell/cmd, no "start", no new windows). Prefer CLI/APIs/headless over the screen.`,
    `- Use pc_screenshot/pc_click only when a task truly needs the GUI, and say so briefly.`,
    ``,
    `Extra tools (MCP server "${TOOLS_SERVER_NAME}"):`,
    `- schedule_task / schedule_once / list_schedules / cancel_schedule: reminders and recurring jobs ("every morning at 9 send me YouTube stats"). Timezone: ${config.timezone}.`,
    `- pc_status / pc_bash / pc_screenshot / pc_click / pc_move / pc_scroll / pc_type / pc_key / pc_read_file / pc_write_file / pc_list_dir: act on the owner's PC when it is online.`,
    ``,
    custom,
  ].join("\n");
}

function summarizeTool(name: string, input: Record<string, unknown>): string {
  const first = (k: string) => {
    const v = input[k];
    return typeof v === "string" ? v.split("\n")[0].slice(0, 90) : "";
  };
  switch (name) {
    case "Bash":
      return `$ ${first("command")}`;
    case "Read":
    case "Write":
    case "Edit":
      return `${name} ${first("file_path")}`;
    case "WebSearch":
      return `Search: ${first("query")}`;
    case "WebFetch":
      return `Fetch: ${first("url")}`;
    case "Glob":
    case "Grep":
      return `${name} ${first("pattern")}`;
    case "Agent":
      return `Subagent: ${first("description")}`;
    default:
      if (name.startsWith(`mcp__${TOOLS_SERVER_NAME}__`)) {
        const short = name.slice(`mcp__${TOOLS_SERVER_NAME}__`.length);
        const args = Object.entries(input)
          .filter(([, v]) => typeof v === "string" || typeof v === "number")
          .map(([k, v]) => `${k}=${String(v).split("\n")[0].slice(0, 40)}`)
          .join(" ");
        return `${short} ${args}`.trim();
      }
      return name;
  }
}

/** Holds the running query per channel so `!stop` can interrupt it. */
const running = new Map<string, Query>();

export async function stopAgent(channelId: string): Promise<boolean> {
  const q = running.get(channelId);
  if (!q) return false;
  await q.interrupt();
  return true;
}

export function isRunning(channelId: string): boolean {
  return running.has(channelId);
}

export async function runAgent(
  channelId: string,
  prompt: string,
  resumeSessionId: string | undefined,
  events: AgentEvents = {},
): Promise<AgentResult> {
  fs.mkdirSync(path.join(config.workspace, OUTBOX_DIR), { recursive: true });

  const options: Options = {
    cwd: config.workspace,
    model: config.model,
    maxTurns: config.maxTurns,
    permissionMode: config.permissionMode,
    allowDangerouslySkipPermissions: config.permissionMode === "bypassPermissions",
    // With no human at a terminal, anything that would prompt is auto-denied
    // rather than hanging the bot (only matters outside bypassPermissions).
    permissionPrompts: "none",
    systemPrompt: { type: "preset", preset: "claude_code", append: systemPrompt() },
    settingSources: ["user", "project"],
    resume: resumeSessionId,
    mcpServers: { [TOOLS_SERVER_NAME]: buildToolsServer(channelId) },
    // Our own tools never need a permission prompt, whatever the mode.
    allowedTools: [`mcp__${TOOLS_SERVER_NAME}`],
  };

  const q = query({ prompt, options });
  running.set(channelId, q);

  let sessionId = resumeSessionId;
  let finalText = "";
  let costUsd = 0;
  let turns = 0;
  let isError = false;
  const textParts: string[] = [];

  try {
    for await (const msg of q as AsyncIterable<SDKMessage>) {
      if ("session_id" in msg && typeof msg.session_id === "string") sessionId = msg.session_id;

      if (msg.type === "assistant") {
        if (msg.parent_tool_use_id) continue; // subagent chatter
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text.trim()) {
            textParts.push(block.text);
            events.onText?.(block.text);
          } else if (block.type === "tool_use") {
            events.onTool?.(summarizeTool(block.name, (block.input ?? {}) as Record<string, unknown>));
          }
        }
        if (msg.error) {
          isError = true;
          textParts.push(`⚠️ API error: ${msg.error}`);
        }
      } else if (msg.type === "result") {
        turns = msg.num_turns;
        costUsd = msg.total_cost_usd;
        if (msg.subtype === "success") {
          finalText = msg.result;
          isError = msg.is_error;
        } else {
          isError = true;
          finalText = `⚠️ ${msg.subtype}` + ("errors" in msg && Array.isArray(msg.errors) ? `: ${msg.errors.join("; ")}` : "");
        }
      }
    }
  } finally {
    running.delete(channelId);
  }

  // The `result` message carries the final answer; fall back to the last text
  // block if the run was interrupted before a result arrived.
  const text = finalText || textParts.at(-1) || "(no reply)";
  return { text, sessionId, costUsd, turns, isError };
}

/** Files the agent dropped in outbox/ since last call. Returns paths and clears the folder afterwards. */
export function drainOutbox(): string[] {
  const dir = path.join(config.workspace, OUTBOX_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .map((f) => path.join(dir, f))
    .filter((p) => fs.statSync(p).isFile());
}
