import type {
  MonthSummary,
  Transaction,
  TransactionDraft,
} from "./models";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function monthFromDate(date: string): string {
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    throw new Error("Data inválida.");
  }
  return date.slice(0, 7);
}

export function previousMonth(month: string): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

export function shiftDateByMonths(date: string, offset: number): string {
  monthFromDate(date);
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function validateDraft(draft: TransactionDraft): TransactionDraft {
  const description = draft.description.trim();
  if (!description || description.length > 160) {
    throw new Error("Informe uma descrição com até 160 caracteres.");
  }
  if (!Number.isInteger(draft.amount) || Math.abs(draft.amount) > 1_000_000_000) {
    throw new Error("Valor inválido.");
  }
  if (draft.amount < 0 && draft.kind !== "income") {
    throw new Error("Somente ajustes de receita podem ser negativos.");
  }
  monthFromDate(draft.date);
  const installmentCount = draft.installmentCount ?? 1;
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 120) {
    throw new Error("O número de parcelas deve estar entre 1 e 120.");
  }
  if (installmentCount > 1 && draft.recurring) {
    throw new Error("Uma movimentação não pode ser parcelada e recorrente ao mesmo tempo.");
  }
  if (draft.kind === "expense" && draft.recurring) {
    throw new Error("Despesas do dia a dia não geram recorrência automática.");
  }
  if (draft.percentageBps != null && draft.kind !== "investment") {
    throw new Error("Percentuais são exclusivos de investimentos.");
  }
  if (draft.percentageBps != null && (!Number.isInteger(draft.percentageBps) || draft.percentageBps < 1 || draft.percentageBps > 10_000)) {
    throw new Error("A porcentagem do investimento deve estar entre 0,01% e 100%.");
  }
  return {
    ...draft,
    description,
    installmentCount,
    method: draft.kind === "investment" ? "transfer" : (draft.method ?? "pix"),
    labelIds: [...new Set(draft.labelIds ?? [])],
  };
}

export function installmentAmounts(total: number, count: number): number[] {
  if (!Number.isInteger(total) || !Number.isInteger(count) || count < 1) {
    throw new Error("Parcelamento inválido.");
  }
  const sign = total < 0 ? -1 : 1;
  const absolute = Math.abs(total);
  const base = Math.floor(absolute / count);
  const remainder = absolute % count;
  return Array.from({ length: count }, (_, index) =>
    sign * (base + (index < remainder ? 1 : 0)),
  );
}

export function calculateEstimatedInvestment(
  entries: Transaction[],
  percentageBps: number,
  incomeCategoryId: string | null,
): number {
  const base = entries
    .filter(
      (entry) =>
        !entry.deleted &&
        !entry.isCarryover &&
        entry.kind === "income" &&
        (!incomeCategoryId || entry.categoryId === incomeCategoryId),
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
  return Math.round((Math.max(0, base) * percentageBps) / 10_000);
}

export function summarize(entries: Transaction[]): MonthSummary {
  const visible = entries.filter((entry) => !entry.deleted);
  const total = (kind: Transaction["kind"]) =>
    visible
      .filter((entry) => entry.kind === kind)
      .reduce((sum, entry) => sum + entry.amount, 0);
  const income = total("income");
  const expenses = total("expense");
  const bills = total("bill");
  const invested = visible
    .filter((entry) => entry.kind === "investment" && entry.done)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const unpaid = visible
    .filter((entry) => entry.kind === "bill" && !entry.done)
    .reduce((sum, entry) => sum + entry.amount, 0);
  return {
    income,
    expenses,
    bills,
    expectedBills: visible
      .filter((entry) => entry.kind === "bill")
      .reduce((sum, entry) => sum + (entry.expectedAmount ?? entry.amount), 0),
    invested,
    estimatedInvested: visible
      .filter((entry) => entry.kind === "investment" && entry.estimated)
      .reduce((sum, entry) => sum + entry.amount, 0),
    unpaid,
    remaining: income - expenses - (bills - unpaid) - invested,
  };
}
