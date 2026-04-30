import { Router } from "express";
import { z } from "zod";
import { handleAsync } from "../asyncHandler.js";
import { requireTecmaAdmin } from "../authMiddleware.js";
import { HttpError } from "../../types/http.js";
import { pascalAiRender } from "../../core/experimental/openai-image-render.service.js";
import { pascalAiSceneDraft } from "../../core/experimental/pascal-ai-scene-draft.service.js";
import { getWorkspaceAiConfigInternal } from "../../core/workspaces/workspace-ai-config.service.js";

export const experimentalRoutes = Router();

const AiRenderBodySchema = z.object({
  workspaceId: z.string().min(1),
  mode: z.enum(["edit", "generate"]).default("edit"),
  renderIntent: z.enum(["faithful", "creative"]).default("faithful"),
  prompt: z.string().min(1).max(4000),
  imageBase64: z.string().optional(),
});

const AiSceneDraftBodySchema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  maxNodes: z.number().int().min(4).max(200).optional().default(48),
  allowedTypes: z.array(z.string().min(1)).max(32).optional(),
});

experimentalRoutes.post(
  "/experimental/pascal/ai-render",
  requireTecmaAdmin,
  handleAsync(async (req) => {
    const parsed = AiRenderBodySchema.parse(req.body);
    const aiConfig = await getWorkspaceAiConfigInternal(parsed.workspaceId);
    if (!aiConfig?.apiKey) {
      throw new HttpError(
        "Workspace AI non configurata: imposta provider + API key in /workspaces/:id/ai-config",
        503,
        "WORKSPACE_AI_NOT_CONFIGURED"
      );
    }
    if (aiConfig.provider !== "openai") {
      throw new HttpError(
        `Provider AI non supportato per Pascal render (${aiConfig.provider}). Configura provider openai.`,
        409,
        "WORKSPACE_AI_PROVIDER_UNSUPPORTED"
      );
    }
    const needsScreenshot = parsed.mode === "edit" && parsed.renderIntent === "faithful";
    if (needsScreenshot && (!parsed.imageBase64 || !parsed.imageBase64.trim())) {
      throw new HttpError("imageBase64 richiesto per vista 3D con intent faithful", 400);
    }
    return pascalAiRender({
      apiKey: aiConfig.apiKey,
      mode: parsed.mode,
      renderIntent: parsed.renderIntent,
      prompt: parsed.prompt,
      imagePngBase64: parsed.imageBase64,
    });
  })
);

experimentalRoutes.post(
  "/experimental/pascal/ai-scene-draft",
  requireTecmaAdmin,
  handleAsync(async (req) => {
    const parsed = AiSceneDraftBodySchema.parse(req.body);
    const aiConfig = await getWorkspaceAiConfigInternal(parsed.workspaceId);
    if (!aiConfig?.apiKey) {
      throw new HttpError(
        "Workspace AI non configurata: imposta provider + API key in /workspaces/:id/ai-config",
        503,
        "WORKSPACE_AI_NOT_CONFIGURED"
      );
    }
    if (aiConfig.provider !== "openai") {
      throw new HttpError(
        `Provider AI non supportato per ai-scene-draft (${aiConfig.provider}). Configura provider openai.`,
        409,
        "WORKSPACE_AI_PROVIDER_UNSUPPORTED"
      );
    }
    return pascalAiSceneDraft({
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey,
      prompt: parsed.prompt,
      maxNodes: parsed.maxNodes,
      allowedTypes: parsed.allowedTypes,
    });
  })
);
