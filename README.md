# WorldTune

Radio y televisión en línea de todo el mundo, organizadas por **país → estado → ciudad → género**.

Web en Next.js y apps de Android/iOS en Expo, compartiendo catálogo, API y cliente tipado.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env            # y también apps/web/.env.local
npm run db:push                 # crea el esquema en la base local (PGlite)
npm run ingest -- setup --country MX --limit 3000
npm run dev                     # http://localhost:3000
```

`setup` encadena `sync:geo`, `sync:radio`, `check:streams` y `recount`. Sin `--country` carga el
catálogo mundial completo (~58 000 emisoras, unos 8 minutos).

> **Importante con PGlite:** es un Postgres embebido de un solo proceso. **No ejecutes la ingesta y
> el servidor web a la vez** sobre el mismo directorio `.pgdata`: el segundo proceso aborta el WASM y
> la web devuelve 500. Para trabajar con ambos en paralelo, apunta `DATABASE_URL` a un Postgres real
> (Neon, Supabase o local) y pon `DATABASE_DRIVER=postgres`.

---

## Estructura

```
packages/core        tipos, slugs, taxonomía de géneros, resolución geográfica, análisis de streams
packages/db          esquema Drizzle, cliente (PGlite | Postgres) y todas las consultas de lectura
packages/sources     clientes de Radio Browser e iptv-org, y el verificador de streams
packages/api-client  cliente tipado de la API, compartido por la web y las apps
apps/ingest          CLI de sincronización y verificación (se ejecuta por cron)
apps/web             Next.js 15 (App Router): navegación, reproductor y API /api/v1
apps/mobile          Expo (React Native): Android e iOS
```

Las consultas viven en `packages/db/src/queries.ts`, no en los componentes, para que las apps móviles
y una futura API pública usen exactamente las mismas.

---

## Apps móviles (apps/mobile)

Expo SDK 57 con expo-router. El teléfono **no** habla con la base de datos: consume
`/api/v1` a través de `@worldtune/api-client`, el mismo cliente tipado que usa la web, para que
un cambio de contrato rompa la compilación en todas las plataformas a la vez.

```bash
npm run dev                       # la API tiene que estar corriendo
npm run start -w @worldtune/mobile    # luego escanea el QR con Expo Go
npm run web -w @worldtune/mobile      # o pruébala en el navegador
```

En desarrollo la app deduce la IP de tu máquina desde el servidor de Expo (en un teléfono
`localhost` es el propio teléfono). En producción manda `EXPO_PUBLIC_API_URL`.

**Diferencia deliberada con la web:** la app **no usa el relay**. Una app nativa puede abrir
`http://` directamente, así que reproduce el origen: menos saltos, menos latencia y cero ancho de
banda nuestro. Esa decisión vive en `resolveStreamUrl()`, en el cliente compartido.

**Estado del audio:** hoy usa `expo-audio` (primera parte, garantizado compatible con el SDK) y
toda la interacción con el motor está aislada en `src/lib/player.tsx`. Si hacen falta controles de
pantalla de bloqueo, Android Auto o CarPlay, se sustituye por `react-native-track-player` tocando
solo ese archivo. **La reproducción en un dispositivo real está sin probar**: en este entorno no hay
emulador ni teléfono, así que lo verificado es que la app compila, navega, pagina y llama bien a la
API, no que suene.

---

## Canales curados a mano (data/canales-curados.json)

iptv-org conoce canales grandes de los que no tiene ninguna señal, y la ingesta automática los
descarta por no tener stream. Ese archivo los recupera y cubre dos casos:

| Caso | Qué se hace | Ejemplo |
|---|---|---|
| El canal publica su HLS en su propia web | Se añade la URL y se reproduce normal | **Canal Once** (IPN) |
| Solo se puede ver en su reproductor (sesión con token o DRM) | Se lista con `soloSitioOficial` y un botón que enlaza a su web | **Azteca 7** |

Todo lo que entra por ahí queda marcado como `curated` en la base: es la lista blanca que haría
falta para publicar en las tiendas.

Para comprobar una señal antes de añadirla:

```bash
npx tsx src/tools/probe-url.ts "https://ejemplo.tv/senal.m3u8"    # desde apps/ingest
```

Dice si responde, qué contenedor es y —lo que más importa— si envía CORS: sin esa cabecera, hls.js
no puede leerlo desde un navegador aunque el canal esté perfectamente vivo.

---

## Rankings (Top 10)

Radio y televisión se miden distinto, y la interfaz lo dice en vez de disimularlo.

| Lista | Fuente | Qué mide exactamente |
|---|---|---|
| **Radio — más escuchadas ahora** | Radio Browser (`clickcount`) | Escuchas de las **últimas 24 horas** en toda su comunidad mundial |
| **Radio — favoritas de siempre** | Radio Browser (`votes`) | Votos acumulados que solo suben: reputación histórica |
| **Radio — suben hoy** | Radio Browser (`clicktrend`) | Diferencia de escuchas frente al día anterior |
| **Televisión** | Nosotros | Reproducciones contadas en esta plataforma |

> Un detalle que cambia el significado de todo: `clickcount` **no es un acumulado histórico**,
> son las escuchas de las últimas 24 h, y `votes` sí es acumulado. Etiquetar el primero como
> «escuchas» a secas haría creer que MANGORADIO tiene 575 oyentes en toda su historia, cuando en
> realidad tiene 824 000 votos y 575 escuchas hoy. Por eso son dos listas distintas y cada cifra
> lleva su unidad escrita al lado.

**Por qué la televisión no tiene un top mundial:** iptv-org publica los canales y sus señales,
pero **ningún dato de espectadores**, y no existe ninguna fuente abierta equivalente. Así que ese
ranking se construye con las reproducciones reales de la plataforma y **empieza vacío**. Ordenarlo
por calidad de señal o por tamaño del canal daría una lista con aspecto de ranking que en realidad
no mide audiencia, y eso es peor que no tenerlo.

El contador propio vive en `play_stats` (una fila por elemento y día, no un evento por
reproducción: basta para un top semanal y la tabla se mantiene pequeña) más un acumulado en
`stations.play_count` / `channels.play_count`. No guarda quién reprodujo qué.

La API devuelve siempre la procedencia junto a los datos, para que ningún cliente pueda presentar
como audiencia mundial algo que son reproducciones propias:

```bash
curl "http://localhost:3000/api/v1/top?source=global&limit=10"
# { "stations": { "source": "radio-browser", "metric": "clicks", "data": [...] },
#   "channels": { "source": "local", "metric": "plays", "data": [...] } }
```

---

## Comandos de ingesta

```bash
npm run ingest -- sync:geo                       # países, estados, ciudades, idiomas, géneros
npm run ingest -- sync:radio [--country MX] [--limit N] [--offset N] [--prune]
npm run ingest -- sync:tv [--prune]
npm run ingest -- check:streams --kind radio --limit 1500 --concurrency 24
npm run ingest -- recount                        # contadores de navegación
```

Todos son idempotentes. `--offset` reanuda una sincronización cortada sin repetir lo ya hecho.

Cadencia recomendada en cron (GitHub Actions sirve y es gratis):

| Tarea | Frecuencia |
|---|---|
| `sync:geo` | mensual |
| `sync:radio` / `sync:tv` | diaria |
| `check:streams` | cada 6 h, por lotes |
| `recount` | tras cada sincronización |

---

## De dónde salen los datos

- **Radio:** [Radio Browser](https://api.radio-browser.info). Los mirrors se descubren por DNS (nunca
  se fija uno en el código) y se envía un `User-Agent` propio, como pide el proyecto. Cada
  reproducción se reporta a su API: su ranking de popularidad se construye con eso.
- **Televisión:** [iptv-org](https://github.com/iptv-org/api). Se aplica **siempre** `blocklist.json`
  (retiradas por DMCA y contenido adulto) y el flag `is_nsfw`.
- **Geografía:** también de iptv-org, porque ya trae códigos ISO-3166-1/2 y la relación
  ciudad → estado → país resuelta.

### El problema real de los datos: la geografía de la radio

Radio Browser entrega el estado como **texto libre** y no entrega ciudad. La resolución
(`packages/core/src/geo.ts`) hace tres cosas que importan:

1. Aprovecha el formato «Ciudad, Estado» que usan muchas emisoras: la última parte es el estado y la
   primera, la ciudad.
2. **Bloquea los homónimos.** Existen pueblos llamados Jalisco, Sonora o Tamaulipas; cuando ese texto
   aparece se refiere al estado, no a la aldea. Sin esta regla, 64 emisoras de Guadalajara acababan
   asignadas a un pueblo de Durango.
3. Solo trata el estado como ciudad en distritos federales coextensivos (CDMX, CABA, Brasilia…),
   listados explícitamente.

Resultado en México: **91 % con estado y 63 % con ciudad**, y las ciudades que salen son ciudades de
verdad (Guadalajara, Monterrey, Culiacán…), no nombres de estado repetidos.

---

## Lo que condiciona el diseño

**Mixed content.** Muchos Icecast solo sirven `http://` y una página https no puede reproducirlos.
Para eso existe `/api/v1/relay`, que solo reenvía URLs **que ya están en el catálogo** (si no, sería
un proxy abierto) y solo audio. El vídeo ajeno no se proxyea nunca.

**CORS.** `hls.js` lee los segmentos por JavaScript, así que sin `Access-Control-Allow-Origin` el
canal no se puede ver aunque esté vivo. El verificador lo detecta y marca esos streams como no
reproducibles en vez de ofrecer un botón que falla.

**Cabeceras prohibidas.** Unos 1 000 streams de iptv-org exigen `referrer` o `user-agent` propios, que
JavaScript no puede fijar. Se guardan, pero no se ofrecen.

**hls.js antes que `canPlayType`.** Chrome responde «maybe» al MIME de HLS y luego falla con
`MEDIA_ELEMENT_ERROR`. Se usa hls.js siempre que esté soportado y solo se cae a reproducción nativa
si no lo está.

---

## Estado verificado (última ejecución)

| Métrica | Valor |
|---|---|
| Emisoras cargadas | 58 341 |
| Canales de TV | 9 851 (8 049 reproducibles) |
| Países / ciudades con contenido | 242 / 2 412 |
| Streams de radio comprobados | 95 % responden (1 004 ok + 133 sin CORS de 1 200) |
| Streams de TV comprobados | 77 % responden, 65 % reproducibles en navegador |
| Canales curados | Canal Once (reproducible, CORS abierto, 230 ms) y Azteca 7 (enlazado) |

---

## Aviso legal

WorldTune es un directorio: enlaza señales públicas, no las almacena, no las graba y no las modifica.
Ver `/aviso-legal` para el procedimiento de retirada.

Para publicar en App Store haría falta más: la regla **5.2.3 de Apple** exige evidencia documental de
derechos para agregar audio o vídeo de terceros. Por eso las tablas `stations` y `channels` ya tienen
una columna `curated`: permite pasar de «catálogo comunitario completo» a «catálogo blanco» sin
rehacer nada.
