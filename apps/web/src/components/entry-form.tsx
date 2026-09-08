"use client";
import { api, cents, localDate, localMonth } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { Dashboard, Entry, Kind } from "@/lib/types";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ReceiptText,
  Repeat2,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CategoryPicker } from "./category-picker";

export function EntryForm({
  t,
  data,
  entry,
  initialKind,
  month,
  save,
  busy,
  close,
  onKindChange,
}: {
  t: Dictionary;
  data: Dashboard;
  entry?: Entry;
  initialKind?: Kind;
  month: string;
  save: (path: string, method: string, body: unknown) => Promise<boolean>;
  busy: boolean;
  close: () => void;
  onKindChange?: (kind: Kind) => void;
}) {
  const [kind, setKind] = useState<Kind>(
    entry?.kind || initialKind || "expense",
  );
  const [labels, setLabels] = useState<string[]>(entry?.labelIds || []);
  const [category, setCategory] = useState(entry?.categoryId || "");
  const [billDone, setBillDone] = useState(entry?.done || false);
  const [percentageMode, setPercentageMode] = useState(
    entry?.percentageBps != null,
  );
  const [percentage, setPercentage] = useState(
    String((entry?.percentageBps || 1500) / 100),
  );
  const [incomeCategory, setIncomeCategory] = useState(
    entry?.incomeCategoryId || "",
  );
  const [confirmed, setConfirmed] = useState(
    entry?.kind === "investment" && entry.done,
  );
  const [recurring, setRecurring] = useState(
    (entry?.kind || initialKind) === "bill",
  );
  const [date, setDate] = useState(
    entry?.date || (month === localMonth() ? localDate() : `${month}-01`),
  );
  const [previewData, setPreviewData] = useState<Dashboard | null>(data);
  const targetMonth = date.slice(0, 7);
  useEffect(() => {
    if (targetMonth === data.month) {
      setPreviewData(data);
      return;
    }
    setPreviewData(null);
    if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(targetMonth)) return;
    let active = true;
    api<Dashboard>(`dashboard?month=${targetMonth}`)
      .then((result) => {
        if (active) setPreviewData(result);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [targetMonth, data]);
  const base = (previewData?.entries || [])
    .filter(
      (e) =>
        e.kind === "income" &&
        e.id !== entry?.id &&
        (!incomeCategory || e.categoryId === incomeCategory),
    )
    .reduce((sum, e) => sum + e.amount, 0);
  const estimate = Math.round(
    (Math.max(0, base) * Math.round(Number(percentage) * 100)) / 10000,
  );
  const money = (value: number) =>
    new Intl.NumberFormat(data.profile.locale, {
      style: "currency",
      currency: data.profile.currency,
    }).format(value / 100);
  const percentageInvestment = kind === "investment" && percentageMode;
  const title = {
    income: t.newIncome,
    expense: t.newExpense,
    bill: t.newBill,
    investment: t.newInvestment,
  };
  const hints = {
    income: t.incomeFormHint,
    expense: t.expenseFormHint,
    bill: t.billFormHint,
    investment: t.investmentFormHint,
  };
  const icons = {
    income: ArrowDownLeft,
    expense: ArrowUpRight,
    bill: ReceiptText,
    investment: TrendingUp,
  };
  const Icon = icons[kind];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await save(
      entry ? `entries/${entry.id}` : "entries",
      entry ? "PATCH" : "POST",
      {
        description: String(f.get("description")).trim(),
        kind,
        amount:
          kind === "bill"
            ? cents(f.get("expectedAmount"))
            : percentageInvestment
              ? 0
              : cents(f.get("amount")),
        date,
        categoryId: kind === "investment" ? null : category || null,
        labelIds: labels,
        method: kind === "investment" ? "transfer" : f.get("method"),
        done: kind === "investment" ? confirmed : kind === "bill" && billDone,
        expectedAmount:
          kind === "bill"
            ? cents(f.get("expectedAmount"))
            : kind === "investment"
              ? percentageInvestment
                ? estimate
                : cents(f.get("amount"))
              : null,
        paidAmount:
          (kind === "bill" && billDone) || (kind === "investment" && confirmed)
            ? cents(f.get("paidAmount"))
            : null,
        percentageBps: percentageInvestment
          ? Math.round(Number(percentage) * 100)
          : null,
        incomeCategoryId: percentageInvestment ? incomeCategory || null : null,
        estimated: kind === "investment" && !confirmed,
        ...(!entry ? { recurring: kind !== "expense" && recurring } : {}),
      },
    );
  }
  return (
    <form onSubmit={submit} className={`form entry-form entry-form-${kind}`}>
      <div className="entry-kind-selector" role="group" aria-label={t.type}>
        {(["income", "expense", "bill", "investment"] as Kind[]).map((k) => {
          const KIcon = icons[k];
          return (
            <button
              type="button"
              key={k}
              className={`kind-choice kind-${k} ${kind === k ? "selected" : ""}`}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                onKindChange?.(k);
                setLabels([]);
                setCategory("");
                setBillDone(false);
                setConfirmed(false);
                setRecurring(k === "bill");
              }}
            >
              <KIcon size={20} />
              <span>{t[k]}</span>
            </button>
          );
        })}
      </div>
      <div className={`entry-intro kind-${kind}`}>
        <Icon size={28} />
        <div>
          <h3>{title[kind]}</h3>
          <p>{hints[kind]}</p>
        </div>
      </div>
      <label>
        {kind === "income"
          ? t.incomeDescription
          : kind === "expense"
            ? t.expenseDescription
            : t.description}
        <input
          name="description"
          required
          maxLength={160}
          defaultValue={entry?.description}
          autoFocus
        />
      </label>
      {kind === "investment" && (
        <fieldset>
          <legend>{t.calculationMode}</legend>
          <div className="type-selector">
            <button
              type="button"
              className={!percentageMode ? "selected" : ""}
              onClick={() => setPercentageMode(false)}
            >
              {t.fixedAmount}
            </button>
            <button
              type="button"
              className={percentageMode ? "selected" : ""}
              onClick={() => {
                setPercentageMode(true);
                if (!entry) setRecurring(true);
              }}
            >
              {t.percentageAmount}
            </button>
          </div>
        </fieldset>
      )}
      {percentageInvestment && (
        <section className="percentage-fields">
          <div className="form-grid">
            <label>
              {t.percentage}
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                required
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
              />
            </label>
            <CategoryPicker
              title={t.incomeBase}
              noneLabel={t.allIncome}
              tags={data.tags.filter(
                (tag) => tag.type === "category" && tag.kind === "income",
              )}
              value={incomeCategory}
              onChange={setIncomeCategory}
            />
          </div>
          <div className="estimate-preview">
            <span>
              {t.estimatedValue}
              <small>
                {percentage || "0"}% × {previewData ? money(base) : "—"}
              </small>
            </span>
            <strong>
              {previewData && Number.isFinite(estimate) ? money(estimate) : "—"}
            </strong>
          </div>
          <p className="form-note">{t.percentageHint}</p>
          <p className="form-note">{t.estimateHint}</p>
        </section>
      )}
      <div
        className={`form-grid ${kind !== "investment" ? "entry-details-grid" : ""}`}
      >
        {kind !== "bill" && !percentageInvestment && (
          <label>
            {kind === "income"
              ? t.incomeAmount
              : kind === "investment"
                ? t.expectedAmount
                : t.expenseAmount}{" "}
            ({data.profile.currency})
            <input
              key={`${percentageInvestment}-${confirmed}`}
              name="amount"
              type="number"
              step="0.01"
              min={kind === "income" ? -10000000 : 0}
              max="10000000"
              required
              defaultValue={
                percentageInvestment
                  ? entry && !entry.estimated
                    ? (entry.expectedAmount ?? entry.amount) / 100
                    : estimate / 100
                  : entry
                    ? entry.amount / 100
                    : ""
              }
              placeholder="0.00"
            />
          </label>
        )}
        {kind === "bill" && (
          <label>
            {t.expectedAmount} ({data.profile.currency})
            <input
              name="expectedAmount"
              type="number"
              min="0"
              max="10000000"
              step="0.01"
              required
              defaultValue={
                entry ? (entry.expectedAmount ?? entry.amount) / 100 : ""
              }
            />
            <small>{t.expectedAmountHint}</small>
          </label>
        )}
        <label>
          {t.date}
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={entry?.recurrenceId ? `${month}-01` : "1900-01-01"}
            max={
              entry?.recurrenceId
                ? `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`
                : "2199-12-31"
            }
          />
        </label>
        {kind !== "investment" && (
          <label>
            {t.method}
            <select name="method" defaultValue={entry?.method || "pix"}>
              {(["pix", "credit", "debit", "cash", "transfer"] as const).map(
                (m) => (
                  <option key={m} value={m}>
                    {t[m]}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
      </div>
      {kind !== "investment" && (
        <CategoryPicker
          title={t.category}
          noneLabel={t.uncategorized}
          tags={data.tags.filter(
            (tag) => tag.type === "category" && tag.kind === kind,
          )}
          value={category}
          onChange={setCategory}
        />
      )}
      {kind === "investment" && (
        <>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              {t.confirmInvestment}
              <small>{t.confirmInvestmentHint}</small>
            </span>
          </label>
          {confirmed && (
            <label>
              {t.savedAmount} ({data.profile.currency})
              <input
                name="paidAmount"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                required
                defaultValue={
                  entry?.paidAmount != null ? entry.paidAmount / 100 : ""
                }
              />
            </label>
          )}
        </>
      )}
      <fieldset>
        <legend>{t.labels}</legend>
        <div className="label-picker">
          {data.tags
            .filter((tag) => tag.type === "label" && tag.kind === kind)
            .map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`chip ${labels.includes(tag.id) ? "chosen" : ""}`}
                style={{
                  borderColor: labels.includes(tag.id) ? tag.color : undefined,
                }}
                aria-pressed={labels.includes(tag.id)}
                onClick={() =>
                  setLabels(
                    labels.includes(tag.id)
                      ? labels.filter((id) => id !== tag.id)
                      : [...labels, tag.id],
                  )
                }
              >
                <i className="dot" style={{ background: tag.color }} />
                {tag.name}
              </button>
            ))}
          {!data.tags.some(
            (tag) => tag.type === "label" && tag.kind === kind,
          ) && <span className="muted">{t.noTags}</span>}
        </div>
      </fieldset>
      {kind === "income" && <p className="form-note">{t.negativeHint}</p>}
      {kind === "bill" && (
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={billDone}
            onChange={(e) => setBillDone(e.target.checked)}
          />
          <span>
            {t.done}
            <small>{t.doneHint}</small>
          </span>
        </label>
      )}
      {kind === "bill" && billDone && (
        <label>
          {t.paidAmount} ({data.profile.currency})
          <input
            name="paidAmount"
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            required
            defaultValue={
              entry?.paidAmount != null ? entry.paidAmount / 100 : ""
            }
          />
          <small>{t.paidAmountHint}</small>
        </label>
      )}
      {!entry && kind !== "expense" ? (
        <label className="checkbox-line recurrence-option">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          <span>
            <Repeat2 size={15} /> {t.recurring}
            <small>{t.recurringHint}</small>
          </span>
        </label>
      ) : (
        entry?.recurrenceId && (
          <p className="form-note">
            {kind === "bill" ? t.billEditHint : t.editHint}
          </p>
        )
      )}
      <div className="form-actions">
        <button
          className="button secondary"
          type="button"
          onClick={close}
          disabled={busy}
        >
          {t.cancel}
        </button>
        <button
          className={`button ${kind === "income" ? "income-action" : kind === "expense" ? "expense-action" : "primary"}`}
          disabled={busy}
        >
          {busy ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
