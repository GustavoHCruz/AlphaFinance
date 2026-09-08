import { MigrationInterface, QueryRunner } from "typeorm";
export class InitialSchema1788650000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE tags (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name varchar NOT NULL, color varchar NOT NULL DEFAULT '#c49b45', type varchar NOT NULL CHECK (type IN ('category','label')));
      CREATE TABLE goals (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name varchar NOT NULL, target integer NOT NULL CHECK (target > 0), "monthlyTarget" integer NOT NULL DEFAULT 0, color varchar NOT NULL DEFAULT '#c49b45', deadline date);
      CREATE TABLE profiles (id integer PRIMARY KEY, name varchar NOT NULL DEFAULT '', photo text NOT NULL DEFAULT '', locale varchar NOT NULL DEFAULT 'pt-BR', currency varchar NOT NULL DEFAULT 'BRL');
      CREATE TABLE recurrences (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), description varchar NOT NULL, kind varchar NOT NULL CHECK (kind IN ('income','expense','bill','investment')), amount integer NOT NULL, day integer NOT NULL CHECK (day BETWEEN 1 AND 31), "startMonth" varchar NOT NULL, "endMonth" varchar, "categoryId" uuid REFERENCES tags(id) ON DELETE SET NULL, "labelIds" jsonb NOT NULL DEFAULT '[]', method varchar NOT NULL DEFAULT 'pix', "goalId" uuid REFERENCES goals(id) ON DELETE SET NULL);
      CREATE TABLE entries (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), description varchar NOT NULL, kind varchar NOT NULL CHECK (kind IN ('income','expense','bill','investment')), amount integer NOT NULL, date date NOT NULL, month varchar NOT NULL, done boolean NOT NULL DEFAULT false, "categoryId" uuid REFERENCES tags(id) ON DELETE SET NULL, "labelIds" jsonb NOT NULL DEFAULT '[]', method varchar NOT NULL DEFAULT 'pix', "goalId" uuid REFERENCES goals(id) ON DELETE SET NULL, "recurrenceId" uuid REFERENCES recurrences(id) ON DELETE SET NULL, deleted boolean NOT NULL DEFAULT false, UNIQUE("recurrenceId", month));
      CREATE INDEX entries_month_idx ON entries(month);
      INSERT INTO profiles(id) VALUES(1);
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE entries, recurrences, profiles, goals, tags");
  }
}
