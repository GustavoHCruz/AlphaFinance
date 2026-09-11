"use client";
import { api, localDate, localMonth } from "@/lib/api";
import { dictionaries } from "@/lib/i18n";
import type { Dashboard, Entry, Kind, Tag } from "@/lib/types";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Download,
  LayoutDashboard,
  Menu,
  Pencil,
  Plus,
  ReceiptText,
  Repeat2,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CashFlow, SpendingChart } from "./charts";
import {
  BillPaymentForm,
  CopyTagForm,
  EntryForm,
  SettingsForm,
  TagForm,
} from "./forms";
import { Modal } from "./modal";
import { TagSorter } from "./tag-sorter";

type Page =
  | "overview"
  | "transactions"
  | "bills"
  | "investment"
  | "organize"
  | "settings";
type Dialog =
  | { type: "entry"; entry?: Entry; kind?: Kind }
  | { type: "tag"; tag?: Tag; tagType: Tag["type"]; kind?: Kind }
  | { type: "payment"; entry: Entry }
  | { type: "copy"; tag: Tag }
  | { type: "delete"; path: string; stop?: boolean };
const nav = [
  { id: "overview", icon: LayoutDashboard },
  { id: "bills", icon: ReceiptText },
  { id: "investment", icon: TrendingUp },
  { id: "transactions", icon: ArrowLeftRight },
  { id: "organize", icon: TagIcon },
] as const;
const kindIcons = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  bill: ReceiptText,
  investment: TrendingUp,
};

export function FinanceApp() {
  const [page, setPage] = useState<Page>("overview");
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [locale, setLocale] = useState<"pt-BR" | "en-US">("pt-BR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [category, setCategory] = useState("all");
  const [label, setLabel] = useState("all");
  const [status, setStatus] = useState("all");
  const [tagKind, setTagKind] = useState<Kind>("income");
  const request = useRef(0);
  const t = dictionaries[locale];
  const creatingEntry = dialog?.type === "entry" && !dialog.entry;
  useEffect(() => {
    if (!creatingEntry) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [creatingEntry]);
  function requestClose() {
    if (busy) return;
    if (creatingEntry) setDiscardOpen(true);
    else setDialog(null);
  }
  function toggleBill(entry: Entry) {
    if (busy) return;
    if (entry.done)
      void save(`entries/${entry.id}`, "PATCH", {
        done: false,
        paidAmount: null,
      });
    else if (!entry.recurrenceId)
      void save(`entries/${entry.id}`, "PATCH", {
        done: true,
        paidAmount: entry.amount,
      });
    else open({ type: "payment", entry });
  }
  useEffect(() => {
    setMonth(localMonth());
  }, []);
  const load = useCallback(async () => {
    if (!month) return;
    const ticket = ++request.current;
    setLoading(true);
    setError(false);
    try {
      const result = await api<Dashboard>(`dashboard?month=${month}`);
      if (ticket === request.current) {
        setData(result);
        setLocale(result.profile.locale);
      }
    } catch {
      if (ticket === request.current) setError(true);
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, [month]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  function open(d: Dialog) {
    setFormError("");
    setDialog(d);
  }
  function navigate(p: Page) {
    setPage(p);
    setSearch("");
    setKind("all");
    setCategory("all");
    setLabel("all");
    setStatus("all");
    setMobileMenu(false);
  }
  function moveMonth(delta: number) {
    if (!month) return;
    const d = new Date(`${month}-01T12:00:00`);
    d.setMonth(d.getMonth() + delta);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (value >= "1900-01" && value <= "2199-12") setMonth(value);
  }
  async function save(path: string, method: string, body?: unknown) {
    if (busy) return false;
    setBusy(true);
    setFormError("");
    try {
      await api(path, method, body);
      setDialog(null);
      setDiscardOpen(false);
      if (path.endsWith("/copy") && body)
        setTagKind((body as { kind: Kind }).kind);
      setNotice(
        method === "DELETE"
          ? t.deleted
          : path === "profile"
            ? t.profileSaved
            : t.success,
      );
      await load();
      return true;
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message === "CATEGORY_IN_USE_BY_PERCENTAGE"
          ? t.categoryInUse
          : error instanceof Error &&
              error.message === "ACTUAL_INVESTMENT_REQUIRED"
            ? t.actualInvestmentRequired
            : error instanceof Error && error.message === "PAID_AMOUNT_REQUIRED"
              ? t.paidAmountRequired
              : t.error;
      setFormError(message);
      if (!dialog) setNotice(message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: data?.profile.currency || "BRL",
    }).format(n / 100);
  const entryName = (e: Entry) => (e.isCarryover ? t.carryover : e.description);
  const formatDate = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
    });
  const monthLabel = month
    ? new Date(`${month}-01T12:00:00`).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      })
    : "—";
  const compareEntriesAscending = (a: Entry, b: Entry) =>
    a.date.localeCompare(b.date) ||
    entryName(a).localeCompare(entryName(b), locale, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id);
  const bills =
    data?.entries
      .filter((e) => e.kind === "bill")
      .sort(compareEntriesAscending) || [];
  const investments =
    data?.entries
      .filter((e) => e.kind === "investment")
      .sort(compareEntriesAscending) || [];
  const trackingPage = page === "bills" || page === "investment";
  const tracked = page === "investment" ? investments : bills;
  const pending = bills.filter((e) => !e.done);
  const filtered =
    (trackingPage ? tracked : data?.entries)?.filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (category === "all" || (e.categoryId || "") === category) &&
        (label === "all" || e.labelIds.includes(label)) &&
        (status === "all" || (status === "done" ? e.done : !e.done)) &&
        entryName(e)
          .toLocaleLowerCase(locale)
          .includes(search.toLocaleLowerCase(locale)),
    ) || [];
  function exportCsv() {
    if (!filtered.length) {
      setNotice(t.exportEmpty);
      return;
    }
    const rows = [
      [
        t.description,
        t.type,
        t.amount,
        t.date,
        t.category,
        t.labels,
        t.method,
        t.status,
        t.expectedAmount,
        t.paidAmount,
      ],
      ...filtered.map((e) => [
        entryName(e),
        t[e.kind],
        (e.amount / 100).toFixed(2),
        e.date,
        data?.tags.find((tag) => tag.id === e.categoryId)?.name || "",
        e.labelIds
          .map((id) => data?.tags.find((tag) => tag.id === id)?.name || "")
          .join(", "),
        t[e.method as "pix"],
        e.kind === "bill"
          ? e.done
            ? t.paid
            : t.pending
          : e.estimated
            ? t.estimated
            : e.kind === "investment"
              ? t.confirmed
              : e.isCarryover
                ? t.automatic
                : "",
        e.expectedAmount == null ? "" : (e.expectedAmount / 100).toFixed(2),
        e.paidAmount == null ? "" : (e.paidAmount / 100).toFixed(2),
      ]),
    ];
    const escape = (s: string) =>
      `"${(/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(escape).join(";")).join("\r\n")],
        {
          type: "text/csv;charset=utf-8",
        },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `alphafinance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function trackingList(rows: Entry[], investment: boolean) {
    return (
      <section className="panel tracking-panel">
        <div className="panel-heading">
          <h2>{investment ? t.trackInvestments : t.upcoming}</h2>
          <div className="panel-heading-actions">
            <span className="count-pill">{rows.length}</span>
            <button
              className="text-button"
              title={t.viewAll}
              onClick={() => navigate(investment ? "investment" : "bills")}
            >
              {t.viewAll}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        <div className="tracking-scroll">
          <div className="tracking-list">
            {rows.map((e) => (
              <div
                className={`tracking-row ${e.done ? "is-complete" : ""}`}
                key={e.id}
              >
                <button
                  className={`bill-check ${e.done ? "checked" : ""}`}
                  aria-label={`${e.done ? t.pending : t.done}: ${e.description}`}
                  aria-pressed={e.done}
                  disabled={busy}
                  onClick={() => toggleBill(e)}
                >
                  {e.done && <Check size={15} />}
                </button>
                <strong className="tracking-name" title={e.description}>
                  {e.description}
                </strong>
                <time dateTime={e.date}>{formatDate(e.date)}</time>
                <span
                  className={`tracking-recurrence ${e.recurrenceId ? "is-recurring" : ""}`}
                >
                  {e.recurrenceId && <Repeat2 size={11} />}
                  {e.recurrenceId ? t.monthly : t.oneTime}
                </span>
                <span className="tracking-status">
                  {e.done ? (investment ? t.saved : t.paid) : t.pending}
                </span>
                <span className="tracking-value">
                  <small>
                    {e.recurrenceId
                      ? e.done
                        ? investment
                          ? t.saved
                          : t.paidShort
                        : t.expectedShort
                      : t.amount}
                  </small>
                  <strong>{money(e.amount)}</strong>
                </span>
              </div>
            ))}
            {!rows.length && (
              <p className="empty-inline">
                {investment ? t.noTrackedInvestments : t.noTrackedBills}
              </p>
            )}
          </div>
        </div>
        <div className="panel-footer">
          <span>{t.pending}</span>
          <strong>
            {money(
              rows.filter((e) => !e.done).reduce((sum, e) => sum + e.amount, 0),
            )}
          </strong>
        </div>
      </section>
    );
  }
  function entryTable(rows: Entry[], compact = false) {
    if (!rows.length)
      return (
        <div className="empty-table">
          <ReceiptText size={30} />
          <h3>{t.noEntries}</h3>
          <p>{t.noEntriesSub}</p>
          <button
            className="button secondary"
            onClick={() =>
              open({
                type: "entry",
                kind:
                  page === "bills"
                    ? "bill"
                    : page === "investment"
                      ? "investment"
                      : undefined,
              })
            }
          >
            <Plus size={16} />
            {t.newEntry}
          </button>
        </div>
      );
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.description}</th>
              {page !== "investment" && <th>{t.category}</th>}
              {!compact && <th>{t.labels}</th>}
              <th>{t.date}</th>
              {!compact && page !== "investment" && <th>{t.method}</th>}
              <th className="align-right">{t.amount}</th>
              <th>
                <span className="sr-only">{t.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const Icon = kindIcons[e.kind];
              const tag = data?.tags.find((tag) => tag.id === e.categoryId);
              return (
                <tr key={e.id}>
                  <td>
                    <div className="transaction-name">
                      {e.kind === "bill" || e.kind === "investment" ? (
                        <button
                          className={`bill-check ${e.done ? "checked" : ""}`}
                          disabled={busy}
                          onClick={() => toggleBill(e)}
                          aria-label={`${e.done ? t.pending : t.done}: ${e.description}`}
                          aria-pressed={e.done}
                        >
                          {e.done && <Check size={15} />}
                        </button>
                      ) : (
                        <span className={`transaction-icon ${e.kind}`}>
                          <Icon size={18} />
                        </span>
                      )}
                      <div>
                        <strong>{entryName(e)}</strong>
                        <small>
                          {e.kind === "bill" || e.kind === "investment" ? (
                            <span
                              className={
                                !e.done && e.date < localDate()
                                  ? "danger-text"
                                  : ""
                              }
                            >
                              {e.done
                                ? e.kind === "investment"
                                  ? t.saved
                                  : t.paid
                                : e.kind === "bill" && e.date < localDate()
                                  ? t.overdue
                                  : t.pending}
                            </span>
                          ) : e.isCarryover ? (
                            t.automatic
                          ) : e.estimated ? (
                            t.estimated
                          ) : (
                            t[e.kind]
                          )}
                          {e.recurrenceId && (
                            <Repeat2 size={12} aria-label={t.recurring} />
                          )}
                        </small>
                        {e.kind === "bill" && e.recurrenceId && (
                          <small>
                            {t.expectedAmount}:{" "}
                            {money(e.expectedAmount ?? e.amount)}
                          </small>
                        )}
                        {e.percentageBps != null && (
                          <small className="percentage-caption">
                            {e.percentageBps / 100}% ·{" "}
                            {data?.tags.find(
                              (tag) => tag.id === e.incomeCategoryId,
                            )?.name || t.allIncome}
                          </small>
                        )}
                      </div>
                    </div>
                  </td>
                  {page !== "investment" && (
                    <td>
                      <span
                        className="category-chip"
                        style={
                          tag
                            ? { color: tag.color, background: `${tag.color}14` }
                            : {}
                        }
                      >
                        <i
                          className="dot"
                          style={{ background: tag?.color || "#a4a69c" }}
                        />
                        {tag?.name || t.uncategorized}
                      </span>
                    </td>
                  )}
                  {!compact && (
                    <td>
                      <div className="table-labels">
                        {e.labelIds.map((id) => {
                          const tag = data?.tags.find((t) => t.id === id);
                          return (
                            tag && (
                              <span
                                className="tiny-label"
                                key={id}
                                style={{ color: tag.color }}
                              >
                                {tag.name}
                              </span>
                            )
                          );
                        })}
                        {!e.labelIds.length && <span className="muted">—</span>}
                      </div>
                    </td>
                  )}
                  <td className="nowrap muted">{formatDate(e.date)}</td>
                  {!compact && page !== "investment" && (
                    <td className="muted">
                      {e.isCarryover || e.kind === "investment"
                        ? "—"
                        : t[e.method as "pix"]}
                    </td>
                  )}
                  <td
                    className={`align-right nowrap amount ${e.kind === "income" ? "positive" : ""}`}
                  >
                    {e.kind === "income" && e.amount >= 0
                      ? "+"
                      : e.kind !== "income" && e.amount > 0
                        ? "−"
                        : ""}
                    {money(e.amount)}
                  </td>
                  <td>
                    {e.isCarryover ? (
                      <span className="muted" title={t.carryoverManage}>
                        <Repeat2 size={15} aria-label={t.carryoverManage} />
                      </span>
                    ) : (
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`${t.edit}: ${e.description}`}
                          onClick={() => open({ type: "entry", entry: e })}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-button delete-button"
                          aria-label={`${t.remove}: ${e.description}`}
                          onClick={() =>
                            open({ type: "delete", path: `entries/${e.id}` })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label={t.close}
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <img src="/logo.svg" alt="" />
          <span>
            Alpha<span>Finance</span>
          </span>
        </a>
        <div className="workspace-label">{t.workspace}</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              <span>{t[n.id]}</span>
              {n.id === "bills" && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="brand-message">
            <Sparkles size={21} />
            <p>{t.tagline}</p>
            <div className="decorative-line" />
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={19} />
            {t.settings}
          </button>
          <div className="local-note">
            <ShieldCheck size={14} />
            <span>{t.local}</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <button
          className="icon-button mobile-toggle mobile-menu-button"
          onClick={() => setMobileMenu(true)}
          aria-label={t.menu}
        >
          <Menu size={22} />
        </button>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview" ? t.financialOverview : "ALPHAFINANCE"}
              </div>
              <h1>{page === "overview" ? t.greeting : t[page]}</h1>
              <p>
                {page === "overview"
                  ? t.subtitle
                  : page === "investment"
                    ? t.investmentSubtitle
                    : page === "bills"
                      ? t.billSubtitle
                      : page === "transactions"
                        ? t.transactionsSubtitle
                        : page === "organize"
                          ? t.organizeSubtitle
                          : t.profileSubtitle}
              </p>
            </div>
            <div className="heading-actions">
              {page !== "organize" && page !== "settings" && (
                <div className="month-picker">
                  <button aria-label={t.previous} onClick={() => moveMonth(-1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <label>
                    <span>{monthLabel}</span>
                    <input
                      aria-label={t.month}
                      type="month"
                      value={month}
                      min="1900-01"
                      max="2199-12"
                      onChange={(e) => {
                        if (
                          /^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) &&
                          e.target.value >= "1900-01" &&
                          e.target.value <= "2199-12"
                        )
                          setMonth(e.target.value);
                      }}
                    />
                  </label>
                  <button aria-label={t.next} onClick={() => moveMonth(1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              {page !== "organize" && page !== "settings" && (
                <div className="create-actions">
                  {(page === "overview" || page === "transactions") && (
                    <button
                      className="button income-action"
                      disabled={!data || loading}
                      onClick={() => open({ type: "entry", kind: "income" })}
                    >
                      <ArrowDownLeft size={17} />
                      {t.newIncome}
                    </button>
                  )}
                  <button
                    className={`button ${page === "overview" || page === "transactions" ? "expense-action" : "primary"}`}
                    disabled={!data || loading}
                    onClick={() =>
                      open({
                        type: "entry",
                        kind:
                          page === "bills"
                            ? "bill"
                            : page === "investment"
                              ? "investment"
                              : "expense",
                      })
                    }
                  >
                    <Plus size={17} />
                    {page === "bills"
                      ? t.newBill
                      : page === "investment"
                        ? t.newInvestment
                        : t.newExpense}
                  </button>
                </div>
              )}
            </div>
          </div>
          {error ? (
            <div className="panel state-panel">
              <CircleDollarSign size={36} />
              <h2>{t.error}</h2>
              <button className="button primary" onClick={() => void load()}>
                {t.retry}
              </button>
            </div>
          ) : loading || !data ? (
            <div className="loading-state" aria-live="polite">
              <div className="spinner" />
              <p>{t.loading}</p>
            </div>
          ) : (
            <>
              {(page === "overview" || page === "transactions") && (
                <section className="carryover-panel">
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={data.carryoverEnabled}
                      disabled={busy}
                      onChange={(e) =>
                        void save(`carryover?month=${month}`, "PUT", {
                          enabled: e.target.checked,
                        })
                      }
                    />
                    <span>
                      {t.carryoverToggle}
                      <small>{t.carryoverHint}</small>
                    </span>
                  </label>
                  <div>
                    <small>{t.carryover}</small>
                    <strong
                      className={
                        data.previousBalance < 0 ? "danger-text" : "positive"
                      }
                    >
                      {money(data.previousBalance)}
                    </strong>
                  </div>
                </section>
              )}
              {page === "overview" && (
                <>
                  <div className="stats-grid">
                    <article className="stat-card balance-card">
                      <div>
                        <span>{t.balance}</span>
                        <Wallet size={20} />
                      </div>
                      <strong>{money(data.summary.remaining)}</strong>
                      <small>{t.balanceHint}</small>
                      <div className="balance-orbit" />
                    </article>
                    {[
                      {
                        label: t.income,
                        value: data.summary.income,
                        hint: t.incomeHint,
                        icon: ArrowDownLeft,
                        className: "income",
                      },
                      {
                        label: t.totalOut,
                        value: data.summary.expenses + data.summary.bills,
                        hint: t.expenseHint,
                        icon: ArrowUpRight,
                        className: "expense",
                      },
                      {
                        label: t.investment,
                        value: data.summary.invested,
                        hint: t.investmentBudgetHint,
                        icon: TrendingUp,
                        className: "investment",
                      },
                    ].map((s) => (
                      <article className="stat-card" key={s.label}>
                        <div>
                          <span>{s.label}</span>
                          <span className={`stat-icon ${s.className}`}>
                            <s.icon size={19} />
                          </span>
                        </div>
                        <strong>{money(s.value)}</strong>
                        <small>{s.hint}</small>
                      </article>
                    ))}
                  </div>
                  {!data.entries.length && (
                    <div className="welcome-banner">
                      <span className="welcome-icon">
                        <Sparkles size={24} />
                      </span>
                      <div>
                        <h3>{t.empty}</h3>
                        <p>{t.emptySub}</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => open({ type: "entry", kind: "income" })}
                      >
                        {t.newIncome}
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  )}
                  <div className="charts-grid">
                    <CashFlow data={data} t={t} locale={locale} money={money} />
                    <SpendingChart
                      data={data}
                      t={t}
                      locale={locale}
                      money={money}
                    />
                  </div>
                  <div className="overview-lists">
                    <div className="tracking-grid">
                      {trackingList(bills, false)}
                      {trackingList(investments, true)}
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>{t.recent}</h2>
                        <button
                          className="text-button"
                          title={t.viewAll}
                          onClick={() => navigate("transactions")}
                        >
                          {t.viewAll}
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                      {entryTable(data.entries.slice(0, 10), true)}
                    </section>
                  </div>
                </>
              )}
              {(page === "transactions" || trackingPage) && (
                <>
                  {trackingPage && (
                    <div className="bill-summary">
                      <div>
                        <span>{t.plan}</span>
                        <strong>
                          {money(
                            tracked.reduce(
                              (sum, e) => sum + (e.expectedAmount ?? e.amount),
                              0,
                            ),
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>
                          {page === "investment" ? t.savedAmount : t.paid}
                        </span>
                        <strong className="positive">
                          {money(
                            tracked
                              .filter((e) => e.done)
                              .reduce((sum, e) => sum + e.amount, 0),
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>{t.pending}</span>
                        <strong>
                          {money(
                            tracked
                              .filter((e) => !e.done)
                              .reduce((sum, e) => sum + e.amount, 0),
                          )}
                        </strong>
                      </div>
                      <div className="bill-completion">
                        <span>
                          {tracked.filter((e) => e.done).length} /{" "}
                          {tracked.length} {t.completed}
                        </span>
                        <div className="progress-track">
                          <i
                            style={{
                              width: tracked.length
                                ? (tracked.filter((e) => e.done).length /
                                    tracked.length) *
                                    100 +
                                  "%"
                                : "0%",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <section className="panel">
                    <div className="filters">
                      <div className="search-box">
                        <Search size={17} />
                        <input
                          aria-label={t.search}
                          placeholder={t.search}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      {page === "transactions" && (
                        <select
                          aria-label={t.type}
                          value={kind}
                          onChange={(e) => setKind(e.target.value)}
                        >
                          <option value="all">{t.all}</option>
                          {(
                            [
                              "income",
                              "expense",
                              "bill",
                              "investment",
                            ] as Kind[]
                          ).map((k) => (
                            <option key={k} value={k}>
                              {t[k]}
                            </option>
                          ))}
                        </select>
                      )}
                      {page !== "investment" && (
                        <select
                          aria-label={t.category}
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="all">{t.allCategories}</option>
                          <option value="">{t.uncategorized}</option>
                          {data.tags
                            .filter((tag) => tag.type === "category")
                            .map((tag) => (
                              <option value={tag.id} key={tag.id}>
                                {tag.name}
                              </option>
                            ))}
                        </select>
                      )}
                      <select
                        aria-label={t.labels}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                      >
                        <option value="all">{t.allLabels}</option>
                        {data.tags
                          .filter((tag) => tag.type === "label")
                          .map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                      </select>
                      {trackingPage && (
                        <select
                          aria-label={t.status}
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="all">{t.filterStatus}</option>
                          <option value="done">{t.paid}</option>
                          <option value="pending">{t.pending}</option>
                        </select>
                      )}
                      <button
                        className="button secondary export-button"
                        onClick={exportCsv}
                      >
                        <Download size={16} />
                        {t.export}
                      </button>
                    </div>
                    {entryTable(filtered)}
                    <div className="panel-footer">
                      <span>
                        {filtered.length} {t.transactions.toLowerCase()}
                      </span>
                      <strong>
                        {money(
                          filtered.reduce(
                            (s, e) =>
                              s + (e.kind === "income" ? e.amount : -e.amount),
                            0,
                          ),
                        )}
                      </strong>
                    </div>
                  </section>
                  <section className="panel recurring-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          <Repeat2 size={18} />
                          {t.recurrences}
                        </h2>
                        <p>{t.recurrenceSub}</p>
                      </div>
                    </div>
                    {data.recurrences
                      .filter(
                        (r) =>
                          r.startMonth <= month &&
                          (!r.endMonth || r.endMonth >= month) &&
                          (!trackingPage ||
                            r.kind ===
                              (page === "investment" ? "investment" : "bill")),
                      )
                      .sort(
                        (a, b) =>
                          a.day - b.day ||
                          a.description.localeCompare(b.description, locale, {
                            sensitivity: "base",
                          }) ||
                          a.id.localeCompare(b.id),
                      )
                      .map((r) => (
                        <div className="recurring-row" key={r.id}>
                          <span className="transaction-icon">
                            <Repeat2 size={18} />
                          </span>
                          <div>
                            <strong>{r.description}</strong>
                            <small>
                              {t[r.kind]} · {t.day} {r.day}
                            </small>
                          </div>
                          <strong>
                            {r.percentageBps != null ? (
                              <>
                                {r.percentageBps / 100}%
                                <small>
                                  {data.tags.find(
                                    (tag) => tag.id === r.incomeCategoryId,
                                  )?.name || t.allIncome}
                                </small>
                              </>
                            ) : (
                              money(r.amount)
                            )}
                          </strong>
                          <button
                            className="button secondary"
                            onClick={() =>
                              open({
                                type: "delete",
                                path: `recurrences/${r.id}?month=${month}`,
                                stop: true,
                              })
                            }
                          >
                            {t.stop}
                          </button>
                        </div>
                      ))}
                    {!data.recurrences.some(
                      (r) =>
                        r.startMonth <= month &&
                        (!r.endMonth || r.endMonth >= month) &&
                        (!trackingPage ||
                          r.kind ===
                            (page === "investment" ? "investment" : "bill")),
                    ) && <p className="empty-inline">{t.noRecurrences}</p>}
                  </section>
                </>
              )}
              {page === "organize" && (
                <div>
                  <div
                    className="tag-kind-tabs"
                    role="group"
                    aria-label={t.tagKind}
                  >
                    {(
                      ["income", "expense", "bill", "investment"] as Kind[]
                    ).map((k) => (
                      <button
                        type="button"
                        key={k}
                        className={`kind-choice kind-${k} ${tagKind === k ? "selected" : ""}`}
                        aria-pressed={tagKind === k}
                        onClick={() => setTagKind(k)}
                      >
                        {t[k]}
                      </button>
                    ))}
                  </div>
                  <p className="order-hint">{t.orderHint}</p>
                  <div className="organize-grid">
                    {(["category", "label"] as const)
                      .filter(
                        (type) => tagKind !== "investment" || type === "label",
                      )
                      .map((type) => (
                        <section className="panel" key={type}>
                          <div className="panel-heading">
                            <h2>
                              {type === "category" ? t.categories : t.labels}
                            </h2>
                            <button
                              className="button secondary"
                              onClick={() =>
                                open({
                                  type: "tag",
                                  tagType: type,
                                  kind: tagKind,
                                })
                              }
                            >
                              <Plus size={15} />
                              {type === "category" ? t.newCategory : t.newLabel}
                            </button>
                          </div>
                          <TagSorter
                            tags={data.tags.filter(
                              (tag) =>
                                tag.type === type && tag.kind === tagKind,
                            )}
                            busy={busy}
                            t={t}
                            reorder={(ids) =>
                              void save("tags/order", "PUT", {
                                type,
                                kind: tagKind,
                                ids,
                              })
                            }
                            actions={(tag) => (
                              <>
                                <button
                                  className="icon-button"
                                  disabled={busy}
                                  title={t.copyTag}
                                  aria-label={t.copyTag + ": " + tag.name}
                                  onClick={() => open({ type: "copy", tag })}
                                >
                                  <Copy size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={t.edit + ": " + tag.name}
                                  onClick={() =>
                                    open({ type: "tag", tagType: type, tag })
                                  }
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-button delete-button"
                                  aria-label={t.remove + ": " + tag.name}
                                  onClick={() =>
                                    open({
                                      type: "delete",
                                      path: "tags/" + tag.id,
                                    })
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          />
                        </section>
                      ))}
                  </div>
                </div>
              )}
              {page === "settings" && (
                <SettingsForm
                  key={`${data.profile.locale}-${data.profile.currency}`}
                  profile={data.profile}
                  t={t}
                  save={save}
                  busy={busy}
                />
              )}
            </>
          )}
          <footer className="app-footer">
            <span>
              AlphaFinance <i>•</i> {t.tagline}
            </span>
            <span>
              <ShieldCheck size={13} />
              {t.localSub}
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label={t.close}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog && data && (
        <Modal
          title={
            dialog.type === "entry"
              ? dialog.entry
                ? t.edit
                : dialog.kind === "income"
                  ? t.newIncome
                  : dialog.kind === "expense"
                    ? t.newExpense
                    : dialog.kind === "bill"
                      ? t.newBill
                      : dialog.kind === "investment"
                        ? t.newInvestment
                        : t.newEntry
              : dialog.type === "tag"
                ? dialog.tag
                  ? t.edit
                  : dialog.tagType === "category"
                    ? t.newCategory
                    : t.newLabel
                : dialog.type === "payment"
                  ? dialog.entry.kind === "investment"
                    ? t.completeInvestment
                    : t.completeBill
                  : dialog.type === "copy"
                    ? t.copyTag
                    : dialog.stop
                      ? t.confirmStop
                      : t.confirmDelete
          }
          close={requestClose}
          closeLabel={t.close}
        >
          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}
          {dialog.type === "entry" && (
            <EntryForm
              data={data}
              t={t}
              month={month}
              entry={dialog.entry}
              initialKind={dialog.kind}
              onKindChange={(kind) => setDialog({ ...dialog, kind })}
              save={save}
              busy={busy}
              close={requestClose}
            />
          )}
          {dialog.type === "tag" && (
            <TagForm
              t={t}
              tag={dialog.tag}
              type={dialog.tagType}
              initialKind={dialog.kind}
              save={save}
              busy={busy}
              close={() => setDialog(null)}
            />
          )}
          {dialog.type === "payment" && (
            <BillPaymentForm
              t={t}
              entry={dialog.entry}
              currency={data.profile.currency}
              locale={locale}
              save={save}
              busy={busy}
              close={requestClose}
            />
          )}
          {dialog.type === "copy" && (
            <CopyTagForm
              t={t}
              tag={dialog.tag}
              save={save}
              busy={busy}
              close={requestClose}
            />
          )}
          {dialog.type === "delete" && (
            <div className="form">
              <p>{dialog.stop ? t.confirmStopHint : t.confirmDeleteHint}</p>
              <div className="form-actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  {t.cancel}
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => void save(dialog.path, "DELETE")}
                >
                  {busy ? t.saving : dialog.stop ? t.stop : t.remove}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
      {discardOpen && (
        <Modal
          title={t.discardTitle}
          close={() => setDiscardOpen(false)}
          closeLabel={t.close}
        >
          <div className="form">
            <p>{t.discardHint}</p>
            <div className="form-actions">
              <button
                className="button secondary"
                autoFocus
                onClick={() => setDiscardOpen(false)}
              >
                {t.keepEditing}
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setDiscardOpen(false);
                  setDialog(null);
                }}
              >
                {t.discardEntry}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
