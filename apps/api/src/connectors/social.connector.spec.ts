import { cleanHandle, parseHandles, sameName } from './social.connector';

describe('redes sociais', () => {
  it('extrai o nome de usuário de @, links e textos', () => {
    expect(cleanHandle('@fulano')).toBe('fulano');
    expect(cleanHandle('https://www.instagram.com/fulano.silva/?hl=pt')).toBe('fulano.silva');
    expect(cleanHandle('x.com/@Fulano_1')).toBe('Fulano_1');
    expect(cleanHandle('nome com espaço')).toBe('nome');
    expect(cleanHandle('<script>')).toBe('');
  });
  it('separa vários nomes, sem repetir, no máximo 5', () => {
    expect(parseHandles('@a1, A1; b2\nc3')).toEqual(['a1', 'b2', 'c3']);
    expect(parseHandles(['u1', 'u2', 'u3', 'u4', 'u5', 'u6'])).toHaveLength(5);
  });
  it('compara nomes ignorando acentos e conectivos', () => {
    expect(sameName('João da Silva Souza', 'JOAO DA SILVA SOUZA')).toBe(true);
    expect(sameName('João Silva', 'João da Silva Souza')).toBe(false);
  });
});

describe('buscadores na internet', () => {
  const { webQueries } = require('./websearch.connector');
  it('busca nome entre aspas e CPF com e sem pontuação', () => {
    const q = webQueries({ kind: 'PF', name: 'Maria de Souza', cpf: '52998224725' });
    expect(q.map((x: any) => x.q)).toEqual(['"Maria de Souza"', '"529.982.247-25" OR "52998224725"']);
  });
  it('pessoa jurídica: razão social, nome fantasia e CNPJ', () => {
    const q = webQueries({ kind: 'PJ', name: 'Alfa Comércio Ltda', tradeName: 'Alfa', cnpj: '11222333000181' });
    expect(q).toHaveLength(2 + 0 + 1 - 1 + 1);
    expect(q[2].q).toBe('"11.222.333/0001-81" OR "11222333000181"');
  });
});

describe('diários oficiais dos estados', () => {
  const { ufsFromCourts, parseUfs, DOE_SITES } = require('./doe.connector');
  it('tem os 27 estados', () => expect(Object.keys(DOE_SITES)).toHaveLength(27));
  it('descobre o estado pelo tribunal', () => {
    expect(ufsFromCourts(['TJPA', 'TRT8', 'STJ', 'TJDFT']).sort()).toEqual(['AP', 'DF', 'PA']);
  });
  it('lê as siglas configuradas', () => expect(parseUfs('pa, sp;xx AM')).toEqual(['PA', 'SP', 'AM']));
});
