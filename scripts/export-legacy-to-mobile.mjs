import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.trimStart().startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));
}

const root = path.resolve(import.meta.dirname, "..");
const values = parseEnv(await readFile(path.join(root, ".env"), "utf8"));
const client = new pg.Client({
  host: "127.0.0.1",
  port: Number(values.POSTGRES_PORT || 5432),
  user: values.POSTGRES_USER || "alphafinance",
  password: values.POSTGRES_PASSWORD || "alphafinance",
  database: values.POSTGRES_DB || "alphafinance",
});

const isoDate = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const timestampFor = (date) => `${isoDate(date)}T12:00:00.000Z`;
const query = async (text) => (await client.query(text)).rows;

try {
  await client.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const profiles = await query("SELECT locale,currency FROM profiles WHERE id=1");
  const tags = await query('SELECT id,name,color,type,kind,position FROM tags ORDER BY position,name,id');
  const recurrences = await query('SELECT id,description,kind,amount,day,"startMonth","endMonth","categoryId","labelIds",method,"percentageBps","incomeCategoryId" FROM recurrences');
  const entries = await query('SELECT id,description,kind,amount,date,month,done,"categoryId","labelIds",method,"recurrenceId",deleted,"percentageBps","incomeCategoryId",estimated,"isCarryover","expectedAmount","paidAmount" FROM entries');
  const monthSettings = await query("SELECT month,carryover FROM month_settings");
  await client.query("COMMIT");
  const profile = profiles[0] || { locale: "pt-BR", currency: "BRL" };
  const snapshot = {
    format: "alphafinance.snapshot",
    version: 1,
    createdAt: new Date().toISOString(),
    profile,
    tags,
    recurrences: recurrences.map((row) => ({
      id: row.id, description: row.description, kind: row.kind, amount: row.amount,
      day: row.day, startMonth: row.startMonth, endMonth: row.endMonth,
      categoryId: row.categoryId, labelIds: row.labelIds || [], method: row.method,
      percentageBps: row.percentageBps, incomeCategoryId: row.incomeCategoryId,
    })),
    transactions: entries.map((row) => ({
      id: row.id, description: row.description, kind: row.kind, amount: row.amount,
      date: isoDate(row.date), month: row.month, done: row.done, categoryId: row.categoryId,
      labelIds: row.labelIds || [], method: row.method, recurrenceId: row.recurrenceId,
      deleted: row.deleted, percentageBps: row.percentageBps, incomeCategoryId: row.incomeCategoryId,
      estimated: row.estimated, isCarryover: row.isCarryover, expectedAmount: row.expectedAmount,
      paidAmount: row.paidAmount, installmentGroupId: null,
      installmentNumber: null, installmentCount: null, inboxEventId: null,
      createdAt: timestampFor(row.date), updatedAt: timestampFor(row.date),
    })),
    inboxEvents: [],
    monthSettings,
  };
  const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "backups", `alphafinance-mobile-import-${snapshot.createdAt.replace(/[:.]/g, "-")}.json`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`Exportação concluída: ${target}\n${entries.length} movimentações, ${tags.length} classificações e ${recurrences.length} recorrências.\n`);
} catch (error) {
  try { await client.query("ROLLBACK"); } catch { }
  throw error;
} finally {
  await client.end();
}
