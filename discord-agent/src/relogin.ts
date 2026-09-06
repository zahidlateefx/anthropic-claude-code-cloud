/**
 * Phone-friendly Claude re-login. Runs `claude setup-token` (1-year token,
 * subscription-backed) under a PTY, forwards the sign-in URL to the owner, and
 * accepts the authorization code back over chat. No SSH / laptop needed.
 *
 * node-pty is a native module and only needed on the cloud host, so it is
 * loaded lazily — the Windows PC worker never imports this file.
 */
type IPty = {
  onData(cb: (d: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number }) => void): { dispose(): void };
  write(data: string): void;
  kill(signal?: string): void;
};

const URL_RE = /https:\/\/claude\.com\/cai\/oauth\/authorize\?[A-Za-z0-9%&=_.\-]+/;

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
  const p: IPty = pty.spawn("claude", ["setup-token"], { name: "xterm-color", cols: 100, rows: 30, env: process.env });
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

/** Feed the authorization code back to the running setup-token. */
export async function submitCode(code: string): Promise<boolean> {
  if (!session) throw new Error("No re-login in progress. Send !relogin first.");
  const s = session;
  return new Promise((resolve) => {
    let buf = "";
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(to);
      try {
        sub.dispose();
      } catch {
        /* noop */
      }
      endSession();
      resolve(ok);
    };
    const sub = s.pty.onData((d) => {
      buf += d;
      const clean = buf.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
      if (/success|logged in|saved|token set|you'?re all set|complete/i.test(clean)) finish(true);
      else if (/invalid|error|failed|expired|incorrect|denied/i.test(clean)) finish(false);
    });
    s.pty.onExit(({ exitCode }) => finish(exitCode === 0));
    // Fallback: assume success if it neither errors nor exits within 45s.
    const to = setTimeout(() => finish(true), 45000);
    s.pty.write(code.trim() + "\r");
  });
}
