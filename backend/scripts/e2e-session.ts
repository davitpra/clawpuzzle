import 'dotenv/config';
import { createHash, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { v2 as cloudinary } from 'cloudinary';
import jwtConfig from '../src/config/jwt.config';

// Sesión del smoke test de Playwright (frontend/e2e). Los clientes solo entran
// por Google, que no se automatiza: este script crea un usuario de prueba en la
// base de desarrollo y le emite tokens igual que AuthService.generateTokens
// (mismo payload, mismos secretos, refresh guardado como hash SHA-256).
//
//   npx ts-node --transpile-only scripts/e2e-session.ts create   → JSON por stdout
//   npx ts-node --transpile-only scripts/e2e-session.ts cleanup
//
// `cleanup` borra el usuario (cascada: mascotas, generaciones, tokens) y las
// fotos que el test subió a Cloudinary, que la cascada no alcanza.

const E2E_EMAIL = 'e2e-smoke@clawpuzzle.test';
const E2E_CREDITS = 5;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function cleanup(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: E2E_EMAIL },
    select: {
      id: true,
      pets: { select: { photos: { select: { photoStorageKey: true } } } },
    },
  });
  if (!user) return;

  const keys = user.pets.flatMap((p) =>
    p.photos.map((ph) => ph.photoStorageKey),
  );
  if (keys.length > 0 && process.env.CLOUDINARY_API_KEY) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    await Promise.allSettled(keys.map((k) => cloudinary.uploader.destroy(k)));
  }

  await prisma.user.delete({ where: { id: user.id } });
}

async function create() {
  // Siempre desde cero: una ejecución anterior abortada no deja estado.
  await cleanup();

  const user = await prisma.user.create({
    data: {
      email: E2E_EMAIL,
      fullName: 'E2E Smoke',
      role: 'user',
      emailVerified: true,
      generationCredits: E2E_CREDITS,
      creditTransactions: {
        create: {
          amount: E2E_CREDITS,
          reason: 'admin_grant',
          note: 'e2e smoke',
        },
      },
    },
  });

  const cfg = jwtConfig();
  const jwt = new JwtService();
  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = await jwt.signAsync(payload, {
    secret: cfg.accessSecret,
    expiresIn: cfg.accessExpiresIn,
  });
  const refreshToken = await jwt.signAsync(payload, {
    secret: cfg.refreshSecret,
    expiresIn: cfg.refreshExpiresIn,
    jwtid: randomUUID(),
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt,
      userAgent: 'playwright',
    },
  });

  return { userId: user.id, accessToken, refreshToken };
}

async function main() {
  const command = process.argv[2];
  if (command === 'create') {
    process.stdout.write(JSON.stringify(await create()));
  } else if (command === 'cleanup') {
    await cleanup();
  } else {
    throw new Error('Uso: e2e-session.ts create|cleanup');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
