import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccountStatusService } from './account-status.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import { GuestAccountService } from './guest-account.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [PrismaModule, CreditsModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    AccountStatusService,
    AccountLifecycleService,
    GuestAccountService,
  ],
  exports: [UsersService, AccountStatusService, GuestAccountService],
})
export class UsersModule {}
