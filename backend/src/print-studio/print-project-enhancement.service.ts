import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FalService } from '../generations/providers/fal/fal.service';
import { EnhanceDto } from './dto/enhance.dto';
import { PrintConfigDto } from '../products/dto/print-config.dto';
import { ExpensesService } from '../expenses/expenses.service';
import { cropRect, parsePrintCrop, type PrintCrop } from './print-crop.util';

/** Resolución objetivo de impresión (DPI) del máster que se manda a imprimir. */
const TARGET_DPI = 300;

/** Resolution we re-encode the print master at when no targetDpi is provided. */
const PRINT_DPI = 300;

/** Hard cap on the longest edge when the item has no known print size (px). */
const MAX_EDGE = 8000;

/** JPEG quality for the re-encoded print master. */
const JPEG_QUALITY = 92;

/** fal.ai upscaler model used for true enlargement. */
const UPSCALE_MODEL = 'fal-ai/seedvr/upscale/image';

/** Maximum upscale factor we expose (seedvr accepts 1–10). */
const MAX_UPSCALE_FACTOR = 8;

/**
 * Sangre por lado, en mm. Fija para todos los productos: el `bleedMm` que
 * pueda traer un printConfig antiguo se ignora.
 */
const BLEED_MM = 3;

/**
 * Conservative output ceiling (~30 mebipixels, px / 1024²). seedvr can produce
 * very large outputs, so we keep this safety cap so the OUTPUT stays bounded
 * (output_px = source_px × factor²).
 */
const MAX_UPSCALE_OUTPUT_PX = 30 * 1024 * 1024;

export interface PrintConfigShape {
  widthCm?: number;
  heightCm?: number;
  safeMarginMm?: number;
  minDpi?: number;
}

/** De dónde sale el tamaño de impresión efectivo de un proyecto. */
export type PrintConfigSource = 'project' | 'variant' | 'title';

/** Un tamaño ya configurado en el catálogo, ofrecido como opción en el Print Studio. */
export interface PrintSizePreset {
  widthCm: number;
  heightCm: number;
}

export interface EnhanceInfo {
  sourceUrl: string | null;
  /** Pixel dimensions of the SOURCE art (enhancement input). */
  sourcePx: { width: number; height: number } | null;
  printInches: { width: number; height: number } | null;
  /** DPI of the SOURCE art at the print size — drives the upscale recommendation. */
  sourceDpi: number | null;
  /**
   * URL of the CURRENT print image (the file that gets printed). The client measures
   * its delivered dimensions to compute the real print DPI — this handles the
   * Cloudinary engine, whose stored asset is the un-transformed base while the
   * upscale lives in the delivery URL (`c_scale,…`), so a server-side probe of the
   * storage key would under-report. Measuring the delivered URL matches PrintProofModal.
   */
  printImageUrl: string | null;
  /** Detected dominant colour of the source image border — used as bleed default. */
  bleedColor: string;
  /** printConfig efectivo (proyecto → variante); null si el tamaño sale del título o no hay. */
  printConfig: PrintConfigShape | null;
  printConfigSource: PrintConfigSource | null;
  /** Tamaños distintos configurados en las variantes del catálogo. */
  printSizePresets: PrintSizePreset[];
  recommendedUpscale: 0 | 2 | 4;
  alreadyEnhanced: boolean;
  /** True when a raw AI-upscaled base exists — "Guardar" will re-apply adjustments from it. */
  hasUpscaledBase: boolean;
  /** Encuadre guardado para "Ajustar al formato"; null = centrado. */
  printCrop: PrintCrop | null;
}

/** Lo que el estudio necesita de un proyecto y de la línea vinculada. */
export const PROJECT_INCLUDE = {
  generation: { select: { resultUrl: true, resultStorageKey: true } },
  orderItem: {
    select: {
      id: true,
      orderId: true,
      variantTitle: true,
      printImageUrl: true,
      printImageStorageKey: true,
      printSourceUrl: true,
      printSourceStorageKey: true,
      productVariant: { select: { printConfig: true } },
      order: { select: { userId: true } },
    },
  },
} satisfies Prisma.PrintProjectInclude;

export type LoadedProject = Prisma.PrintProjectGetPayload<{
  include: typeof PROJECT_INCLUDE;
}>;

/**
 * Pipeline del Estudio de impresión sobre un PrintProject: tamaño, encuadre,
 * upscale con IA, sangrado y máster. Si el proyecto está vinculado a una línea
 * de pedido, cada guardado actualiza su imagen para impresión.
 */
@Injectable()
export class PrintProjectEnhancementService {
  private readonly logger = new Logger(PrintProjectEnhancementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly falService: FalService,
    private readonly configService: ConfigService,
    private readonly expensesService: ExpensesService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  async getEnhanceInfo(projectId: string): Promise<EnhanceInfo> {
    const project = await this.loadProject(projectId);
    const original = this.resolveSource(project);
    const printInches = this.resolvePrintInches(project);
    const sourceMatches = this.sourceMatches(project, original);

    const sourcePx = original ? await this.getSourcePixels(original) : null;
    const sourceDpi = this.dpiFor(sourcePx, printInches);
    const bleedColor = original
      ? await this.detectBorderColor(original.url)
      : '#ffffff';
    const resolved = this.resolvePrintConfig(project);
    const printConfigSource: PrintConfigSource | null = resolved
      ? resolved.source
      : printInches
        ? 'title'
        : null;

    return {
      sourceUrl: original?.url ?? null,
      sourcePx,
      printInches,
      sourceDpi,
      printImageUrl: sourceMatches ? project.printImageUrl : null,
      bleedColor,
      printConfig: resolved?.cfg ?? null,
      printConfigSource,
      printSizePresets: await this.loadPrintSizePresets(),
      recommendedUpscale: this.recommendUpscale(sourceDpi),
      alreadyEnhanced: sourceMatches && Boolean(project.printImageUrl),
      hasUpscaledBase: sourceMatches && Boolean(project.upscaledUrl),
      printCrop: sourceMatches ? parsePrintCrop(project.printCrop) : null,
    };
  }

  /**
   * Fija (o borra, con `cfg = null`) el tamaño de impresión del proyecto.
   * Anula el printConfig de la variante vinculada sin tocar el catálogo.
   * Devuelve el EnhanceInfo recalculado para que el estudio se refresque.
   */
  async setPrintConfig(
    projectId: string,
    cfg: PrintConfigDto | null,
    adminUserId?: string,
  ): Promise<EnhanceInfo> {
    if (cfg && (cfg.widthCm == null || cfg.heightCm == null)) {
      throw new BadRequestException(
        'El tamaño de impresión necesita ancho y alto',
      );
    }
    const project = await this.loadProject(projectId);
    await this.prisma.printProject.update({
      where: { id: projectId },
      data: {
        printConfig: cfg
          ? ({ ...cfg } as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
    await this.recordEvent(project, 'print_config_updated', adminUserId, {
      printConfig: cfg ? { ...cfg } : null,
    });
    return this.getEnhanceInfo(projectId);
  }

  /** DPI of an image at a given print size (limited by the tighter edge). */
  private dpiFor(
    px: { width: number; height: number } | null,
    inches: { width: number; height: number } | null,
  ): number | null {
    if (!px || !inches) return null;
    return Math.floor(
      Math.min(px.width / inches.width, px.height / inches.height),
    );
  }

  /**
   * Run the enhancement pipeline and persist the result.
   *
   * Two paths depending on whether `options.upscaleFactor` (or `upscale` /
   * `targetDpi`) is set:
   *
   * • Upscale path — runs fal.ai, saves a raw high-res BASE (upscaledUrl)
   *   so future "adjust-only" saves can re-apply bleed without re-running
   *   the AI. Then applies adjustments on top and saves the master.
   *
   * • Adjust-only path — starts from the raw upscaled base when one exists,
   *   otherwise from the source. Never calls fal.ai.
   *
   * The source art (upload or generation) is NEVER deleted or overwritten.
   */
  async applyEnhance(
    projectId: string,
    options: EnhanceDto,
    adminUserId?: string,
  ): Promise<{ printImageUrl: string }> {
    const project = await this.loadProject(projectId);
    const original = this.resolveSource(project);
    if (!original) {
      throw new BadRequestException('El proyecto no tiene imagen de origen');
    }
    const sourceMatches = this.sourceMatches(project, original);
    const printInches = this.resolvePrintInches(project);
    // Sin tamaño de impresión no hay DPI con el que medir la sangre: antes se
    // omitía en silencio y el máster salía sin bleed.
    if (options.bleed && !printInches) {
      throw new BadRequestException(
        'El proyecto no tiene tamaño de impresión: no se puede añadir bleed',
      );
    }
    const ext = options.format === 'png' ? 'png' : 'jpg';
    const masterKey = `print-projects/${projectId}/print/${uuidv4()}.${ext}`;

    const wantsUpscale = Boolean(
      options.upscaleFactor || options.upscale || options.targetDpi,
    );
    const mock = this.configService.get<boolean>('ai.mock');

    let baseBytes: Buffer;
    let newUpscaledUrl: string | null = null;
    let newUpscaledKey: string | null = null;

    if (wantsUpscale) {
      // ── Upscale path ────────────────────────────────────────────────────
      const factor = await this.resolveUpscaleFactor(
        options,
        original,
        printInches,
      );

      if (factor > 0 && !mock) {
        const sourcePx = await this.getSourcePixels(original);
        const result = await this.falService.generate({
          model: UPSCALE_MODEL,
          prompt: '',
          params: {
            image_url: original.url,
            upscale_mode: 'factor',
            upscale_factor: factor,
          },
        });
        baseBytes = result.imageBuffer;
        this.logger.log(
          `Upscaled project ${projectId} x${factor} (req ${result.requestId})`,
        );

        this.expensesService
          .recordUpscaleCost({
            orderId: project.orderItem?.orderId,
            orderItemId: project.orderItem?.id,
            userId: project.orderItem?.order.userId ?? undefined,
            generationId: project.generationId ?? undefined,
            model: UPSCALE_MODEL,
            factor,
            sourcePx,
            requestId: result.requestId,
          })
          .catch((err) => {
            this.logger.warn(
              `Failed to record upscale cost for project ${projectId}: ${(err as Error).message}`,
            );
          });
      } else {
        if (factor > 0 && mock) {
          this.logger.warn(
            'MOCK_AI=true — skipping fal upscale, adjustments only',
          );
        }
        baseBytes = await this.download(original.url);
      }

      // Save a clean, unadjusted base at print resolution (JPEG). Always JPEG —
      // the raw upscale at print size can be tens of MB as PNG, exceeding the
      // storage provider's per-file limit. JPEG keeps it bounded while staying a
      // faithful high-res reference for later adjust-only saves.
      const baseKey = `print-projects/${projectId}/print/base/${uuidv4()}.jpg`;
      const baseBuffer = await this.buildPrintImage(baseBytes, printInches, {
        format: 'jpeg',
      });
      newUpscaledUrl = await this.storageService.upload(
        baseKey,
        baseBuffer,
        'image/jpeg',
      );
      newUpscaledKey = baseKey;
    } else {
      // ── Adjust-only path ─────────────────────────────────────────────────
      // Prefer the saved high-res base; fall back to the source.
      if (sourceMatches && project.upscaledUrl) {
        baseBytes = await this.download(project.upscaledUrl);
      } else {
        baseBytes = await this.download(original.url);
      }
    }

    // Build the print master (crop/bleed applied on the base).
    const outputBuffer = await this.buildPrintImage(
      baseBytes,
      printInches,
      options,
    );
    const contentType = options.format === 'png' ? 'image/png' : 'image/jpeg';
    const printImageUrl = await this.storageService.upload(
      masterKey,
      outputBuffer,
      contentType,
    );
    this.logger.log(
      `Enhanced project → ${masterKey} (${outputBuffer.byteLength} bytes)`,
    );

    // Borrar el máster anterior (solo si es del proyecto) y la base que ya no
    // vale: la reemplazada por una nueva, o la de otra fuente.
    const staleKeys = [project.printImageStorageKey];
    if (newUpscaledKey !== null || !sourceMatches) {
      staleKeys.push(project.upscaledStorageKey);
    }
    await this.deleteKeys(staleKeys);

    const data: Prisma.PrintProjectUpdateInput = {
      printImageUrl,
      printImageStorageKey: masterKey,
      sourceUrl: original.url,
      // El encuadre se recuerda para que los guardados siguientes lo mantengan.
      printCrop:
        options.fitToFormat && options.crop
          ? ({ ...options.crop } as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
    };
    if (newUpscaledKey !== null) {
      data.upscaledUrl = newUpscaledUrl;
      data.upscaledStorageKey = newUpscaledKey;
    } else if (!sourceMatches) {
      data.upscaledUrl = null;
      data.upscaledStorageKey = null;
    }
    await this.prisma.printProject.update({ where: { id: projectId }, data });

    if (project.orderItem) {
      await this.pushMasterToItem(project.orderItem, printImageUrl);
    }
    await this.recordEvent(project, 'print_image_enhanced', adminUserId, {
      options: options as unknown as Record<string, unknown>,
      printImageUrl,
    });

    return { printImageUrl };
  }

  /** Borra la base y el máster del proyecto y vuelve a la imagen de origen. */
  async revertEnhance(
    projectId: string,
    adminUserId?: string,
  ): Promise<{ printImageUrl: null }> {
    const project = await this.loadProject(projectId);
    await this.resetDerived(project);
    await this.recordEvent(project, 'print_image_reverted', adminUserId, {});
    return { printImageUrl: null };
  }

  /**
   * Descarta todo lo derivado de la fuente (base, máster y encuadre). Si la
   * línea vinculada sigue mostrando este máster, vuelve a su subida manual o a
   * nada. Se usa al revertir y al cambiar la imagen de origen.
   */
  async resetDerived(project: LoadedProject): Promise<void> {
    await this.deleteKeys([
      project.printImageStorageKey,
      project.upscaledStorageKey,
    ]);
    await this.prisma.printProject.update({
      where: { id: project.id },
      data: {
        printImageUrl: null,
        printImageStorageKey: null,
        upscaledUrl: null,
        upscaledStorageKey: null,
        printCrop: Prisma.DbNull,
      },
    });
    const item = project.orderItem;
    if (
      item &&
      project.printImageUrl &&
      item.printImageUrl === project.printImageUrl
    ) {
      await this.prisma.orderItem.update({
        where: { id: item.id },
        data: {
          printImageUrl: item.printSourceUrl,
          printImageStorageKey: item.printSourceStorageKey,
        },
      });
    }
  }

  async loadProject(projectId: string): Promise<LoadedProject> {
    const project = await this.prisma.printProject.findUnique({
      where: { id: projectId },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  /**
   * El máster pasa a ser la imagen para impresión de la línea. La key queda en
   * el proyecto, que es su dueño; un máster anterior que la línea heredó al
   * desvincularse otro proyecto se borra (nunca su subida manual).
   */
  async pushMasterToItem(
    item: NonNullable<LoadedProject['orderItem']>,
    printImageUrl: string,
  ): Promise<void> {
    if (
      item.printImageStorageKey &&
      item.printImageStorageKey !== item.printSourceStorageKey
    ) {
      await this.deleteKeys([item.printImageStorageKey]);
    }
    await this.prisma.orderItem.update({
      where: { id: item.id },
      data: { printImageUrl, printImageStorageKey: null },
    });
  }

  /** OrderEvent en la línea vinculada; sin vínculo no hay historial que llevar. */
  async recordEvent(
    project: { orderItem: { id: string; orderId: string } | null },
    eventType: string,
    adminUserId: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!project.orderItem) return;
    await this.prisma.orderEvent.create({
      data: {
        orderId: project.orderItem.orderId,
        orderItemId: project.orderItem.id,
        eventType,
        source: 'admin',
        userId: adminUserId ?? null,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async deleteKeys(keys: (string | null)[]): Promise<void> {
    for (const key of new Set(keys.filter((k): k is string => Boolean(k)))) {
      await this.storageService.delete(key).catch(() => null);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Determine the fal.ai upscale factor.
   * targetDpi takes priority over the legacy upscale field. The factor is capped
   * both at MAX_UPSCALE_FACTOR× and at the 30 MP OUTPUT ceiling (output = source ×
   * factor²); returns 0 when no upscale is needed or the source is already too large.
   */
  private async resolveUpscaleFactor(
    options: EnhanceDto,
    original: { url: string; storageKey: string | null },
    printInches: { width: number; height: number } | null,
  ): Promise<number> {
    const sourcePx = await this.getSourcePixels(original);

    // Desired factor before any safety cap.
    let desired: number;
    if (options.upscaleFactor) {
      desired = options.upscaleFactor;
    } else if (options.targetDpi) {
      const sourceDpi = this.dpiFor(sourcePx, printInches);
      desired =
        sourceDpi === null || sourceDpi <= 0
          ? 2 // unknown resolution — safe default
          : Math.ceil(options.targetDpi / sourceDpi);
    } else {
      desired = options.upscale ?? 0;
    }

    if (desired <= 1) return 0;
    desired = Math.min(desired, MAX_UPSCALE_FACTOR);

    // Cap by fal.ai's output megapixel ceiling: output_px = source_px × factor².
    if (sourcePx) {
      const srcArea = sourcePx.width * sourcePx.height;
      const maxFactor = Math.sqrt(MAX_UPSCALE_OUTPUT_PX / srcArea);
      if (maxFactor < 1.1) {
        this.logger.warn(
          `Skipping upscale: source ${sourcePx.width}×${sourcePx.height} ` +
            `too large for fal.ai (max factor ${maxFactor.toFixed(2)}).`,
        );
        return 0;
      }
      desired = Math.min(desired, maxFactor);
    }

    // seedvr accepts fractional factors — keep a clean float passed through as-is.
    return Math.round(desired * 100) / 100;
  }

  /**
   * Resolve the source pixel dimensions. Tries the Cloudinary probe first, then
   * falls back to downloading + reading sharp metadata (works for any URL).
   */
  private async getSourcePixels(original: {
    url: string;
    storageKey: string | null;
  }): Promise<{ width: number; height: number } | null> {
    if (original.storageKey) {
      const probed = await this.probeDimensions(original.storageKey);
      if (probed) return probed;
    }
    try {
      const bytes = await this.download(original.url);
      const meta = await sharp(bytes).metadata();
      if (meta.width && meta.height) {
        return { width: meta.width, height: meta.height };
      }
    } catch (err) {
      this.logger.warn(
        `getSourcePixels download failed: ${(err as Error).message}`,
      );
    }
    return null;
  }

  /**
   * Re-encode a buffer to a print-ready image: crop, resize and bleed.
   * - Caps resolution to the print size at targetDpi/PRINT_DPI (or MAX_EDGE),
   *   never enlarges. The cap covers the print area (`outside`), so a source
   *   whose ratio differs from the format still has targetDpi after the crop.
   * - Applies the bleed extension when requested.
   * - Outputs JPEG or PNG per options.format.
   */
  private async buildPrintImage(
    buffer: Buffer,
    printInches: { width: number; height: number } | null,
    options: EnhanceDto,
  ): Promise<Buffer> {
    // Cap output at PRINT_DPI (or targetDpi) at the print size. The AI upscale is
    // sized to reach this DPI; capping here keeps both the stored base and the
    // master within the storage provider's per-file size limit. `withoutEnlargement`
    // leaves lower-res sources untouched (no fake upscaling).
    const effectiveDpi = options.targetDpi ?? PRINT_DPI;

    let pipe: sharp.Sharp;
    if (options.fitToFormat && printInches) {
      pipe = await this.cropToFormat(
        buffer,
        printInches,
        effectiveDpi,
        options.crop,
      );
    } else {
      const maxWidth = printInches
        ? Math.round(printInches.width * effectiveDpi)
        : MAX_EDGE;
      const maxHeight = printInches
        ? Math.round(printInches.height * effectiveDpi)
        : MAX_EDGE;
      // Con tamaño de impresión, `outside`: el eje más justo para el formato
      // queda a effectiveDpi. Con `inside` mandaba el otro eje y, si la
      // proporción no coincide, el recorte del troquel dejaba el máster por
      // debajo (3:4 a 20×30 cm salía a 268 DPI). Sin tamaño: límite de borde,
      // `inside`.
      pipe = sharp(buffer).resize({
        width: maxWidth,
        height: maxHeight,
        fit: printInches ? 'outside' : 'inside',
        withoutEnlargement: true,
      });
    }

    if (options.bleed && printInches) {
      const bleedPx = Math.round((BLEED_MM / 25.4) * effectiveDpi);
      const mode = options.bleedMode ?? 'solid';
      pipe = pipe.extend({
        top: bleedPx,
        bottom: bleedPx,
        left: bleedPx,
        right: bleedPx,
        ...(mode === 'solid'
          ? {
              extendWith: 'background',
              background: this.hexToRgb(options.bleedColor ?? '#ffffff'),
            }
          : { extendWith: mode === 'mirror' ? 'mirror' : 'copy' }),
      });
    }

    if (options.format === 'png') {
      return pipe.png().toBuffer();
    }
    return pipe.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  }

  /**
   * Recorta a la proporción exacta del formato según el encuadre (centrado por
   * defecto) y lo dimensiona al DPI pedido, sin agrandar nunca.
   */
  private async cropToFormat(
    buffer: Buffer,
    printInches: { width: number; height: number },
    dpi: number,
    crop: PrintCrop | undefined,
  ): Promise<sharp.Sharp> {
    const meta = await sharp(buffer).metadata();
    const targetW = Math.round(printInches.width * dpi);
    const targetH = Math.round(printInches.height * dpi);
    if (!meta.width || !meta.height) {
      return sharp(buffer).resize({
        width: targetW,
        height: targetH,
        fit: 'cover',
        position: 'centre',
      });
    }

    const rect = cropRect(
      meta.width,
      meta.height,
      printInches.width / printInches.height,
      crop,
    );
    const scale = Math.min(1, rect.width / targetW, rect.height / targetH);
    return sharp(buffer)
      .extract(rect)
      .resize({
        width: Math.max(1, Math.round(targetW * scale)),
        height: Math.max(1, Math.round(targetH * scale)),
        fit: 'fill',
      });
  }

  /**
   * Detect the dominant colour of the source image (proxy for background colour).
   * Used as the default bleed fill. Falls back to #ffffff on any error.
   */
  private async detectBorderColor(url: string): Promise<string> {
    try {
      const bytes = await this.download(url);
      const stats = await sharp(bytes)
        .resize(64, 64, { fit: 'fill' })
        .removeAlpha()
        .toColorspace('srgb')
        .stats();
      // Use dominant colour when available (sharp ≥ 0.32), else fall back to mean.
      const { dominant: d } = stats as typeof stats & {
        dominant?: { r: number; g: number; b: number };
      };
      if (d) {
        return this.rgbToHex(d.r, d.g, d.b);
      }
      const [r, g, b] = stats.channels.map((c) => Math.round(c.mean));
      return this.rgbToHex(r, g, b);
    } catch {
      return '#ffffff';
    }
  }

  /** Convert 0-255 RGB channels to a 6-digit hex colour string. */
  private rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map((v) =>
          Math.max(0, Math.min(255, Math.round(v)))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  }

  /** Parse a #rrggbb hex string to an RGBA object (alpha=1 for solid fill). */
  private hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
    alpha: number;
  } {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      alpha: 1,
    };
  }

  /** Download a remote image into a Buffer. */
  private async download(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to download source image (${res.status})`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * La imagen de origen del proyecto. Con generación, la imagen actual de la
   * generación (puede haberse reemplazado); si no, la subida al proyecto.
   */
  private resolveSource(
    project: LoadedProject,
  ): { url: string; storageKey: string | null } | null {
    if (project.generationId) {
      return project.generation?.resultUrl
        ? {
            url: project.generation.resultUrl,
            storageKey: project.generation.resultStorageKey,
          }
        : null;
    }
    return project.sourceUrl
      ? { url: project.sourceUrl, storageKey: project.sourceStorageKey }
      : null;
  }

  /** La base y el máster guardados salieron de la fuente actual. */
  private sourceMatches(
    project: LoadedProject,
    original: { url: string } | null,
  ): boolean {
    return Boolean(original) && project.sourceUrl === original?.url;
  }

  /**
   * Tamaño físico impreso, en pulgadas (la unidad con la que se razona el DPI).
   *
   * Orden de preferencia deliberado. ClawAndSoul acabó dependiendo del parser
   * de título como fuente real desde que la producción pasó a manual, y ese
   * parser exige el símbolo ″: con títulos de puzzle en centímetros devolvía
   * null y el estudio de impresión perdía en silencio la recomendación de
   * upscale y el bleed. Aquí el dato sale de la base de datos y el parser es
   * el último recurso, no el primero.
   */
  private resolvePrintInches(
    project: LoadedProject,
  ): { width: number; height: number } | null {
    const resolved = this.resolvePrintConfig(project);
    if (resolved) {
      return {
        width: resolved.cfg.widthCm / 2.54,
        height: resolved.cfg.heightCm / 2.54,
      };
    }

    return this.parseInchesFromTitle(project.orderItem?.variantTitle ?? null);
  }

  /**
   * printConfig efectivo: el elegido en el estudio para el proyecto manda
   * sobre el de la variante vinculada. Solo cuenta si trae ancho y alto.
   */
  private resolvePrintConfig(project: LoadedProject): {
    cfg: PrintConfigShape & { widthCm: number; heightCm: number };
    source: 'project' | 'variant';
  } | null {
    const candidates: [
      Prisma.JsonValue | null | undefined,
      'project' | 'variant',
    ][] = [
      [project.printConfig, 'project'],
      [project.orderItem?.productVariant?.printConfig, 'variant'],
    ];
    for (const [raw, source] of candidates) {
      const cfg = raw as PrintConfigShape | null | undefined;
      if (
        cfg &&
        typeof cfg.widthCm === 'number' &&
        typeof cfg.heightCm === 'number'
      ) {
        return {
          cfg: cfg as PrintConfigShape & { widthCm: number; heightCm: number },
          source,
        };
      }
    }
    return null;
  }

  /** Tamaños distintos (ancho × alto) configurados en el catálogo. */
  private async loadPrintSizePresets(): Promise<PrintSizePreset[]> {
    const variants = await this.prisma.productFormatVariant.findMany({
      where: { printConfig: { not: Prisma.DbNull } },
      select: { printConfig: true },
    });
    const byKey = new Map<string, PrintSizePreset>();
    for (const v of variants) {
      const cfg = v.printConfig as PrintConfigShape | null;
      if (
        !cfg ||
        typeof cfg.widthCm !== 'number' ||
        typeof cfg.heightCm !== 'number'
      ) {
        continue;
      }
      byKey.set(`${cfg.widthCm}x${cfg.heightCm}`, {
        widthCm: cfg.widthCm,
        heightCm: cfg.heightCm,
      });
    }
    return [...byKey.values()].sort(
      (a, b) => a.widthCm - b.widthCm || a.heightCm - b.heightCm,
    );
  }

  /**
   * Último recurso: sacar el tamaño del título de la variante. Acepta tanto
   * pulgadas ("12x16″") como centímetros ("48x36 cm"), porque los títulos de
   * puzzle se escriben en el sistema métrico.
   */
  private parseInchesFromTitle(
    title: string | null,
  ): { width: number; height: number } | null {
    if (!title) return null;
    const m = title.match(
      /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(″|"|cm)/i,
    );
    if (!m) return null;
    // Todo se razona en pulgadas; un título métrico se convierte aquí.
    const divisor = m[3].toLowerCase() === 'cm' ? 2.54 : 1;
    const width = parseFloat(m[1]) / divisor;
    const height = parseFloat(m[2]) / divisor;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }
    return { width, height };
  }

  private async probeDimensions(
    publicId: string,
  ): Promise<{ width: number; height: number } | null> {
    try {
      const res = (await cloudinary.api.resource(publicId)) as {
        width?: number;
        height?: number;
      };
      if (res.width && res.height) {
        return { width: res.width, height: res.height };
      }
    } catch (err) {
      this.logger.warn(
        `probeDimensions failed for ${publicId}: ${(err as Error).message}`,
      );
    }
    return null;
  }

  private recommendUpscale(sourceDpi: number | null): 0 | 2 | 4 {
    if (sourceDpi === null) return 2;
    if (sourceDpi >= TARGET_DPI) return 0;
    const factor = Math.ceil(TARGET_DPI / sourceDpi);
    return factor <= 1 ? 0 : factor <= 2 ? 2 : 4;
  }
}
