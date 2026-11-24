import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Paragraph as DocxParagraph, Table as DocxTable } from 'docx';
import { Report, Section } from './report.builder';

// Bibliotecas pesadas (Excel, Word, PDF, ZIP) são carregadas só quando um relatório é
// gerado — o servidor abre mais rápido e usa menos memória em computadores modestos.
const loadExcel = async () => (await import('exceljs')).default;
const loadZip = async () => (await import('jszip')).default;
const loadPdf = async () => (await import('pdfkit')).default;
const loadDocx = () => import('docx');

export type ExportFormat = 'pdf' | 'docx' | 'odt' | 'txt' | 'csv' | 'xlsx' | 'json' | 'html';
export const FORMATS: Record<ExportFormat, { mime: string; ext: string }> = {
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  odt: { mime: 'application/vnd.oasis.opendocument.text', ext: 'odt' },
  txt: { mime: 'text/plain; charset=utf-8', ext: 'txt' },
  csv: { mime: 'text/csv; charset=utf-8', ext: 'csv' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  json: { mime: 'application/json; charset=utf-8', ext: 'json' },
  html: { mime: 'text/html; charset=utf-8', ext: 'html' },
};

/**
 * Padrão de documento forense: Arial 12, texto justificado, margens 3 cm (sup./esq.) e
 * 2 cm (inf./dir.), seções numeradas, número do relatório e integridade em todas as páginas.
 * Tabelas usam Arial 10 para caber na largura da página.
 */
const FONT = 'Arial';
const BODY_PT = 12;
const TABLE_PT = 10;
const ASSETS = [join(__dirname, '..', '..', 'assets'), join(process.cwd(), 'assets')].find((p) => existsSync(join(p, 'logo-mark.png')));
const defaultLogo = () => (ASSETS ? readFileSync(join(ASSETS, 'logo-mark.png')) : null);
/** Logomarca do escritório (perfil do usuário) ou, na falta dela, a do Lex Detetive. */
const logoOf = (r: Report) => r.logo || defaultLogo();
const logoDataUrl = (r: Report) => { const b = logoOf(r); return b ? `data:image/${b[0] === 0x89 ? 'png' : 'jpeg'};base64,${b.toString('base64')}` : ''; };

/** Numera as seções: nível 1 → "3. METODOLOGIA"; nível 2 → "3.1 Título". */
export function numbered(sections: Section[]) {
  let i = 0, j = 0;
  return sections.map((s) => {
    if (s.level === 2) return { ...s, label: `${i}.${++j} ${s.heading}` };
    i++; j = 0;
    return { ...s, label: `${i}. ${s.heading.toUpperCase()}` };
  });
}
/** Frações de largura das colunas: as definidas no relatório ou, na falta, proporcionais ao conteúdo. */
export function colFractions(t: { columns: string[]; rows: (string | number)[][]; widths?: number[] }): number[] {
  if (t.widths && t.widths.length === t.columns.length) {
    const sum = t.widths.reduce((a, b) => a + b, 0) || 1;
    return t.widths.map((w) => w / sum);
  }
  const weight = t.columns.map((c, i) => Math.max(c.length, ...t.rows.slice(0, 80).map((r) => Math.min(60, String(r[i] ?? '').length))) + 4);
  const total = weight.reduce((a, b) => a + b, 0);
  return weight.map((w) => w / total);
}
const alpha = (n: number) => `${String.fromCharCode(97 + (n % 26))})`;
const footerLine = (r: Report) => `Relatório nº ${r.number} · ${r.organization} · Documento confidencial (LGPD)`;

export async function exportReport(r: Report, format: ExportFormat): Promise<Buffer> {
  switch (format) {
    case 'pdf': return toPdf(r);
    case 'docx': return toDocx(r);
    case 'odt': return toOdt(r);
    case 'xlsx': return toXlsx(r);
    case 'html': return Buffer.from(toHtml(r), 'utf8');
    case 'txt': return Buffer.from(toTxt(r), 'utf8');
    case 'csv': return Buffer.from('\uFEFF' + toCsv(r), 'utf8');
    case 'json': return Buffer.from(JSON.stringify(r, null, 2), 'utf8');
  }
}

// ---------------- HTML (pronto para impressão em A4) ----------------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cell = (s: unknown) => esc(s).replace(/\n/g, '<br>');

export function toHtml(r: Report): string {
  const body = numbered(r.sections).map((s) => [
    s.level === 2 ? `<h3>${esc(s.label)}</h3>` : `<h2>${esc(s.label)}</h2>`,
    ...(s.paragraphs || []).map((p) => `<p>${esc(p)}</p>`),
    s.bullets ? `<ol class="alpha">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ol>` : '',
    s.table ? `<table>${s.table.widths ? `<colgroup>${s.table.widths.map((w) => `<col style="width:${(w * 100).toFixed(1)}%">`).join('')}</colgroup>` : ''}<thead><tr>${s.table.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((row) => `<tr>${row.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '',
  ].join('\n')).join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.title)} nº ${esc(r.number)}</title>
<style>
@page{size:A4;margin:3cm 2cm 2cm 3cm}
body{font-family:Arial,"Liberation Sans",Helvetica,sans-serif;font-size:12pt;line-height:1.5;color:#000;background:#fff;max-width:16cm;margin:2cm auto;text-align:justify}
.cab{display:flex;justify-content:space-between;font-size:9pt;border-bottom:1px solid #000;padding-bottom:4pt;margin-bottom:18pt}
.capa{text-align:center;margin-bottom:18pt}.capa p{text-align:center;margin:2pt 0}
h1{font-size:12pt;text-transform:uppercase;text-align:center;margin:12pt 0 4pt}
h2{font-size:12pt;font-weight:bold;margin:18pt 0 6pt;text-align:left}h3{font-size:12pt;font-weight:bold;margin:12pt 0 6pt;text-align:left}
p{margin:0 0 8pt;text-align:justify}ol.alpha{list-style:lower-alpha;padding-left:1.2cm}ol.alpha li{text-align:justify;margin-bottom:4pt}
table{border-collapse:collapse;width:100%;font-size:10pt;margin:6pt 0 12pt}th{background:#e7e7e7;font-weight:bold;text-align:left}
th,td{border:0.5pt solid #777;padding:3pt 5pt;vertical-align:top;text-align:left;word-break:normal;overflow-wrap:normal;hyphens:none}
tr{page-break-inside:avoid}table{table-layout:fixed}
.ass{margin-top:36pt;text-align:center}.ass .local{text-align:right;margin-bottom:42pt}.ass .linha{border-top:0.5pt solid #000;width:8cm;margin:0 auto 4pt}
.rod{margin-top:24pt;border-top:1px solid #000;padding-top:4pt;font-size:8pt;text-align:center}
</style></head><body>
<div class="cab"><span>${logoDataUrl(r) ? `<img src="${logoDataUrl(r)}" alt="" style="height:22pt;vertical-align:middle;margin-right:6pt">` : ''}${esc(r.organization)} · Lex Detetive</span><span>Relatório nº ${esc(r.number)}</span></div>
<div class="capa"><p><b>${esc(r.organization.toUpperCase())}</b></p><h1>${esc(r.title)}</h1><p>Relatório nº ${esc(r.number)}</p><p>Investigado: <b>${esc(r.subtitle)}</b></p><p>${esc(r.dateLong)}</p></div>
${body}
<div class="ass"><p class="local">${esc(r.dateLong)}.</p><div class="linha"></div><p style="text-align:center"><b>${esc(r.signature.name)}</b><br>${r.signature.details.map((l) => `${esc(l)}<br>`).join('')}${esc(r.signature.organization)}</p></div>
<div class="rod">${esc(footerLine(r))}<br>SHA-256: ${r.integrity}</div>
</body></html>`;
}

// ---------------- TXT / CSV ----------------
export function toTxt(r: Report): string {
  const out: string[] = [r.organization.toUpperCase(), r.title.toUpperCase(), `Relatório nº ${r.number}`, `Investigado: ${r.subtitle}`, r.dateLong, '='.repeat(70)];
  for (const s of numbered(r.sections)) {
    out.push('', s.label);
    s.paragraphs?.forEach((p) => out.push(p));
    s.bullets?.forEach((b, i) => out.push(`  ${alpha(i)} ${b}`));
    if (s.table) s.table.rows.forEach((row) => out.push('  ' + row.map((c, i) => `${s.table!.columns[i]}: ${String(c).replace(/\n/g, ' / ')}`).join(' | ')));
  }
  out.push('', `${r.dateLong}.`, '', '_'.repeat(40), r.signature.name, ...r.signature.details, r.signature.organization, '', `SHA-256: ${r.integrity}`);
  return out.join('\n');
}

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** CSV com uma linha por movimentação (separador ";" para o Excel em português). */
export function toCsv(r: Report): string {
  const t: any = (r.data as any).target;
  const rows: unknown[][] = [['Relatório', 'Investigado', 'Processo', 'Tribunal', 'Vara', 'Classe', 'Situação', 'Valor', 'Data', 'Movimentação']];
  for (const p of (t.processes || []).filter((x: any) => x.source !== 'manual')) {
    for (const m of p.movements?.length ? p.movements : [{ date: null, description: '' }])
      rows.push([r.number, t.name, p.number, p.court, p.organ || '', p.className, p.status, p.value ?? '', m.date ? new Date(m.date).toLocaleDateString('pt-BR') : '', m.description]);
  }
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

// ---------------- XLSX (Arial 12) ----------------
async function toXlsx(r: Report): Promise<Buffer> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = `Lex Detetive — ${r.organization}`;
  wb.created = r.generatedAt;
  const font = { name: FONT, size: BODY_PT };
  const resumo = wb.addWorksheet('Relatório');
  resumo.columns = [{ width: 110 }];
  const add = (text: string, bold = false, center = false) => {
    const row = resumo.addRow([text]);
    row.font = { ...font, bold };
    row.alignment = { wrapText: true, horizontal: center ? 'center' : 'justify', vertical: 'top' };
  };
  add(r.organization.toUpperCase(), true, true); add(r.title.toUpperCase(), true, true); add(`Relatório nº ${r.number}`, false, true);
  add(`Investigado: ${r.subtitle}`, false, true); add(r.dateLong, false, true);
  const used = new Set(['Relatório']);
  for (const s of numbered(r.sections)) {
    resumo.addRow([]); add(s.label, true);
    s.paragraphs?.forEach((p) => add(p));
    s.bullets?.forEach((b, i) => add(`${alpha(i)} ${b}`));
    if (s.table) {
      let name = s.heading.replace(/[\\/*?:[\]]/g, ' ').slice(0, 28).trim() || 'Tabela';
      let k = 2;
      while (used.has(name)) name = `${name.slice(0, 25)} ${k++}`;
      used.add(name);
      add(`(ver aba “${name}”)`);
      const ws = wb.addWorksheet(name);
      const header = ws.addRow(s.table.columns);
      header.eachCell((c) => { c.font = { ...font, bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E7E7' } }; });
      s.table.rows.forEach((row) => ws.addRow(row).eachCell((c) => { c.font = font; }));
      ws.columns.forEach((col, idx) => {
        const longest = Math.max(s.table!.columns[idx]?.length || 8, ...s.table!.rows.map((row) => String(row[idx] ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0)));
        col.width = Math.min(70, Math.max(12, longest + 2));
        col.alignment = { wrapText: true, vertical: 'top', horizontal: 'justify' };
      });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
  }
  resumo.addRow([]); add(`${r.dateLong}.`); add(`${r.signature.name} — ${r.signature.organization}`, true); add(`SHA-256: ${r.integrity}`);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------- DOCX (Arial 12 justificado) ----------------
async function toDocx(r: Report): Promise<Buffer> {
  const {
    AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph,
    ShadingType, Table, TableCell, TableRow, TextRun, WidthType, TabStopType, TableLayoutType,
  } = await loadDocx();
  const png = logoOf(r);
  const sz = BODY_PT * 2;
  const tsz = TABLE_PT * 2;
  const J = AlignmentType.JUSTIFIED;
  const C = AlignmentType.CENTER;
  const children: (DocxParagraph | DocxTable)[] = [];
  const P = (text: string, o: { bold?: boolean; align?: any; after?: number; before?: number; size?: number } = {}) =>
    new Paragraph({ alignment: o.align ?? J, spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 360 }, children: [new TextRun({ text, bold: o.bold, size: o.size ?? sz, font: FONT })] });
  const border = { style: BorderStyle.SINGLE, size: 4, color: '777777' };

  children.push(P(r.organization.toUpperCase(), { bold: true, align: C, after: 60 }));
  children.push(P(r.title.toUpperCase(), { bold: true, align: C, after: 60 }));
  children.push(P(`Relatório nº ${r.number}`, { align: C, after: 60 }));
  children.push(P(`Investigado: ${r.subtitle}`, { align: C, after: 60 }));
  children.push(P(r.dateLong, { align: C, after: 360 }));

  for (const s of numbered(r.sections)) {
    children.push(P(s.label, { bold: true, align: AlignmentType.LEFT, before: s.level === 2 ? 120 : 240, after: 120 }));
    s.paragraphs?.forEach((p) => children.push(P(p)));
    s.bullets?.forEach((b, i) => children.push(new Paragraph({ alignment: J, indent: { left: 567, hanging: 340 }, spacing: { after: 80, line: 360 }, children: [new TextRun({ text: `${alpha(i)}\t${b}`, size: sz, font: FONT })] })));
    if (s.table) {
      const mkCell = (text: unknown, head: boolean, w: number) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        shading: head ? { type: ShadingType.CLEAR, fill: 'E7E7E7', color: 'auto' } : undefined,
        borders: { top: border, bottom: border, left: border, right: border },
        children: String(text ?? '').split('\n').map((line) => new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: line, bold: head, size: tsz, font: FONT })] })),
      });
      const TW = 9071; // largura útil da página em twips (21 cm − 3 cm − 2 cm)
      const fr = colFractions(s.table);
      const colW = fr.map((f) => Math.round(f * TW));
      children.push(new Table({
        width: { size: TW, type: WidthType.DXA },
        columnWidths: colW,
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({ tableHeader: true, cantSplit: true, children: s.table.columns.map((c, i) => mkCell(c, true, colW[i])) }),
          ...s.table.rows.map((row) => new TableRow({ cantSplit: true, children: row.map((c, i) => mkCell(c, false, colW[i])) })),
        ],
      }));
      children.push(P('', { after: 120 }));
    }
  }
  // Assinatura
  children.push(P(`${r.dateLong}.`, { align: AlignmentType.RIGHT, before: 480, after: 960 }));
  children.push(P('_______________________________________', { align: C, after: 0 }));
  children.push(P(r.signature.name, { bold: true, align: C, after: 0 }));
  r.signature.details.forEach((l) => children.push(P(l, { align: C, after: 0 })));
  children.push(P(r.signature.organization, { align: C }));

  const doc = new Document({
    creator: 'Lex Detetive', title: `${r.title} nº ${r.number}`, description: r.subtitle,
    styles: { default: { document: { run: { font: FONT, size: sz }, paragraph: { alignment: J } } } },
    sections: [{
      properties: { page: { margin: { top: 1701, left: 1701, right: 1134, bottom: 1134, header: 567, footer: 567 } } },
      headers: {
        default: new Header({ children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 9071 }],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
          children: [
            ...(png ? [new ImageRun({ type: png[0] === 0x89 ? 'png' : 'jpg', data: png, transformation: { width: 28, height: 28 } })] : []),
            new TextRun({ text: `  ${r.organization} · Lex Detetive`, size: 18, font: FONT }),
            new TextRun({ text: `\tRelatório nº ${r.number}`, size: 18, font: FONT }),
          ],
        })] }),
      },
      footers: {
        default: new Footer({ children: [
          new Paragraph({ alignment: C, border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } }, children: [
            new TextRun({ text: `${footerLine(r)} · Página `, size: 16, font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT }),
            new TextRun({ text: ' de ', size: 16, font: FONT }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONT }),
          ] }),
          new Paragraph({ alignment: C, children: [new TextRun({ text: `SHA-256: ${r.integrity}`, size: 14, font: FONT })] }),
        ] }),
      },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

// ---------------- ODT (Arial 12 justificado) ----------------
const xml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

async function toOdt(r: Report): Promise<Buffer> {
  const parts: string[] = [];
  const colStyles: string[] = [];
  for (const [t, st] of [[r.organization.toUpperCase(), 'CapaB'], [r.title.toUpperCase(), 'CapaB'], [`Relatório nº ${r.number}`, 'Capa'], [`Investigado: ${r.subtitle}`, 'Capa'], [r.dateLong, 'Capa']])
    parts.push(`<text:p text:style-name="${st}">${xml(t)}</text:p>`);
  let t = 0;
  for (const s of numbered(r.sections)) {
    parts.push(`<text:h text:style-name="H" text:outline-level="${s.level === 2 ? 2 : 1}">${xml(s.label)}</text:h>`);
    s.paragraphs?.forEach((p) => parts.push(`<text:p text:style-name="Corpo">${xml(p)}</text:p>`));
    s.bullets?.forEach((b, i) => parts.push(`<text:p text:style-name="Item">${alpha(i)} ${xml(b)}</text:p>`));
    if (s.table) {
      t++;
      const fr = colFractions(s.table);
      fr.forEach((f, i) => colStyles.push(`<style:style style:name="T${t}C${i}" style:family="table-column"><style:table-column-properties style:column-width="${(16 * f).toFixed(2)}cm"/></style:style>`));
      parts.push(`<table:table table:name="Tabela${t}" table:style-name="Tbl">${fr.map((_, i) => `<table:table-column table:style-name="T${t}C${i}"/>`).join('')}` +
        `<table:table-header-rows><table:table-row>${s.table.columns.map((c) => `<table:table-cell table:style-name="Th" office:value-type="string"><text:p text:style-name="ThP">${xml(c)}</text:p></table:table-cell>`).join('')}</table:table-row></table:table-header-rows>` +
        s.table.rows.map((row) => `<table:table-row>${row.map((c) => `<table:table-cell table:style-name="Td" office:value-type="string">${String(c ?? '').split('\n').map((l) => `<text:p text:style-name="Cel">${xml(l)}</text:p>`).join('')}</table:table-cell>`).join('')}</table:table-row>`).join('') +
        `</table:table>`);
    }
  }
  parts.push(`<text:p text:style-name="Local">${xml(r.dateLong)}.</text:p>`, `<text:p text:style-name="Capa">_______________________________________</text:p>`,
    `<text:p text:style-name="CapaB">${xml(r.signature.name)}</text:p>`, ...r.signature.details.map((l) => `<text:p text:style-name="Capa">${xml(l)}</text:p>`), `<text:p text:style-name="Capa">${xml(r.signature.organization)}</text:p>`,
    `<text:p text:style-name="Rod">SHA-256: ${r.integrity}</text:p>`);
  const ns = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
  const base = `style:font-name="${FONT}" fo:font-family="${FONT}"`;
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${ns} office:version="1.3"><office:font-face-decls><style:font-face style:name="${FONT}" svg:font-family="${FONT}" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"/></office:font-face-decls><office:automatic-styles>
<style:style style:name="Capa" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.1cm"/><style:text-properties ${base} fo:font-size="12pt"/></style:style>
<style:style style:name="CapaB" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.1cm"/><style:text-properties ${base} fo:font-size="12pt" fo:font-weight="bold"/></style:style>
<style:style style:name="H" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm"/><style:text-properties ${base} fo:font-size="12pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Corpo" style:family="paragraph"><style:paragraph-properties fo:text-align="justify" fo:line-height="150%" fo:margin-bottom="0.2cm"/><style:text-properties ${base} fo:font-size="12pt"/></style:style>
<style:style style:name="Item" style:family="paragraph"><style:paragraph-properties fo:text-align="justify" fo:line-height="150%" fo:margin-left="1cm"/><style:text-properties ${base} fo:font-size="12pt"/></style:style>
<style:style style:name="Local" style:family="paragraph"><style:paragraph-properties fo:text-align="end" fo:margin-top="1cm" fo:margin-bottom="1.5cm"/><style:text-properties ${base} fo:font-size="12pt"/></style:style>
<style:style style:name="Rod" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-top="0.6cm"/><style:text-properties ${base} fo:font-size="8pt"/></style:style>
<style:style style:name="Cel" style:family="paragraph"><style:paragraph-properties fo:text-align="start"/><style:text-properties ${base} fo:font-size="10pt"/></style:style>
<style:style style:name="ThP" style:family="paragraph"><style:text-properties ${base} fo:font-size="10pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Tbl" style:family="table"><style:table-properties style:width="16cm" table:align="margins"/></style:style>
<style:style style:name="Th" style:family="table-cell"><style:table-cell-properties fo:background-color="#E7E7E7" fo:padding="0.08cm" fo:border="0.02cm solid #777777"/></style:style>
${colStyles.join('\n')}
<style:style style:name="Td" style:family="table-cell"><style:table-cell-properties fo:padding="0.08cm" fo:border="0.02cm solid #777777"/></style:style>
</office:automatic-styles><office:body><office:text>${parts.join('\n')}</office:text></office:body></office:document-content>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${ns} office:version="1.3"><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="3cm" fo:margin-bottom="2cm" fo:margin-left="3cm" fo:margin-right="2cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`;
  const JSZip = await loadZip();
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', content);
  zip.file('styles.xml', styles);
  zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta><dc:title>${xml(r.title)} nº ${xml(r.number)}</dc:title><meta:generator>Lex Detetive</meta:generator></office:meta></office:document-meta>`);
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`);
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/vnd.oasis.opendocument.text' });
}

// ---------------- PDF (Arial do sistema, 12, justificado) ----------------
/** Usa a Arial instalada no computador (Windows/macOS); no Linux, Liberation Sans (mesmas medidas); senão Helvetica. */
function systemArial(): { regular: string; bold: string } | null {
  const candidates = [
    ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'],
    [join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf'), join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arialbd.ttf')],
    ['/usr/share/fonts/truetype/msttcorefonts/Arial.ttf', '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf'],
    ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'],
    ['/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf', '/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf'],
  ];
  const hit = candidates.find(([a, b]) => existsSync(a) && existsSync(b));
  return hit ? { regular: hit[0], bold: hit[1] } : null;
}

async function toPdf(r: Report): Promise<Buffer> {
  const PDFDocument = await loadPdf();
  const cm = 28.3465;
  const M = { top: 3 * cm, left: 3 * cm, right: 2 * cm, bottom: 2 * cm };
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: M, bufferPages: true, info: { Title: `${r.title} nº ${r.number}`, Author: r.organization, Subject: r.subtitle, Creator: 'Lex Detetive' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const arial = systemArial();
    if (arial) { doc.registerFont('R', arial.regular); doc.registerFont('B', arial.bold); }
    const R = arial ? 'R' : 'Helvetica';
    const B = arial ? 'B' : 'Helvetica-Bold';
    const png = logoOf(r);
    const W = doc.page.width - M.left - M.right;
    const X = M.left;
    const LINE_GAP = 5; // ~1,5 de entrelinha para Arial 12

    const header = () => {
      const y = M.top - 40;
      // A quebra de página pode ocorrer no meio de um texto: preserva fonte e tamanho correntes.
      const prevFont = (doc as any)._font;
      const prevSize = (doc as any)._fontSize;
      doc.save();
      if (png) { try { doc.image(png, X, y - 8, { fit: [60, 24] }); } catch { /* imagem inválida */ } }
      doc.font(R).fontSize(8).fillColor('#000').text(`${r.organization} · Lex Detetive`, X + (png ? 66 : 0), y + 3, { lineBreak: false });
      doc.text(`Relatório nº ${r.number}`, X, y + 3, { width: W, align: 'right', lineBreak: false });
      doc.moveTo(X, y + 18).lineTo(X + W, y + 18).lineWidth(0.6).strokeColor('#000').stroke();
      doc.restore();
      if (prevFont) { (doc as any)._font = prevFont; doc.fontSize(prevSize); }
      doc.x = X; doc.y = M.top;
    };
    doc.on('pageAdded', header);
    header();

    const text = (t: string, o: { bold?: boolean; align?: 'justify' | 'center' | 'left' | 'right'; size?: number; after?: number; indent?: number } = {}) => {
      doc.font(o.bold ? B : R).fontSize(o.size ?? BODY_PT).fillColor('#000')
        .text(t, X + (o.indent || 0), doc.y, { width: W - (o.indent || 0), align: o.align ?? 'justify', lineGap: LINE_GAP });
      doc.y += o.after ?? 6;
    };
    const ensure = (h: number) => { if (doc.y + h > doc.page.height - M.bottom) doc.addPage(); };

    // Capa
    text(r.organization.toUpperCase(), { bold: true, align: 'center', after: 2 });
    text(r.title.toUpperCase(), { bold: true, align: 'center', after: 2 });
    text(`Relatório nº ${r.number}`, { align: 'center', after: 2 });
    text(`Investigado: ${r.subtitle}`, { align: 'center', after: 2 });
    text(r.dateLong, { align: 'center', after: 10 });
    doc.moveTo(X, doc.y).lineTo(X + W, doc.y).lineWidth(0.6).strokeColor('#000').stroke();
    doc.y += 14;

    const table = (s: Section) => {
      const t = s.table!;
      const widths = colFractions(t).map((f) => f * W);
      // Fonte da tabela: começa em 10 pt e diminui (até 8 pt) se alguma palavra não couber inteira na coluna.
      let size = TABLE_PT;
      const fits = (sz: number) => [t.columns, ...t.rows].every((row, ri) => {
        doc.font(ri === 0 ? B : R).fontSize(sz);
        return row.every((c, i) => String(c ?? '').split(/\s+/).every((w) => doc.widthOfString(w) <= widths[i] - 8));
      });
      while (size > 8 && !fits(size)) size -= 0.5;
      const drawRow = (cells: (string | number)[], head: boolean) => {
        doc.font(head ? B : R).fontSize(size);
        const h = Math.max(...cells.map((c, i) => doc.heightOfString(String(c ?? ''), { width: widths[i] - 8, lineGap: 1 }))) + 7;
        if (doc.y + h > doc.page.height - M.bottom) {
          doc.addPage();
          if (!head) drawRow(t.columns, true); // repete o cabeçalho na nova página
          doc.font(head ? B : R).fontSize(size);
        }
        const y = doc.y;
        if (head) doc.rect(X, y, W, h).fill('#E7E7E7');
        let x = X;
        cells.forEach((c, i) => {
          doc.rect(x, y, widths[i], h).lineWidth(0.4).strokeColor('#777').stroke();
          doc.fillColor('#000').text(String(c ?? ''), x + 4, y + 4, { width: widths[i] - 8, align: 'left', lineGap: 1 });
          x += widths[i];
        });
        doc.y = y + h; doc.x = X;
      };
      drawRow(t.columns, true);
      t.rows.forEach((row) => drawRow(row, false));
      doc.y += 10;
    };

    for (const s of numbered(r.sections)) {
      // Não deixa o título sozinho no pé da página: reserva espaço para o título, o texto e o início da tabela.
      doc.font(R).fontSize(BODY_PT);
      const parasH = (s.paragraphs || []).reduce((h, p) => h + doc.heightOfString(p, { width: W, lineGap: LINE_GAP }) + 6, 0);
      ensure(Math.min(320, 40 + parasH + (s.table ? 70 : 0)));
      doc.y += s.level === 2 ? 4 : 10;
      text(s.label, { bold: true, align: 'left', after: 6 });
      s.paragraphs?.forEach((p) => text(p));
      s.bullets?.forEach((b, i) => text(`${alpha(i)}  ${b}`, { indent: 28, after: 3 }));
      if (s.bullets) doc.y += 4;
      if (s.table) table(s);
    }

    // Assinatura
    ensure(150);
    doc.y += 18;
    text(`${r.dateLong}.`, { align: 'right', after: 48 });
    const mid = X + W / 2;
    doc.moveTo(mid - 120, doc.y).lineTo(mid + 120, doc.y).lineWidth(0.6).strokeColor('#000').stroke();
    doc.y += 6;
    text(r.signature.name, { bold: true, align: 'center', after: 0 });
    r.signature.details.forEach((l) => text(l, { align: 'center', after: 0 }));
    text(r.signature.organization, { align: 'center', after: 0 });

    // Rodapé com numeração "Página X de Y" e integridade
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - bottom + 16;
      doc.moveTo(X, y - 4).lineTo(X + W, y - 4).lineWidth(0.6).strokeColor('#000').stroke();
      doc.font(R).fontSize(8).fillColor('#000').text(`${footerLine(r)} · Página ${i + 1} de ${range.count}`, X, y, { width: W, align: 'center', lineBreak: false });
      doc.fontSize(7).text(`SHA-256: ${r.integrity}`, X, y + 11, { width: W, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
