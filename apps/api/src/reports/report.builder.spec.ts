import { buildReport, REPORT_TYPES, ReportType } from './report.builder';
import { exportReport, FORMATS } from './exporters';

const target = {
  kind: 'PF', name: 'Maria Exemplo', document: '***.982.247-**', purpose: 'Teste', monitored: true, intervalMinutes: 60,
  processes: [{ number: '0000011-44.2026.8.26.0058', court: 'TJSP', className: 'Procedimento Comum', status: 'ativo', value: 1000, source: 'datajud',
    lastMovementAt: new Date(), movements: [{ date: new Date(), description: 'Juntada de petição' }] }],
  snapshots: [], analyses: [],
};

describe('relatórios', () => {
  it.each(Object.keys(REPORT_TYPES))('monta o relatório %s', (type) => {
    const r = buildReport(type as ReportType, target, { user: 'Teste', organization: 'Lex Tecnologias' });
    expect(r.sections.length).toBeGreaterThan(2);
    expect(r.integrity).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each(Object.keys(FORMATS))('exporta em %s', async (format) => {
    const r = buildReport('investigacao', target, { user: 'Teste', organization: 'Lex Tecnologias' });
    const buf = await exportReport(r, format as any);
    expect(buf.length).toBeGreaterThan(100);
  });
});

describe('resumo do processo e trechos de publicação', () => {
  const { cleanPublication, processSummary } = require('./report.builder');
  it('tira o cabeçalho do tribunal e mantém o tipo do ato', () => {
    const c = cleanPublication('Intimação publicada no DJEN (Decisão): PODER JUDICIÁRIO TRIBUNAL DE JUSTIÇA DO ESTADO 1ª VARA CÍVEL 0805576-60.2022.8.14.0015 texto do ato');
    expect(c.kind).toBe('Intimação (Decisão)');
    expect(c.text).toBe('texto do ato');
  });
  it('resume partes, posição do investigado e último ato', () => {
    const p = {
      number: '0805576-60.2022.8.14.0015', court: 'TJPA', organ: '1ª Vara Cível', className: 'PROCEDIMENTO COMUM CÍVEL', status: 'ativo',
      parties: JSON.stringify([{ name: 'EMPRESA ALFA LTDA', role: 'Polo ativo (autor)' }, { name: 'BETA S/A', role: 'Polo passivo (réu)' }, { name: 'BETA S/A', role: 'Polo passivo (réu)' }]),
      movements: [{ date: '2026-10-12T12:00:00Z', code: 'DJEN-1', description: 'Intimação publicada no DJEN (Decisão): DECISÃO defiro' }],
    };
    const s = processSummary(p, 'Empresa Alfa Ltda');
    expect(s.sentence).toContain('EMPRESA ALFA LTDA contra BETA S/A.');
    expect(s.sentence).toContain('autor (polo ativo)');
    expect(s.sentence).toContain('12/10/2026 — Intimação (Decisão)');
  });
});
