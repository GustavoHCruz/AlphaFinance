import { MigrationInterface, QueryRunner } from "typeorm";

export class BillPaymentsAndTagOrder1788750000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tags ADD COLUMN position integer NOT NULL DEFAULT 0;
      WITH ordered AS (SELECT id, row_number() OVER (PARTITION BY type, kind ORDER BY name, id) - 1 AS position FROM tags)
      UPDATE tags SET position = ordered.position FROM ordered WHERE tags.id = ordered.id;
      ALTER TABLE entries ADD COLUMN "expectedAmount" integer CHECK ("expectedAmount" >= 0),
        ADD COLUMN "paidAmount" integer CHECK ("paidAmount" >= 0);
      UPDATE entries e SET "expectedAmount" = COALESCE(r.amount, e.amount), "paidAmount" = CASE WHEN e.done THEN e.amount ELSE NULL END
        FROM (SELECT e2.id, r2.amount FROM entries e2 LEFT JOIN recurrences r2 ON r2.id = e2."recurrenceId") r
        WHERE e.id = r.id AND e.kind = 'bill';
      UPDATE entries SET amount = "expectedAmount" WHERE kind = 'bill' AND NOT done;
      ALTER TABLE entries DROP COLUMN "goalId";
      ALTER TABLE recurrences DROP COLUMN "goalId";
      DROP TABLE goals;`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE goals (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name varchar NOT NULL, target integer NOT NULL, "monthlyTarget" integer NOT NULL DEFAULT 0, color varchar NOT NULL DEFAULT '#c49b45', deadline date);
      ALTER TABLE entries ADD COLUMN "goalId" uuid REFERENCES goals(id) ON DELETE SET NULL, DROP COLUMN "expectedAmount", DROP COLUMN "paidAmount";
      ALTER TABLE recurrences ADD COLUMN "goalId" uuid REFERENCES goals(id) ON DELETE SET NULL;
      ALTER TABLE tags DROP COLUMN position;`);
  }
}
