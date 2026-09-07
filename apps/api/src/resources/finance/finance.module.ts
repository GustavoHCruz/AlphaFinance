import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, Profile, Recurrence, Tag, MonthSettings } from './models/finance.entity';
import { FinanceService } from './services/finance.service';
import { FinanceController } from './controllers/finance.controller';
@Module({
  imports: [TypeOrmModule.forFeature([Entry, Profile, Recurrence, Tag, MonthSettings])],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
