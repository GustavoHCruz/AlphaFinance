export function formatMoney(cents: number, currency = "BRL", locale = "pt-BR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function parseMoney(value: string): number {
  const normalized = value.trim().replace(/R\$|\s/g, "");
  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const number = Number(decimal);
  if (!Number.isFinite(number)) throw new Error("Informe um valor válido.");
  return Math.round(number * 100);
}

export function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localMonth() { return localDate().slice(0, 7); }

export function monthLabel(month: string, locale = "pt-BR") {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function moveMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
