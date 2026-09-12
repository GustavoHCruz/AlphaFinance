import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { calculateEstimatedInvestment, installmentAmounts, monthFromDate, previousMonth, shiftDateByMonths, summarize, validateDraft } from "../domain/finance";
import type { AlphaFinanceSnapshot, Dashboard, InboxEvent, NativeNotificationCandidate, PaymentMethod, Profile, Recurrence, Tag, Transaction, TransactionDraft, TransactionKind } from "../domain/models";
import type { FinanceRepository } from "../domain/repositories";
import { checkDatabaseIntegrity, getDatabase } from "./database";

type Row = Record<string, unknown>;
const bool = (value: unknown) => Number(value) === 1;
const nullable = <T>(value: T | null | undefined): T | null => value ?? null;
const now = () => new Date().toISOString();
const id = () => Crypto.randomUUID();
const labels = (value: unknown): string[] => {
  try { return typeof value === "string" ? JSON.parse(value) : []; } catch { return []; }
};

function mapTransaction(row: Row): Transaction {
  return {
    id: String(row.id), description: String(row.description), kind: row.kind as TransactionKind,
    amount: Number(row.amount), date: String(row.date), month: String(row.month), done: bool(row.done),
    categoryId: nullable(row.category_id as string | null), labelIds: labels(row.label_ids),
    method: row.method as PaymentMethod, recurrenceId: nullable(row.recurrence_id as string | null),
    deleted: bool(row.deleted), percentageBps: nullable(row.percentage_bps as number | null),
    incomeCategoryId: nullable(row.income_category_id as string | null), estimated: bool(row.estimated),
    isCarryover: bool(row.is_carryover), expectedAmount: nullable(row.expected_amount as number | null),
    paidAmount: nullable(row.paid_amount as number | null), installmentGroupId: nullable(row.installment_group_id as string | null),
    installmentNumber: nullable(row.installment_number as number | null), installmentCount: nullable(row.installment_count as number | null),
    inboxEventId: nullable(row.inbox_event_id as string | null), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapRecurrence(row: Row): Recurrence {
  return {
    id: String(row.id), description: String(row.description), kind: row.kind as TransactionKind,
    amount: Number(row.amount), day: Number(row.day), startMonth: String(row.start_month),
    endMonth: nullable(row.end_month as string | null), categoryId: nullable(row.category_id as string | null),
    labelIds: labels(row.label_ids), method: row.method as PaymentMethod,
    percentageBps: nullable(row.percentage_bps as number | null), incomeCategoryId: nullable(row.income_category_id as string | null),
  };
}

function mapTag(row: Row): Tag {
  return { id: String(row.id), name: String(row.name), color: String(row.color), type: row.type as Tag["type"], kind: row.kind as TransactionKind, position: Number(row.position) };
}
function mapInbox(row: Row): InboxEvent {
  return { id: String(row.id), source: row.source as InboxEvent["source"], sourceEventId: nullable(row.source_event_id as string | null), institution: nullable(row.institution as string | null), amount: nullable(row.amount as number | null), suggestedKind: nullable(row.suggested_kind as TransactionKind | null), suggestedMethod: nullable(row.suggested_method as PaymentMethod | null), description: nullable(row.description as string | null), occurredAt: String(row.occurred_at), status: row.status as InboxEvent["status"], confidence: nullable(row.confidence as number | null), transactionId: nullable(row.transaction_id as string | null), createdAt: String(row.created_at), reviewedAt: nullable(row.reviewed_at as string | null) };
}

const transactionSelect = `SELECT t.*,
  COALESCE((SELECT json_group_array(label_id) FROM transaction_labels WHERE transaction_id=t.id),'[]') label_ids
  FROM transactions t`;
const recurrenceSelect = `SELECT r.*,
  COALESCE((SELECT json_group_array(label_id) FROM recurrence_labels WHERE recurrence_id=r.id),'[]') label_ids
  FROM recurrences r`;

function monthsBetween(start: string, end: string): string[] {
  const values: string[] = [];
  let current = start;
  while (current <= end && values.length < 2_400) {
    values.push(current);
    const date = new Date(`${current}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    current = date.toISOString().slice(0, 7);
  }
  return values;
}

export class SQLiteFinanceRepository implements FinanceRepository {
  private db!: SQLiteDatabase;

  async initialize(): Promise<void> {
    this.db = await getDatabase();
  }

  private async ensureReady() { if (!this.db) await this.initialize(); }

  private async validateReferences(db: SQLiteDatabase, draft: TransactionDraft) {
    if (draft.categoryId) {
      const tag = await db.getFirstAsync<Row>("SELECT id FROM tags WHERE id=? AND type='category' AND kind=?", draft.categoryId, draft.kind);
      if (!tag) throw new Error("Categoria incompatível com o tipo da movimentação.");
    }
    for (const labelId of draft.labelIds ?? []) {
      const tag = await db.getFirstAsync<Row>("SELECT id FROM tags WHERE id=? AND type='label' AND kind=?", labelId, draft.kind);
      if (!tag) throw new Error("Etiqueta incompatível com o tipo da movimentação.");
    }
  }

  private trackedValues(draft: TransactionDraft) {
    if (draft.kind === "investment") {
      const done = draft.done ?? false;
      const expected = draft.expectedAmount ?? draft.amount;
      if (done && draft.paidAmount == null) throw new Error("Informe o valor efetivamente investido.");
      return { amount: done ? draft.paidAmount! : expected, expectedAmount: expected, paidAmount: done ? draft.paidAmount! : null, done, estimated: !done };
    }
    if (draft.kind === "bill") {
      const done = draft.done ?? false;
      const expected = draft.expectedAmount ?? draft.amount;
      if (done && draft.paidAmount == null) throw new Error("Informe o valor efetivamente pago.");
      return { amount: done ? draft.paidAmount! : expected, expectedAmount: expected, paidAmount: done ? draft.paidAmount! : null, done, estimated: false };
    }
    return { amount: draft.amount, expectedAmount: null, paidAmount: null, done: true, estimated: false };
  }

  private async insertLabels(db: SQLiteDatabase, table: "transaction_labels" | "recurrence_labels", ownerColumn: "transaction_id" | "recurrence_id", ownerId: string, labelIds: string[]) {
    for (const labelId of labelIds) await db.runAsync(`INSERT INTO ${table} (${ownerColumn},label_id) VALUES (?,?)`, ownerId, labelId);
  }

  private async insertTransactionDraft(tx: SQLiteDatabase, draft: TransactionDraft): Promise<string[]> {
    await this.validateReferences(tx, draft);
    const createdIds: string[] = [];
    const count = draft.installmentCount ?? 1;
    const amounts = installmentAmounts(draft.amount, count);
    const installmentGroupId = count > 1 ? id() : null;
    let recurrenceId: string | null = null;
    if (draft.recurring) {
      recurrenceId = id();
      const tracked = this.trackedValues(draft);
      await tx.runAsync(`INSERT INTO recurrences (id,description,kind,amount,day,start_month,end_month,category_id,method,percentage_bps,income_category_id)
        VALUES (?,?,?,?,?,?,NULL,?,?,?,?)`, recurrenceId, draft.description, draft.kind,
        tracked.expectedAmount ?? tracked.amount, Number(draft.date.slice(8)), monthFromDate(draft.date),
        nullable(draft.categoryId), draft.method!, nullable(draft.percentageBps), nullable(draft.incomeCategoryId));
      await this.insertLabels(tx, "recurrence_labels", "recurrence_id", recurrenceId, draft.labelIds!);
    }
    for (let index = 0; index < count; index += 1) {
      const transactionId = id();
      const date = shiftDateByMonths(draft.date, index);
      const partDraft = { ...draft, amount: amounts[index], expectedAmount: count > 1 ? amounts[index] : draft.expectedAmount };
      const tracked = this.trackedValues(partDraft);
      const stamp = now();
      await tx.runAsync(`INSERT INTO transactions
        (id,description,kind,amount,date,month,done,category_id,method,recurrence_id,deleted,percentage_bps,income_category_id,estimated,is_carryover,expected_amount,paid_amount,installment_group_id,installment_number,installment_count,inbox_event_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,0,?,?,?,?,?,?,?,?)`,
        transactionId, draft.description, draft.kind, tracked.amount, date, monthFromDate(date), tracked.done ? 1 : 0,
        nullable(draft.categoryId), draft.method!, recurrenceId, nullable(draft.percentageBps), nullable(draft.incomeCategoryId), tracked.estimated ? 1 : 0,
        tracked.expectedAmount, tracked.paidAmount, installmentGroupId,
        count > 1 ? index + 1 : null, count > 1 ? count : null, nullable(draft.inboxEventId), stamp, stamp);
      await this.insertLabels(tx, "transaction_labels", "transaction_id", transactionId, draft.labelIds!);
      createdIds.push(transactionId);
    }
    return createdIds;
  }

  private async materializeAndRecalculate(db: SQLiteDatabase, requestedMonth: string) {
    const maxRow = await db.getFirstAsync<{ month: string | null }>("SELECT MAX(month) month FROM transactions WHERE deleted=0");
    const horizon = maxRow?.month && maxRow.month > requestedMonth ? maxRow.month : requestedMonth;
    const recurrenceRows = await db.getAllAsync<Row>(`${recurrenceSelect} ORDER BY start_month`);
    for (const row of recurrenceRows) {
      const recurrence = mapRecurrence(row);
      const end = recurrence.endMonth && recurrence.endMonth < horizon ? recurrence.endMonth : horizon;
      if (end < recurrence.startMonth) continue;
      for (const month of monthsBetween(recurrence.startMonth, end)) {
        const [year, monthNumber] = month.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, monthNumber, 0, 12)).getUTCDate();
        const date = `${month}-${String(Math.min(recurrence.day, lastDay)).padStart(2, "0")}`;
        const stamp = now();
        const transactionId = id();
        const result = await db.runAsync(`INSERT OR IGNORE INTO transactions
          (id,description,kind,amount,date,month,done,category_id,method,recurrence_id,percentage_bps,income_category_id,estimated,is_carryover,expected_amount,paid_amount,created_at,updated_at)
          VALUES (?,?,?,?,?,?,0,?,?,?,?,?, ?,0,?,NULL,?,?)`,
          transactionId, recurrence.description, recurrence.kind, recurrence.amount, date, month,
          recurrence.categoryId, recurrence.method, recurrence.id, recurrence.percentageBps,
          recurrence.incomeCategoryId, recurrence.kind === "investment" ? 1 : 0,
          recurrence.kind === "bill" || recurrence.kind === "investment" ? recurrence.amount : null,
          stamp, stamp);
        if (result.changes) await this.insertLabels(db, "transaction_labels", "transaction_id", transactionId, recurrence.labelIds);
      }
    }

    const carryoverMonths = await db.getAllAsync<{ month: string }>("SELECT month FROM month_settings WHERE carryover=1 ORDER BY month");
    for (const { month } of carryoverMonths) {
      const stamp = now();
      await db.runAsync(`INSERT OR IGNORE INTO transactions
        (id,description,kind,amount,date,month,done,method,deleted,estimated,is_carryover,created_at,updated_at)
        VALUES (?,'Saldo do mês anterior','income',0,?,?,1,'transfer',0,0,1,?,?)`, id(), `${month}-01`, month, stamp, stamp);
    }

    const all = (await db.getAllAsync<Row>(`${transactionSelect} WHERE t.deleted=0 ORDER BY t.month,t.date,t.id`)).map(mapTransaction);
    const grouped = new Map<string, Transaction[]>();
    for (const entry of all) grouped.set(entry.month, [...(grouped.get(entry.month) ?? []), entry]);
    const balances = new Map<string, number>();
    for (const [month, entries] of grouped) {
      const carryover = entries.find((entry) => entry.isCarryover);
      if (carryover) {
        carryover.amount = balances.get(previousMonth(month)) ?? 0;
        await db.runAsync("UPDATE transactions SET amount=?,updated_at=? WHERE id=?", carryover.amount, now(), carryover.id);
      }
      for (const entry of entries.filter((item) => item.estimated && item.percentageBps != null)) {
        const amount = calculateEstimatedInvestment(entries, entry.percentageBps!, entry.incomeCategoryId);
        entry.amount = amount;
        entry.expectedAmount = amount;
        await db.runAsync("UPDATE transactions SET amount=?,expected_amount=?,updated_at=? WHERE id=?", amount, amount, now(), entry.id);
      }
      balances.set(month, summarize(entries).remaining);
    }
  }

  async dashboard(month: string): Promise<Dashboard> {
    await this.ensureReady();
    await this.db.withExclusiveTransactionAsync((tx) => this.materializeAndRecalculate(tx, month));
    const entries = (await this.db.getAllAsync<Row>(`${transactionSelect} WHERE t.month=? AND t.deleted=0 ORDER BY t.is_carryover DESC,t.date DESC,t.description`, month)).map(mapTransaction);
    const tags = (await this.db.getAllAsync<Row>("SELECT * FROM tags ORDER BY position,name,id")).map(mapTag);
    const recurrences = (await this.db.getAllAsync<Row>(recurrenceSelect)).map(mapRecurrence);
    const profileRow = await this.db.getFirstAsync<Row>("SELECT locale,currency FROM profiles WHERE id=1");
    const profile = { locale: profileRow?.locale ?? "pt-BR", currency: profileRow?.currency ?? "BRL" } as Profile;
    const settings = await this.db.getFirstAsync<{ carryover: number }>("SELECT carryover FROM month_settings WHERE month=?", month);
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 5 + index); return date.toISOString().slice(0, 7);
    });
    const history: Dashboard["history"] = [];
    for (const historyMonth of months) {
      const rows = (await this.db.getAllAsync<Row>(`${transactionSelect} WHERE t.month=? AND t.deleted=0`, historyMonth)).map(mapTransaction);
      history.push({ month: historyMonth, ...summarize(rows) });
    }
    const previousRows = (await this.db.getAllAsync<Row>(`${transactionSelect} WHERE t.month=? AND t.deleted=0`, previousMonth(month))).map(mapTransaction);
    const pending = await this.db.getFirstAsync<{ count: number }>("SELECT COUNT(*) count FROM inbox_events WHERE status='PENDING'");
    return { month, carryoverEnabled: bool(settings?.carryover), previousBalance: summarize(previousRows).remaining, entries, tags, recurrences, profile, summary: summarize(entries), history, pendingInboxCount: pending?.count ?? 0 };
  }

  async createTransaction(input: TransactionDraft): Promise<Transaction[]> {
    await this.ensureReady();
    const draft = validateDraft(input);
    let createdIds: string[] = [];
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      createdIds = await this.insertTransactionDraft(tx, draft);
    });
    const placeholders = createdIds.map(() => "?").join(",");
    return (await this.db.getAllAsync<Row>(`${transactionSelect} WHERE t.id IN (${placeholders})`, createdIds)).map(mapTransaction);
  }

  async updateTransaction(transactionId: string, patch: Partial<TransactionDraft>): Promise<void> {
    await this.ensureReady();
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<Row>(`${transactionSelect} WHERE t.id=? AND t.deleted=0`, transactionId);
      if (!row) throw new Error("Movimentação não encontrada.");
      const existing = mapTransaction(row);
      if (existing.isCarryover) throw new Error("Gerencie o saldo anterior pela opção do mês.");
      const draft = validateDraft({ description: patch.description ?? existing.description, kind: patch.kind ?? existing.kind, amount: patch.amount ?? existing.amount, date: patch.date ?? existing.date, done: patch.done ?? existing.done, categoryId: patch.categoryId === undefined ? existing.categoryId : patch.categoryId, labelIds: patch.labelIds ?? existing.labelIds, method: patch.method ?? existing.method, percentageBps: patch.percentageBps === undefined ? existing.percentageBps : patch.percentageBps, incomeCategoryId: patch.incomeCategoryId === undefined ? existing.incomeCategoryId : patch.incomeCategoryId, expectedAmount: patch.expectedAmount === undefined ? existing.expectedAmount : patch.expectedAmount, paidAmount: patch.paidAmount === undefined ? existing.paidAmount : patch.paidAmount, installmentCount: 1, inboxEventId: existing.inboxEventId });
      if (existing.recurrenceId && draft.kind !== existing.kind) throw new Error("O tipo de uma recorrência não pode ser alterado.");
      if (existing.recurrenceId && monthFromDate(draft.date) !== existing.month) throw new Error("Uma ocorrência recorrente deve permanecer no mês original.");
      await this.validateReferences(tx, draft);
      const tracked = this.trackedValues(draft);
      await tx.runAsync(`UPDATE transactions SET description=?,kind=?,amount=?,date=?,month=?,done=?,category_id=?,method=?,percentage_bps=?,income_category_id=?,estimated=?,expected_amount=?,paid_amount=?,updated_at=? WHERE id=?`,
        draft.description, draft.kind, tracked.amount, draft.date, monthFromDate(draft.date), tracked.done ? 1 : 0, nullable(draft.categoryId), draft.method!, nullable(draft.percentageBps), nullable(draft.incomeCategoryId), tracked.estimated ? 1 : 0, tracked.expectedAmount, tracked.paidAmount, now(), transactionId);
      await tx.runAsync("DELETE FROM transaction_labels WHERE transaction_id=?", transactionId);
      await this.insertLabels(tx, "transaction_labels", "transaction_id", transactionId, draft.labelIds!);
      if (existing.recurrenceId) {
        await tx.runAsync(`UPDATE recurrences SET description=?,amount=?,day=?,category_id=?,method=?,percentage_bps=?,income_category_id=? WHERE id=?`, draft.description, tracked.expectedAmount ?? tracked.amount, Number(draft.date.slice(8)), nullable(draft.categoryId), draft.method!, nullable(draft.percentageBps), nullable(draft.incomeCategoryId), existing.recurrenceId);
        await tx.runAsync("DELETE FROM recurrence_labels WHERE recurrence_id=?", existing.recurrenceId);
        await this.insertLabels(tx, "recurrence_labels", "recurrence_id", existing.recurrenceId, draft.labelIds!);
        await tx.runAsync(`UPDATE transactions SET description=?,category_id=?,method=?,percentage_bps=?,income_category_id=?,updated_at=? WHERE recurrence_id=? AND month>?`, draft.description, nullable(draft.categoryId), draft.method!, nullable(draft.percentageBps), nullable(draft.incomeCategoryId), now(), existing.recurrenceId, existing.month);
      }
    });
  }

  async deleteTransaction(transactionId: string) { await this.ensureReady(); await this.db.runAsync("UPDATE transactions SET deleted=1,updated_at=? WHERE id=? AND is_carryover=0", now(), transactionId); }
  async setTransactionDone(transactionId: string, done: boolean, actualAmount?: number) {
    await this.ensureReady();
    const row = await this.db.getFirstAsync<Row>("SELECT kind,amount,expected_amount FROM transactions WHERE id=? AND deleted=0", transactionId);
    if (!row) throw new Error("Movimentação não encontrada.");
    if (done && (row.kind === "bill" || row.kind === "investment") && actualAmount == null) throw new Error("Informe o valor realizado.");
    const amount = done && actualAmount != null ? actualAmount : Number(row.expected_amount ?? row.amount);
    await this.db.runAsync("UPDATE transactions SET done=?,estimated=?,paid_amount=?,amount=?,updated_at=? WHERE id=?", done ? 1 : 0, row.kind === "investment" && !done ? 1 : 0, done ? actualAmount ?? null : null, amount, now(), transactionId);
  }
  async setCarryover(month: string, enabled: boolean) {
    await this.ensureReady();
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("INSERT INTO month_settings(month,carryover) VALUES (?,?) ON CONFLICT(month) DO UPDATE SET carryover=excluded.carryover", month, enabled ? 1 : 0);
      if (!enabled) await tx.runAsync("UPDATE transactions SET deleted=1,updated_at=? WHERE month=? AND is_carryover=1", now(), month);
      await this.materializeAndRecalculate(tx, month);
    });
  }
  async stopRecurrence(recurrenceId: string, fromMonth: string) {
    await this.ensureReady();
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("UPDATE recurrences SET end_month=? WHERE id=?", previousMonth(fromMonth), recurrenceId);
      await tx.runAsync("UPDATE transactions SET deleted=1,updated_at=? WHERE recurrence_id=? AND month>=?", now(), recurrenceId, fromMonth);
    });
  }

  async saveTag(tag: Omit<Tag, "id" | "position"> & { id?: string }) {
    await this.ensureReady();
    if (tag.kind === "investment" && tag.type === "category") throw new Error("Investimentos usam apenas etiquetas.");
    if (tag.id) await this.db.runAsync("UPDATE tags SET name=?,color=? WHERE id=?", tag.name.trim(), tag.color, tag.id);
    else {
      const row = await this.db.getFirstAsync<{ position: number | null }>("SELECT MAX(position) position FROM tags WHERE type=? AND kind=?", tag.type, tag.kind);
      await this.db.runAsync("INSERT INTO tags(id,name,color,type,kind,position) VALUES (?,?,?,?,?,?)", id(), tag.name.trim(), tag.color, tag.type, tag.kind, (row?.position ?? -1) + 1);
    }
  }
  async deleteTag(tagId: string) {
    await this.ensureReady();
    const used = await this.db.getFirstAsync("SELECT id FROM transactions WHERE income_category_id=? UNION SELECT id FROM recurrences WHERE income_category_id=? LIMIT 1", tagId, tagId);
    if (used) throw new Error("Categoria usada como base percentual; altere os investimentos primeiro.");
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("UPDATE transactions SET category_id=NULL WHERE category_id=?", tagId);
      await tx.runAsync("UPDATE recurrences SET category_id=NULL WHERE category_id=?", tagId);
      await tx.runAsync("DELETE FROM tags WHERE id=?", tagId);
    });
  }
  async saveProfile(profile: Profile) { await this.ensureReady(); await this.db.runAsync("UPDATE profiles SET locale=?,currency=? WHERE id=1", profile.locale, profile.currency); }

  async enqueueNotification(candidate: NativeNotificationCandidate) {
    await this.ensureReady();
    await this.db.runAsync(`INSERT OR IGNORE INTO inbox_events (id,source,source_event_id,institution,amount,suggested_kind,suggested_method,description,occurred_at,status,confidence,created_at)
      VALUES (?,'ANDROID_NOTIFICATION',?,?,?,?,?,?,?,'PENDING',?,?)`, id(), candidate.sourceEventId, candidate.institution, candidate.amount, candidate.suggestedKind, candidate.suggestedMethod, candidate.description, candidate.occurredAt, candidate.confidence, now());
  }
  async listInbox(status: InboxEvent["status"] = "PENDING") { await this.ensureReady(); return (await this.db.getAllAsync<Row>("SELECT * FROM inbox_events WHERE status=? ORDER BY occurred_at DESC", status)).map(mapInbox); }
  async acceptInbox(inboxId: string, draft: TransactionDraft) {
    await this.ensureReady();
    const validated = validateDraft({ ...draft, inboxEventId: inboxId });
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      const event = await tx.getFirstAsync<Row>("SELECT id FROM inbox_events WHERE id=? AND status='PENDING'", inboxId);
      if (!event) throw new Error("Evento do Inbox não está mais pendente.");
      const createdIds = await this.insertTransactionDraft(tx, validated);
      const result = await tx.runAsync("UPDATE inbox_events SET status='ACCEPTED',transaction_id=?,reviewed_at=? WHERE id=? AND status='PENDING'", createdIds[0], now(), inboxId);
      if (result.changes !== 1) throw new Error("O evento do Inbox foi alterado durante a revisão.");
    });
  }
  async ignoreInbox(inboxId: string) { await this.ensureReady(); await this.db.runAsync("UPDATE inbox_events SET status='IGNORED',reviewed_at=? WHERE id=? AND status='PENDING'", now(), inboxId); }

  async exportSnapshot(): Promise<AlphaFinanceSnapshot> {
    await this.ensureReady();
    const profileRow = await this.db.getFirstAsync<Row>("SELECT locale,currency FROM profiles WHERE id=1");
    return {
      format: "alphafinance.snapshot", version: 1, createdAt: now(),
      profile: { locale: (profileRow?.locale ?? "pt-BR") as Profile["locale"], currency: (profileRow?.currency ?? "BRL") as Profile["currency"] },
      tags: (await this.db.getAllAsync<Row>("SELECT * FROM tags ORDER BY position")).map(mapTag),
      recurrences: (await this.db.getAllAsync<Row>(recurrenceSelect)).map(mapRecurrence),
      transactions: (await this.db.getAllAsync<Row>(transactionSelect)).map(mapTransaction),
      inboxEvents: (await this.db.getAllAsync<Row>("SELECT * FROM inbox_events")).map(mapInbox),
      monthSettings: (await this.db.getAllAsync<{ month: string; carryover: number }>("SELECT * FROM month_settings")).map((row) => ({ month: row.month, carryover: bool(row.carryover) })),
    };
  }

  async importSnapshot(snapshot: AlphaFinanceSnapshot): Promise<void> {
    await this.ensureReady();
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      for (const table of ["transaction_labels", "transactions", "recurrence_labels", "recurrences", "inbox_events", "month_settings", "tags"])
        await tx.execAsync(`DELETE FROM ${table}`);
      await tx.runAsync("UPDATE profiles SET locale=?,currency=? WHERE id=1", snapshot.profile.locale, snapshot.profile.currency);
      for (const item of snapshot.tags) await tx.runAsync("INSERT INTO tags VALUES (?,?,?,?,?,?)", item.id, item.name, item.color, item.type, item.kind, item.position);
      for (const item of snapshot.inboxEvents) await tx.runAsync("INSERT INTO inbox_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", item.id, item.source, item.sourceEventId, item.institution, item.amount, item.suggestedKind, item.suggestedMethod, item.description, item.occurredAt, item.status, item.confidence, item.transactionId, item.createdAt, item.reviewedAt);
      for (const item of snapshot.recurrences) {
        await tx.runAsync("INSERT INTO recurrences VALUES (?,?,?,?,?,?,?,?,?,?,?)", item.id, item.description, item.kind, item.amount, item.day, item.startMonth, item.endMonth, item.categoryId, item.method, item.percentageBps, item.incomeCategoryId);
        await this.insertLabels(tx, "recurrence_labels", "recurrence_id", item.id, item.labelIds);
      }
      for (const item of snapshot.transactions) {
        await tx.runAsync(`INSERT INTO transactions (id,description,kind,amount,date,month,done,category_id,method,recurrence_id,deleted,percentage_bps,income_category_id,estimated,is_carryover,expected_amount,paid_amount,installment_group_id,installment_number,installment_count,inbox_event_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, item.id, item.description, item.kind, item.amount, item.date, item.month, item.done ? 1 : 0, item.categoryId, item.method, item.recurrenceId, item.deleted ? 1 : 0, item.percentageBps, item.incomeCategoryId, item.estimated ? 1 : 0, item.isCarryover ? 1 : 0, item.expectedAmount, item.paidAmount, item.installmentGroupId, item.installmentNumber, item.installmentCount, item.inboxEventId, item.createdAt, item.updatedAt);
        await this.insertLabels(tx, "transaction_labels", "transaction_id", item.id, item.labelIds);
      }
      for (const item of snapshot.monthSettings) await tx.runAsync("INSERT INTO month_settings VALUES (?,?)", item.month, item.carryover ? 1 : 0);
    });
    if (!(await checkDatabaseIntegrity())) throw new Error("A verificação de integridade do SQLite falhou após a restauração.");
  }
}
