import crypto from "node:crypto";
import { ENV } from "../../config/env.js";
import { logger } from "../../observability/logger.js";

type AudioEntry = {
  contentType: string;
  data: Buffer;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const audioCache = new Map<string, AudioEntry>();

function cleanupExpired(): void {
  const now = Date.now();
  for (const [k, v] of audioCache.entries()) {
    if (v.expiresAt <= now) audioCache.delete(k);
  }
}

export function getCachedZeusAudio(id: string): { contentType: string; data: Buffer } | null {
  cleanupExpired();
  const row = audioCache.get(id);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    audioCache.delete(id);
    return null;
  }
  return { contentType: row.contentType, data: row.data };
}

export async function synthesizeZeusVoiceAudio(text: string): Promise<string | null> {
  cleanupExpired();
  if (ENV.ZEUS_VOICE_PROVIDER !== "elevenlabs") return null;
  if (!ENV.ELEVENLABS_API_KEY.trim()) {
    logger.warn("[zeus] elevenlabs selected but ELEVENLABS_API_KEY missing");
    return null;
  }
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ENV.ELEVENLABS_VOICE_ID)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ENV.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: ENV.ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      logger.error({ status: res.status, errText }, "[zeus] elevenlabs synth failed");
      return null;
    }
    const arr = await res.arrayBuffer();
    const id = crypto.randomBytes(12).toString("hex");
    audioCache.set(id, {
      contentType: "audio/mpeg",
      data: Buffer.from(arr),
      expiresAt: Date.now() + TTL_MS
    });
    return id;
  } catch (err) {
    logger.error({ err }, "[zeus] elevenlabs synth exception");
    return null;
  }
}
