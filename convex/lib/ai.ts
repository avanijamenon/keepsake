/**
 * Which open-model endpoint to use. Anything that speaks the OpenAI-compatible
 * chat completions API with image inputs works:
 *   - Cloudflare Workers AI (default; free daily allowance)
 *   - a local Ollama / llama.cpp / vLLM server
 */
import { env } from "../_generated/server";

/** Mistral Small 3.1 — Apache-2.0 licensed, vision-capable. */
export const DEFAULT_WORKERS_AI_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

export type AiConfig = { baseUrl: string; apiKey?: string; model: string };

export function aiConfig(): AiConfig | null {
  if (env.AI_BASE_URL) {
    return {
      baseUrl: env.AI_BASE_URL.replace(/\/$/, ""),
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL ?? DEFAULT_WORKERS_AI_MODEL,
    };
  }
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN) {
    return {
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
      apiKey: env.CLOUDFLARE_AI_TOKEN,
      model: env.AI_MODEL ?? DEFAULT_WORKERS_AI_MODEL,
    };
  }
  return null;
}

export function aiEnabled() {
  return aiConfig() !== null;
}
