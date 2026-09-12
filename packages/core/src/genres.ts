import { fold } from './slug';

export type GenreKind = 'radio' | 'tv' | 'both';

export interface GenreDef {
  slug: string;
  /** Nombre en ingles (clave para i18n). */
  name: string;
  /** Nombre en espanol, idioma por defecto de la interfaz. */
  nameEs: string;
  kind: GenreKind;
  /** Slug del genero padre, para arboles tipo rock > classic-rock. */
  parent?: string;
}

/**
 * Taxonomia curada. Es intencionalmente cerrada: los tags de Radio Browser son
 * texto libre (mas de 12 000 valores distintos, con lugares, nombres de cadenas
 * y duplicados en varios idiomas), asi que todo se mapea aqui o se descarta.
 */
export const GENRES: GenreDef[] = [
  // --- Musica: raices ---
  { slug: 'pop', name: 'Pop', nameEs: 'Pop', kind: 'both' },
  { slug: 'rock', name: 'Rock', nameEs: 'Rock', kind: 'both' },
  { slug: 'classic-rock', name: 'Classic rock', nameEs: 'Rock clásico', kind: 'radio', parent: 'rock' },
  { slug: 'alternative', name: 'Alternative', nameEs: 'Alternativa', kind: 'radio', parent: 'rock' },
  { slug: 'indie', name: 'Indie', nameEs: 'Indie', kind: 'radio', parent: 'rock' },
  { slug: 'metal', name: 'Metal', nameEs: 'Metal', kind: 'radio', parent: 'rock' },
  { slug: 'punk', name: 'Punk', nameEs: 'Punk', kind: 'radio', parent: 'rock' },
  { slug: 'hard-rock', name: 'Hard rock', nameEs: 'Hard rock', kind: 'radio', parent: 'rock' },
  { slug: 'electronic', name: 'Electronic', nameEs: 'Electrónica', kind: 'both' },
  { slug: 'house', name: 'House', nameEs: 'House', kind: 'radio', parent: 'electronic' },
  { slug: 'techno', name: 'Techno', nameEs: 'Techno', kind: 'radio', parent: 'electronic' },
  { slug: 'trance', name: 'Trance', nameEs: 'Trance', kind: 'radio', parent: 'electronic' },
  { slug: 'edm', name: 'EDM', nameEs: 'EDM', kind: 'radio', parent: 'electronic' },
  { slug: 'dance', name: 'Dance', nameEs: 'Dance', kind: 'radio', parent: 'electronic' },
  { slug: 'drum-and-bass', name: 'Drum & bass', nameEs: 'Drum & bass', kind: 'radio', parent: 'electronic' },
  { slug: 'disco', name: 'Disco', nameEs: 'Disco', kind: 'radio' },
  { slug: 'hip-hop', name: 'Hip hop', nameEs: 'Hip hop', kind: 'both' },
  { slug: 'rap', name: 'Rap', nameEs: 'Rap', kind: 'radio', parent: 'hip-hop' },
  { slug: 'rnb', name: 'R&B', nameEs: 'R&B', kind: 'radio' },
  { slug: 'soul', name: 'Soul', nameEs: 'Soul', kind: 'radio' },
  { slug: 'funk', name: 'Funk', nameEs: 'Funk', kind: 'radio' },
  { slug: 'jazz', name: 'Jazz', nameEs: 'Jazz', kind: 'both' },
  { slug: 'smooth-jazz', name: 'Smooth jazz', nameEs: 'Smooth jazz', kind: 'radio', parent: 'jazz' },
  { slug: 'blues', name: 'Blues', nameEs: 'Blues', kind: 'radio' },
  { slug: 'classical', name: 'Classical', nameEs: 'Clásica', kind: 'both' },
  { slug: 'opera', name: 'Opera', nameEs: 'Ópera', kind: 'radio', parent: 'classical' },
  { slug: 'country', name: 'Country', nameEs: 'Country', kind: 'both' },
  { slug: 'folk', name: 'Folk', nameEs: 'Folk', kind: 'radio' },
  { slug: 'world', name: 'World music', nameEs: 'Música del mundo', kind: 'radio' },
  { slug: 'reggae', name: 'Reggae', nameEs: 'Reggae', kind: 'radio' },
  { slug: 'ska', name: 'Ska', nameEs: 'Ska', kind: 'radio' },
  { slug: 'gospel', name: 'Gospel', nameEs: 'Gospel', kind: 'radio' },
  { slug: 'ambient', name: 'Ambient', nameEs: 'Ambiental', kind: 'radio' },
  { slug: 'chillout', name: 'Chillout', nameEs: 'Chillout', kind: 'radio' },
  { slug: 'lounge', name: 'Lounge', nameEs: 'Lounge', kind: 'radio' },
  { slug: 'easy-listening', name: 'Easy listening', nameEs: 'Música ligera', kind: 'radio' },
  { slug: 'instrumental', name: 'Instrumental', nameEs: 'Instrumental', kind: 'radio' },
  { slug: 'soundtrack', name: 'Soundtracks', nameEs: 'Bandas sonoras', kind: 'radio' },
  { slug: 'experimental', name: 'Experimental', nameEs: 'Experimental', kind: 'radio' },

  // --- Musica latina ---
  { slug: 'latin', name: 'Latin', nameEs: 'Latina', kind: 'both' },
  { slug: 'latin-pop', name: 'Latin pop', nameEs: 'Pop latino', kind: 'radio', parent: 'latin' },
  { slug: 'salsa', name: 'Salsa', nameEs: 'Salsa', kind: 'radio', parent: 'latin' },
  { slug: 'cumbia', name: 'Cumbia', nameEs: 'Cumbia', kind: 'radio', parent: 'latin' },
  { slug: 'bachata', name: 'Bachata', nameEs: 'Bachata', kind: 'radio', parent: 'latin' },
  { slug: 'merengue', name: 'Merengue', nameEs: 'Merengue', kind: 'radio', parent: 'latin' },
  { slug: 'tropical', name: 'Tropical', nameEs: 'Tropical', kind: 'radio', parent: 'latin' },
  { slug: 'reggaeton', name: 'Reggaeton', nameEs: 'Reguetón', kind: 'radio', parent: 'latin' },
  { slug: 'regional-mexican', name: 'Regional Mexican', nameEs: 'Regional mexicana', kind: 'radio', parent: 'latin' },
  { slug: 'banda', name: 'Banda', nameEs: 'Banda', kind: 'radio', parent: 'regional-mexican' },
  { slug: 'grupera', name: 'Grupera', nameEs: 'Grupera', kind: 'radio', parent: 'regional-mexican' },
  { slug: 'nortena', name: 'Nortena', nameEs: 'Norteña', kind: 'radio', parent: 'regional-mexican' },
  { slug: 'mariachi', name: 'Mariachi', nameEs: 'Mariachi', kind: 'radio', parent: 'regional-mexican' },
  { slug: 'ranchera', name: 'Ranchera', nameEs: 'Ranchera', kind: 'radio', parent: 'regional-mexican' },
  { slug: 'mexican-classics', name: 'Mexican classics', nameEs: 'Clásicos del recuerdo', kind: 'radio', parent: 'regional-mexican' },
  { slug: 'balada', name: 'Ballads', nameEs: 'Baladas', kind: 'radio', parent: 'latin' },
  { slug: 'bolero', name: 'Bolero', nameEs: 'Bolero', kind: 'radio', parent: 'latin' },
  { slug: 'tango', name: 'Tango', nameEs: 'Tango', kind: 'radio', parent: 'latin' },
  { slug: 'samba', name: 'Samba', nameEs: 'Samba', kind: 'radio', parent: 'latin' },
  { slug: 'bossa-nova', name: 'Bossa nova', nameEs: 'Bossa nova', kind: 'radio', parent: 'latin' },
  { slug: 'sertanejo', name: 'Sertanejo', nameEs: 'Sertanejo', kind: 'radio', parent: 'latin' },
  { slug: 'forro', name: 'Forro', nameEs: 'Forró', kind: 'radio', parent: 'latin' },
  { slug: 'vallenato', name: 'Vallenato', nameEs: 'Vallenato', kind: 'radio', parent: 'latin' },

  // --- Musica por region del mundo ---
  { slug: 'kpop', name: 'K-pop', nameEs: 'K-pop', kind: 'radio', parent: 'pop' },
  { slug: 'jpop', name: 'J-pop', nameEs: 'J-pop', kind: 'radio', parent: 'pop' },
  { slug: 'cpop', name: 'C-pop', nameEs: 'C-pop', kind: 'radio', parent: 'pop' },
  { slug: 'schlager', name: 'Schlager', nameEs: 'Schlager', kind: 'radio' },
  { slug: 'chanson', name: 'Chanson', nameEs: 'Chanson', kind: 'radio' },
  { slug: 'arabic', name: 'Arabic music', nameEs: 'Música árabe', kind: 'radio', parent: 'world' },
  { slug: 'bollywood', name: 'Bollywood', nameEs: 'Bollywood', kind: 'radio', parent: 'world' },
  { slug: 'afrobeat', name: 'Afrobeat', nameEs: 'Afrobeat', kind: 'radio', parent: 'world' },
  { slug: 'greek', name: 'Greek music', nameEs: 'Música griega', kind: 'radio', parent: 'world' },
  { slug: 'turkish', name: 'Turkish music', nameEs: 'Música turca', kind: 'radio', parent: 'world' },
  { slug: 'celtic', name: 'Celtic', nameEs: 'Celta', kind: 'radio', parent: 'world' },
  { slug: 'balkan', name: 'Balkan', nameEs: 'Balcánica', kind: 'radio', parent: 'world' },

  // --- Formatos y epocas ---
  { slug: 'hits', name: 'Hits', nameEs: 'Éxitos', kind: 'radio' },
  { slug: 'top-40', name: 'Top 40', nameEs: 'Top 40', kind: 'radio', parent: 'hits' },
  { slug: 'adult-contemporary', name: 'Adult contemporary', nameEs: 'Adulto contemporáneo', kind: 'radio' },
  { slug: 'oldies', name: 'Oldies', nameEs: 'Del recuerdo', kind: 'radio' },
  { slug: 'retro', name: 'Retro', nameEs: 'Retro', kind: 'radio', parent: 'oldies' },
  { slug: '50s', name: "50's", nameEs: 'Años 50', kind: 'radio', parent: 'oldies' },
  { slug: '60s', name: "60's", nameEs: 'Años 60', kind: 'radio', parent: 'oldies' },
  { slug: '70s', name: "70's", nameEs: 'Años 70', kind: 'radio', parent: 'oldies' },
  { slug: '80s', name: "80's", nameEs: 'Años 80', kind: 'radio', parent: 'oldies' },
  { slug: '90s', name: "90's", nameEs: 'Años 90', kind: 'radio' },
  { slug: '2000s', name: "2000's", nameEs: 'Años 2000', kind: 'radio' },
  { slug: 'variety', name: 'Variety', nameEs: 'Variada', kind: 'radio' },
  { slug: 'eclectic', name: 'Eclectic', nameEs: 'Ecléctica', kind: 'radio' },

  // --- Palabra hablada y servicio ---
  { slug: 'news', name: 'News', nameEs: 'Noticias', kind: 'both' },
  { slug: 'local-news', name: 'Local news', nameEs: 'Noticias locales', kind: 'radio', parent: 'news' },
  { slug: 'talk', name: 'Talk', nameEs: 'Hablada', kind: 'both' },
  { slug: 'sports', name: 'Sports', nameEs: 'Deportes', kind: 'both' },
  { slug: 'business', name: 'Business', nameEs: 'Negocios', kind: 'both' },
  { slug: 'politics', name: 'Politics', nameEs: 'Política', kind: 'both' },
  { slug: 'culture', name: 'Culture', nameEs: 'Cultura', kind: 'both' },
  { slug: 'education', name: 'Education', nameEs: 'Educación', kind: 'both' },
  { slug: 'science', name: 'Science', nameEs: 'Ciencia', kind: 'both' },
  { slug: 'health', name: 'Health', nameEs: 'Salud', kind: 'both' },
  { slug: 'comedy', name: 'Comedy', nameEs: 'Comedia', kind: 'both' },
  { slug: 'drama', name: 'Drama', nameEs: 'Drama', kind: 'both' },
  { slug: 'weather', name: 'Weather', nameEs: 'Clima', kind: 'both' },
  { slug: 'traffic', name: 'Traffic', nameEs: 'Tráfico', kind: 'radio' },
  { slug: 'christian', name: 'Christian', nameEs: 'Cristiana', kind: 'both' },
  { slug: 'religious', name: 'Religious', nameEs: 'Religiosa', kind: 'both' },
  { slug: 'catholic', name: 'Catholic', nameEs: 'Católica', kind: 'radio', parent: 'religious' },
  { slug: 'islamic', name: 'Islamic', nameEs: 'Islámica', kind: 'radio', parent: 'religious' },
  { slug: 'kids', name: 'Kids', nameEs: 'Infantil', kind: 'both' },
  { slug: 'youth', name: 'Youth', nameEs: 'Juvenil', kind: 'radio' },
  { slug: 'public-radio', name: 'Public radio', nameEs: 'Radio pública', kind: 'radio' },
  { slug: 'community-radio', name: 'Community radio', nameEs: 'Radio comunitaria', kind: 'radio' },
  { slug: 'college-radio', name: 'College radio', nameEs: 'Radio universitaria', kind: 'radio' },
  { slug: 'indigenous', name: 'Indigenous radio', nameEs: 'Radio indígena', kind: 'radio' },
  { slug: 'audiobook', name: 'Audiobooks', nameEs: 'Audiolibros', kind: 'radio' },

  // --- Solo TV (categorias de iptv-org) ---
  { slug: 'general', name: 'General', nameEs: 'General', kind: 'both' },
  { slug: 'entertainment', name: 'Entertainment', nameEs: 'Entretenimiento', kind: 'both' },
  { slug: 'movies', name: 'Movies', nameEs: 'Películas', kind: 'tv' },
  { slug: 'series', name: 'Series', nameEs: 'Series', kind: 'tv' },
  { slug: 'animation', name: 'Animation', nameEs: 'Animación', kind: 'tv' },
  { slug: 'documentary', name: 'Documentary', nameEs: 'Documentales', kind: 'tv' },
  { slug: 'lifestyle', name: 'Lifestyle', nameEs: 'Estilo de vida', kind: 'tv' },
  { slug: 'cooking', name: 'Cooking', nameEs: 'Cocina', kind: 'tv' },
  { slug: 'travel', name: 'Travel', nameEs: 'Viajes', kind: 'tv' },
  { slug: 'outdoor', name: 'Outdoor', nameEs: 'Aire libre', kind: 'tv' },
  { slug: 'auto', name: 'Auto', nameEs: 'Motor', kind: 'tv' },
  { slug: 'family', name: 'Family', nameEs: 'Familiar', kind: 'tv' },
  { slug: 'classic', name: 'Classic', nameEs: 'Clásicos', kind: 'tv' },
  { slug: 'western', name: 'Western', nameEs: 'Western', kind: 'tv' },
  { slug: 'legislative', name: 'Legislative', nameEs: 'Legislativo', kind: 'tv' },
  { slug: 'shop', name: 'Shopping', nameEs: 'Compras', kind: 'tv' },
  { slug: 'relax', name: 'Relax', nameEs: 'Relax', kind: 'tv' },
  { slug: 'music', name: 'Music', nameEs: 'Música', kind: 'tv' },
];

export const GENRE_SLUGS = new Set(GENRES.map((g) => g.slug));

/**
 * Alias -> slug canonico. Las claves se normalizan con fold() al construir el mapa,
 * igual que las entradas que se buscan, asi que da lo mismo escribirlas con o sin acentos.
 */
const RAW_ALIASES: Record<string, string[]> = {
  pop: ['pop music', 'musica pop', 'pop en espanol', 'pop en ingles', 'pop en espanol e ingles', 'popmusic', 'pop hits'],
  rock: ['rock music', 'musica rock', 'rock en espanol', 'rock en ingles', 'rock pop', 'pop rock', 'rocknroll', 'rock and roll'],
  'classic-rock': ['classicrock', 'rock clasico', 'rock classics', 'album rock', 'aor'],
  alternative: ['alternative rock', 'alternativa', 'alternativo', 'modern rock'],
  indie: ['indie rock', 'indie pop'],
  metal: ['heavy metal', 'death metal', 'black metal', 'thrash metal', 'metalcore'],
  'hard-rock': ['hardrock'],
  electronic: ['electronica', 'electro', 'electronic music', 'musica electronica', 'elektro'],
  house: ['deep house', 'tech house', 'progressive house', 'future house'],
  techno: ['minimal techno'],
  edm: ['dance electronic', 'electronic dance music'],
  dance: ['dancefloor', 'dance music', 'dance hits', 'club'],
  'drum-and-bass': ['drum and bass', 'dnb', 'drum n bass', 'jungle'],
  disco: ['italo disco', 'nu disco'],
  'hip-hop': ['hiphop', 'hip hop', 'urban', 'urbano', 'trap'],
  rap: ['rap music', 'rap en espanol'],
  rnb: ['r&b', 'r and b', 'rhythm and blues', 'rhythm & blues'],
  jazz: ['musica jazz', 'jazz music'],
  'smooth-jazz': ['smoothjazz'],
  classical: ['clasica', 'musica clasica', 'classic music', 'classical music', 'klassik', 'musique classique', 'barroco', 'baroque'],
  country: ['country music', 'classic country', 'bluegrass'],
  folk: ['folklore', 'folclore', 'folk music', 'musica folklorica', 'americana'],
  world: ['world music', 'musica del mundo', 'musica internacional', 'international'],
  reggae: ['dancehall', 'dub'],
  gospel: ['musica cristiana', 'gospel music', 'praise'],
  ambient: ['ambiental', 'new age', 'meditation', 'meditacion', 'nature sounds'],
  chillout: ['chill', 'chill out', 'downtempo'],
  lounge: ['bar lounge'],
  'easy-listening': ['easylistening', 'musica ligera', 'softrock', 'soft rock', 'melodica', 'suave'],
  instrumental: ['musica instrumental', 'piano'],
  soundtrack: ['soundtracks', 'ost', 'movie soundtracks', 'bandas sonoras', 'anime'],

  latin: ['latino', 'latina', 'latin music', 'musica latina', 'musica en espanol', 'espanol', 'spanish music', 'en espanol', 'hispana'],
  'latin-pop': ['latinpop', 'pop latino'],
  salsa: ['salsa music', 'timba'],
  cumbia: ['cumbias', 'sonidero'],
  tropical: ['musica tropical', 'tropical music'],
  reggaeton: ['reguetton', 'perreo'],
  'regional-mexican': [
    'regional mexicana', 'regional mexican', 'musica regional mexicana', 'musica regional',
    'regional music', 'mexican music', 'musica mexicana', 'traditional mexican music',
    'musica tradicional mexicana', 'musica popular mexicana', 'regional', 'regional radio', 'mexican',
  ],
  grupera: ['grupero', 'grupos'],
  nortena: ['norteno', 'nortenas', 'nortenos', 'conjunto'],
  ranchera: ['rancheras', 'ranchero'],
  balada: ['baladas', 'baladas en espanol', 'ballads', 'romantica', 'romantic', 'romanticas', 'love songs', 'baladas romanticas'],
  bolero: ['boleros', 'trova'],
  'mexican-classics': ['clasicos', 'musica del recuerdo', 'recuerdos', 'viejitas', 'oldies en espanol'],

  kpop: ['k-pop', 'korean pop'],
  jpop: ['j-pop', 'japanese pop'],
  cpop: ['c-pop', 'mandopop', 'cantopop'],
  arabic: ['arab', 'arabe', 'musica arabe', 'quran', 'coran'],
  greek: ['greece', 'griega', 'laika'],
  turkish: ['turkce', 'turkiye', 'turk'],
  balkan: ['narodna', 'turbo folk', 'ex yu'],
  celtic: ['irish', 'irlandesa', 'celta'],
  afrobeat: ['afro', 'afrobeats', 'african music', 'highlife'],
  bollywood: ['hindi', 'desi', 'punjabi', 'tamil'],

  hits: ['top hits', 'hit music', 'greatest hits', 'exitos', 'top charts', 'charts', 'classic hits', 'contemporary hits', 'contemporary hits radio', 'chr', 'mainstream'],
  'top-40': ['top40', 'top 40', 'top 100', 'top 20'],
  'adult-contemporary': ['hot adult contemporary', 'hot ac', 'adult hits', 'adulto contemporaneo'],
  oldies: ['golden oldies', 'nostalgia', 'antiguas', 'evergreens', 'old school', 'oldschool'],
  retro: ['retro hits', 'vintage'],
  '50s': ['1950s', "50's", 'fifties'],
  '60s': ['1960s', "60's", 'sixties'],
  '70s': ['1970s', "70's", 'seventies'],
  '80s': ['1980s', "80's", 'eighties', 'ochentas', 'los 80'],
  '90s': ['1990s', "90's", 'nineties', 'noventas', 'los 90'],
  '2000s': ["2000's", 'dos mil', '00s'],
  variety: ['musica variada', 'variada', 'various', 'varios', 'mixed', 'full service', 'misc', 'de todo'],
  eclectic: ['eclectica', 'freeform'],

  news: ['noticias', 'nachrichten', 'actualidad', 'informacion', 'information', 'informativa', 'news talk', 'noticias y comentarios', 'musica y noticias', 'noticias en espanol', 'noticias nacionales e internacionales'],
  'local-news': ['local news', 'noticias locales'],
  talk: ['talk radio', 'hablada', 'radio hablada', 'talk & speech', 'speech', 'charla', 'tertulia', 'debate', 'entrevistas', 'programas en vivo', 'phone in'],
  sports: ['sport', 'deportes', 'deportiva', 'futbol', 'football', 'soccer', 'sports talk', 'deporte'],
  business: ['economia', 'finance', 'finanzas', 'economy'],
  politics: ['politica', 'political'],
  culture: ['cultura', 'cultural', 'kultur', 'arte', 'art', 'literatura', 'history', 'historia'],
  education: ['educacion', 'educativa', 'educational', 'learning'],
  science: ['ciencia', 'tech', 'technology', 'tecnologia'],
  health: ['salud', 'wellness', 'bienestar'],
  comedy: ['comedia', 'humor', 'humour'],
  weather: ['clima', 'tiempo', 'meteo'],
  traffic: ['trafico', 'traffic news'],
  christian: ['cristiana', 'christian music', 'christian radio', 'evangelica', 'evangelical', 'iglesia', 'church', 'ccm', 'worship', 'predicacion'],
  religious: ['religiosa', 'religion', 'spiritual', 'espiritual', 'fe', 'faith'],
  catholic: ['catolica', 'catholic radio', 'vaticano', 'rosario'],
  islamic: ['islam', 'muslim', 'islamica'],
  kids: ['infantil', 'children', 'ninos', 'kinder', 'cuentos'],
  youth: ['juvenil', 'jovenes', 'teen', 'young'],
  'public-radio': ['npr', 'public', 'pbs', 'radio publica', 'state radio', 'nacional'],
  'community-radio': ['community', 'comunitaria', 'community news', 'local radio', 'local music', 'vecinal'],
  'college-radio': ['university radio', 'universitaria', 'college', 'campus', 'student radio'],
  indigenous: ['indigena', 'aboriginal', 'native'],
  audiobook: ['audiolibros', 'radio teatro', 'radionovela'],

  // Categorias de iptv-org que no coinciden exactamente con el slug
  general: ['general tv', 'generalista'],
  entertainment: ['entretenimiento', 'espectaculos', 'farandula'],
  movies: ['peliculas', 'cine', 'film'],
  series: ['tv series', 'novelas', 'telenovelas'],
  animation: ['animacion', 'cartoons', 'dibujos animados'],
  documentary: ['documentales', 'docu'],
  lifestyle: ['estilo de vida', 'moda', 'fashion', 'hogar'],
  cooking: ['cocina', 'gastronomia', 'food'],
  travel: ['viajes', 'turismo'],
  outdoor: ['aire libre', 'caza', 'pesca', 'naturaleza'],
  auto: ['motor', 'autos', 'coches', 'cars'],
  family: ['familiar'],
  shop: ['compras', 'teleshopping', 'shopping'],
  relax: ['relajacion', 'relaxing'],
  music: ['music tv', 'videoclips', 'music videos'],
};

export const GENRE_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of GENRES) {
    map[fold(g.slug.replace(/-/g, ' '))] = g.slug;
    map[fold(g.slug)] = g.slug;
    map[fold(g.name)] = g.slug;
    map[fold(g.nameEs)] = g.slug;
  }
  for (const [slug, aliases] of Object.entries(RAW_ALIASES)) {
    if (!GENRE_SLUGS.has(slug)) throw new Error(`Alias apunta a un genero inexistente: ${slug}`);
    for (const alias of aliases) map[fold(alias)] = slug;
  }
  return map;
})();

/**
 * Tags que nunca son genero: lugares, tipos de banda, nombres de cadenas y ruido.
 * Se descartan en silencio para no ensuciar los filtros de la interfaz.
 */
const STOPWORDS = [
  'radio', 'fm', 'am', 'estacion', 'station', 'online', 'internet', 'stream', 'streaming',
  'music', 'musica', 'musik', 'musique', 'commercial', 'comercial', 'popular', 'top', 'hit',
  'live', 'en vivo', 'directo', '24/7', 'digital', 'web', 'webradio', 'web radio',
  'radio online', 'hd', 'stereo', 'sonido', 'varios', 'mix',
  // geografia que aparece como tag
  'mexico', 'mex', 'mx', 'cdmx', 'ciudad de mexico', 'mexico city', 'valle de mexico',
  'norteamerica', 'latinoamerica', 'america', 'sudamerica', 'centroamerica', 'europa', 'europe',
  'asia', 'africa', 'usa', 'us', 'espana', 'spain', 'argentina', 'colombia', 'chile', 'peru',
  'brasil', 'brazil', 'venezuela', 'ecuador', 'guatemala', 'bolivia', 'uruguay', 'paraguay',
  'cuba', 'republica dominicana', 'puerto rico', 'costa rica', 'panama', 'honduras',
  'el salvador', 'nicaragua', 'sureste', 'norte', 'sur', 'este', 'oeste', 'bajio', 'pacifico',
  'serbia', 'greece', 'turkiye',
  // idiomas como tag (ya existe una columna de idioma)
  'ingles', 'english', 'frances', 'french', 'aleman', 'german', 'deutsch', 'italiano',
  'portugues', 'portuguese', 'musica en ingles', 'musica en espanol e ingles',
  // cadenas y marcas
  'moi merino', 'mvs', 'mvs radio', 'radiopolis', 'grupo acir', 'acir', 'imer', 'exa',
  'los 40', 'radio formula', 'grupo formula', 'iheartradio', 'audacy', 'cumulus',
];
export const TAG_STOPLIST = new Set(STOPWORDS.map(fold));

export interface NormalizedTags {
  /** Slugs canonicos, sin duplicados y en orden de aparicion. */
  genres: string[];
  /** Tags que no son genero ni estan en la lista de descarte: material para curar. */
  unknown: string[];
}

/** Convierte el campo `tags` de Radio Browser (texto libre, separado por comas). */
export function normalizeTags(raw: string | null | undefined, limit = 6): NormalizedTags {
  const genres: string[] = [];
  const unknown: string[] = [];
  if (!raw) return { genres, unknown };

  for (const piece of raw.split(/[,;|/]/)) {
    const key = fold(piece).replace(/\s+/g, ' ');
    if (!key || key.length < 2 || key.length > 40) continue;
    if (TAG_STOPLIST.has(key)) continue;

    const slug = GENRE_ALIASES[key] ?? GENRE_ALIASES[key.replace(/\s+/g, '')];
    if (slug) {
      if (!genres.includes(slug)) genres.push(slug);
    } else if (!unknown.includes(key)) {
      unknown.push(key);
    }
  }
  return { genres: genres.slice(0, limit), unknown };
}

/** Mapea una categoria de iptv-org a un slug de la taxonomia. */
export function normalizeTvCategory(category: string): string | null {
  const key = fold(category);
  return GENRE_ALIASES[key] ?? (GENRE_SLUGS.has(key) ? key : null);
}
