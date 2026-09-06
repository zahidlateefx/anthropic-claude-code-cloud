import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Cron } from "croner";
import { config } from "./config.js";

export interface Job {
  id: string;
  channelId: string;
  /** 5-field cron expression for recurring jobs. */
  cron?: string;
  /** ISO timestamp for one-shot jobs. */
  at?: string;
  prompt: string;
  description: string;
  createdAt: string;
}

type OnFire = (job: Job) => Promise<void>;

const file = path.join(config.dataDir, "schedules.json");

function load(): Job[] {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Job[];
  } catch {
    return [];
  }
}

function save(jobs: Job[]) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(jobs, null, 2));
}

class Scheduler {
  private jobs: Job[] = load();
  private timers = new Map<string, Cron>();
  private onFire: OnFire | null = null;

  start(onFire: OnFire) {
    this.onFire = onFire;
    // Drop one-shots whose time passed while the bot was offline.
    this.jobs = this.jobs.filter((j) => !j.at || new Date(j.at) > new Date());
    save(this.jobs);
    for (const job of this.jobs) this.arm(job);
    console.log(`⏰ Scheduler: ${this.jobs.length} job(s) armed (tz ${config.timezone})`);
  }

  private arm(job: Job) {
    const pattern = job.cron ?? new Date(job.at!);
    const timer = new Cron(pattern, { timezone: config.timezone, protect: true }, async () => {
      try {
        await this.onFire?.(job);
      } catch (err) {
        console.error(`Scheduled job ${job.id} failed:`, err);
      } finally {
        if (job.at) this.remove(job.id); // one-shot: done
      }
    });
    this.timers.set(job.id, timer);
  }

  add(input: Omit<Job, "id" | "createdAt">): Job {
    if (input.cron) new Cron(input.cron, { timezone: config.timezone }).stop(); // validates
    if (input.at && Number.isNaN(Date.parse(input.at))) throw new Error(`Invalid datetime: ${input.at}`);
    if (input.at && new Date(input.at) <= new Date()) throw new Error(`Datetime is in the past: ${input.at}`);
    const job: Job = { ...input, id: randomUUID().slice(0, 8), createdAt: new Date().toISOString() };
    this.jobs.push(job);
    save(this.jobs);
    if (this.onFire) this.arm(job);
    return job;
  }

  remove(id: string): boolean {
    const before = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.timers.get(id)?.stop();
    this.timers.delete(id);
    if (this.jobs.length !== before) save(this.jobs);
    return this.jobs.length !== before;
  }

  list(channelId?: string): Array<Job & { nextRun: string | null }> {
    return this.jobs
      .filter((j) => !channelId || j.channelId === channelId)
      .map((j) => ({ ...j, nextRun: this.timers.get(j.id)?.nextRun()?.toISOString() ?? null }));
  }
}

export const scheduler = new Scheduler();

export function nowLocal(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}
