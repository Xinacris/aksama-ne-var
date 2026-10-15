import Anthropic from "@anthropic-ai/sdk";
import { DailyLimiter } from "@/server/import/rateLimit";
import { handleTranslate, handleTranslateInfo, type TranslateDeps } from "@/server/translate/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Same daily limit per household as smart import (its own counter). */
const limiter = new DailyLimiter();

function deps(): TranslateDeps {
  return {
    fetch,
    env: { AI_PROVIDER: process.env.AI_PROVIDER, GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
    anthropic: (apiKey) => new Anthropic({ apiKey }),
    limiter,
  };
}

/** Recipe translation with the import's providers (Gemini → Claude). Hidden in the apps when neither key is set. */
export async function POST(req: Request) {
  return handleTranslate(req, deps());
}

export async function GET() {
  return handleTranslateInfo(deps());
}
