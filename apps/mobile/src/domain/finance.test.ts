/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { installmentAmounts, shiftDateByMonths, summarize } from "./finance";
import type { Transaction } from "./models";

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "id",
    description: "Teste",
    kind: "expense",
    amount: 0,
    date: "2026-09-01",
    month: "2026-09",
    done: true,
    categoryId: null,
    labelIds: [],
    method: "pix",
    recurrenceId: null,
    deleted: false,
    percentageBps: null,
    incomeCategoryId: null,
    estimated: false,
    isCarryover: false,
    expectedAmount: null,
    paidAmount: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentCount: null,
    inboxEventId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

test("parcelas preservam exatamente os centavos", () => {
  assert.deepEqual(installmentAmounts(10_00, 3), [334, 333, 333]);
  assert.equal(installmentAmounts(10_00, 3).reduce((a, b) => a + b, 0), 10_00);
});

test("datas parceladas respeitam o último dia do mês", () => {
  assert.equal(shiftDateByMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(shiftDateByMonths("2024-01-31", 1), "2024-02-29");
});

test("conta pendente não reduz o saldo até ser paga", () => {
  const result = summarize([
    transaction({ kind: "income", amount: 5_000 }),
    transaction({ kind: "expense", amount: 1_000 }),
    transaction({ kind: "bill", amount: 2_000, done: false }),
    transaction({ kind: "investment", amount: 500 }),
  ]);
  assert.equal(result.remaining, 3_500);
  assert.equal(result.unpaid, 2_000);
});
