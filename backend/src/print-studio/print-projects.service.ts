import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  LoadedProject,
  PrintProjectEnhancementService,
} from './print-project-enhancement.service';
import { CreatePrintProjectDto } from './dto/print-project.dto';

/** Título de un proyecto creado sin pedido; la primera subida lo reemplaza. */
export const DEFAULT_PROJECT_TITLE = 'Proyecto sin título';

const LIST_SELECT = {
  id: true,
  title: true,
  printImageUrl: true,
  sourceUrl: true,
  createdAt: true,
  updatedAt: true,
  generation: { select: { thumbnailUrl: true, resultUrl: true } },
  orderItem: {
    select: {
      id: true,
      title: true,
      order: { select: { id: true, orderNumber: true, customerName: true } },
    },
  },
} satisfies Prisma.PrintProjectSelect;

/**
 * Proyectos del Estudio de impresión: alta, título, imagen de origen y vínculo
 * con una línea de pedido. El pipeline de imagen vive en
 * PrintProjectEnhancementService.
 */
@Injectable()
export class PrintProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly enhancement: PrintProjectEnhancementService,
  ) {}

  async list(opts: { page: number; limit: number; q?: string }) {
    const where: Prisma.PrintProjectWhereInput = opts.q
      ? {
          OR: [
            { title: { contains: opts.q, mode: 'insensitive' } },
            {
              orderItem: {
                order: {
                  OR: [
                    { orderNumber: { contains: opts.q, mode: 'insensitive' } },
                    {
                      customerName: { contains: opts.q, mode: 'insensitive' },
                    },
                    {
                      customerEmail: { contains: opts.q, mode: 'insensitive' },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.printProject.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.printProject.count({ where }),
    ]);
    return {
      data: rows.map(({ generation, printImageUrl, sourceUrl, ...row }) => ({
        ...row,
        thumbnailUrl:
          printImageUrl ??
          generation?.thumbnailUrl ??
          generation?.resultUrl ??
          sourceUrl,
      })),
      meta: {
        total,
        page: opts.page,
        limit: opts.limit,
        totalPages: Math.max(1, Math.ceil(total / opts.limit)),
      },
    };
  }

  async get(projectId: string) {
    const project = await this.prisma.printProject.findUnique({
      where: { id: projectId },
      include: {
        orderItem: { select: { id: true, orderId: true } },
        generation: {
          select: { id: true, resultUrl: true, thumbnailUrl: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return {
      id: project.id,
      title: project.title,
      orderItem: project.orderItem,
      generation: project.generation,
      sourceKind: project.generationId
        ? ('generation' as const)
        : project.sourceUrl
          ? ('upload' as const)
          : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async create(dto: CreatePrintProjectDto, adminUserId?: string) {
    const item = dto.orderItemId
      ? await this.loadLinkableItem(dto.orderItemId)
      : null;
    const project = await this.prisma.printProject.create({
      data: {
        title:
          dto.title?.trim() || (item ? itemTitle(item) : DEFAULT_PROJECT_TITLE),
        orderItemId: item?.id ?? null,
        generationId: item?.generation?.resultUrl ? item.generationId : null,
        sourceUrl: item?.generation?.resultUrl ?? null,
        createdById: adminUserId ?? null,
      },
    });
    return this.get(project.id);
  }

  /** El proyecto de una línea: el existente o uno nuevo ya vinculado. */
  async openForItem(orderId: string, itemId: string, adminUserId?: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true, printProject: { select: { id: true } } },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.printProject) return this.get(item.printProject.id);
    return this.create({ orderItemId: itemId }, adminUserId);
  }

  async rename(projectId: string, title: string) {
    await this.enhancement.loadProject(projectId);
    await this.prisma.printProject.update({
      where: { id: projectId },
      data: { title: title.trim() },
    });
    return this.get(projectId);
  }

  /** Borra el proyecto y sus assets; un máster en uso lo hereda la línea. */
  async remove(projectId: string): Promise<void> {
    const project = await this.enhancement.loadProject(projectId);
    const handedOff = await this.handOffMaster(project);
    const keys = [
      project.sourceStorageKey,
      project.upscaledStorageKey,
      handedOff ? null : project.printImageStorageKey,
    ].filter((k): k is string => Boolean(k));
    await this.prisma.printProject.delete({ where: { id: projectId } });
    for (const key of new Set(keys)) {
      await this.storageService.delete(key).catch(() => null);
    }
  }

  /** Sube una imagen como origen del proyecto. Descarta lo derivado de la anterior. */
  async uploadSource(
    projectId: string,
    file: Express.Multer.File,
    adminUserId?: string,
  ) {
    const project = await this.enhancement.loadProject(projectId);
    // Subir PRIMERO: si falla, la fuente anterior sigue intacta.
    const key = `print-projects/${projectId}/source/${uuidv4()}`;
    const url = await this.storageService.upload(
      key,
      file.buffer,
      file.mimetype,
    );
    await this.replaceSource(project, {
      generationId: null,
      sourceUrl: url,
      sourceStorageKey: key,
    });
    // Un proyecto recién creado toma el nombre del archivo.
    if (project.title === DEFAULT_PROJECT_TITLE && file.originalname) {
      await this.prisma.printProject.update({
        where: { id: projectId },
        data: { title: file.originalname.replace(/\.[^.]+$/, '') },
      });
    }
    await this.enhancement.recordEvent(
      project,
      'print_source_uploaded',
      adminUserId,
      { sourceUrl: url },
    );
    return this.get(projectId);
  }

  /** Usa una generación (del ítem o de la galería del cliente) como origen. */
  async setGenerationSource(
    projectId: string,
    generationId: string,
    adminUserId?: string,
  ) {
    const project = await this.enhancement.loadProject(projectId);
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { id: true, resultUrl: true },
    });
    if (!generation?.resultUrl) {
      throw new BadRequestException('La generación no tiene imagen');
    }
    await this.replaceSource(project, {
      generationId: generation.id,
      sourceUrl: generation.resultUrl,
      sourceStorageKey: null,
    });
    await this.enhancement.recordEvent(
      project,
      'print_source_generation',
      adminUserId,
      { generationId },
    );
    return this.get(projectId);
  }

  /**
   * Vincula el proyecto a una línea (como mucho un proyecto por línea). Si ya
   * estaba vinculado a otra, se desvincula primero. Sin imagen de origen, toma
   * la generación de la línea; con máster ya guardado, lo pasa a la línea.
   */
  async link(projectId: string, orderItemId: string, adminUserId?: string) {
    let project = await this.enhancement.loadProject(projectId);
    if (project.orderItemId === orderItemId) return this.get(projectId);
    const item = await this.loadLinkableItem(orderItemId);
    if (project.orderItem) {
      await this.unlink(projectId, adminUserId);
    }
    const adoptGeneration =
      !project.generationId && !project.sourceUrl && item.generation?.resultUrl;
    await this.prisma.printProject.update({
      where: { id: projectId },
      data: {
        orderItemId: item.id,
        ...(adoptGeneration
          ? {
              generationId: item.generationId,
              sourceUrl: item.generation?.resultUrl,
            }
          : {}),
      },
    });
    project = await this.enhancement.loadProject(projectId);
    if (project.orderItem && project.printImageUrl) {
      await this.enhancement.pushMasterToItem(
        project.orderItem,
        project.printImageUrl,
      );
    }
    await this.enhancement.recordEvent(
      project,
      'print_project_linked',
      adminUserId,
      { printProjectId: projectId },
    );
    return this.get(projectId);
  }

  /** Desvincula el proyecto. La línea conserva la imagen que ya tenía. */
  async unlink(projectId: string, adminUserId?: string) {
    const project = await this.enhancement.loadProject(projectId);
    if (!project.orderItem) return this.get(projectId);
    await this.handOffMaster(project);
    await this.prisma.printProject.update({
      where: { id: projectId },
      data: { orderItemId: null },
    });
    await this.enhancement.recordEvent(
      project,
      'print_project_unlinked',
      adminUserId,
      { printProjectId: projectId },
    );
    return this.get(projectId);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Si la línea vinculada muestra el máster del proyecto, la línea pasa a ser
   * su dueña: el proyecto lo suelta (URL y key) para no borrarlo al volver a
   * guardar; el siguiente guardado genera uno nuevo desde la base.
   */
  private async handOffMaster(project: LoadedProject): Promise<boolean> {
    const item = project.orderItem;
    if (
      !item ||
      !project.printImageStorageKey ||
      item.printImageUrl !== project.printImageUrl
    ) {
      return false;
    }
    await this.prisma.orderItem.update({
      where: { id: item.id },
      data: { printImageStorageKey: project.printImageStorageKey },
    });
    await this.prisma.printProject.update({
      where: { id: project.id },
      data: { printImageUrl: null, printImageStorageKey: null },
    });
    return true;
  }

  private async replaceSource(
    project: LoadedProject,
    source: {
      generationId: string | null;
      sourceUrl: string;
      sourceStorageKey: string | null;
    },
  ): Promise<void> {
    await this.enhancement.resetDerived(project);
    await this.prisma.printProject.update({
      where: { id: project.id },
      data: source,
    });
    if (
      project.sourceStorageKey &&
      project.sourceStorageKey !== source.sourceStorageKey
    ) {
      await this.storageService
        .delete(project.sourceStorageKey)
        .catch(() => null);
    }
  }

  private async loadLinkableItem(orderItemId: string) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        id: true,
        title: true,
        generationId: true,
        generation: { select: { resultUrl: true } },
        order: { select: { orderNumber: true } },
        printProject: { select: { id: true } },
      },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.printProject) {
      throw new ConflictException(
        'Esa línea del pedido ya tiene un proyecto de impresión',
      );
    }
    return item;
  }
}

function itemTitle(item: { title: string; order: { orderNumber: string } }) {
  return `${item.order.orderNumber} · ${item.title}`;
}
