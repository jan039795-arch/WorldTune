/** Registro minimo y legible. La ingesta corre en cron: los logs son la unica ventana. */

const started = Date.now();

function stamp(): string {
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  return `[${seconds.padStart(6)}s]`;
}

export const log = {
  info(message: string, ...rest: unknown[]): void {
    console.log(`${stamp()} ${message}`, ...rest);
  },
  warn(message: string, ...rest: unknown[]): void {
    console.warn(`${stamp()} aviso: ${message}`, ...rest);
  },
  error(message: string, ...rest: unknown[]): void {
    console.error(`${stamp()} ERROR: ${message}`, ...rest);
  },
  /** Progreso en una sola linea, para no llenar el log con miles de filas. */
  progress(done: number, total: number | null, label: string): void {
    const suffix = total ? `${done}/${total}` : `${done}`;
    process.stdout.write(`\r${stamp()} ${label}: ${suffix}      `);
    if (total && done >= total) process.stdout.write('\n');
  },
  done(label: string): void {
    process.stdout.write('\n');
    console.log(`${stamp()} ${label}`);
  },
};

export interface RunCounters {
  inserted: number;
  updated: number;
  deactivated: number;
  errors: number;
}

export function newCounters(): RunCounters {
  return { inserted: 0, updated: 0, deactivated: 0, errors: 0 };
}
