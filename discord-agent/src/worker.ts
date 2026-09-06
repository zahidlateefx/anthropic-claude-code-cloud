import dotenv from "dotenv";
dotenv.config({ path: "worker.env" }); // preferred worker config
dotenv.config(); // fall back to .env; first-loaded wins
import fs from "node:fs";
import path from "node:path";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import WebSocket from "ws";
import * as computer from "./computer.js";

/**
 * PC worker — runs on the owner's computer. Dials out to the cloud Friday over
 * WebSocket and executes PC-only actions (shell, screen, local files) that the
 * cloud brain requests. Dials out, so no router/port config is needed here.
 *
 * Env: CLOUD_URL (ws://<cloud-host>:8787), BRIDGE_TOKEN (same as cloud).
 */
const exec = promisify(execCb);
const CLOUD_URL = (process.env.CLOUD_URL || "").trim();
const TOKEN = (process.env.BRIDGE_TOKEN || "").trim();
if (!CLOUD_URL || !TOKEN) {
  console.error("Set CLOUD_URL (ws://<host>:8787) and BRIDGE_TOKEN in the worker's .env");
  process.exit(1);
}

type Handler = (params: any) => Promise<any>;

const handlers: Record<string, Handler> = {
  async ping() {
    return { ok: true, platform: process.platform, host: (await import("node:os")).hostname() };
  },
  async bash({ command, cwd, timeoutMs }: { command: string; cwd?: string; timeoutMs?: number }) {
    try {
      const { stdout, stderr } = await exec(command, {
        cwd: cwd || undefined,
        timeout: timeoutMs || 120000,
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
      });
      return { stdout, stderr, code: 0 };
    } catch (err: any) {
      return { stdout: err.stdout ?? "", stderr: err.stderr ?? String(err?.message ?? err), code: err.code ?? 1 };
    }
  },
  async screenshot() {
    const s = await computer.screenshot();
    return { base64: s.png.toString("base64"), width: s.width, height: s.height, realWidth: s.realWidth, realHeight: s.realHeight };
  },
  async click({ x, y, button, double }: any) {
    await computer.click(x, y, button ?? "left", double ?? false);
    return { ok: true };
  },
  async move({ x, y }: any) {
    await computer.moveMouse(x, y);
    return { ok: true };
  },
  async scroll({ x, y, amount }: any) {
    await computer.scroll(x, y, amount);
    return { ok: true };
  },
  async type({ text }: any) {
    await computer.typeText(text);
    return { ok: true };
  },
  async key({ key, modifiers }: any) {
    await computer.pressKey(key, modifiers ?? []);
    return { ok: true };
  },
  async readFile({ path: p, encoding }: any) {
    const data = fs.readFileSync(p);
    return encoding === "base64" ? { base64: data.toString("base64") } : { text: data.toString("utf8") };
  },
  async writeFile({ path: p, text, base64 }: any) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, base64 != null ? Buffer.from(base64, "base64") : String(text ?? ""));
    return { ok: true, path: p };
  },
  async listDir({ path: p }: any) {
    const dir = p || (process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME) || ".";
    return {
      dir,
      entries: fs.readdirSync(dir).slice(0, 500).map((name) => {
        try {
          const st = fs.statSync(path.join(dir, name));
          return { name, dir: st.isDirectory(), size: st.size };
        } catch {
          return { name };
        }
      }),
    };
  },
};

function connect() {
  const ws = new WebSocket(`${CLOUD_URL}?token=${encodeURIComponent(TOKEN)}`);

  ws.on("open", () => console.log(`✅ PC worker connected to ${CLOUD_URL}`));

  ws.on("message", async (data) => {
    let req: any;
    try {
      req = JSON.parse(data.toString());
    } catch {
      return;
    }
    const handler = handlers[req.method];
    if (!handler) {
      ws.send(JSON.stringify({ id: req.id, ok: false, error: `unknown method ${req.method}` }));
      return;
    }
    try {
      const result = await handler(req.params ?? {});
      ws.send(JSON.stringify({ id: req.id, ok: true, result }));
    } catch (err: any) {
      ws.send(JSON.stringify({ id: req.id, ok: false, error: String(err?.message ?? err) }));
    }
  });

  ws.on("close", (code) => {
    console.log(`PC worker disconnected (${code}); reconnecting in 3s…`);
    setTimeout(connect, 3000);
  });
  ws.on("error", (err) => console.error("PC worker socket error:", err.message));
  ws.on("ping", () => ws.pong());
}

console.log(`PC worker starting on ${process.platform}; target ${CLOUD_URL}`);
connect();
