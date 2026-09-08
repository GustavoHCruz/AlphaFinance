import { MigrationInterface, QueryRunner } from "typeorm";

export class MonthlyPlanning1788740000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tags ADD COLUMN kind varchar NOT NULL DEFAULT 'expense'
      CHECK (kind IN ('income','expense','bill','investment'));
      CREATE TABLE month_settings (month varchar PRIMARY KEY, carryover boolean NOT NULL DEFAULT false);
      ALTER TABLE entries ADD COLUMN "isCarryover" boolean NOT NULL DEFAULT false,
        ADD COLUMN estimated boolean NOT NULL DEFAULT false;
      CREATE UNIQUE INDEX entries_carryover_month ON entries(month) WHERE "isCarryover";
      ALTER TABLE entries ADD COLUMN "percentageBps" integer CHECK ("percentageBps" BETWEEN 1 AND 10000),
        ADD COLUMN "incomeCategoryId" uuid REFERENCES tags(id) ON DELETE RESTRICT;
      ALTER TABLE recurrences ADD COLUMN "percentageBps" integer CHECK ("percentageBps" BETWEEN 1 AND 10000),
        ADD COLUMN "incomeCategoryId" uuid REFERENCES tags(id) ON DELETE RESTRICT;`);

    // Preserve old classifications. A tag shared by multiple kinds becomes an
    // independent copy for each kind, and its existing links are remapped.
    const tags: { id: string; name: string; color: string; type: string }[] =
      await q.query("SELECT * FROM tags");
    for (const tag of tags) {
      const used: { kind: string }[] = await q.query(
        `SELECT DISTINCT kind FROM (
        SELECT kind FROM entries WHERE "categoryId" = $1 OR "labelIds" ? $1::text
        UNION SELECT kind FROM recurrences WHERE "categoryId" = $1 OR "labelIds" ? $1::text
      ) kinds ORDER BY kind`,
        [tag.id],
      );
      const kinds = used.length ? used.map((r) => r.kind) : ["expense"];
      await q.query("UPDATE tags SET kind = $1 WHERE id = $2", [
        kinds[0],
        tag.id,
      ]);
      for (const kind of kinds.slice(1)) {
        const [copy] = await q.query(
          "INSERT INTO tags (name,color,type,kind) VALUES ($1,$2,$3,$4) RETURNING id",
          [tag.name, tag.color, tag.type, kind],
        );
        for (const table of ["entries", "recurrences"]) {
          await q.query(
            `UPDATE ${table} SET "categoryId" = $1 WHERE "categoryId" = $2 AND kind = $3`,
            [copy.id, tag.id, kind],
          );
          await q.query(
            `UPDATE ${table} SET "labelIds" = (SELECT jsonb_agg(CASE WHEN value = $2 THEN $1::text ELSE value END) FROM jsonb_array_elements_text("labelIds")) WHERE "labelIds" ? $2 AND kind = $3`,
            [copy.id, tag.id, kind],
          );
        }
      }
    }
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE entries DROP COLUMN "incomeCategoryId", DROP COLUMN "percentageBps", DROP COLUMN estimated, DROP COLUMN "isCarryover";
      ALTER TABLE recurrences DROP COLUMN "incomeCategoryId", DROP COLUMN "percentageBps";
      DROP TABLE month_settings;
      ALTER TABLE tags DROP COLUMN kind;`);
  }
}
