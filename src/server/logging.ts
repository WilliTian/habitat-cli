import type { Context } from "hono";

const summaries = new WeakMap<object, string>();
const maxSummaryCodePoints = 160;

export function setHabitatApiSummary(context: Context, summary: string): void {
  summaries.set(context, summary);
}

export function formatHabitatApiLog(context: Context): string {
  const fallbackSummary = String(context.res.status);
  const summary = sanitizeSummary(summaries.get(context) ?? fallbackSummary) || fallbackSummary;

  return `[habitat-api] ${context.req.method} ${context.req.path} -> ${summary}`;
}

function sanitizeSummary(summary: string): string {
  return Array.from(
    summary
      .replace(/[\p{Cc}\p{Cf}]/gu, " ")
      .replace(/\p{White_Space}+/gu, " ")
      .trim(),
  )
    .slice(0, maxSummaryCodePoints)
    .join("");
}
