import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GenerationsService } from './generations.service';
import { PrismaService } from '../prisma/prisma.service';
import { PetsService } from '../pets/pets.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CreditsService } from '../credits/credits.service';
import { QUEUE_NAMES, JOB_NAMES } from './constants/queues.constants';
import { CreateImageGenerationDto } from './dto/create-image-generation.dto';

// CreditsService va real: el 402 y el reembolso son los de verdad, y solo la
// base de datos está simulada. El cliente de transacción es el propio mock
// (como en credits.service.spec.ts), así que lo que ocurre "dentro" de la
// transacción queda en las mismas jest.fn.
const mockPrisma = {
  petPhoto: { findUnique: jest.fn() },
  productReference: { findUnique: jest.fn() },
  style: { findUnique: jest.fn() },
  productFormatVariant: { findFirst: jest.fn() },
  user: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  generation: { create: jest.fn(), update: jest.fn() },
  creditTransaction: { create: jest.fn(), findUnique: jest.fn() },
  orderItem: { findMany: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

const mockPets = { findOne: jest.fn() };
const mockQueue = { add: jest.fn() };

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'test',
  });

const USER_ID = 'user-1';
const GEN_ID = 'gen-1';

const dto: CreateImageGenerationDto = {
  petId: 'pet-1',
  petPhotoId: 'photo-1',
  formatId: 'ratio_4_3',
  productRefId: 'prod-1',
  styleId: 'style-1',
};

/** Deja lista una petición válida de un usuario normal con saldo. */
function arrangeHappyPath() {
  mockPets.findOne.mockResolvedValue({
    id: 'pet-1',
    userId: USER_ID,
    name: 'Toby',
    species: 'dog',
    breed: null,
    photos: [{ id: 'photo-1' }],
  });
  mockPrisma.petPhoto.findUnique.mockResolvedValue({
    id: 'photo-1',
    petId: 'pet-1',
    photoUrl: 'https://cdn.test/toby.jpg',
  });
  mockPrisma.productReference.findUnique.mockResolvedValue({
    id: 'prod-1',
    isActive: true,
    isLaunchProduct: true,
    styleId: null,
  });
  mockPrisma.style.findUnique.mockResolvedValue({
    isActive: true,
    templateVarOptions: null,
  });
  mockPrisma.productFormatVariant.findFirst.mockResolvedValue({
    constraints: { cropMode: 'cover' },
  });
  mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
  mockPrisma.generation.create.mockResolvedValue({ id: GEN_ID });
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.creditTransaction.create.mockResolvedValue({});
}

describe('GenerationsService', () => {
  let service: GenerationsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(mockPrisma),
    );
    mockPrisma.orderItem.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerationsService,
        CreditsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PetsService, useValue: mockPets },
        { provide: ExpensesService, useValue: {} },
        {
          provide: getQueueToken(QUEUE_NAMES.IMAGE_GENERATION),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get(GenerationsService);
  });

  describe('createImageGeneration', () => {
    it('descuenta 1 crédito y encola la generación', async () => {
      arrangeHappyPath();

      await service.createImageGeneration(USER_ID, dto);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: USER_ID, generationCredits: { gte: 1 } },
        data: { generationCredits: { decrement: 1 } },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          amount: -1,
          reason: 'generation_spend',
          referenceId: GEN_ID,
        },
      });
      expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.GENERATE, {
        generationId: GEN_ID,
      });
    });

    // La fila se crea dentro de la transacción y el 402 sale de ella, así que
    // Postgres la revierte. El rollback real se prueba en la Fase 2.
    it('sin saldo lanza 402 desde la transacción y no encola nada', async () => {
      arrangeHappyPath();
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

      const error = await service
        .createImageGeneration(USER_ID, dto)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYMENT_REQUIRED,
      );
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.generation.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('no cobra a un admin', async () => {
      arrangeHappyPath();
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });

      await service.createImageGeneration(USER_ID, dto);

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('guarda el formato validado contra la variante del producto', async () => {
      arrangeHappyPath();

      await service.createImageGeneration(USER_ID, dto);

      expect(mockPrisma.productFormatVariant.findFirst).toHaveBeenCalledWith({
        where: {
          productRefId: 'prod-1',
          formatId: 'ratio_4_3',
          isActive: true,
        },
      });
      const calls = mockPrisma.generation.create.mock.calls as Array<
        [{ data: { formatId: string; metadata: Record<string, unknown> } }]
      >;
      const { data } = calls[0][0];
      expect(data.formatId).toBe('ratio_4_3');
      expect(data.metadata.compatConstraints).toEqual({ cropMode: 'cover' });
    });

    describe('rechazos antes de crear nada', () => {
      afterEach(() => {
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.generation.create).not.toHaveBeenCalled();
        expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
        expect(mockQueue.add).not.toHaveBeenCalled();
      });

      it('mascota de otro usuario → 400', async () => {
        arrangeHappyPath();
        mockPets.findOne.mockResolvedValue({
          userId: 'otro',
          photos: [{ id: 'photo-1' }],
        });

        await expect(
          service.createImageGeneration(USER_ID, dto),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('producto inexistente → 404', async () => {
        arrangeHappyPath();
        mockPrisma.productReference.findUnique.mockResolvedValue(null);

        await expect(
          service.createImageGeneration(USER_ID, dto),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('producto inactivo → 404', async () => {
        arrangeHappyPath();
        mockPrisma.productReference.findUnique.mockResolvedValue({
          id: 'prod-1',
          isActive: false,
          isLaunchProduct: true,
          styleId: null,
        });

        await expect(
          service.createImageGeneration(USER_ID, dto),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('estilo inactivo en el producto de lanzamiento → 400', async () => {
        arrangeHappyPath();
        mockPrisma.style.findUnique.mockResolvedValue({
          isActive: false,
          templateVarOptions: null,
        });

        await expect(
          service.createImageGeneration(USER_ID, dto),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('formato sin variante activa → 400', async () => {
        arrangeHappyPath();
        mockPrisma.productFormatVariant.findFirst.mockResolvedValue(null);

        await expect(
          service.createImageGeneration(USER_ID, dto),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });
  });

  describe('markFailed', () => {
    beforeEach(() => {
      mockPrisma.generation.update.mockResolvedValue({ id: GEN_ID });
      mockPrisma.creditTransaction.findUnique.mockResolvedValue({
        userId: USER_ID,
      });
    });

    it('marca la generación como fallida y reembolsa el crédito', async () => {
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      await service.markFailed(GEN_ID, 'boom');

      expect(mockPrisma.generation.update).toHaveBeenCalledWith({
        where: { id: GEN_ID },
        data: { status: 'failed', errorMessage: 'boom' },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          amount: 1,
          reason: 'generation_refund',
          referenceId: GEN_ID,
        },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { generationCredits: { increment: 1 } },
      });
    });

    // El segundo refund choca con el unique (reason, referenceId) del ledger.
    it('llamado dos veces solo reembolsa una', async () => {
      mockPrisma.creditTransaction.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(p2002());

      await service.markFailed(GEN_ID, 'boom');
      await expect(service.markFailed(GEN_ID, 'boom')).resolves.toBeDefined();

      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('no reembolsa una generación que no gastó crédito (admin)', async () => {
      mockPrisma.creditTransaction.findUnique.mockResolvedValue(null);

      await service.markFailed(GEN_ID, 'boom');

      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('pasa a art_failed los items pagados que esperaban el arte', async () => {
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.orderItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          productionStatus: 'generating',
          order: { financialStatus: 'paid' },
        },
      ]);

      await service.markFailed(GEN_ID, 'boom');

      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { productionStatus: 'art_failed' },
      });
    });
  });
});
