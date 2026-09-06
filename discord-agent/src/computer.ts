/**
 * Minimal cross-platform screen control with no native npm dependencies.
 *  - Windows: PowerShell + user32 / System.Drawing (nothing to install)
 *  - macOS:   screencapture + osascript; clicks need `brew install cliclick`
 *  - Linux:   xdotool + ImageMagick `import` (apt install xdotool imagemagick)
 *
 * Screenshots are downscaled to MAX_WIDTH so the model gets a manageable
 * image; click coordinates are given in that image's pixel space and mapped
 * back to real screen pixels here.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const exec = promisify(execFile);
const MAX_WIDTH = 1568;
const platform = process.platform;

let scale = 1; // real px per screenshot px
let origin = { x: 0, y: 0 }; // virtual-screen offset (multi-monitor on Windows)

async function ps(script: string): Promise<string> {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const { stdout } = await exec("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.trim();
}

async function run(cmd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec(cmd, args, { maxBuffer: 64 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") throw new Error(`${cmd} is not installed. ${installHint()}`);
    throw err;
  }
}

function installHint(): string {
  if (platform === "darwin") return "Run: brew install cliclick";
  if (platform === "linux") return "Run: sudo apt install xdotool imagemagick";
  return "";
}

const WIN_USER32 = `
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class U {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, int d, UIntPtr e);
}
"@
[void][U]::SetProcessDPIAware()
`;

// ---------------------------------------------------------------- screenshot
export async function screenshot(): Promise<{ png: Buffer; width: number; height: number; realWidth: number; realHeight: number }> {
  const file = path.join(os.tmpdir(), `friday-shot-${Date.now()}.png`);
  let realWidth = 0;
  let realHeight = 0;

  if (platform === "win32") {
    const out = await ps(`${WIN_USER32}
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
$w = [Math]::Min($b.Width, ${MAX_WIDTH}); $h = [int]($b.Height * $w / $b.Width)
$small = New-Object System.Drawing.Bitmap $bmp, $w, $h
$small.Save("${file.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
"$($b.Width) $($b.Height) $($b.Left) $($b.Top) $w $h"`);
    const [bw, bh, bl, bt, w, h] = out.split(" ").map(Number);
    realWidth = bw; realHeight = bh; origin = { x: bl, y: bt };
    scale = bw / w;
    const png = fs.readFileSync(file); fs.rmSync(file, { force: true });
    return { png, width: w, height: h, realWidth, realHeight };
  }

  if (platform === "darwin") {
    await run("screencapture", ["-x", "-C", file]);
    // Logical (point) size of the main display; retina screenshots are 2x pixels.
    const bounds = await run("osascript", ["-e", 'tell application "Finder" to get bounds of window of desktop']);
    const [, , lw, lh] = bounds.split(",").map((s) => Number(s.trim()));
    realWidth = lw; realHeight = lh;
    const w = Math.min(lw, MAX_WIDTH);
    await run("sips", ["--resampleWidth", String(w), file]);
    const png = fs.readFileSync(file); fs.rmSync(file, { force: true });
    scale = lw / w;
    return { png, width: w, height: Math.round(lh * w / lw), realWidth, realHeight };
  }

  // linux (X11)
  const geo = await run("xdotool", ["getdisplaygeometry"]);
  const [lw, lh] = geo.split(" ").map(Number);
  realWidth = lw; realHeight = lh;
  const w = Math.min(lw, MAX_WIDTH);
  await run("import", ["-window", "root", "-resize", `${w}x`, file]);
  const png = fs.readFileSync(file); fs.rmSync(file, { force: true });
  scale = lw / w;
  return { png, width: w, height: Math.round(lh * w / lw), realWidth, realHeight };
}

function toReal(x: number, y: number) {
  return { x: Math.round(x * scale) + origin.x, y: Math.round(y * scale) + origin.y };
}

// --------------------------------------------------------------------- mouse
export type Button = "left" | "right" | "middle";

export async function click(x: number, y: number, button: Button = "left", double = false): Promise<void> {
  const r = toReal(x, y);
  if (platform === "win32") {
    const [down, up] = { left: [0x02, 0x04], right: [0x08, 0x10], middle: [0x20, 0x40] }[button];
    const one = `[U]::mouse_event(${down},0,0,0,[UIntPtr]::Zero); [U]::mouse_event(${up},0,0,0,[UIntPtr]::Zero)`;
    await ps(`${WIN_USER32}
[void][U]::SetCursorPos(${r.x}, ${r.y}); Start-Sleep -Milliseconds 50
${one}${double ? `; Start-Sleep -Milliseconds 80; ${one}` : ""}`);
  } else if (platform === "darwin") {
    const cmd = button === "right" ? "rc" : double ? "dc" : "c";
    await run("cliclick", [`${cmd}:${r.x},${r.y}`]);
  } else {
    const btn = { left: 1, middle: 2, right: 3 }[button];
    await run("xdotool", ["mousemove", String(r.x), String(r.y), "click", ...(double ? ["--repeat", "2"] : []), String(btn)]);
  }
}

export async function moveMouse(x: number, y: number): Promise<void> {
  const r = toReal(x, y);
  if (platform === "win32") await ps(`${WIN_USER32}\n[void][U]::SetCursorPos(${r.x}, ${r.y})`);
  else if (platform === "darwin") await run("cliclick", [`m:${r.x},${r.y}`]);
  else await run("xdotool", ["mousemove", String(r.x), String(r.y)]);
}

export async function scroll(x: number, y: number, amount: number): Promise<void> {
  // amount: positive = scroll down, in "notches"
  await moveMouse(x, y);
  if (platform === "win32") {
    await ps(`${WIN_USER32}\n[U]::mouse_event(0x800,0,0,${-amount * 120},[UIntPtr]::Zero)`);
  } else if (platform === "darwin") {
    const key = amount > 0 ? 125 : 126; // down / up arrow, best effort without extra tools
    for (let i = 0; i < Math.abs(amount); i++) await run("osascript", ["-e", `tell application "System Events" to key code ${key}`]);
  } else {
    const btn = amount > 0 ? 5 : 4;
    await run("xdotool", ["click", "--repeat", String(Math.abs(amount)), String(btn)]);
  }
}

// ------------------------------------------------------------------ keyboard
export async function typeText(text: string): Promise<void> {
  if (platform === "win32") {
    const escaped = text.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`).replace(/\n/g, "{ENTER}");
    await ps(`Add-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(escaped)})`);
  } else if (platform === "darwin") {
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    await run("osascript", ["-e", `tell application "System Events" to keystroke "${escaped}"`]);
  } else {
    await run("xdotool", ["type", "--delay", "20", text]);
  }
}

const MAC_KEYCODES: Record<string, number> = {
  enter: 36, return: 36, tab: 48, escape: 53, esc: 53, backspace: 51, delete: 117, space: 49,
  up: 126, down: 125, left: 123, right: 124, home: 115, end: 119, pageup: 116, pagedown: 121,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
};
const WIN_KEYS: Record<string, string> = {
  enter: "{ENTER}", return: "{ENTER}", tab: "{TAB}", escape: "{ESC}", esc: "{ESC}", backspace: "{BS}", delete: "{DEL}",
  space: " ", up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}", home: "{HOME}", end: "{END}",
  pageup: "{PGUP}", pagedown: "{PGDN}", insert: "{INS}", printscreen: "{PRTSC}",
};
const X_KEYS: Record<string, string> = {
  enter: "Return", return: "Return", tab: "Tab", escape: "Escape", esc: "Escape", backspace: "BackSpace", delete: "Delete",
  space: "space", up: "Up", down: "Down", left: "Left", right: "Right", home: "Home", end: "End", pageup: "Page_Up", pagedown: "Page_Down",
};

/** key: e.g. "enter", "a", "f5". modifiers: any of ctrl, alt, shift, cmd/win. */
export async function pressKey(key: string, modifiers: string[] = []): Promise<void> {
  const k = key.toLowerCase();
  const mods = modifiers.map((m) => m.toLowerCase());
  if (platform === "win32") {
    const prefix = (mods.includes("ctrl") ? "^" : "") + (mods.includes("alt") ? "%" : "") + (mods.includes("shift") ? "+" : "");
    const body = WIN_KEYS[k] ?? (/^f\d{1,2}$/.test(k) ? `{${k.toUpperCase()}}` : k);
    await ps(`Add-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(prefix + body)})`);
  } else if (platform === "darwin") {
    const using = mods
      .map((m) => ({ ctrl: "control down", alt: "option down", shift: "shift down", cmd: "command down", win: "command down" })[m])
      .filter(Boolean);
    const usingClause = using.length ? ` using {${using.join(", ")}}` : "";
    const code = MAC_KEYCODES[k];
    const action = code !== undefined ? `key code ${code}` : `keystroke "${k.replace(/"/g, '\\"')}"`;
    await run("osascript", ["-e", `tell application "System Events" to ${action}${usingClause}`]);
  } else {
    const parts = [...mods.map((m) => ({ ctrl: "ctrl", alt: "alt", shift: "shift", cmd: "super", win: "super" })[m] ?? m), X_KEYS[k] ?? key];
    await run("xdotool", ["key", parts.join("+")]);
  }
}
