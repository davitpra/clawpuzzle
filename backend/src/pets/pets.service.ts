import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

/** Máximo de fotos que se pueden guardar por mascota. */
export const MAX_PET_PHOTOS = 4;

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createPetDto: CreatePetDto) {
    return this.prisma.pet.create({
      data: {
        ...createPetDto,
        userId,
      },
      include: {
        photos: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.pet.findMany({
      where: { userId, isActive: true },
      include: {
        photos: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Sin comprobar propietario: solo para quien ya valida la propiedad por su
  // cuenta (GenerationsService). Todo lo que venga de una ruta de usuario debe
  // pasar por findOneOwned.
  async findOne(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    return pet;
  }

  /** Igual que findOne, pero exige que la mascota sea del usuario. */
  async findOneOwned(id: string, userId: string) {
    const pet = await this.findOne(id);
    if (pet.userId !== userId) {
      throw new ForbiddenException('You do not own this pet');
    }

    return pet;
  }

  async update(id: string, userId: string, updatePetDto: UpdatePetDto) {
    await this.findOneOwned(id, userId);

    return this.prisma.pet.update({
      where: { id },
      data: updatePetDto,
      include: {
        photos: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOneOwned(id, userId);

    // Soft delete
    return this.prisma.pet.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deletePhoto(
    petId: string,
    photoId: string,
    userId: string,
  ): Promise<string> {
    await this.findOneOwned(petId, userId);

    const photo = await this.prisma.petPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.petId !== petId) {
      throw new NotFoundException('Photo not found');
    }

    await this.prisma.petPhoto.delete({ where: { id: photoId } });

    return photo.photoStorageKey;
  }

  async getPhotos(petId: string, userId: string) {
    await this.findOneOwned(petId, userId);

    return this.prisma.petPhoto.findMany({
      where: { petId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async updatePhoto(
    petId: string,
    photoId: string,
    userId: string,
    data: { orderIndex?: number; isPrimary?: boolean },
  ) {
    await this.findOneOwned(petId, userId);

    const photo = await this.prisma.petPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.petId !== petId) {
      throw new NotFoundException('Photo not found');
    }

    if (data.isPrimary) {
      await this.prisma.petPhoto.updateMany({
        where: { petId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.petPhoto.update({
      where: { id: photoId },
      data: {
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      },
    });
  }

  // Valida que se pueda agregar otra foto (propiedad + tope MAX_PET_PHOTOS).
  // Se llama antes de subir el archivo a S3 para no dejar objetos huérfanos.
  async assertCanAddPhoto(petId: string, userId: string): Promise<void> {
    await this.findOneOwned(petId, userId);

    const count = await this.prisma.petPhoto.count({ where: { petId } });
    if (count >= MAX_PET_PHOTOS) {
      throw new BadRequestException(
        `A pet can have at most ${MAX_PET_PHOTOS} photos`,
      );
    }
  }

  async addPhoto(
    petId: string,
    userId: string,
    photoUrl: string,
    photoStorageKey: string,
    isPrimary: boolean = false,
  ) {
    await this.findOneOwned(petId, userId);

    // Get current max order index
    const maxPhoto = await this.prisma.petPhoto.findFirst({
      where: { petId },
      orderBy: { orderIndex: 'desc' },
    });

    const orderIndex = maxPhoto ? maxPhoto.orderIndex + 1 : 0;

    // If setting as primary, unset all other photos
    if (isPrimary) {
      await this.prisma.petPhoto.updateMany({
        where: { petId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.petPhoto.create({
      data: {
        petId,
        photoUrl,
        photoStorageKey,
        isPrimary,
        orderIndex,
      },
    });
  }
}
