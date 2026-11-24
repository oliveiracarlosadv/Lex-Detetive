import { isValidCnpj, isValidCpf, maskCnpj, maskCpf, onlyDigits } from './documents';

/**
 * Conferência de CPF/CNPJ nas publicações (homônimos).
 * A API pública do DJEN não busca por documento; aqui procuramos o CPF/CNPJ escrito
 * no texto PERTO do nome da parte e comparamos com o documento cadastrado.
 */
export type DocStatus = 'confirmado' | 'divergente' | 'nao_informado';
export interface DocCheck { status: DocStatus; found?: string }

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// CPF completo, CPF mascarado pelo tribunal (***.456.789-**), CNPJ completo.
const DOC_RE = /(\*{3}\.?\d{3}\.?\d{3}-?\*{2})|(\d{3}\.?\*{3}\.?\*{3}-?\d{2})|(\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b)|(\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b)/g;

const NEXT_PARTY = /\b(autor|autora|reu|re|requerente|requerid[oa]|reclamante|reclamad[oa]|exequente|executad[oa]|impetrante|impetrad[oa]|apelante|apelad[oa]|agravante|agravad[oa]|embargante|embargad[oa]|destinatari[oa]|advogad[oa]|oab|polo (ativo|passivo)|parte (autora|re))\b\s*[:\-–]/;

/** Documentos (válidos ou mascarados) que aparecem logo depois de cada menção ao nome. */
export function docsNearName(text: string, name: string, window = 260): string[] {
  if (!text || !name) return [];
  const t = strip(text);
  const words = strip(name).replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  // O nome pode vir com pontuação/quebras entre as palavras: casa as palavras em sequência.
  const nameRe = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\W]{1,4}'), 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(t))) {
    let slice = text.slice(m.index + m[0].length, m.index + m[0].length + window);
    // Para na próxima parte citada — evita atribuir à pessoa o CPF de outra parte ou do advogado.
    const next = strip(slice).search(NEXT_PARTY);
    if (next >= 0) slice = slice.slice(0, next);
    for (const d of slice.matchAll(DOC_RE)) {
      const raw = d[0];
      const digits = onlyDigits(raw);
      if (raw.includes('*') || (digits.length === 11 && isValidCpf(digits)) || (digits.length === 14 && isValidCnpj(digits))) { out.push(raw); break; }
    }
  }
  return [...new Set(out)];
}

/** Compara um documento encontrado (inteiro ou mascarado) com o cadastrado. */
export function sameDoc(found: string, registered: string): boolean {
  const reg = onlyDigits(registered);
  if (!found.includes('*')) return onlyDigits(found) === reg;
  // Mascarado: confere só as posições visíveis.
  const pattern = found.replace(/[^\d*]/g, '');
  if (pattern.length !== reg.length) return false;
  return [...pattern].every((ch, i) => ch === '*' || ch === reg[i]);
}

export const maskFound = (d: string) => (d.includes('*') ? d : onlyDigits(d).length === 14 ? maskCnpj(d) : maskCpf(d));

/** Resultado de uma publicação: confere, diverge ou não informa documento. */
export function checkPublication(text: string, name: string, registered?: string | null): DocCheck {
  if (!registered) return { status: 'nao_informado' };
  const docs = docsNearName(text, name);
  if (!docs.length) return { status: 'nao_informado' };
  const hit = docs.find((d) => sameDoc(d, registered));
  if (hit) return { status: 'confirmado', found: maskFound(hit) };
  return { status: 'divergente', found: maskFound(docs[0]) };
}

/** Junta várias publicações do mesmo processo: uma confirmação vale mais que divergências. */
export function mergeChecks(a: DocCheck | undefined, b: DocCheck): DocCheck {
  if (!a) return b;
  if (a.status === 'confirmado') return a;
  if (b.status === 'confirmado') return b;
  if (a.status === 'divergente') return a;
  return b;
}

/** Ordem de exibição: confirmados pelo CPF, depois sem documento, por último os divergentes. */
export const DOC_RANK: Record<string, number> = { confirmado: 0, nao_informado: 1, divergente: 2 };
