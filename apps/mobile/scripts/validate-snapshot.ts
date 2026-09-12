/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateSnapshot } from "../src/application/snapshot-validation";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Uso: npm run validate:snapshot -- <arquivo.json>");
  const snapshot = validateSnapshot(JSON.parse(await readFile(resolve(input), "utf8")));
  console.log(JSON.stringify({
    valid: true,
    version: snapshot.version,
    tags: snapshot.tags.length,
    recurrences: snapshot.recurrences.length,
    transactions: snapshot.transactions.length,
    inboxEvents: snapshot.inboxEvents.length,
  }));
}

void main();
