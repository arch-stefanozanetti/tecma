import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";

const OPENAI_IMAGES_EDITS = "https://api.openai.com/v1/images/edits";
const OPENAI_IMAGES_GENERATIONS = "https://api.openai.com/v1/images/generations";

export type AiRenderMode = "edit" | "generate";

/** faithful: ancorato allo screenshot (edit DALL-E 2). creative: immagine nuova stile render (DALL-E 3, senza screenshot). */
export type RenderIntent = "faithful" | "creative";

export interface PascalAiRenderInput {
  apiKey: string;
  mode: AiRenderMode;
  renderIntent: RenderIntent;
  prompt: string;
  imagePngBase64?: string;
}

export interface PascalAiRenderResult {
  data: {
    imageBase64: string;
    model: string;
  };
}

function stripDataUrlBase64(input: string): string {
  const trimmed = input.trim();
  const m = /^data:image\/\w+;base64,(.+)$/s.exec(trimmed);
  return m ? m[1]! : trimmed;
}

async function readOpenAiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    if (j?.error?.message) return j.error.message;
  } catch {
    /* ignore */
  }
  return await res.text().catch(() => res.statusText);
}

function buildCreativeImagePrompt(userPrompt: string): string {
  const t = userPrompt.trim();
  return [
    "Professional architectural visualization, photorealistic CGI interior or exterior.",
    "Natural soft lighting, coherent materials, depth of field optional.",
    "Single clear focal composition, high detail, no UI overlays, no watermark.",
    "User intent:",
    t,
  ].join(" ");
}

async function imagesGenerationsB64(key: string, dallE3Prompt: string): Promise<PascalAiRenderResult> {
  const body = {
    model: "dall-e-3",
    prompt: dallE3Prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json" as const,
  };

  const res = await fetch(OPENAI_IMAGES_GENERATIONS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readOpenAiError(res);
    logger.warn({ status: res.status, detail }, "[experimental] OpenAI images/generations failed");
    throw new HttpError(detail || "OpenAI images error", res.status >= 400 && res.status < 600 ? res.status : 502, "OPENAI_ERROR");
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    throw new HttpError("Risposta OpenAI senza immagine", 502, "OPENAI_EMPTY");
  }

  return {
    data: {
      imageBase64: b64,
      model: "dall-e-3",
    },
  };
}

export async function pascalAiRender(input: PascalAiRenderInput): Promise<PascalAiRenderResult> {
  const key = input.apiKey.trim();
  if (!key) {
    throw new HttpError("Servizio render AI non configurato per il workspace", 503, "OPENAI_NOT_CONFIGURED");
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new HttpError("prompt obbligatorio", 400);
  }

  if (input.mode === "generate") {
    const dallE3Prompt = input.renderIntent === "creative" ? buildCreativeImagePrompt(prompt) : prompt;
    return imagesGenerationsB64(key, dallE3Prompt);
  }

  if (input.renderIntent === "creative") {
    return imagesGenerationsB64(key, buildCreativeImagePrompt(prompt));
  }

  const raw = input.imagePngBase64?.trim();
  if (!raw) {
    throw new HttpError("imageBase64 obbligatorio per mode=edit con intent faithful", 400);
  }

  const b64 = stripDataUrlBase64(raw);
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    throw new HttpError("imageBase64 non valido", 400);
  }

  if (buffer.length > 4 * 1024 * 1024) {
    throw new HttpError("Immagine troppo grande (max ~4MB decodificati)", 400);
  }

  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(buffer)], { type: "image/png" }), "scene.png");
  form.append("prompt", prompt);
  form.append("model", "dall-e-2");
  form.append("n", "1");
  form.append("size", "1024x1024");
  form.append("response_format", "b64_json");

  const res = await fetch(OPENAI_IMAGES_EDITS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: form,
  });

  if (!res.ok) {
    const detail = await readOpenAiError(res);
    logger.warn({ status: res.status, detail }, "[experimental] OpenAI images/edits failed");
    throw new HttpError(detail || "OpenAI images error", res.status >= 400 && res.status < 600 ? res.status : 502, "OPENAI_ERROR");
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const outB64 = json.data?.[0]?.b64_json;
  if (!outB64) {
    throw new HttpError("Risposta OpenAI senza immagine", 502, "OPENAI_EMPTY");
  }

  return {
    data: {
      imageBase64: outB64,
      model: "dall-e-2",
    },
  };
}
