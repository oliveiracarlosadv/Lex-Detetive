const AUTOR = /autor|requerente|exequente|reclamante|impetrante|embargante|apelante|agravante|ativo/i;
const REU = /r[ée]u|requerid|executad|reclamad|impetrad|embargad|apelad|agravad|passivo/i;

/** Autor (polo ativo) e réu (polo passivo) a partir dos papéis informados pelas fontes. */
export function splitParties(parties?: { name: string; role?: string }[] | null) {
  const list = (parties || []).filter((x) => !/advogad/i.test(x.role || ''));
  const names = (re: RegExp) => list.filter((x) => re.test(x.role || '')).map((x) => x.name).join('; ');
  return { autor: names(AUTOR) || 'não informado', reu: names(REU) || 'não informado' };
}
