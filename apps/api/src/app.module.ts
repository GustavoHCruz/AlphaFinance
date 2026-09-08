import { Controller, Get, Module, Redirect } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { InitialSchema1788650000000 } from "./database/migrations/1788650000000-initial-schema";
import { MonthlyPlanning1788740000000 } from "./database/migrations/1788740000000-monthly-planning";
import { BillPaymentsAndTagOrder1788750000000 } from "./database/migrations/1788750000000-bill-payments-and-tag-order";
import { FinanceModule } from "./resources/finance/finance.module";

import { InvestmentChecklist1788760000000 } from "./database/migrations/1788760000000-investment-checklist";

@Controller()
class AppController {
  constructor(private readonly db: DataSource) {}
  @Get() @Redirect("/docs", 302) root() {}
  @Get("health") async health() {
    await this.db.query("SELECT 1");
    return { status: "ok" };
  }
}
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DATABASE_HOST || "localhost",
      port: Number(process.env.POSTGRES_PORT || 5432),
      username: process.env.POSTGRES_USER || "alphafinance",
      password: process.env.POSTGRES_PASSWORD || "alphafinance",
      database: process.env.POSTGRES_DB || "alphafinance",
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: true,
      migrations: [
        InitialSchema1788650000000,
        MonthlyPlanning1788740000000,
        BillPaymentsAndTagOrder1788750000000,
        InvestmentChecklist1788760000000,
      ],
      retryAttempts: 15,
    }),
    FinanceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
