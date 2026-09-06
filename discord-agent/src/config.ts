import "dotenv/config";
import path from "node:path";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";

function list(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return v;
}

const PERMISSION_MODES: PermissionMode[] = ["bypassPermissions", "acceptEdits", "auto", "default", "dontAsk", "plan"];

function permissionMode(v: string | undefined): PermissionMode {
  const mode = (v ?? "bypassPermissions") as PermissionMode;
  if (!PERMISSION_MODES.includes(mode)) {
    throw new Error(`AGENT_PERMISSION_MODE must be one of ${PERMISSION_MODES.join(", ")}`);
  }
  return mode;
}

export const config = {
  discordToken: required("DISCORD_TOKEN"),
  ownerIds: new Set(list(process.env.DISCORD_OWNER_IDS)),
  channelIds: new Set(list(process.env.DISCORD_CHANNEL_IDS)),
  model: process.env.AGENT_MODEL || "claude-opus-5",
  workspace: path.resolve(process.env.AGENT_WORKSPACE || "./workspace"),
  permissionMode: permissionMode(process.env.AGENT_PERMISSION_MODE),
  maxTurns: Number(process.env.AGENT_MAX_TURNS || 80),
  agentName: process.env.AGENT_NAME || "Friday",
  dataDir: path.resolve("./data"),
};

if (config.ownerIds.size === 0) {
  throw new Error("DISCORD_OWNER_IDS is empty. Refusing to start a bot anyone on Discord could command.");
}
