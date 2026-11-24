import { heuristicAnalysis } from './heuristics';

describe('análise por regras', () => {
  it('aponta riscos de constrição e possível prescrição intercorrente', () => {
    const r = heuristicAnalysis({
      number: '1', court: 'TJSP', className: 'Execução Fiscal', status: 'ativo', value: 1000,
      movements: [{ date: '2020-01-01', description: 'Penhora via SISBAJUD deferida' }],
    });
    expect(r.riscos.some((x) => x.nivel === 'alto')).toBe(true);
    expect(r.prescricao).toMatch(/prescrição intercorrente/);
    expect(r.valores[0].valor).toContain('1.000');
  });
});
