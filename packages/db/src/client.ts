import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * Un solo punto de entrada a la base de datos con dos motores:
 *
 *  - `pglite`: Postgres embebido (WASM) en un directorio local. Sirve para
 *    desarrollar sin Docker ni cuenta en la nube, con la misma semantica de
 *    Postgres que produccion.
 *  - `postgres`: cualquier Postgres real (Neon, Supabase, VPS) via postgres-js.
 *
 * Se elige con DATABASE_DRIVER y no hay ninguna consulta especifica de motor,
 * para que pasar de local a Neon sea cambiar una variable de entorno.
 */

export type Database = PgDatabase<any, typeof schema, any>;

export type DriverName = 'pglite' | 'postgres';

let instance: Database | null = null;
let closeFn: (() => Promise<void>) | null = null;

export function resolveDriver(): DriverName {
  const explicit = process.env.DATABASE_DRIVER?.toLowerCase();
  const driver: DriverName =
    explicit === 'pglite' || explicit === 'postgres'
      ? explicit
      : process.env.DATABASE_URL
        ? 'postgres'
        : 'pglite';

  /*
   * En un despliegue, caer a PGlite es peor que fallar: crearía una base vacía
   * dentro del contenedor, el build "funcionaría" y el sitio saldría publicado
   * con cero emisoras. Un error aquí se ve; una web vacía se descubre tarde.
   */
  if (driver === 'pglite' && (process.env.VERCEL || process.env.CI)) {
    throw new Error(
      'Falta DATABASE_URL en el entorno de despliegue. Sin ella se usaría una base ' +
        'local vacía y el sitio se publicaría sin contenido.',
    );
  }
  return driver;
}

export async function getDb(): Promise<Database> {
  if (instance) return instance;

  if (resolveDriver() === 'pglite') {
    const [{ PGlite }, { drizzle }] = await Promise.all([
      import('@electric-sql/pglite'),
      import('drizzle-orm/pglite'),
    ]);
    const dir = process.env.PGLITE_DIR ?? './.pgdata';
    const client = new PGlite(dir);
    await client.waitReady;
    instance = drizzle(client, { schema }) as unknown as Database;
    closeFn = () => client.close();
    return instance;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL es obligatorio con DATABASE_DRIVER=postgres');
  const [{ default: postgres }, { drizzle }] = await Promise.all([
    import('postgres'),
    import('drizzle-orm/postgres-js'),
  ]);
  // max bajo: Neon cobra por conexion y la web usa funciones serverless.
  const client = postgres(url, { max: Number(process.env.DATABASE_POOL ?? 5), prepare: false });
  instance = drizzle(client, { schema }) as unknown as Database;
  closeFn = () => client.end({ timeout: 5 });
  return instance;
}

/** Cierra la conexion. Solo lo usa la ingesta; la web mantiene el pool vivo. */
export async function closeDb(): Promise<void> {
  await closeFn?.();
  instance = null;
  closeFn = null;
}

export { schema };
