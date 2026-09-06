import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config.js";

/**
 * Cloud-side bridge. The PC worker dials in over WebSocket with the shared
 * token; the cloud agent then proxies PC-only actions (shell, screen, local
 * files) to it via callPC(). If no worker is connected, callPC rejects with a
 * clear "PC offline" message the agent relays to the owner.
 */
let pc: WebSocket | null = null;
const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();

export function startBridge() {
  if (!config.bridge.enabled) return;
  const wss = new WebSocketServer({ port: config.bridge.port });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.searchParams.get("token") !== config.bridge.token) {
      ws.close(4001, "bad token");
      return;
    }
    if (pc && pc.readyState === WebSocket.OPEN) pc.close(4002, "replaced");
    pc = ws;
    console.log("🔌 PC worker connected");

    ws.on("message", (data) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error || "PC worker error"));
    });

    ws.on("close", () => {
      if (pc === ws) {
        pc = null;
        console.log("🔌 PC worker disconnected");
      }
    });
    ws.on("error", () => {});
    ws.on("pong", () => ((ws as any).isAlive = true));
  });

  // Drop dead sockets so isPcOnline() reflects reality.
  setInterval(() => {
    if (!pc) return;
    if ((pc as any).isAlive === false) {
      pc.terminate();
      return;
    }
    (pc as any).isAlive = false;
    pc.ping();
  }, 30000);

  console.log(`🌉 Bridge listening on port ${config.bridge.port} (PC worker can connect)`);
}

export function isPcOnline(): boolean {
  return pc?.readyState === WebSocket.OPEN;
}

const OFFLINE_MSG =
  "PC offline: owner ka computer abhi internet se connected nahi hai. Ye kaam (shell/screen/local files) tab hoga jab PC on aur connected ho. Cloud wale kaam (web, code, GitHub) abhi ho sakte hain.";

export function callPC<T = any>(method: string, params: unknown = {}, timeoutMs = 120000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!config.bridge.enabled) {
      reject(new Error("PC bridge is not configured (no BRIDGE_TOKEN). PC tasks are unavailable."));
      return;
    }
    if (!isPcOnline()) {
      reject(new Error(OFFLINE_MSG));
      return;
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`PC did not respond within ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    pc!.send(JSON.stringify({ id, method, params }));
  });
}
