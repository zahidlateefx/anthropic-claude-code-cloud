import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { config } from "./config.js";
import { scheduler, nowLocal } from "./scheduler.js";
import * as computer from "./computer.js";

export const TOOLS_SERVER_NAME = "friday";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (err: unknown) => ({ content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true });

/**
 * In-process MCP server giving the agent scheduling + screen control.
 * Built per request so the tools know which Discord channel they belong to.
 */
export function buildToolsServer(channelId: string) {
  return createSdkMcpServer({
    name: TOOLS_SERVER_NAME,
    version: "1.0.0",
    alwaysLoad: true,
    instructions: [
      `Scheduling: times are in ${config.timezone}. Now: ${nowLocal()}.`,
      `A scheduled job runs the given prompt as if the owner sent it in this chat, and the reply is posted here.`,
      `Screen control: call screenshot first, then click/type using coordinates from that screenshot. Take a new screenshot after each action to verify.`,
    ].join("\n"),
    tools: [
      tool(
        "schedule_task",
        "Create a recurring task with a 5-field cron expression (min hour day month weekday). Example: '0 9 * * *' = every day 09:00.",
        {
          cron: z.string().describe("5-field cron expression"),
          prompt: z.string().describe("What to do when it fires, written as an instruction to yourself"),
          description: z.string().describe("Short human label, e.g. 'Daily YouTube stats'"),
        },
        async ({ cron, prompt, description }) => {
          try {
            const job = scheduler.add({ channelId, cron, prompt, description });
            const next = scheduler.list(channelId).find((j) => j.id === job.id)?.nextRun;
            return text(`Scheduled ${job.id} (${cron}). Next run: ${next}`);
          } catch (err) {
            return fail(err);
          }
        },
      ),
      tool(
        "schedule_once",
        "Run a task once at a specific date/time (a reminder or a delayed action).",
        {
          at: z.string().describe(`ISO 8601 datetime with timezone offset, e.g. 2026-09-07T09:00:00+05:00 (${config.timezone})`),
          prompt: z.string().describe("What to do when it fires"),
          description: z.string().describe("Short human label"),
        },
        async ({ at, prompt, description }) => {
          try {
            const job = scheduler.add({ channelId, at, prompt, description });
            return text(`Scheduled once: ${job.id} at ${new Date(at).toISOString()}`);
          } catch (err) {
            return fail(err);
          }
        },
      ),
      tool("list_schedules", "List scheduled tasks for this chat.", {}, async () => {
        const jobs = scheduler.list(channelId);
        if (jobs.length === 0) return text("No scheduled tasks.");
        return text(jobs.map((j) => `${j.id} · ${j.description} · ${j.cron ?? j.at} · next ${j.nextRun ?? "-"}\n   ${j.prompt}`).join("\n"));
      }),
      tool("cancel_schedule", "Cancel a scheduled task by id.", { id: z.string() }, async ({ id }) =>
        text(scheduler.remove(id) ? `Cancelled ${id}` : `No job ${id}`),
      ),

      tool("screenshot", "Capture the screen. Returns an image; use its pixel coordinates for click/move/scroll.", {}, async () => {
        try {
          const s = await computer.screenshot();
          return {
            content: [
              { type: "image" as const, data: s.png.toString("base64"), mimeType: "image/png" },
              { type: "text" as const, text: `Screenshot ${s.width}x${s.height} (screen ${s.realWidth}x${s.realHeight}). Use screenshot coordinates.` },
            ],
          };
        } catch (err) {
          return fail(err);
        }
      }),
      tool(
        "click",
        "Click at screenshot coordinates.",
        {
          x: z.number(),
          y: z.number(),
          button: z.enum(["left", "right", "middle"]).default("left"),
          double: z.boolean().default(false),
        },
        async ({ x, y, button, double }) => {
          try {
            await computer.click(x, y, button, double);
            return text(`Clicked ${button}${double ? " (double)" : ""} at ${x},${y}`);
          } catch (err) {
            return fail(err);
          }
        },
      ),
      tool("move_mouse", "Move the mouse to screenshot coordinates.", { x: z.number(), y: z.number() }, async ({ x, y }) => {
        try {
          await computer.moveMouse(x, y);
          return text(`Moved to ${x},${y}`);
        } catch (err) {
          return fail(err);
        }
      }),
      tool(
        "scroll",
        "Scroll at screenshot coordinates. amount > 0 scrolls down, < 0 up (in notches).",
        { x: z.number(), y: z.number(), amount: z.number().int() },
        async ({ x, y, amount }) => {
          try {
            await computer.scroll(x, y, amount);
            return text(`Scrolled ${amount} at ${x},${y}`);
          } catch (err) {
            return fail(err);
          }
        },
      ),
      tool("type_text", "Type text into the focused element (click it first).", { text: z.string() }, async ({ text: t }) => {
        try {
          await computer.typeText(t);
          return text(`Typed ${t.length} chars`);
        } catch (err) {
          return fail(err);
        }
      }),
      tool(
        "press_key",
        "Press a key with optional modifiers. key: enter, tab, esc, backspace, delete, up/down/left/right, home, end, pageup, pagedown, f1-f12, space, or a single character.",
        {
          key: z.string(),
          modifiers: z.array(z.enum(["ctrl", "alt", "shift", "cmd", "win"])).default([]),
        },
        async ({ key, modifiers }) => {
          try {
            await computer.pressKey(key, modifiers);
            return text(`Pressed ${[...modifiers, key].join("+")}`);
          } catch (err) {
            return fail(err);
          }
        },
      ),
    ],
  });
}
