import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Configuración de la app compartida por main.ts y los tests de integración.
// El orden importa (express.raw antes del prefijo global): vive aquí, y no
// dentro de bootstrap(), para que el test del webhook firmado ejercite
// exactamente el mismo cableado que producción.
export function configureApp(app: NestExpressApplication): void {
  // Detrás del proxy de la plataforma (Railway, Render, Nginx) req.ip devolvería
  // la IP del balanceador; sin esto el geoip de las sesiones registra basura.
  app.set('trust proxy', 1);

  // Raw body required for Shopify HMAC webhook verification.
  // Must be registered before setGlobalPrefix and cookieParser so the
  // route-specific middleware takes precedence over the global JSON parser.
  app.use('/api/webhooks/shopify', express.raw({ type: '*/*' }));

  // Global prefix
  app.setGlobalPrefix('api');

  // Cookie parser for httpOnly cookies
  app.use(cookieParser());

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that do not have any decorators
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter()); // HTTP exception filter for consistent error responses
  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(), // Logging interceptor for request/response logging for monitoring
    new TransformInterceptor(), // Transform interceptor for consistent response formatting
  );
}
