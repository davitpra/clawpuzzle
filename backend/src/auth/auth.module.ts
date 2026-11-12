import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthCleanupService } from './auth-cleanup.service';
import { TurnstileService } from './turnstile.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    CreditsModule,
    // Por AccountStatusService (el login reactiva las cuentas dadas de baja por
    // inactividad) y GuestAccountService (sesiones de invitado). No hay ciclo:
    // UsersModule solo depende de Prisma y Credits.
    UsersModule,
    JwtModule.register({}), // Configuration is done in the service using ConfigService
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthCleanupService, TurnstileService],
  exports: [AuthService],
})
export class AuthModule {}
