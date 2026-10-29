import { Module } from '@nestjs/common';

import { GenerationsModule } from '../generations/generations.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { AdminPrintProjectsController } from './admin-print-projects.controller';
import { PrintProjectsService } from './print-projects.service';
import { PrintProjectEnhancementService } from './print-project-enhancement.service';

@Module({
  imports: [GenerationsModule, ExpensesModule],
  controllers: [AdminPrintProjectsController],
  providers: [PrintProjectsService, PrintProjectEnhancementService],
  exports: [PrintProjectsService],
})
export class PrintStudioModule {}
