import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { callPC, isPcOnline } from "./bridge.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (err: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
  isError: true,
});

/**
 * Tools the cloud agent uses to act on the owner's PC through the bridge.
 * Each rejects clearly when the PC is offline.
 */
export function pcTools() {
  return [
    tool("pc_status", "Check whether the owner's PC is online (connected to the cloud bridge).", {}, async () =>
      text(isPcOnline() ? "PC is ONLINE and reachable." : "PC is OFFLINE (not connected to the internet/bridge right now)."),
    ),
    tool(
      "pc_bash",
      "Run a shell command on the owner's PC (PowerShell on Windows, bash on macOS/Linux). Use for opening apps, controlling local software, local files, etc. Cloud tasks use the normal Bash tool instead.",
      { command: z.string(), cwd: z.string().optional() },
      async ({ command, cwd }) => {
        try {
          const r = await callPC<{ stdout: string; stderr: string; code: number }>("bash", { command, cwd });
          return text(`exit=${r.code}\n${r.stdout || ""}${r.stderr ? `\n[stderr]\n${r.stderr}` : ""}`.slice(0, 8000) || "(no output)");
        } catch (err) {
          return fail(err);
        }
      },
    ),
    tool("pc_screenshot", "Capture the owner's PC screen. Returns an image; use its coordinates for pc_click etc.", {}, async () => {
      try {
        const s = await callPC<{ base64: string; width: number; height: number; realWidth: number; realHeight: number }>("screenshot");
        return {
          content: [
            { type: "image" as const, data: s.base64, mimeType: "image/png" },
            { type: "text" as const, text: `Screenshot ${s.width}x${s.height} (screen ${s.realWidth}x${s.realHeight}).` },
          ],
        };
      } catch (err) {
        return fail(err);
      }
    }),
    tool(
      "pc_click",
      "Click on the owner's PC at screenshot coordinates.",
      { x: z.number(), y: z.number(), button: z.enum(["left", "right", "middle"]).default("left"), double: z.boolean().default(false) },
      async (p) => {
        try {
          await callPC("click", p, 30000);
          return text(`Clicked ${p.button}${p.double ? " (double)" : ""} at ${p.x},${p.y}`);
        } catch (err) {
          return fail(err);
        }
      },
    ),
    tool("pc_move", "Move the mouse on the owner's PC.", { x: z.number(), y: z.number() }, async (p) => {
      try {
        await callPC("move", p, 30000);
        return text(`Moved to ${p.x},${p.y}`);
      } catch (err) {
        return fail(err);
      }
    }),
    tool("pc_scroll", "Scroll on the owner's PC. amount>0 down, <0 up.", { x: z.number(), y: z.number(), amount: z.number().int() }, async (p) => {
      try {
        await callPC("scroll", p, 30000);
        return text(`Scrolled ${p.amount} at ${p.x},${p.y}`);
      } catch (err) {
        return fail(err);
      }
    }),
    tool("pc_type", "Type text into the focused element on the owner's PC.", { text: z.string() }, async ({ text: t }) => {
      try {
        await callPC("type", { text: t }, 60000);
        return text(`Typed ${t.length} chars`);
      } catch (err) {
        return fail(err);
      }
    }),
    tool(
      "pc_key",
      "Press a key on the owner's PC with optional modifiers (ctrl, alt, shift, cmd/win). key: enter, tab, esc, up/down/left/right, f1-f12, or a character.",
      { key: z.string(), modifiers: z.array(z.enum(["ctrl", "alt", "shift", "cmd", "win"])).default([]) },
      async (p) => {
        try {
          await callPC("key", p, 30000);
          return text(`Pressed ${[...p.modifiers, p.key].join("+")}`);
        } catch (err) {
          return fail(err);
        }
      },
    ),
    tool("pc_read_file", "Read a text file from the owner's PC.", { path: z.string() }, async ({ path: p }) => {
      try {
        const r = await callPC<{ text: string }>("readFile", { path: p });
        return text(r.text.slice(0, 8000));
      } catch (err) {
        return fail(err);
      }
    }),
    tool("pc_write_file", "Write a text file on the owner's PC.", { path: z.string(), text: z.string() }, async ({ path: p, text: t }) => {
      try {
        const r = await callPC<{ path: string }>("writeFile", { path: p, text: t });
        return text(`Wrote ${r.path}`);
      } catch (err) {
        return fail(err);
      }
    }),
    tool("pc_list_dir", "List a directory on the owner's PC (default: home).", { path: z.string().optional() }, async ({ path: p }) => {
      try {
        const r = await callPC<{ dir: string; entries: { name: string; dir?: boolean; size?: number }[] }>("listDir", { path: p });
        return text(`${r.dir}\n` + r.entries.map((e) => `${e.dir ? "[d]" : "   "} ${e.name}`).join("\n").slice(0, 6000));
      } catch (err) {
        return fail(err);
      }
    }),
  ];
}
