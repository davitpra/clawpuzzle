import {
  Style,
  Pet,
  PetPhoto,
  Format,
  VisionConfig,
  ImageGenConfig,
} from '@prisma/client';

/** Fallback when neither constraints nor the linked Format provide an aspect ratio. */
export const DEFAULT_ASPECT_RATIO = '3:4';

/**
 * Valor de {{petSpecies}} cuando la mascota no tiene especie guardada (el
 * funnel ya no la pregunta). El VLM ve la foto y deduce el animal por sí solo.
 */
export const UNKNOWN_SPECIES = 'pet';

/**
 * Tamaño en píxeles a pedir al modelo, sacado del Format. Si los constraints
 * fuerzan otra proporción, no se envía: un tamaño del Format la contradiría.
 */
export function resolveImageSize(
  ctx: Pick<PipelineContext, 'format' | 'constraints'>,
): { width: number; height: number } | undefined {
  if (ctx.constraints.aspectRatio || !ctx.format) return undefined;
  return { width: ctx.format.width, height: ctx.format.height };
}

export type StyleWithConfigs = Style & {
  visionConfig: VisionConfig | null;
  imageGenConfig: ImageGenConfig | null;
};

export interface PipelineContext {
  generationId: string;
  petPhotoUrl: string;
  style: StyleWithConfigs;
  pet: Pet;
  format: Format | null;
  constraints: {
    maxPets?: number;
    aspectRatio?: string;
    [key: string]: unknown;
  };
  userSelections?: Record<string, string | number>;
  subjectPhotoUrls?: string[];
}

export interface PipelineResult {
  visionAnalysis?: Record<string, any>;
  finalPrompt: string;
  falRequestId: string;
  resultUrl: string;
  resultStorageKey: string;
  processingTimeSeconds: number;
  /** Frozen snapshot of the style template config used — for audit/reproducibility. */
  promptSnapshot?: Record<string, any>;
}

export abstract class BaseStyleStrategy {
  abstract readonly key: string;
  abstract execute(ctx: PipelineContext): Promise<PipelineResult>;
}

export interface GenerationWithRelations {
  id: string;
  userId: string;
  petId: string;
  petPhotoId: string | null;
  styleId: string;
  prompt: string;
  provider: string;
  metadata: any;
  style: StyleWithConfigs;
  pet: Pet;
  petPhoto: PetPhoto | null;
}
