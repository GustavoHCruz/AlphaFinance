import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  EntryDto,
  OrderTagsDto,
  ProfileDto,
  TagDto,
  UpdateEntryDto,
} from "../models/finance.dto";
import {
  Entry,
  MonthSettings,
  Profile,
  Recurrence,
  Tag,
} from "../models/finance.entity";

@Injectable()
export class FinanceService {
  constructor(private readonly db: DataSource) {}
  private async required<T>(value: T | null): Promise<T> {
    if (!value) throw new NotFoundException("Not found");
    return value;
  }
  private async lock(em: EntityManager) {
    await em.query("SELECT pg_advisory_xact_lock(7419201)");
  }
  private async references(em: EntityManager, dto: Partial<EntryDto>) {
    if (dto.kind === "investment" && dto.categoryId)
      throw new BadRequestException("Investments do not have categories");
    if (dto.kind === "expense" && dto.recurring)
      throw new BadRequestException("Everyday expenses cannot repeat");
    if (
      !["bill", "investment"].includes(dto.kind!) &&
      (dto.expectedAmount != null || dto.paidAmount != null)
    )
      throw new BadRequestException(
        "Expected and actual amounts require a bill or investment",
      );
    if (
      dto.categoryId &&
      !(await em.exists(Tag, {
        where: { id: dto.categoryId, type: "category", kind: dto.kind },
      }))
    )
      throw new BadRequestException("Invalid category");
    for (const id of dto.labelIds || [])
      if (
        !(await em.exists(Tag, {
          where: { id, type: "label", kind: dto.kind },
        }))
      )
        throw new BadRequestException("Invalid label");
    if (dto.amount !== undefined && dto.amount < 0 && dto.kind !== "income")
      throw new BadRequestException(
        "Negative values are only valid for income adjustments",
      );
    if (dto.percentageBps != null && dto.kind !== "investment")
      throw new BadRequestException("Percentages require an investment");
    if (dto.estimated && dto.kind !== "investment")
      throw new BadRequestException("Estimates require an investment");
    if (dto.incomeCategoryId) {
      if (
        dto.percentageBps == null ||
        !(await em.exists(Tag, {
          where: { id: dto.incomeCategoryId, type: "category", kind: "income" },
        }))
      )
        throw new BadRequestException(
          "The calculation base must be an income category",
        );
    }
  }
  private async materialize(em: EntityManager, month: string) {
    // Generate every intervening month, including months the user never opened.
    // The unique key also retains deleted occurrences as tombstones.
    await em.query(
      `INSERT INTO entries (description, kind, amount, date, month, "categoryId", "labelIds", method, "recurrenceId", "percentageBps", "incomeCategoryId", estimated, "expectedAmount")
      SELECT r.description, r.kind, r.amount,
        (m + (LEAST(r.day, EXTRACT(DAY FROM m + interval '1 month - 1 day')::int) - 1) * interval '1 day')::date,
        to_char(m, 'YYYY-MM'), r."categoryId", r."labelIds", r.method, r.id, r."percentageBps", r."incomeCategoryId", r.kind = 'investment', CASE WHEN r.kind IN ('bill', 'investment') THEN r.amount ELSE NULL END
      FROM recurrences r
      CROSS JOIN LATERAL generate_series((r."startMonth" || '-01')::date,
        LEAST(($1 || '-01')::date, (COALESCE(r."endMonth", $1) || '-01')::date), interval '1 month') m
      ON CONFLICT ("recurrenceId", month) DO NOTHING`,
      [month],
    );
  }
  private previousMonth(month: string) {
    const d = new Date(`${month}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  }
  private async recalculate(em: EntityManager, month: string) {
    const [horizon] = await em.query(
      `SELECT GREATEST($1, MAX(month)) AS month FROM (
      SELECT month FROM entries WHERE NOT deleted UNION SELECT month FROM month_settings WHERE carryover
    ) months`,
      [month],
    );
    await this.materialize(em, horizon.month || month);
    await em.query(`INSERT INTO entries (description, kind, amount, date, month, "isCarryover")
      SELECT 'Previous month balance', 'income', 0, (month || '-01')::date, month, true
      FROM month_settings WHERE carryover
      ON CONFLICT (month) WHERE "isCarryover" DO UPDATE SET deleted = false`);
    const all = await em.find(Entry, {
      where: { deleted: false },
      order: { month: "ASC", date: "DESC", description: "ASC" },
    });
    const grouped = new Map<string, Entry[]>();
    for (const entry of all)
      grouped.set(entry.month, [...(grouped.get(entry.month) || []), entry]);
    const balances = new Map<string, number>();
    for (const [m, rows] of grouped) {
      const opening = rows.find((e) => e.isCarryover);
      if (opening) {
        const amount = balances.get(this.previousMonth(m)) || 0;
        if (Math.abs(amount) > 1000000000)
          throw new BadRequestException(
            "Opening balance exceeds the supported amount",
          );
        if (opening.amount !== amount)
          await em.update(Entry, opening.id, { amount });
        opening.amount = amount;
      }
      const income = rows.filter((e) => e.kind === "income");
      for (const entry of rows.filter(
        (e) => e.estimated && e.percentageBps != null,
      )) {
        const base = income
          .filter(
            (e) =>
              !entry.incomeCategoryId ||
              e.categoryId === entry.incomeCategoryId,
          )
          .reduce((sum, e) => sum + e.amount, 0);
        const amount = Math.round(
          (Math.max(0, base) * entry.percentageBps!) / 10000,
        );
        if (amount > 1000000000)
          throw new BadRequestException(
            "Estimated investment exceeds the supported amount",
          );
        if (entry.amount !== amount)
          await em.update(Entry, entry.id, { amount, expectedAmount: amount });
        entry.amount = amount;
        entry.expectedAmount = amount;
      }
      balances.set(
        m,
        rows.reduce(
          (sum, e) =>
            sum +
            (e.kind === "income"
              ? e.amount
              : e.kind === "bill" && !e.done
                ? 0
                : -e.amount),
          0,
        ),
      );
    }
    return { all, balances };
  }
  async setCarryover(month: string, enabled: boolean) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      await em.save(MonthSettings, { month, carryover: enabled });
      if (!enabled)
        await em.update(Entry, { month, isCarryover: true }, { deleted: true });
      await this.recalculate(em, month);
      return { enabled };
    });
  }
  async dashboard(month: string) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(`${month}-01T12:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() - 5 + i);
        return d.toISOString().slice(0, 7);
      });
      const { all, balances } = await this.recalculate(em, month);
      const entries = all
        .filter((e) => e.month === month)
        .sort(
          (a, b) =>
            Number(b.isCarryover) - Number(a.isCarryover) ||
            b.date.localeCompare(a.date) ||
            a.description.localeCompare(b.description),
        );
      const total = (rows: Entry[], kind: string) =>
        rows
          .filter((e) => e.kind === kind)
          .reduce((sum, e) => sum + e.amount, 0);
      const summarize = (rows: Entry[]) => {
        const income = total(rows, "income"),
          expenses = total(rows, "expense"),
          bills = total(rows, "bill"),
          invested = total(rows, "investment");
        const unpaid = rows
          .filter((e) => e.kind === "bill" && !e.done)
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          income,
          expenses,
          bills,
          expectedBills: rows
            .filter((e) => e.kind === "bill")
            .reduce((sum, e) => sum + (e.expectedAmount ?? e.amount), 0),
          invested,
          estimatedInvested: rows
            .filter((e) => e.estimated)
            .reduce((sum, e) => sum + e.amount, 0),
          unpaid,
          remaining: income - expenses - (bills - unpaid) - invested,
        };
      };
      const profile =
        (await em.findOneBy(Profile, { id: 1 })) ||
        (await em.save(Profile, em.create(Profile, { id: 1 })));
      return {
        month,
        carryoverEnabled:
          (await em.findOneBy(MonthSettings, { month }))?.carryover || false,
        previousBalance: balances.get(this.previousMonth(month)) || 0,
        entries,
        profile,
        tags: await em.find(Tag, {
          order: { position: "ASC", name: "ASC", id: "ASC" },
        }),
        recurrences: await em.find(Recurrence),
        summary: summarize(entries),
        history: months.map((m) => ({
          month: m,
          ...summarize(all.filter((e) => e.month === m)),
        })),
      };
    });
  }
  async createEntry(dto: EntryDto) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      await this.references(em, dto);
      const { recurring, ...fields } = this.billValues(dto);
      fields.estimated = fields.kind === "investment" && !fields.done;
      let recurrenceId: string | null = null;
      if (recurring) {
        const { date, done, estimated, expectedAmount, paidAmount, ...base } =
          fields;
        const r = await em.save(
          Recurrence,
          em.create(Recurrence, {
            ...base,
            amount: ["bill", "investment"].includes(fields.kind)
              ? fields.expectedAmount!
              : fields.amount,
            startMonth: date.slice(0, 7),
            day: Number(date.slice(8)),
          }),
        );
        recurrenceId = r.id;
      }
      const created = await em.save(
        Entry,
        em.create(Entry, {
          ...fields,
          month: dto.date.slice(0, 7),
          recurrenceId,
        }),
      );
      await this.recalculate(em, created.month);
      return em.findOneByOrFail(Entry, { id: created.id });
    });
  }
  async updateEntry(id: string, dto: UpdateEntryDto) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const entry = await this.required(
        await em.findOneBy(Entry, { id, deleted: false }),
      );
      if (entry.isCarryover)
        throw new BadRequestException(
          "Manage opening balance using the month option",
        );
      if (dto.recurring !== undefined)
        throw new BadRequestException(
          "Recurrence can only be set when creating an entry",
        );
      if (
        entry.recurrenceId &&
        dto.date &&
        dto.date.slice(0, 7) !== entry.month
      )
        throw new BadRequestException(
          "Recurring entries must stay in their original month",
        );
      await this.references(em, { ...entry, ...dto });
      const updated = await em.save(
        Entry,
        this.billValues({
          ...entry,
          ...dto,
          month: (dto.date || entry.date).slice(0, 7),
        }),
      );
      if (
        entry.kind === "bill" &&
        updated.kind === "bill" &&
        entry.recurrenceId &&
        dto.expectedAmount != null
      ) {
        await em.update(Recurrence, entry.recurrenceId, {
          amount: dto.expectedAmount,
        });
        await em.query(
          `UPDATE entries SET "expectedAmount" = $1, amount = CASE WHEN done THEN amount ELSE $1 END WHERE "recurrenceId" = $2 AND kind = 'bill'`,
          [dto.expectedAmount, entry.recurrenceId],
        );
      }
      await this.recalculate(em, updated.month);
      return em.findOneByOrFail(Entry, { id });
    });
  }
  async deleteEntry(id: string) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const entry = await this.required(
        await em.findOneBy(Entry, { id, deleted: false }),
      );
      if (entry.isCarryover)
        throw new BadRequestException(
          "Manage opening balance using the month option",
        );
      await em.update(Entry, entry.id, { deleted: true });
      await this.recalculate(em, entry.month);
      return { ok: true };
    });
  }
  async stopRecurrence(id: string, month: string) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const r = await this.required(await em.findOneBy(Recurrence, { id }));
      const d = new Date(`${month}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      const endMonth = d.toISOString().slice(0, 7);
      await em.update(Recurrence, r.id, {
        endMonth: r.endMonth && r.endMonth < endMonth ? r.endMonth : endMonth,
      });
      await em
        .createQueryBuilder()
        .update(Entry)
        .set({ deleted: true })
        .where('"recurrenceId" = :id AND month >= :month', { id, month })
        .execute();
      await this.recalculate(em, month);
      return { ok: true };
    });
  }
  async saveTag(dto: TagDto, id?: string) {
    if (dto.kind === "investment" && dto.type === "category")
      throw new BadRequestException("Investments only support labels");
    return this.db.transaction(async (em) => {
      await this.lock(em);
      if (id) {
        const old = await this.required(await em.findOneBy(Tag, { id }));
        if (old.type !== dto.type || old.kind !== dto.kind)
          throw new BadRequestException(
            "Cannot change tag type or transaction kind",
          );
        return em.save(Tag, { ...old, ...dto });
      }
      return em.save(
        Tag,
        em.create(Tag, {
          ...dto,
          position: await this.nextTagPosition(em, dto),
        }),
      );
    });
  }
  private async nextTagPosition(
    em: EntityManager,
    scope: Pick<Tag, "kind" | "type">,
  ) {
    const last = await em.findOne(Tag, {
      where: { kind: scope.kind, type: scope.type },
      order: { position: "DESC" },
    });
    return (last?.position ?? -1) + 1;
  }
  async copyTag(id: string, kind: Tag["kind"]) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const source = await this.required(await em.findOneBy(Tag, { id }));
      if (source.kind === kind)
        throw new BadRequestException("Choose a different kind");
      const { name, color, type } = source;
      if (kind === "investment" && type === "category")
        throw new BadRequestException("Investments only support labels");
      return em.save(
        Tag,
        em.create(Tag, {
          name,
          color,
          type,
          kind,
          position: await this.nextTagPosition(em, { type, kind }),
        }),
      );
    });
  }
  async orderTags(dto: OrderTagsDto) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const tags = await em.find(Tag, {
        where: { kind: dto.kind, type: dto.type },
      });
      if (
        tags.length !== dto.ids.length ||
        tags.some((tag) => !dto.ids.includes(tag.id))
      )
        throw new BadRequestException(
          "Order must include every tag in the selected scope",
        );
      for (const [position, id] of dto.ids.entries())
        await em.update(Tag, id, { position });
      return { ok: true };
    });
  }
  private billValues<T extends EntryDto>(dto: T): T {
    if (dto.kind === "investment") {
      const done = dto.done ?? dto.estimated === false;
      const expectedAmount = dto.expectedAmount ?? dto.amount;
      if (done && dto.paidAmount == null)
        throw new BadRequestException("ACTUAL_INVESTMENT_REQUIRED");
      return {
        ...dto,
        categoryId: null,
        method: "transfer",
        done,
        estimated: !done,
        expectedAmount,
        paidAmount: done ? dto.paidAmount : null,
        amount: done ? dto.paidAmount! : expectedAmount,
      };
    }
    if (dto.kind !== "bill") return dto;
    const expectedAmount = dto.expectedAmount ?? dto.amount;
    if (dto.done && dto.paidAmount == null)
      throw new BadRequestException("PAID_AMOUNT_REQUIRED");
    return {
      ...dto,
      expectedAmount,
      paidAmount: dto.done ? dto.paidAmount : null,
      amount: dto.done ? dto.paidAmount! : expectedAmount,
    };
  }
  async deleteTag(id: string) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      await this.required(await em.findOneBy(Tag, { id }));
      if (
        (await em.exists(Entry, { where: { incomeCategoryId: id } })) ||
        (await em.exists(Recurrence, { where: { incomeCategoryId: id } }))
      )
        throw new BadRequestException("CATEGORY_IN_USE_BY_PERCENTAGE");
      for (const table of ["entries", "recurrences"]) {
        await em.query(
          `UPDATE ${table} SET "categoryId" = NULL WHERE "categoryId" = $1`,
          [id],
        );
        await em.query(
          `UPDATE ${table} SET "labelIds" = "labelIds" - $1::text WHERE "labelIds" ? $1`,
          [id],
        );
      }
      await em.delete(Tag, id);
      return { ok: true };
    });
  }
  async saveProfile(dto: ProfileDto) {
    return this.db.manager.save(Profile, { id: 1, ...dto });
  }
}
