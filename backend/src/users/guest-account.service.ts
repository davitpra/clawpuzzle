import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, type User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService, type CreditReason } from '../credits/credits.service';
import { StorageService } from '../storage/storage.service';

export const GUEST_ROLE = 'guest';

/** Créditos de una sesión de invitado: la imagen gratis. */
export const GUEST_BONUS_CREDITS = 1;

// `User.email` es obligatorio y único. El dominio `.invalid` (RFC 2606) nunca
// resuelve, así que ningún correo real puede coincidir con el de un invitado.
const GUEST_EMAIL_DOMAIN = 'guest.clawpuzzle.invalid';

/** Cuántos invitados se purgan por ejecución del cron. */
const PURGE_BATCH_SIZE = 250;

/**
 * Créditos que viajan con el invitado al fusionarlo con otra cuenta: solo los
 * que pagó. El `guest_bonus` y los gastos/reembolsos de generación no se
 * mueven: la cuenta destino no debe ganar créditos por una imagen regalada.
 */
const PURCHASED_CREDIT_REASONS: CreditReason[] = [
  'order_bonus',
  'pack_purchase',
  'order_bonus_reversal',
  'pack_purchase_reversal',
];

export interface GoogleProfile {
  email: string;
  googleId: string;
  fullName?: string;
  avatarUrl?: string;
}

/**
 * Ciclo de vida del usuario invitado: un `User` real con rol `guest` que puede
 * generar una imagen y comprarla sin registrarse. Al entrar con Google se
 * convierte en esa misma fila (`upgradeGuest`) o se fusiona con la cuenta que
 * ya tenía ese email (`mergeGuestInto`).
 */
@Injectable()
export class GuestAccountService {
  private readonly logger = new Logger(GuestAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credits: CreditsService,
    private readonly storage: StorageService,
  ) {}

  static isGuest(user: { role: string } | null | undefined): boolean {
    return user?.role === GUEST_ROLE;
  }

  /** El invitado `id` si existe y sigue activo; si no, null. */
  async findActiveGuest(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== GUEST_ROLE || user.status !== 'active') {
      return null;
    }
    return user;
  }

  /**
   * Comprueba el interruptor y el tope de las últimas 24 h. Se cuenta en el
   * ledger (`guest_bonus`) y no en `User`: un invitado convertido deja de tener
   * rol `guest` pero su imagen gratis sí costó.
   */
  async assertCapacity(): Promise<void> {
    if (!this.config.get<boolean>('guest.enabled')) {
      throw new ServiceUnavailableException('Guest generation is disabled');
    }

    const dailyCap = this.config.get<number>('guest.dailyCap') ?? 0;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const created = await this.prisma.creditTransaction.count({
      where: { reason: 'guest_bonus', createdAt: { gte: since } },
    });
    if (created >= dailyCap) {
      this.logger.warn(`Guest daily cap reached (${created}/${dailyCap})`);
      throw new HttpException(
        'Guest generation limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Crea el invitado con su crédito gratis. */
  async createGuest(): Promise<User> {
    const id = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          email: `guest-${id}@${GUEST_EMAIL_DOMAIN}`,
          role: GUEST_ROLE,
          lastSeenAt: new Date(),
        },
      });
      await this.credits.grant(
        id,
        GUEST_BONUS_CREDITS,
        'guest_bonus',
        id,
        'guest',
        tx,
      );
      // Releída: `grant` incrementó el saldo después del create.
      return tx.user.findUniqueOrThrow({ where: { id } });
    });
  }

  /**
   * Convierte al invitado en cuenta con su perfil de Google, conservando el id
   * (y con él su mascota, su arte y sus pedidos). Otorga el bono de registro
   * que falte para igualar a quien se registra directamente.
   */
  async upgradeGuest(
    guestId: string,
    profile: GoogleProfile,
    signupBonus: number,
  ): Promise<User> {
    const user = await this.prisma.$transaction(async (tx) => {
      // `role: guest` en el where: dos logins simultáneos no pueden convertir la
      // misma fila dos veces.
      const { count } = await tx.user.updateMany({
        where: { id: guestId, role: GUEST_ROLE },
        data: {
          email: profile.email,
          googleId: profile.googleId,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          emailVerified: true,
          role: 'user',
        },
      });
      if (count === 0) {
        throw new Error(`Guest ${guestId} is no longer a guest`);
      }
      await this.credits.grant(
        guestId,
        signupBonus,
        'signup_bonus',
        guestId,
        'signup (guest upgrade)',
        tx,
      );
      // Las sesiones de invitado (30 días) no deben seguir vivas como sesiones
      // de la cuenta: el login emite las suyas.
      await tx.refreshToken.updateMany({
        where: { userId: guestId, isRevoked: false },
        data: { isRevoked: true },
      });
      return tx.user.findUniqueOrThrow({ where: { id: guestId } });
    });

    this.logger.log(`Guest ${guestId} upgraded to account ${user.email}`);
    return user;
  }

  /**
   * Pasa todo lo del invitado a `targetUserId` y lo borra. Se usa cuando el
   * invitado entra con un email que ya tenía cuenta, o compra con él.
   */
  async mergeGuestInto(guestId: string, targetUserId: string): Promise<void> {
    if (guestId === targetUserId) return;

    await this.prisma.$transaction(async (tx) => {
      const guest = await tx.user.findUnique({
        where: { id: guestId },
        select: { role: true },
      });
      // Ya fusionado o convertido por otra petición: nada que hacer.
      if (!guest || guest.role !== GUEST_ROLE) return;

      const move = {
        where: { userId: guestId },
        data: { userId: targetUserId },
      };
      await tx.pet.updateMany(move);
      await tx.generation.updateMany(move);
      await tx.order.updateMany(move);
      await tx.expense.updateMany(move);
      await tx.auditLog.updateMany(move);

      await this.movePurchasedCredits(tx, guestId, targetUserId);

      // Cascada: sesiones, carrito y los movimientos de crédito que no viajan.
      await tx.user.delete({ where: { id: guestId } });
    });

    this.logger.log(`Guest ${guestId} merged into user ${targetUserId}`);
  }

  /**
   * Una cuenta nueva adopta a los invitados que compraron con su email desde
   * otro navegador (el webhook no pudo fusionarlos: la cuenta aún no existía).
   */
  async adoptGuestsByOrderEmail(email: string, userId: string): Promise<void> {
    const guests = await this.prisma.user.findMany({
      where: {
        role: GUEST_ROLE,
        orders: {
          some: { customerEmail: { equals: email, mode: 'insensitive' } },
        },
      },
      select: { id: true },
    });
    for (const guest of guests) {
      await this.mergeGuestInto(guest.id, userId);
    }
  }

  private async movePurchasedCredits(
    tx: Prisma.TransactionClient,
    guestId: string,
    targetUserId: string,
  ): Promise<void> {
    const where = {
      userId: guestId,
      reason: { in: PURCHASED_CREDIT_REASONS },
    };
    const { _sum } = await tx.creditTransaction.aggregate({
      where,
      _sum: { amount: true },
    });
    const amount = _sum.amount ?? 0;

    // Las filas cambian de dueño en vez de crearse de nuevo: la unique
    // (reason, referenceId) sigue protegiendo contra un doble grant del webhook.
    await tx.creditTransaction.updateMany({
      where,
      data: { userId: targetUserId },
    });
    if (amount !== 0) {
      await tx.user.update({
        where: { id: targetUserId },
        data: { generationCredits: { increment: amount } },
      });
    }
  }

  /**
   * Borra los invitados sin pedidos que no han vuelto en `retentionDays`, con
   * sus fotos y su arte en storage. Los que compraron se conservan: el pedido
   * necesita el arte.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async purgeStaleGuests(): Promise<number> {
    const retentionDays = this.config.get<number>('guest.retentionDays') ?? 0;
    if (retentionDays <= 0) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const guests = await this.prisma.user.findMany({
      where: {
        role: GUEST_ROLE,
        orders: { none: {} },
        OR: [
          { lastSeenAt: { lt: cutoff } },
          { lastSeenAt: null, createdAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
      take: PURGE_BATCH_SIZE,
    });

    let purged = 0;
    for (const guest of guests) {
      try {
        await this.deleteGuest(guest.id);
        purged += 1;
      } catch (error) {
        this.logger.error(`Failed to purge guest ${guest.id}`, error);
      }
    }

    if (guests.length > 0) {
      this.logger.log(`Guest purge: ${purged}/${guests.length} guests removed`);
    }
    return purged;
  }

  private async deleteGuest(guestId: string): Promise<void> {
    // Las claves se leen antes: un fallo del proveedor de storage no debe
    // impedir el borrado de la fila.
    const [photos, generations] = await Promise.all([
      this.prisma.petPhoto.findMany({
        where: { pet: { userId: guestId } },
        select: { photoStorageKey: true },
      }),
      this.prisma.generation.findMany({
        where: { userId: guestId, resultStorageKey: { not: null } },
        select: { resultStorageKey: true },
      }),
    ]);

    await this.prisma.user.delete({ where: { id: guestId } });

    const keys = [
      ...photos.map((p) => p.photoStorageKey),
      ...generations.map((g) => g.resultStorageKey as string),
    ];
    await Promise.all(
      keys.map((key) => this.storage.delete(key).catch(() => undefined)),
    );
  }
}
