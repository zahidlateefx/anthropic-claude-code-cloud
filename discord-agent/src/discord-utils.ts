const LIMIT = 2000;

/**
 * Split long text into Discord-sized chunks, keeping code fences balanced so a
 * ``` block that spans a boundary doesn't break formatting.
 */
export function chunkMessage(text: string, limit = LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let current = "";
  let openFence: string | null = null;

  const push = () => {
    if (!current) return;
    chunks.push(openFence ? current + "\n```" : current);
    current = openFence ? openFence + "\n" : "";
  };

  for (const line of text.split("\n")) {
    const fence = line.match(/^```(\w*)/);
    // +8 leaves room for a closing fence we may append.
    if (current.length + line.length + 8 > limit) push();
    // A single line longer than the limit gets hard-split.
    if (line.length + 8 > limit) {
      for (let i = 0; i < line.length; i += limit - 8) {
        current += line.slice(i, i + limit - 8);
        push();
      }
      continue;
    }
    current += (current && !current.endsWith("\n") ? "\n" : "") + line;
    if (fence) openFence = openFence ? null : line;
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
