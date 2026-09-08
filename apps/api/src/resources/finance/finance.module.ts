import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FinanceController } from "./controllers/finance.controller";
import {
  Entry,
  MonthSettings,
  Profile,
  Recurrence,
  Tag,
} from "./models/finance.entity";
import { FinanceService } from "./services/finance.service";
@Module({
  imports: [
    TypeOrmModule.forFeature([Entry, Profile, Recurrence, Tag, MonthSettings]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
