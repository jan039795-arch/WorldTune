#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

// La ingesta corre por cron y desde npm workspaces: el .env vive en la raiz del
// repo, no en el directorio de trabajo. Node lo carga sin dependencias externas.
for (const candidate of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(resolve(process.cwd(), candidate));
    break;
  } catch {
    // no existe: se usan las variables del entorno tal cual
  }
}
import { closeDb, getDb, ingestRuns, resolveDriver } from '@worldtune/db';
import { eq } from 'drizzle-orm';
import { checkStreams } from './check-streams';
import { log, type RunCounters } from './log';
import { recount } from './recount';
import { syncGeo } from './sync-geo';
import { syncRadio } from './sync-radio';
import { syncTv } from './sync-tv';
import { flagNumber, parseArgs } from './util';

/**
 * CLI de ingesta. Cada comando es idempotente y se puede volver a lanzar sin
 * duplicar nada, porque es lo que hace un cron fiable.
 *
 *   npm run ingest -- sync:geo
 *   npm run ingest -- sync:radio --country MX --limit 2000
 *   npm run ingest -- check:streams --kind radio --limit 300
 *   npm run ingest -- recount
 */

const HELP = `
worldtune ingest

  sync:geo                          paises, estados, ciudades, idiomas y generos
  sync:radio  [--country XX] [--limit N] [--page-size N] [--offset N] [--prune]
  sync:tv     [--limit N] [--prune]
  check:streams [--kind radio|tv|both] [--limit N] [--concurrency N] [--stale-hours N]
  recount                           recalcula los contadores de navegacion
  setup       [--country XX]        sync:geo + sync:radio + check:streams + recount
  help

Variables de entorno relevantes:
  DATABASE_DRIVER=pglite|postgres   (por defecto pglite si no hay DATABASE_URL)
  PGLITE_DIR=./.pgdata
  DATABASE_URL=postgres://...
  USER_AGENT=WorldTune/0.1          se envia a Radio Browser, es obligatorio
`;

let strayErrors = 0;

// Una peticion colateral que falla tarde (un cuerpo HTTP que el servidor cierra
// despues de que ya hayamos seguido) no debe abortar una ingesta de 10 minutos.
// Se cuenta, se registra y el trabajo continua.
process.on('unhandledRejection', (reason) => {
  strayErrors++;
  if (strayErrors <= 5) log.warn('promesa rechazada sin capturar', reason);
});
process.on('uncaughtException', (error) => {
  log.error('excepcion sin capturar', error);
  process.exitCode = 1;
});
process.on('exit', () => {
  if (strayErrors > 0) log.warn(`errores de red colaterales ignorados: ${strayErrors}`);
});

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === 'help' || flags.help) {
    console.log(HELP);
    return;
  }

  log.info(`motor de base de datos: ${resolveDriver()}`);

  const runner = async (task: string, fn: () => Promise<RunCounters>): Promise<void> => {
    const db = await getDb();
    const id = randomUUID();
    await db.insert(ingestRuns).values({ id, task }).catch(() => {
      // Si la tabla no existe todavia, el trabajo sigue: el log es secundario.
    });
    try {
      const counters = await fn();
      await db
        .update(ingestRuns)
        .set({ finishedAt: new Date(), ...counters })
        .where(eq(ingestRuns.id, id))
        .catch(() => {});
      log.info(
        `${task} terminado: ${counters.inserted} escritos, ${counters.updated} actualizados, ` +
          `${counters.deactivated} desactivados, ${counters.errors} con error`,
      );
    } catch (error) {
      await db
        .update(ingestRuns)
        .set({ finishedAt: new Date(), errors: 1, notes: String(error).slice(0, 500) })
        .where(eq(ingestRuns.id, id))
        .catch(() => {});
      throw error;
    }
  };

  switch (command) {
    case 'sync:geo':
      await runner('sync:geo', () => syncGeo());
      break;

    case 'sync:radio':
      await runner('sync:radio', () =>
        syncRadio({
          countryCode: typeof flags.country === 'string' ? flags.country : undefined,
          limit: flags.limit ? flagNumber(flags, 'limit', 0) : undefined,
          pageSize: flagNumber(flags, 'page-size', 1000),
          offset: flags.offset ? flagNumber(flags, 'offset', 0) : undefined,
          prune: flags.prune === true,
        }),
      );
      break;

    case 'sync:tv':
      await runner('sync:tv', () =>
        syncTv({
          limit: flags.limit ? flagNumber(flags, 'limit', 0) : undefined,
          prune: flags.prune === true,
        }),
      );
      break;

    case 'check:streams':
      await runner('check:streams', () =>
        checkStreams({
          kind: (flags.kind as 'radio' | 'tv' | 'both') ?? 'both',
          limit: flagNumber(flags, 'limit', 500),
          concurrency: flagNumber(flags, 'concurrency', 16),
          staleHours: flagNumber(flags, 'stale-hours', 6),
          timeoutMs: flagNumber(flags, 'timeout', 12_000),
        }),
      );
      break;

    case 'recount':
      await runner('recount', () => recount());
      break;

    // Atajo para dejar el catalogo listo desde cero en una sola orden.
    case 'setup': {
      const country = typeof flags.country === 'string' ? flags.country : undefined;
      const limit = flags.limit ? flagNumber(flags, 'limit', 0) : undefined;
      await runner('sync:geo', () => syncGeo());
      await runner('sync:radio', () => syncRadio({ countryCode: country, limit }));
      await runner('check:streams', () =>
        checkStreams({ kind: 'radio', limit: flagNumber(flags, 'check', 300) }),
      );
      await runner('recount', () => recount());
      break;
    }

    default:
      console.log(`comando desconocido: ${command}`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main()
  .then(() => closeDb())
  .catch(async (error) => {
    log.error(error instanceof Error ? error.stack ?? error.message : String(error));
    await closeDb().catch(() => {});
    process.exitCode = 1;
  });
