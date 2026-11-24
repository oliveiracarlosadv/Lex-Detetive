import { diffRegistry, movementFingerprint, newRecords, processCard } from './ingest';

describe('consolidação e detecção de mudanças', () => {
  it('detecta alterações cadastrais campo a campo', () => {
    const changes = diffRegistry({ situacao: 'ATIVA', socios: [{ nome: 'A' }] }, { situacao: 'BAIXADA', socios: [{ nome: 'A' }] });
    expect(changes).toEqual([{ field: 'situacao', before: 'ATIVA', after: 'BAIXADA' }]);
    expect(diffRegistry(null, { a: 1 })).toEqual([]);
  });

  it('identifica novos registros (sanções/publicações)', () => {
    const old = [{ title: 'CEIS', date: '2024-01-01' }];
    expect(newRecords(old, [...old, { title: 'CNEP', date: '2024-02-01' }])).toHaveLength(1);
  });

  it('impressão digital da movimentação ignora caixa e espaços', () => {
    expect(movementFingerprint('2024-01-01T10:00:00Z', 'Juntada de Petição ')).toBe(movementFingerprint('2024-01-01T10:00:00.000Z', 'juntada de petição'));
  });

  it('monta a ficha do processo com partes, audiências e marcos', () => {
    const card = processCard(
      {
        number: '0000011-44.2026.8.26.0058', court: 'TJSP', organ: '2ª Vara Cível', className: 'Procedimento Comum', value: 15000,
        parties: JSON.stringify([{ name: 'Maria', role: 'Autor' }, { name: 'Banco X', role: 'Réu' }]),
      },
      [
        { date: '2026-01-10', description: 'Decisão — Tutela de urgência deferida' },
        { date: '2026-02-01', description: 'Juntada de contestação' },
        { date: '2026-03-01', description: 'Audiência de conciliação designada para 15/04/2026 14:00' },
        { date: '2026-04-15', description: 'Audiência de conciliação realizada — sem acordo' },
      ],
      [{ date: '2026-05-01', description: 'Intimação eletrônica expedida — prazo de 15 dias' }],
    );
    expect(card.autor).toBe('Maria');
    expect(card.reu).toBe('Banco X');
    expect(card.vara).toBe('2ª Vara Cível');
    expect(card.valorCausa).toContain('15.000');
    expect(card.intimacao).toBe(true);
    expect(card.marcos.liminar.presente).toBe(true);
    expect(card.marcos.contestacao.presente).toBe(true);
    expect(card.marcos.replica.presente).toBe(false);
    expect(card.marcos.sentenca.presente).toBe(false);
    expect(new Date(card.audienciasMarcadas[0].data).getDate()).toBe(15);
    expect(card.audienciasRealizadas).toHaveLength(1);
  });

  it('informa quando a fonte não traz as partes', () => {
    const card = processCard({ number: 'x', court: 'TJPA' }, []);
    expect(card.autor).toBe('não informado pela fonte');
  });
});
