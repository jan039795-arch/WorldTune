import { resolve } from 'node:path';

/**
 * Carga del .env, y tiene que ser el PRIMER import de la CLI.
 *
 * En ESM los módulos importados se evalúan antes que el cuerpo del que los
 * importa. Si la carga del .env vive en el cuerpo de cli.ts, para cuando se
 * ejecuta ya se han evaluado `@worldtune/sources` y compañía, y cualquier
 * variable leída a nivel de módulo (el `USER_AGENT` que enviamos a Radio
 * Browser, el directorio de caché) se habrá quedado con su valor por defecto
 * sin avisar de nada.
 *
 * En CI no hay fichero .env y las variables vienen del entorno: entonces esto no
 * hace nada y todo funciona igual.
 */
for (const candidate of ['.env', '../../.env']) {
  try {
    process.loadEnvFile(resolve(process.cwd(), candidate));
    break;
  } catch {
    // no existe: se usan las variables del entorno tal cual
  }
}
