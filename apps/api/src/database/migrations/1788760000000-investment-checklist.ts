import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvestmentChecklist1788760000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE entries SET done = NOT estimated,
      "expectedAmount" = amount, "paidAmount" = CASE WHEN estimated THEN NULL ELSE amount END,
      "categoryId" = NULL, method = 'transfer' WHERE kind = 'investment'`);
    await q.query(
      `UPDATE recurrences SET "categoryId" = NULL, method = 'transfer' WHERE kind = 'investment'`,
    );
    await q.query(`DELETE FROM tags WHERE kind = 'investment' AND type = 'category'`);
    await q.query(`ALTER TABLE profiles DROP COLUMN name, DROP COLUMN photo`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE profiles ADD COLUMN name varchar NOT NULL DEFAULT '', ADD COLUMN photo text NOT NULL DEFAULT ''`,
    );
  }
}
