import Anthropic from "@anthropic-ai/sdk";
import { guardedFetch } from "@/server/import/guardedFetch";
import { handleImport } from "@/server/import/handler";
import { DailyLimiter } from "@/server/import/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const limiter = new DailyLimiter();

/** Recipe import. Works without env vars (rule parser); ANTHROPIC_API_KEY enables Claude, YOUTUBE_API_KEY full descriptions. */
export async function POST(req: Request) {
  return handleImport(req, {
    fetch,
    webFetch: guardedFetch(fetch),
    env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY },
    anthropic: (apiKey) => new Anthropic({ apiKey }),
    limiter,
  });
}
