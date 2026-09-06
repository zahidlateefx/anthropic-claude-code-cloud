import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { config } from "./config.js";
import { scheduler, nowLocal } from "./scheduler.js";
import { pcTools } from "./pc-tools.js";

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
      `The owner's PC: use pc_* tools (pc_bash, pc_screenshot, pc_click, pc_type, ...). For screen work, pc_screenshot first, then click/type by those coordinates, then screenshot again to verify. If a pc_ tool says the PC is offline, tell the owner their PC is not connected and offer to do it when it's back — do not retry in a loop.`,
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

      ...pcTools(),
    ],
  });
}
