"use client";
import type { Dictionary } from "@/lib/i18n";
import type { Dashboard } from "@/lib/types";

type Props = {
  data: Dashboard;
  t: Dictionary;
  money: (n: number) => string;
  locale: string;
};
export function CashFlow({ data, t, money, locale }: Props) {
  const max = Math.max(
    100,
    ...data.history.flatMap((h) => [
      h.income,
      h.expenses + h.bills + h.invested,
    ]),
  );
  const active = data.history.some(
    (h) => h.income || h.expenses || h.bills || h.invested,
  );
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.cashflow}</h2>
          <p>{t.sixMonths}</p>
        </div>
        <div className="chart-legend">
          <span>
            <i className="dot flow-income" />
            {t.income}
          </span>
          <span>
            <i className="dot flow-expense" />
            {t.totalOut}
          </span>
        </div>
      </div>
      <div
        className="bar-chart"
        role="img"
        aria-label={`${t.cashflow}: ${data.history.map((h) => `${h.month}: ${t.income} ${money(h.income)}, ${t.totalOut} ${money(h.expenses + h.bills + h.invested)}`).join("; ")}`}
      >
        <div className="chart-grid">
          {[1, 0.75, 0.5, 0.25, 0].map((p) => (
            <div key={p}>
              <span>
                {new Intl.NumberFormat(locale, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format((max * p) / 100)}
              </span>
              <i />
            </div>
          ))}
        </div>
        <div className="bar-groups">
          {data.history.map((h, i) => (
            <div
              className={`bar-group ${i === 5 ? "current" : ""}`}
              key={h.month}
            >
              <div className="bars">
                <div
                  className="bar income-bar"
                  style={{ height: `${(Math.max(0, h.income) / max) * 100}%` }}
                  title={`${t.income}: ${money(h.income)}`}
                />
                <div
                  className="bar expense-bar"
                  style={{
                    height: `${((h.expenses + h.bills + h.invested) / max) * 100}%`,
                  }}
                  title={`${t.totalOut}: ${money(h.expenses + h.bills + h.invested)}`}
                />
              </div>
              <span>
                {new Date(`${h.month}-01T12:00:00`)
                  .toLocaleDateString(locale, { month: "short" })
                  .replace(".", "")}
              </span>
            </div>
          ))}
        </div>
        {!active && <div className="chart-empty">{t.noChart}</div>}
      </div>
      <div className="chart-foot">
        <span>{t.totalOut}</span>
        <span>
          {t.expense} + {t.bill} + {t.investment}
        </span>
      </div>
    </section>
  );
}
export function SpendingChart({ data, t, money }: Props) {
  const map = new Map<string, number>();
  data.entries
    .filter((e) => e.kind === "expense" || e.kind === "bill")
    .forEach((e) =>
      map.set(
        e.categoryId || "",
        (map.get(e.categoryId || "") || 0) + e.amount,
      ),
    );
  const groups = [...map]
    .map(([id, amount]) => ({
      id,
      amount,
      tag: data.tags.find((t) => t.id === id),
    }))
    .sort((a, b) => b.amount - a.amount);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  let cursor = 0;
  const gradient = groups
    .filter((g) => g.amount > 0)
    .map((g) => {
      const start = cursor;
      cursor += (g.amount / total) * 100;
      return `${g.tag?.color || "#b9b9ae"} ${start}% ${cursor}%`;
    })
    .join(",");
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.spending}</h2>
          <p>{t.byCategory}</p>
        </div>
      </div>
      <div className="donut-row">
        <div
          className="donut"
          role="img"
          aria-label={`${t.totalOut}: ${money(total)}`}
          style={{
            background: gradient ? `conic-gradient(${gradient})` : "#eeeee8",
          }}
        >
          <div>
            <small>{t.totalOut}</small>
            <strong>{money(total)}</strong>
          </div>
        </div>
      </div>
      <div className="category-legend">
        {groups.length ? (
          groups.map((g) => (
            <div key={g.id}>
              <span>
                <i
                  className="dot"
                  style={{ background: g.tag?.color || "#b9b9ae" }}
                />
                {g.tag?.name || t.uncategorized}
              </span>
              <strong>
                {money(g.amount)}{" "}
                <small>
                  {total ? Math.round((g.amount / total) * 100) : 0}%
                </small>
              </strong>
            </div>
          ))
        ) : (
          <p className="muted center">{t.noData}</p>
        )}
      </div>
    </section>
  );
}
