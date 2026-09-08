"use client";
import { cents } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { Entry, Kind, Profile, Tag } from "@/lib/types";

type Save = (path: string, method: string, body: unknown) => Promise<boolean>;
type Common = { t: Dictionary; save: Save; busy: boolean; close: () => void };
export { EntryForm } from "./entry-form";
export function BillPaymentForm({
  t,
  entry,
  currency,
  locale,
  save,
  busy,
  close,
}: Common & { entry: Entry; currency: string; locale: string }) {
  const expected = entry.expectedAmount ?? entry.amount;
  const investment = entry.kind === "investment";
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await save(`entries/${entry.id}`, "PATCH", {
          done: true,
          paidAmount: cents(f.get("paidAmount")),
        });
      }}
    >
      <div className="payment-summary">
        <strong>{entry.description}</strong>
        <span>
          {t.expectedAmount}:{" "}
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
          }).format(expected / 100)}
        </span>
      </div>
      <label>
        {investment ? t.savedAmount : t.paidAmount} ({currency})
        <input
          name="paidAmount"
          type="number"
          step="0.01"
          min="0"
          max="10000000"
          required
          autoFocus
          defaultValue={(entry.paidAmount ?? expected) / 100}
        />
        <small>{investment ? t.confirmInvestmentHint : t.paidAmountHint}</small>
      </label>
      <FormActions t={t} busy={busy} close={close} />
    </form>
  );
}
export function CopyTagForm({
  t,
  tag,
  save,
  busy,
  close,
}: Common & { tag: Tag }) {
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await save(`tags/${tag.id}/copy`, "POST", { kind: f.get("kind") });
      }}
    >
      <p>
        <strong>{tag.name}</strong> — {t.copyHint}
      </p>
      <label>
        {t.copyTo}
        <select
          name="kind"
          defaultValue={(
            ["income", "expense", "bill", "investment"] as Kind[]
          ).find((kind) => kind !== tag.kind)}
        >
          {(["income", "expense", "bill", "investment"] as Kind[])
            .filter(
              (kind) =>
                kind !== tag.kind &&
                (tag.type !== "category" || kind !== "investment"),
            )
            .map((kind) => (
              <option key={kind} value={kind}>
                {t[kind]}
              </option>
            ))}
        </select>
      </label>
      <FormActions t={t} busy={busy} close={close} />
    </form>
  );
}
export function TagForm({
  t,
  tag,
  type,
  initialKind,
  save,
  busy,
  close,
}: Common & { tag?: Tag; type: Tag["type"]; initialKind?: Kind }) {
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await save(tag ? `tags/${tag.id}` : "tags", tag ? "PUT" : "POST", {
          name: String(f.get("name")).trim(),
          color: f.get("color"),
          type,
          kind: tag?.kind || f.get("kind"),
        });
      }}
    >
      <label>
        {t.tagKind}
        <select
          name="kind"
          defaultValue={tag?.kind || initialKind || "expense"}
          disabled={!!tag}
        >
          {(["income", "expense", "bill", "investment"] as Kind[])
            .filter((k) => type !== "category" || k !== "investment")
            .map((k) => (
              <option key={k} value={k}>
                {t[k]}
              </option>
            ))}
        </select>
        <small>{t.tagKindHint}</small>
      </label>
      <label>
        {t.name}
        <input
          name="name"
          required
          maxLength={50}
          defaultValue={tag?.name}
          autoFocus
        />
      </label>
      <label>
        {t.color}
        <input
          name="color"
          type="color"
          defaultValue={tag?.color || "#c49b45"}
        />
      </label>
      <FormActions t={t} busy={busy} close={close} />
    </form>
  );
}
export function SettingsForm({
  profile,
  t,
  save,
  busy,
}: {
  profile: Profile;
  t: Dictionary;
  save: Save;
  busy: boolean;
}) {
  return (
    <form
      className="profile-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await save("profile", "PUT", {
          locale: f.get("locale"),
          currency: f.get("currency"),
        });
      }}
    >
      <section className="panel profile-panel">
        <h2>{t.preferences}</h2>
        <label>
          {t.language}
          <select name="locale" defaultValue={profile.locale}>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <label>
          {t.currency}
          <select name="currency" defaultValue={profile.currency}>
            <option value="BRL">BRL — Real</option>
            <option value="USD">USD — Dollar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
          <small>{t.currencyHint}</small>
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? t.saving : t.save}
        </button>
      </section>
    </form>
  );
}
function FormActions({
  t,
  busy,
  close,
}: {
  t: Dictionary;
  busy: boolean;
  close: () => void;
}) {
  return (
    <div className="form-actions">
      <button
        className="button secondary"
        type="button"
        onClick={close}
        disabled={busy}
      >
        {t.cancel}
      </button>
      <button className="button primary" disabled={busy}>
        {busy ? t.saving : t.save}
      </button>
    </div>
  );
}
