/**
 * Limpeza dos textos publicados pelos tribunais (DJEN): muitos chegam com marcação de
 * página (<p>, <center>, <h2>…), entidades (&nbsp;) e acentos corrompidos na origem
 * ("Distribuiï¿½ï¿½o"). O texto exibido e salvo passa a ser legível.
 */
const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', ndash: '–', mdash: '—' };
// Letras acentuadas em forma de código (&ecirc; &atilde; &ccedil; …), frequentes nos diários de SC e AM.
const MARKS: Record<string, string> = { acute: '\u0301', grave: '\u0300', circ: '\u0302', tilde: '\u0303', uml: '\u0308', cedil: '\u0327' };
for (const l of 'aeiouAEIOUcCnN') for (const [name, mark] of Object.entries(MARKS)) {
  const ch = (l + mark).normalize('NFC');
  if (ch.length === 1) ENTITIES[`${l}${name}`] = ch;
}

const BAD = 'ï¿½';
/** Palavras jurídicas frequentes cujos acentos chegam corrompidos. */
const WORDS: [RegExp, string][] = [
  [/justi\?a/gi, 'justiça'], [/par\?grafo/gi, 'parágrafo'], [/\?nico/gi, 'único'], [/sa\?de/gi, 'saúde'],
  [/n\?o\b/gi, 'não'], [/s\?o\b/gi, 'são'], [/\?rg\?o/gi, 'órgão'], [/c\?digo/gi, 'código'], [/of\?cio/gi, 'ofício'],
  [/ser\?\b/gi, 'será'], [/j\?\b/gi, 'já'], [/tamb\?m/gi, 'também'], [/peti\?\?o/gi, 'petição'], [/audi\?ncia/gi, 'audiência'],
  [/ju\?zo/gi, 'juízo'], [/senten\?a/gi, 'sentença'], [/ac\?rd\?o/gi, 'acórdão'], [/an\?lise/gi, 'análise'], [/p\?blic/gi, 'públic'],
  [/u\?d([oa]s?)\b/gi, 'uíd$1'], [/\?ncia\b/gi, 'ência'], [/d\?vida/gi, 'dívida'], [/m\?dia/gi, 'média'], [/cr\?dito/gi, 'crédito'],
    [/eletr\?nic/gi, 'eletrônic'], [/cart\?rio/gi, 'cartório'], [/c\?vel/gi, 'cível'], [/fam\?lia/gi, 'família'], [/ap\?s/gi, 'após'],
];

function keepCase(found: string, fixed: string) {
  const letters = found.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) return fixed.toUpperCase();
  return /^\p{Lu}/u.test(found) ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
}

export function fixMojibake(s: string) {
  if (!s.includes(BAD) && !s.includes('�')) return s;
  let t = s.split(BAD).join('?').replace(/�/g, '?');
  t = t.replace(/\?\?es\b/g, 'ções').replace(/\?\?ES\b/g, 'ÇÕES').replace(/\?\?o\b/g, 'ção').replace(/\?\?O\b/g, 'ÇÃO');
  for (const [re, fixed] of WORDS) t = t.replace(re, (m, ...g) => keepCase(m, fixed.replace(/\$(\d)/g, (_, i) => (typeof g[i - 1] === 'string' ? g[i - 1] : ''))));
  // O que não dá para recuperar com segurança some, em vez de aparecer como lixo.
  return t.replace(/(\p{L})\?(?=\p{L})/gu, '$1').replace(/\?(?=\p{L})/gu, '');
}

export function cleanText(s?: string | null) {
  if (!s) return '';
  let t = String(s)
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/\s*(p|h\d|div|li|center|tr)\s*>/gi, '. ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
      return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
    });
  t = fixMojibake(t);
  return t.replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/([.:;])(\s*\.)+/g, '$1').replace(/^[.\s]+/, '').trim();
}

/** Limpa recursivamente todas as strings de um objeto (fichas de processo salvas em JSON). */
export function cleanDeep<T>(v: T): T {
  if (typeof v === 'string') return cleanText(v) as T;
  if (Array.isArray(v)) return v.map(cleanDeep) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cleanDeep(x)])) as T;
  return v;
}

export const needsCleaning = (s?: string | null) => !!s && (/<[a-z/!][^>]*>/i.test(s) || s.includes(BAD) || s.includes('�') || /&[a-z#0-9]+;/i.test(s));
