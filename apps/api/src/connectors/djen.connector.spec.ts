import { mapDjenItems, nameMatches } from './djen.connector';
import { parseDouHtml } from './dou.connector';
import { processCard } from '../targets/ingest';

const item = {
  id: 1, data_disponibilizacao: '2026-10-16', siglaTribunal: 'TRT21', tipoComunicacao: 'Intimação', nomeOrgao: '3ª Vara do Trabalho de Mossoró',
  numeroprocessocommascara: '0001003-19.2015.5.21.0013', nomeClasse: 'Ação Trabalhista', tipoDocumento: 'Despacho', link: 'https://pje.trt21.jus.br/x',
  texto: 'Fica a parte intimada para manifestação no prazo de 5 dias.',
  destinatarios: [{ nome: 'HELIO MOURA E SILVA', polo: 'A' }, { nome: 'PSI PROJETOS LTDA', polo: 'P' }],
  destinatarioadvogados: [{ advogado: { nome: 'Fulano', numero_oab: '4414', uf_oab: 'RN' } }],
};

describe('DJEN', () => {
  it('evita homônimos: todas as palavras do nome precisam aparecer', () => {
    expect(nameMatches('Hélio Moura', 'HELIO MOURA E SILVA')).toBe(true);
    expect(nameMatches('Hélio Souza', 'HELIO MOURA E SILVA')).toBe(false);
    expect(nameMatches('PSI Projetos Ltda', 'PSI - PROJETOS E SERVICOS INDUSTRIAIS LTDA')).toBe(true);
  });

  it('converte publicações em processo com partes, vara e intimação', () => {
    const [p] = mapDjenItems([item, { ...item, id: 2, data_disponibilizacao: '2026-09-01', tipoComunicacao: 'Edital' }]);
    expect(p.number).toBe('0001003-19.2015.5.21.0013');
    expect(p.court).toBe('TRT21');
    expect(p.movements).toHaveLength(2);
    expect(p.movements[0].date.startsWith('2026-10-16')).toBe(true);
    const card = processCard({ number: p.number, court: p.court, organ: p.organ, parties: JSON.stringify(p.parties) }, p.movements, p.movements.slice(0, 1));
    expect(card.autor).toBe('HELIO MOURA E SILVA');
    expect(card.reu).toBe('PSI PROJETOS LTDA');
    expect(card.vara).toContain('Mossoró');
    expect(card.intimacao).toBe(true);
  });
});

describe('DOU', () => {
  it('lê os resultados embutidos na página de busca', () => {
    const html = '<script id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params" type="application/json">{"jsonArray":[{"pubName":"DO3","title":"AVISO","pubDate":"16/10/2026","urlTitle":"aviso-1","content":"x"}]}</script>';
    expect(parseDouHtml(html)).toHaveLength(1);
    expect(parseDouHtml('<html></html>')).toEqual([]);
  });
});
