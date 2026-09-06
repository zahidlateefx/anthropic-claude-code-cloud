/**
 * Phone-friendly Claude re-login. Runs `claude setup-token` (1-year token,
 * subscription-backed) under a PTY, forwards the sign-in URL to the owner, and
 * accepts the authorization code back over chat. No SSH / laptop needed.
 *
 * node-pty is a native module and only needed on the cloud host, so it is
 * loaded lazily — the Windows PC worker never imports this file.
 */
import fs from "node:fs";
import path from "node:path";

type IPty = {
  onData(cb: (d: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number }) => void): { dispose(): void };
  write(data: string): void;
  kill(signal?: string): void;
};

const URL_RE = /https:\/\/claude\.com\/cai\/oauth\/authorize\?[A-Za-z0-9%&=_.\-]+/;
// The long-lived (1-year) token setup-token prints on success.
const TOKEN_RE = /sk-ant-[A-Za-z0-9_-]{24,}/;
const stripAnsi = (s: string) =>
  s
    .replace(/\x1b\][0-9]?;?[^\x07\x1b]*(?:\x07|\x1b\\)/g, "") // OSC (incl. hyperlinks)
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "") // CSI
    .replace(/\x1b[()][AB0-2]/g, "") // charset designators like ESC(B
    .replace(/\x1b[=>]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ""); // stray control chars

/** Persist the long-lived token so the bot (and restarts) use it, and apply it now. */
function saveToken(token: string) {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = token; // takes effect for the next agent query
  const file = path.resolve(".env");
  let lines: string[] = [];
  try {
    lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => !l.startsWith("CLAUDE_CODE_OAUTH_TOKEN="));
  } catch {
    /* no .env yet */
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  lines.push(`CLAUDE_CODE_OAUTH_TOKEN=${token}`);
  fs.writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });
}

let session: { pty: IPty; startedAt: number } | null = null;

async function loadPty(): Promise<any> {
  try {
    return await import("node-pty");
  } catch {
    throw new Error("node-pty not installed on this host — re-login over chat is unavailable. Run `claude setup-token` on the server instead.");
  }
}

export function reloginActive(): boolean {
  return session !== null;
}

function endSession() {
  if (session) {
    try {
      session.pty.kill();
    } catch {
      /* already dead */
    }
    session = null;
  }
}

/** Start `claude setup-token`; resolve with the sign-in URL to show the owner. */
export async function startRelogin(): Promise<string> {
  endSession();
  const pty = await loadPty();
  // Run a FRESH interactive login: strip any existing credentials from the
  // child env so setup-token always does the browser flow (otherwise it may
  // reuse/short-circuit with the token we already have and never mint a new one).
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k === "CLAUDE_CODE_OAUTH_TOKEN" || k === "ANTHROPIC_API_KEY" || k === "ANTHROPIC_AUTH_TOKEN") continue;
    if (typeof v === "string") childEnv[k] = v;
  }
  const p: IPty = pty.spawn("claude", ["setup-token"], { name: "xterm-color", cols: 1000, rows: 50, env: childEnv });
  session = { pty: p, startedAt: Date.now() };
  const mine = session;

  // Auto-expire an abandoned attempt after 10 minutes.
  setTimeout(() => {
    if (session === mine) endSession();
  }, 600000);

  return new Promise((resolve, reject) => {
    let buf = "";
    const to = setTimeout(() => {
      sub.dispose();
      endSession();
      reject(new Error("Timed out waiting for the sign-in link."));
    }, 30000);
    const sub = p.onData((d) => {
      buf += d;
      const m = buf.match(URL_RE);
      if (m) {
        clearTimeout(to);
        sub.dispose();
        resolve(m[0]);
      }
    });
    p.onExit(() => {
      if (session === mine) session = null;
    });
  });
}

export interface ReloginResult {
  ok: boolean;
  tokenSaved: boolean;
  detail?: string;
}

/** A user may paste the whole callback URL/line; pull out the bare code. */
function cleanCode(raw: string): string {
  let c = raw.trim();
  const m = c.match(/[?&]code=([^&\s]+)/);
  if (m) c = decodeURIComponent(m[1]);
  return c.replace(/\s+/g, "");
}

/** Feed the authorization code back and capture + persist the long-lived token. */
export async function submitCode(code: string): Promise<ReloginResult> {
  if (!session) throw new Error("No re-login in progress. Send !relogin first.");
  const s = session;
  return new Promise((resolve) => {
    let buf = "";
    let settled = false;
    const tail = () => stripAnsi(buf).replace(TOKEN_RE, "«token»").replace(/\s+/g, " ").trim().slice(-500);
    const tryToken = (): boolean => {
      const m = stripAnsi(buf).match(TOKEN_RE);
      if (m) {
        saveToken(m[0]);
        return true;
      }
      return false;
    };
    const finish = (ok: boolean, tokenSaved: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(to);
      try {
        sub.dispose();
      } catch {
        /* noop */
      }
      endSession();
      resolve({ ok, tokenSaved, detail: ok ? undefined : tail() });
    };
    const sub = s.pty.onData((d) => {
      buf += d;
      if (tryToken()) finish(true, true);
      // Only fail fast on an explicit rejection phrase (avoid matching stray "error").
      else if (/invalid code|incorrect code|not valid|authentication failed|authorization failed|invalid_grant/i.test(stripAnsi(buf))) finish(false, false);
    });
    s.pty.onExit(({ exitCode }) => {
      if (tryToken()) finish(true, true);
      else finish(false, false); // exited without printing a token
    });
    const to = setTimeout(() => finish(tryToken(), false), 90000);
    s.pty.write(cleanCode(code) + "\r");
  });
}
