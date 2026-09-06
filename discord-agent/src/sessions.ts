import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

/**
 * One Claude session per Discord channel/DM, persisted to disk so the agent
 * remembers context across bot restarts.
 */
const file = path.join(config.dataDir, "sessions.json");

type Store = Record<string, string>;

function load(): Store {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Store;
  } catch {
    return {};
  }
}

function save(store: Store) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

let store = load();

export const sessions = {
  get(channelId: string): string | undefined {
    return store[channelId];
  },
  set(channelId: string, sessionId: string) {
    store[channelId] = sessionId;
    save(store);
  },
  clear(channelId: string) {
    delete store[channelId];
    save(store);
  },
};
