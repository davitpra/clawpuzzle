import { ConflictException } from '@nestjs/common';
import { PrintProjectsService } from './print-projects.service';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('PrintProjectsService link', () => {
  const masterUrl = 'https://cdn.example.com/master.jpg';

  const prisma = {
    printProject: {
      findUnique: jest.fn(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
    },
    orderItem: {
      findUnique: jest.fn(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
    },
  };
  const enhancement = {
    loadProject: jest.fn(),
    pushMasterToItem: jest.fn(),
    recordEvent: jest.fn(),
  };

  let service: PrintProjectsService;

  function linkedProject(overrides: Record<string, unknown> = {}) {
    return {
      id: 'project-1',
      orderItemId: 'item-1',
      generationId: null,
      sourceUrl: 'https://cdn.example.com/upload.png',
      printImageUrl: masterUrl,
      printImageStorageKey: 'master.jpg',
      orderItem: { id: 'item-1', orderId: 'order-1', printImageUrl: masterUrl },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.printProject.update.mockResolvedValue({});
    prisma.orderItem.update.mockResolvedValue({});
    prisma.printProject.findUnique.mockResolvedValue({
      id: 'project-1',
      orderItem: null,
      generation: null,
    });
    service = new PrintProjectsService(
      prisma as never,
      { delete: jest.fn().mockResolvedValue(undefined) } as never,
      enhancement as never,
    );
  });

  // Desvincular no deja a la línea sin imagen: hereda el máster y el proyecto
  // lo suelta, para que su próximo guardado no lo borre.
  it('hands the master over to the item on unlink', async () => {
    enhancement.loadProject.mockResolvedValue(linkedProject());

    await service.unlink('project-1');

    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { printImageStorageKey: 'master.jpg' },
    });
    expect(prisma.printProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { printImageUrl: null, printImageStorageKey: null },
    });
    expect(prisma.printProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { orderItemId: null },
    });
  });

  it('keeps the master when the item shows another image', async () => {
    enhancement.loadProject.mockResolvedValue(
      linkedProject({
        orderItem: {
          id: 'item-1',
          orderId: 'order-1',
          printImageUrl: 'https://cdn.example.com/manual.jpg',
        },
      }),
    );

    await service.unlink('project-1');

    expect(prisma.orderItem.update).not.toHaveBeenCalled();
  });

  it('rejects linking an item that already has a project', async () => {
    enhancement.loadProject.mockResolvedValue(
      linkedProject({ orderItemId: null, orderItem: null }),
    );
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'item-2',
      title: 'Puzzle',
      generationId: null,
      generation: null,
      order: { orderNumber: '#1' },
      printProject: { id: 'project-2' },
    });

    await expect(service.link('project-1', 'item-2')).rejects.toThrow(
      ConflictException,
    );
  });

  it('adopts the item generation when the project has no image', async () => {
    enhancement.loadProject.mockResolvedValue(
      linkedProject({
        orderItemId: null,
        orderItem: null,
        sourceUrl: null,
        printImageUrl: null,
      }),
    );
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'item-2',
      title: 'Puzzle',
      generationId: 'generation-1',
      generation: { resultUrl: 'https://cdn.example.com/generation.png' },
      order: { orderNumber: '#1' },
      printProject: null,
    });

    await service.link('project-1', 'item-2');

    expect(prisma.printProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        orderItemId: 'item-2',
        generationId: 'generation-1',
        sourceUrl: 'https://cdn.example.com/generation.png',
      },
    });
  });
});
