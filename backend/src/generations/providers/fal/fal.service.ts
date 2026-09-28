import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fal } from '@fal-ai/client';

export interface FalGenerateInput {
  model: string;
  prompt: string;
  imageUrls?: string[];
  aspectRatio?: string;
  // Tamaño exacto en píxeles. Los modelos flux (p. ej. fal-ai/flux/dev) no
  // aceptan `aspect_ratio`: la forma de la imagen solo llega por aquí.
  imageSize?: { width: number; height: number };
  numImages?: number;
  outputFormat?: 'jpeg' | 'png';
  params?: Record<string, any>;
}

export interface FalGenerateResult {
  requestId: string;
  imageBuffer: Buffer;
  contentType: string;
}

interface FalImage {
  url: string;
}

interface FalResponse {
  requestId?: string;
  // Text-to-image models return `images[]`; upscaler/enhancer models return a single `image`.
  data?: { images?: FalImage[]; image?: FalImage };
  images?: FalImage[];
  image?: FalImage;
}

// Modelos que validan `aspect_ratio` contra una lista cerrada (fal da 422 si
// no está). Un formato fuera de la lista (p. ej. A3 = 5:7) se genera en la
// proporción soportada más cercana; el print master recorta después a la
// proporción exacta de impresión.
const SUPPORTED_ASPECT_RATIOS: { prefix: string; ratios: string[] }[] = [
  {
    prefix: 'fal-ai/nano-banana',
    ratios: [
      '21:9',
      '16:9',
      '3:2',
      '4:3',
      '5:4',
      '1:1',
      '4:5',
      '3:4',
      '2:3',
      '9:16',
    ],
  },
];

function ratioValue(ratio: string): number | null {
  const [w, h] = ratio.split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}

/** Devuelve la proporción soportada por `model` más cercana a `ratio`. */
export function snapAspectRatio(model: string, ratio: string): string {
  const entry = SUPPORTED_ASPECT_RATIOS.find((e) => model.startsWith(e.prefix));
  const target = ratioValue(ratio);
  if (!entry || entry.ratios.includes(ratio) || target === null) return ratio;
  // Distancia en escala logarítmica: 2:1 y 1:2 quedan igual de lejos de 1:1.
  return entry.ratios.reduce((best, candidate) =>
    Math.abs(Math.log(ratioValue(candidate)! / target)) <
    Math.abs(Math.log(ratioValue(best)! / target))
      ? candidate
      : best,
  );
}

@Injectable()
export class FalService {
  private readonly logger = new Logger(FalService.name);

  constructor(private configService: ConfigService) {
    fal.config({ credentials: this.configService.get<string>('ai.falKey') });
  }

  async generate(input: FalGenerateInput): Promise<FalGenerateResult> {
    if (input.aspectRatio) {
      const snapped = snapAspectRatio(input.model, input.aspectRatio);
      if (snapped !== input.aspectRatio) {
        this.logger.log(
          `${input.model} no admite aspect_ratio=${input.aspectRatio}; se usa ${snapped}`,
        );
        input = { ...input, aspectRatio: snapped };
      }
    }

    this.logger.log(
      `Generating with ${input.model} | aspectRatio=${input.aspectRatio ?? '-'} | imageSize=${input.imageSize ? `${input.imageSize.width}x${input.imageSize.height}` : '-'} | images=${input.imageUrls?.length ?? 0}`,
    );

    // `params` va al final: el `parameters` de un ImageGenConfig puede
    // sobrescribir cualquiera de estos, incluido image_size.
    const falInput: Record<string, any> = {
      prompt: input.prompt,
      ...(input.imageUrls?.length ? { image_urls: input.imageUrls } : {}),
      ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
      ...(input.imageSize ? { image_size: input.imageSize } : {}),
      ...(input.numImages ? { num_images: input.numImages } : {}),
      ...(input.outputFormat ? { output_format: input.outputFormat } : {}),
      ...input.params,
    };

    const result = await fal.subscribe(input.model, { input: falInput });

    const falResult = result as FalResponse;
    const requestId = falResult.requestId ?? 'unknown';
    const single = falResult.data?.image ?? falResult.image;
    const images: FalImage[] =
      falResult.data?.images ?? falResult.images ?? (single ? [single] : []);

    if (!images.length) {
      throw new Error(`Fal.ai returned no images for requestId: ${requestId}`);
    }

    const imageUrl = images[0].url;
    this.logger.log(`Fal.ai generation complete. RequestId: ${requestId}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download generated image: ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';

    return { requestId, imageBuffer, contentType };
  }
}
