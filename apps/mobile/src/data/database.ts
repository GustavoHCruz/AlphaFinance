import * as SQLite from "expo-sqlite";

export const DATABASE_NAME = "alphafinance.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const migrations: Array<{ version: number; sql: string; foreignKeysOff?: boolean }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE profiles (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        locale TEXT NOT NULL DEFAULT 'pt-BR' CHECK (locale IN ('pt-BR','en-US')),
        currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL','USD','EUR'))
      );
      INSERT INTO profiles(id) VALUES (1);

      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
        color TEXT NOT NULL DEFAULT '#c49b45',
        type TEXT NOT NULL CHECK (type IN ('category','label')),
        kind TEXT NOT NULL CHECK (kind IN ('income','expense','bill','investment')),
        position INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('checking','savings','cash','other')),
        institution TEXT,
        color TEXT NOT NULL DEFAULT '#49663f',
        opening_balance INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1))
      );

      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        last_four TEXT CHECK (last_four IS NULL OR length(last_four) = 4),
        closing_day INTEGER CHECK (closing_day IS NULL OR closing_day BETWEEN 1 AND 31),
        due_day INTEGER CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
        limit_cents INTEGER CHECK (limit_cents IS NULL OR limit_cents >= 0),
        color TEXT NOT NULL DEFAULT '#c49b45',
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1))
      );

      CREATE TABLE recurrences (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense','bill','investment')),
        amount INTEGER NOT NULL,
        day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
        start_month TEXT NOT NULL,
        end_month TEXT,
        category_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
        method TEXT NOT NULL DEFAULT 'pix',
        percentage_bps INTEGER CHECK (percentage_bps BETWEEN 1 AND 10000),
        income_category_id TEXT REFERENCES tags(id) ON DELETE RESTRICT,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        card_id TEXT REFERENCES cards(id) ON DELETE SET NULL
      );

      CREATE TABLE recurrence_labels (
        recurrence_id TEXT NOT NULL REFERENCES recurrences(id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (recurrence_id, label_id)
      );

      CREATE TABLE inbox_events (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK (source IN ('MANUAL','ANDROID_NOTIFICATION','CSV_IMPORT','FUTURE')),
        source_event_id TEXT,
        institution TEXT,
        amount INTEGER,
        suggested_kind TEXT CHECK (suggested_kind IS NULL OR suggested_kind IN ('income','expense','bill','investment')),
        suggested_method TEXT CHECK (suggested_method IS NULL OR suggested_method IN ('pix','credit','debit','cash','transfer')),
        description TEXT,
        occurred_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','IGNORED')),
        confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
        transaction_id TEXT,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        UNIQUE (source, source_event_id)
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense','bill','investment')),
        amount INTEGER NOT NULL,
        date TEXT NOT NULL,
        month TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
        category_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
        method TEXT NOT NULL DEFAULT 'pix',
        recurrence_id TEXT REFERENCES recurrences(id) ON DELETE SET NULL,
        deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0,1)),
        percentage_bps INTEGER CHECK (percentage_bps BETWEEN 1 AND 10000),
        income_category_id TEXT REFERENCES tags(id) ON DELETE RESTRICT,
        estimated INTEGER NOT NULL DEFAULT 0 CHECK (estimated IN (0,1)),
        is_carryover INTEGER NOT NULL DEFAULT 0 CHECK (is_carryover IN (0,1)),
        expected_amount INTEGER,
        paid_amount INTEGER,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
        installment_group_id TEXT,
        installment_number INTEGER,
        installment_count INTEGER,
        inbox_event_id TEXT REFERENCES inbox_events(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (recurrence_id, month)
      );

      CREATE TABLE transaction_labels (
        transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (transaction_id, label_id)
      );

      CREATE TABLE month_settings (
        month TEXT PRIMARY KEY,
        carryover INTEGER NOT NULL DEFAULT 0 CHECK (carryover IN (0,1))
      );

      CREATE TABLE provider_state (
        provider_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE INDEX transactions_month_idx ON transactions(month, deleted, date DESC);
      CREATE UNIQUE INDEX transactions_carryover_month_idx
        ON transactions(month) WHERE is_carryover = 1;
      CREATE INDEX inbox_status_idx ON inbox_events(status, occurred_at DESC);
      CREATE INDEX cards_account_idx ON cards(account_id);
      CREATE INDEX installments_group_idx ON transactions(installment_group_id, installment_number);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE INDEX transactions_inbox_event_idx
        ON transactions(inbox_event_id) WHERE inbox_event_id IS NOT NULL;
    `,
  },
  {
    version: 4,
    foreignKeysOff: true,
    sql: `
      CREATE TABLE recurrences_v4 (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense','bill','investment')),
        amount INTEGER NOT NULL,
        day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
        start_month TEXT NOT NULL,
        end_month TEXT,
        category_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
        method TEXT NOT NULL DEFAULT 'pix',
        percentage_bps INTEGER CHECK (percentage_bps BETWEEN 1 AND 10000),
        income_category_id TEXT REFERENCES tags(id) ON DELETE RESTRICT
      );

      CREATE TABLE recurrence_labels_v4 (
        recurrence_id TEXT NOT NULL REFERENCES recurrences_v4(id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (recurrence_id, label_id)
      );

      CREATE TABLE transactions_v4 (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense','bill','investment')),
        amount INTEGER NOT NULL,
        date TEXT NOT NULL,
        month TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
        category_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
        method TEXT NOT NULL DEFAULT 'pix',
        recurrence_id TEXT REFERENCES recurrences_v4(id) ON DELETE SET NULL,
        deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0,1)),
        percentage_bps INTEGER CHECK (percentage_bps BETWEEN 1 AND 10000),
        income_category_id TEXT REFERENCES tags(id) ON DELETE RESTRICT,
        estimated INTEGER NOT NULL DEFAULT 0 CHECK (estimated IN (0,1)),
        is_carryover INTEGER NOT NULL DEFAULT 0 CHECK (is_carryover IN (0,1)),
        expected_amount INTEGER,
        paid_amount INTEGER,
        installment_group_id TEXT,
        installment_number INTEGER,
        installment_count INTEGER,
        inbox_event_id TEXT REFERENCES inbox_events(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (recurrence_id, month)
      );

      CREATE TABLE transaction_labels_v4 (
        transaction_id TEXT NOT NULL REFERENCES transactions_v4(id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (transaction_id, label_id)
      );

      INSERT INTO recurrences_v4
        (id,description,kind,amount,day,start_month,end_month,category_id,method,percentage_bps,income_category_id)
        SELECT id,description,kind,amount,day,start_month,end_month,category_id,method,percentage_bps,income_category_id
        FROM recurrences;
      INSERT INTO recurrence_labels_v4 SELECT recurrence_id,label_id FROM recurrence_labels;
      INSERT INTO transactions_v4
        (id,description,kind,amount,date,month,done,category_id,method,recurrence_id,deleted,percentage_bps,income_category_id,estimated,is_carryover,expected_amount,paid_amount,installment_group_id,installment_number,installment_count,inbox_event_id,created_at,updated_at)
        SELECT id,description,kind,amount,date,month,done,category_id,method,recurrence_id,deleted,percentage_bps,income_category_id,estimated,is_carryover,expected_amount,paid_amount,installment_group_id,installment_number,installment_count,inbox_event_id,created_at,updated_at
        FROM transactions;
      INSERT INTO transaction_labels_v4 SELECT transaction_id,label_id FROM transaction_labels;

      DROP TABLE transaction_labels;
      DROP TABLE transactions;
      DROP TABLE recurrence_labels;
      DROP TABLE recurrences;
      DROP TABLE cards;
      DROP TABLE accounts;

      ALTER TABLE recurrences_v4 RENAME TO recurrences;
      ALTER TABLE recurrence_labels_v4 RENAME TO recurrence_labels;
      ALTER TABLE transactions_v4 RENAME TO transactions;
      ALTER TABLE transaction_labels_v4 RENAME TO transaction_labels;

      CREATE INDEX transactions_month_idx ON transactions(month, deleted, date DESC);
      CREATE UNIQUE INDEX transactions_carryover_month_idx
        ON transactions(month) WHERE is_carryover = 1;
      CREATE INDEX installments_group_idx ON transactions(installment_group_id, installment_number);
      CREATE INDEX transactions_inbox_event_idx
        ON transactions(inbox_event_id) WHERE inbox_event_id IS NOT NULL;
    `,
  },
  {
    version: 5,
    sql: `
      UPDATE transactions
      SET description = 'Saldo do mês anterior'
      WHERE is_carryover = 1;
    `,
  },
  {
    version: 6,
    sql: `
      ALTER TABLE tags
      ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1));
    `,
  },
];

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
    await db.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    let version = result?.user_version ?? 0;
    for (const migration of migrations) {
      if (migration.version <= version) continue;
      if (migration.foreignKeysOff) await db.execAsync("PRAGMA foreign_keys = OFF");
      try {
        await db.withExclusiveTransactionAsync(async (tx) => {
          await tx.execAsync(migration.sql);
          const violations = await tx.getAllAsync("PRAGMA foreign_key_check");
          if (violations.length) throw new Error(`A migração ${migration.version} criou referências inválidas.`);
          await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
        });
      } finally {
        if (migration.foreignKeysOff) await db.execAsync("PRAGMA foreign_keys = ON");
      }
      version = migration.version;
    }
    return db;
  });
  return databasePromise;
}

export async function checkDatabaseIntegrity(): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ integrity_check: string }>("PRAGMA integrity_check");
  return result?.integrity_check === "ok";
}
