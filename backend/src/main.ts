import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

// Global /api prefix
// Global validation pipe
// Global filters and interceptors
// Request / response interceptors
// CORS configuration
// Swagger documentation

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProduction
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug'],
  });

  // trust proxy, raw body del webhook, prefijo /api, cookies, pipes, filtros
  // e interceptores: ver app.setup.ts.
  configureApp(app);

  // CORS. Outside production the local dev origins stay allowed on top of
  // FRONTEND_URL, so pointing that variable at some other host (a preview
  // deploy, a device on the LAN) can't lock out http://localhost:3000.
  const localOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  // FRONTEND_URL admite varios orígenes separados por comas (el dominio real y
  // el de staging, p. ej.). Cada uno se compara por igualdad exacta contra la
  // cabecera Origin, así que van enteros y con esquema: 'clawpuzzle.com' y
  // 'www.clawpuzzle.com' son dos orígenes distintos y hay que listar el que se
  // sirva. No pongas aquí un host fuera de .clawpuzzle.com esperando que la
  // sesión funcione: la cookie es sameSite=lax y el navegador la descarta en
  // peticiones cross-site aunque el CORS pase.
  //
  // Origin headers never carry a trailing slash; .env values sometimes do.
  const configuredOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = [
    ...configuredOrigins,
    ...(isProduction ? [] : localOrigins),
  ];

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : localOrigins,
    credentials: true,
  });

  // Swagger documentation. En producción queda apagado salvo que se active a
  // mano: /api/docs publica toda la superficie de la API (incluidos los
  // endpoints de admin) sin pedir credenciales.
  const swaggerEnabled = process.env.SWAGGER_ENABLED
    ? process.env.SWAGGER_ENABLED === 'true'
    : !isProduction;

  const config = new DocumentBuilder()
    .setTitle('ClawPuzzle API')
    .setDescription(
      'API for AI-generated pet art printed on custom jigsaw puzzles',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('pets', 'Pet management')
    .addTag('styles', 'Art styles')
    .addTag('generations', 'Image and video generation')
    .addTag('credits', 'Credit management')
    .build();

  // create swagger document api at /api/docs
  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;

  // '0.0.0.0' es obligatorio dentro de un contenedor: el default de Node solo
  // escucharía en la interfaz local y el healthcheck de la plataforma fallaría.
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on port ${port}`);
  if (swaggerEnabled) {
    console.log(`📚 Swagger docs available at /api/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('❌ Error starting application:', err);
  process.exit(1);
});
