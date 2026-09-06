import "dotenv/config";
import path from "node:path";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";

function list(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const PERMISSION_MODES: PermissionMode[] = ["bypassPermissions", "acceptEdits", "auto", "default", "dontAsk", "plan"];

function permissionMode(v: string | undefined): PermissionMode {
  const mode = (v ?? "bypassPermissions") as PermissionMode;
  if (!PERMISSION_MODES.includes(mode)) {
    throw new Error(`AGENT_PERMISSION_MODE must be one of ${PERMISSION_MODES.join(", ")}`);
  }
  return mode;
}

// Digits-only phone number, so +92 300 1234567 and 923001234567 compare equal.
const digits = (s: string) => s.replace(/\D/g, "");

const discordToken = process.env.DISCORD_TOKEN?.trim() || "";
const discordOwners = new Set(list(process.env.DISCORD_OWNER_IDS));
const waOwners = new Set(list(process.env.WHATSAPP_OWNER_NUMBERS).map(digits).filter(Boolean));
const bridgeToken = process.env.BRIDGE_TOKEN?.trim() || "";

export const config = {
  discord: {
    enabled: Boolean(discordToken),
    token: discordToken,
    ownerIds: discordOwners,
    channelIds: new Set(list(process.env.DISCORD_CHANNEL_IDS)),
  },
  whatsapp: {
    enabled: waOwners.size > 0,
    owners: waOwners,
  },
  // PC bridge: enabled on the cloud host when BRIDGE_TOKEN is set. The PC worker
  // dials in with the same token; the agent then gets pc_* tools.
  bridge: {
    enabled: Boolean(bridgeToken),
    port: Number(process.env.BRIDGE_PORT || 8787),
    token: bridgeToken,
  },
  model: process.env.AGENT_MODEL || "claude-opus-5",
  workspace: path.resolve(process.env.AGENT_WORKSPACE || "./workspace"),
  permissionMode: permissionMode(process.env.AGENT_PERMISSION_MODE),
  maxTurns: Number(process.env.AGENT_MAX_TURNS || 80),
  agentName: process.env.AGENT_NAME || "Friday",
  timezone: process.env.AGENT_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
  dataDir: path.resolve("./data"),
};

if (!config.discord.enabled && !config.whatsapp.enabled) {
  throw new Error("No transport configured. Set DISCORD_TOKEN (+ DISCORD_OWNER_IDS) and/or WHATSAPP_OWNER_NUMBERS.");
}
if (config.discord.enabled && config.discord.ownerIds.size === 0) {
  throw new Error("DISCORD_OWNER_IDS is empty. Refusing to start a Discord bot anyone could command.");
}
