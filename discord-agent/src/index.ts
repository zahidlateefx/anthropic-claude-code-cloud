import fs from "node:fs";
import { config } from "./config.js";
import { startDiscord } from "./discord.js";
import { startWhatsApp } from "./whatsapp.js";
import { startScheduler } from "./core.js";

fs.mkdirSync(config.workspace, { recursive: true });
console.log(
  `${config.agentName}: model=${config.model} permissions=${config.permissionMode} tz=${config.timezone} workspace=${config.workspace}`,
);

if (config.discord.enabled) startDiscord();
if (config.whatsapp.enabled) startWhatsApp();

// Safety net: if a transport never signals ready, still arm schedules after 15s.
setTimeout(startScheduler, 15000);
