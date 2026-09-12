import { z } from "zod";
import type { AlphaFinanceSnapshot } from "../domain/models";

const uuid = z.string().min(1).max(100);
const month = z.string().regex(/^\d{4}-\d{2}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().min(10).max(50);
const kind = z.enum(["income", "expense", "bill", "investment"]);
const method = z.enum(["pix", "credit", "debit", "cash", "transfer"]);
const nullableUuid = uuid.nullable();
const cents = z.number().int().min(-1_000_000_000).max(1_000_000_000);

const snapshotSchema = z.object({
  format: z.literal("alphafinance.snapshot"),
  version: z.literal(1),
  createdAt: timestamp,
  profile: z.object({
    locale: z.enum(["pt-BR", "en-US"]),
    currency: z.enum(["BRL", "USD", "EUR"]),
  }),
  tags: z.array(
    z.object({
      id: uuid,
      name: z.string().trim().min(1).max(50),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      type: z.enum(["category", "label"]),
      kind,
      position: z.number().int(),
    }),
  ).max(10_000),
  recurrences: z.array(z.object({
    id: uuid,
    description: z.string().min(1).max(160),
    kind,
    amount: cents,
    day: z.number().int().min(1).max(31),
    startMonth: month,
    endMonth: month.nullable(),
    categoryId: nullableUuid,
    labelIds: z.array(uuid).max(100),
    method,
    percentageBps: z.number().int().min(1).max(10_000).nullable(),
    incomeCategoryId: nullableUuid,
  })).max(100_000),
  transactions: z.array(z.object({
    id: uuid,
    description: z.string().min(1).max(160),
    kind,
    amount: cents,
    date,
    month,
    done: z.boolean(),
    categoryId: nullableUuid,
    labelIds: z.array(uuid).max(100),
    method,
    recurrenceId: nullableUuid,
    deleted: z.boolean(),
    percentageBps: z.number().int().min(1).max(10_000).nullable(),
    incomeCategoryId: nullableUuid,
    estimated: z.boolean(),
    isCarryover: z.boolean(),
    expectedAmount: cents.nullable(),
    paidAmount: cents.nullable(),
    installmentGroupId: nullableUuid,
    installmentNumber: z.number().int().min(1).max(120).nullable(),
    installmentCount: z.number().int().min(1).max(120).nullable(),
    inboxEventId: nullableUuid,
    createdAt: timestamp,
    updatedAt: timestamp,
  })).max(1_000_000),
  inboxEvents: z.array(z.object({
    id: uuid,
    source: z.enum(["MANUAL", "ANDROID_NOTIFICATION", "CSV_IMPORT", "LEGACY_IMPORT", "FUTURE"]),
    sourceEventId: z.string().max(200).nullable(),
    institution: z.string().max(100).nullable(),
    amount: cents.nullable(),
    suggestedKind: kind.nullable(),
    suggestedMethod: method.nullable(),
    description: z.string().max(160).nullable(),
    occurredAt: timestamp,
    status: z.enum(["PENDING", "ACCEPTED", "IGNORED"]),
    confidence: z.number().min(0).max(1).nullable(),
    transactionId: nullableUuid,
    createdAt: timestamp,
    reviewedAt: timestamp.nullable(),
  })).max(1_000_000),
  monthSettings: z.array(z.object({ month, carryover: z.boolean() })).max(10_000),
});

export function validateSnapshot(input: unknown): AlphaFinanceSnapshot {
  const snapshot = snapshotSchema.parse(input) as AlphaFinanceSnapshot;
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`${label} contém IDs duplicados.`);
  };
  unique(snapshot.tags.map((item) => item.id), "Categorias");
  unique(snapshot.recurrences.map((item) => item.id), "Recorrências");
  unique(snapshot.transactions.map((item) => item.id), "Movimentações");
  unique(snapshot.inboxEvents.map((item) => item.id), "Inbox");

  const tags = new Set(snapshot.tags.map((item) => item.id));
  const recurrences = new Set(snapshot.recurrences.map((item) => item.id));
  const transactions = new Set(snapshot.transactions.map((item) => item.id));
  const inbox = new Set(snapshot.inboxEvents.map((item) => item.id));
  for (const item of [...snapshot.recurrences, ...snapshot.transactions]) {
    if (item.categoryId && !tags.has(item.categoryId)) throw new Error("Movimentação referencia categoria inexistente.");
    if (item.labelIds.some((id) => !tags.has(id))) throw new Error("Movimentação referencia etiqueta inexistente.");
    if (item.incomeCategoryId && !tags.has(item.incomeCategoryId)) throw new Error("Cálculo percentual referencia categoria de renda inexistente.");
  }
  for (const item of snapshot.transactions) {
    if (item.recurrenceId && !recurrences.has(item.recurrenceId)) throw new Error("Movimentação referencia recorrência inexistente.");
    if (item.inboxEventId && !inbox.has(item.inboxEventId)) throw new Error("Movimentação referencia evento inexistente.");
    if (item.month !== item.date.slice(0, 7)) throw new Error("Movimentação possui mês incompatível com a data.");
  }
  for (const event of snapshot.inboxEvents) {
    if (event.transactionId && !transactions.has(event.transactionId)) throw new Error("Evento do Inbox referencia movimentação inexistente.");
    if (event.status === "ACCEPTED" && !event.transactionId) throw new Error("Evento aceito não possui movimentação associada.");
  }
  return snapshot;
}
