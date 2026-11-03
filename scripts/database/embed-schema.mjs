import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'database/migrations';
const files = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
const entries = files.map((f) => {
  const version = Number(f.slice(0, 3));
  const sql = readFileSync(`${dir}/${f}`, 'utf8');
  return `  ${version}: ${JSON.stringify(sql)},`;
});
const out = `// GENERATED FILE — do not edit. Run: node scripts/database/embed-schema.mjs\n// Source of truth: database/migrations/*.sql\nexport const MIGRATION_SQL: Record<number, string> = {\n${entries.join('\n')}\n};\nexport const LATEST_SCHEMA_VERSION = ${files.length};\n`;
writeFileSync('src/core/schema.generated.ts', out);
console.log(`Embedded ${files.length} migrations into src/core/schema.generated.ts`);
