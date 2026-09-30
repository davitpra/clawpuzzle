import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ShopifyApiService } from '../../src/shopify-sync/shopify-api.service';
import { REDIS_CLIENT } from '../../src/shopify-sync/constants/queues.constants';

// Arnés de la suite de integración: AppModule completo contra Postgres y Redis
// reales (ver test-env.ts). Solo se sustituye ShopifyApiService, que llamaría a
// la Admin API de Shopify (con reintentos) al ingerir cada orden.

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  redis: Redis;
  close: () => Promise<void>;
}

const shopifyApiStub: Partial<Record<keyof ShopifyApiService, unknown>> = {
  getFulfillmentDisplayStatus: () => Promise.resolve(null),
  registerWebhooks: () => Promise.resolve(),
  cancelOrder: () => Promise.resolve(),
  refundLineItems: () => Promise.resolve(),
  fetchAllOrders: () => Promise.resolve([]),
  fetchAllProducts: () => Promise.resolve([]),
};

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ShopifyApiService)
    .useValue(shopifyApiStub)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  // Cliente ioredis suelto del módulo shopify-sync. Nadie lo cierra en el
  // shutdown de Nest; lo reutilizamos para el FLUSHDB y lo cerramos a mano.
  const redis = app.get<Redis>(REDIS_CLIENT);

  return {
    app,
    prisma,
    redis,
    close: async () => {
      await app.close();
      await redis.quit();
    },
  };
}

// Deja la base y la DB de Redis de test vacías. Los TRUNCATE van en una sola
// sentencia para que CASCADE resuelva las FKs de una vez.
export async function resetState({ prisma, redis }: TestApp): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
    );
  }
  await redis.flushdb();
}

// La ingesta de órdenes y la generación corren en workers BullMQ dentro del
// proceso: los tests sondean la base hasta ver el efecto.
export async function waitFor<T>(
  probe: () => Promise<T | null | undefined | false>,
  { timeoutMs = 15000, intervalMs = 100 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) {
      throw new Error(`waitFor: condición no cumplida en ${timeoutMs} ms`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Firma como Shopify: HMAC-SHA256 en base64 de los bytes exactos del body.
export function signShopify(body: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

// ─── Fábricas ────────────────────────────────────────────────────────────────

export const TEST_PASSWORD = 'test-password-123';

let seq = 0;
const next = () => `${Date.now()}-${++seq}`;

export async function seedUser(
  prisma: PrismaService,
  opts: { role?: 'user' | 'admin'; credits?: number; email?: string } = {},
) {
  return prisma.user.create({
    data: {
      email: opts.email ?? `user-${next()}@test.local`,
      // Coste 4: el mínimo de bcrypt, para no pagar ~250 ms por usuario.
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      role: opts.role ?? 'user',
      emailVerified: true,
      generationCredits: opts.credits ?? 0,
    },
  });
}

// Catálogo mínimo del lanzamiento: un formato, un estilo activo y el producto
// Puzzle de lanzamiento (cualquier estilo) con una variante de ese formato.
export async function seedCatalog(prisma: PrismaService) {
  const format = await prisma.format.create({
    data: {
      name: `ratio_4_3_${next()}`,
      displayName: '4:3',
      aspectRatio: '4:3',
      width: 1184,
      height: 888,
    },
  });
  const style = await prisma.style.create({
    data: {
      name: `style-${next()}`,
      displayName: 'Acuarela',
      category: 'painting',
      strategyKey: 'style-driven-prompt',
      promptTemplate: 'A watercolor portrait of {{pet}}',
    },
  });
  const shopifyProductId = String(9_000_000 + seq);
  const shopifyVariantId = String(8_000_000 + seq);
  const product = await prisma.productReference.create({
    data: {
      shopifyProductId,
      name: 'puzzle',
      displayName: 'Puzzle',
      template: 'Puzzle',
      formatId: format.id,
      isLaunchProduct: true,
    },
  });
  const variant = await prisma.productFormatVariant.create({
    data: {
      productRefId: product.id,
      formatId: format.id,
      shopifyVariantId,
      shopifyVariantTitle: 'Perro',
    },
  });
  return { format, style, product, variant };
}

export async function seedPetWithPhoto(prisma: PrismaService, userId: string) {
  const pet = await prisma.pet.create({
    data: { userId, name: 'Toby', species: 'dog' },
  });
  // Con MOCK_AI el "resultado" es esta misma URL: no se toca Cloudinary.
  const photo = await prisma.petPhoto.create({
    data: {
      petId: pet.id,
      photoUrl: 'https://example.test/toby.jpg',
      photoStorageKey: 'pets/toby.jpg',
      isPrimary: true,
    },
  });
  return { pet, photo };
}

export async function seedGeneration(
  prisma: PrismaService,
  userId: string,
  styleId: string,
  status = 'completed',
) {
  return prisma.generation.create({
    data: {
      userId,
      styleId,
      type: 'image',
      status,
      prompt: 'dog',
      provider: 'fal',
      resultUrl: 'https://example.test/art.png',
    },
  });
}

// Login por password. Solo lo admite el rol admin (los clientes entran por
// Google), así que es el camino real únicamente para admins. Devuelve las
// cookies para reenviarlas con .set('Cookie', ...).
export async function loginAdmin(
  app: NestExpressApplication,
  email: string,
): Promise<string[]> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  return cookiesFrom(res);
}

// Sesión de un cliente sin pasar por Google: un access token firmado con el
// secreto de test, igual al que emite AuthService tras el login.
export async function userSession(user: {
  id: string;
  email: string;
  role: string;
}): Promise<string[]> {
  const token = await new JwtService().signAsync(
    { sub: user.id, email: user.email, role: user.role },
    { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
  );
  return [`accessToken=${token}`];
}

export function cookiesFrom(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // Solo "nombre=valor"; los atributos (Path, HttpOnly…) no se reenvían.
  return list.map((c) => c.split(';')[0]);
}

export function cookieValue(cookies: string[], name: string): string | null {
  const hit = cookies.find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}
