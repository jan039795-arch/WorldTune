import { sql } from 'drizzle-orm';

/** Parte un array en lotes: los INSERT gigantes revientan el limite de parametros. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** `excluded.columna` para los ON CONFLICT DO UPDATE. */
export function excluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

export function parseArgs(argv: string[]): { command: string; flags: Record<string, string | true> } {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { command, flags };
}

export function flagNumber(
  flags: Record<string, string | true>,
  name: string,
  fallback: number,
): number {
  const value = flags[name];
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
