import { probeStream } from '@worldtune/sources';

/**
 * Comprueba una URL suelta desde la linea de ordenes. Sirve para validar una
 * senal antes de anadirla al catalogo curado:
 *   npx tsx src/tools/probe-url.ts <url> [<url>...]
 */
async function main(): Promise<void> {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.log('uso: tsx src/tools/probe-url.ts <url> [<url>...]');
    return;
  }
  for (const url of urls) {
    const result = await probeStream(url, { timeoutMs: 15_000 });
    console.log(`\n${url}`);
    console.log(
      `  estado=${result.status} http=${result.httpStatus} cors=${result.corsAllowed} ` +
        `tipo=${result.contentType ?? '-'} contenedor=${result.container} ${result.latencyMs}ms`,
    );
    if (result.finalUrl !== url) console.log(`  redirige a: ${result.finalUrl}`);
    if (result.error) console.log(`  error: ${result.error}`);
  }
}

void main();
