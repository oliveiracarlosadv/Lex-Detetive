import { checkPublication, docsNearName, mergeChecks, sameDoc } from './doc-match';

const CPF = '529.982.247-25';

describe('conferência de CPF nas publicações (homônimos)', () => {
  it('confirma quando o CPF ao lado do nome é o cadastrado', () => {
    const t = 'RECLAMANTE: MARIA DA SILVA SANTOS, brasileira, CPF nº 529.982.247-25, residente em Belém.';
    expect(checkPublication(t, 'Maria da Silva Santos', CPF)).toEqual({ status: 'confirmado', found: '***.982.247-**' });
  });

  it('aponta homônimo quando o CPF ao lado do nome é outro', () => {
    const t = 'EXECUTADO: MARIA DA SILVA SANTOS - CPF: 239.481.244-34';
    expect(checkPublication(t, 'Maria da Silva Santos', CPF).status).toBe('divergente');
  });

  it('não confunde com o CPF de outra parte citada antes do nome', () => {
    const t = 'AUTOR: JOÃO PEREIRA, CPF 239.481.244-34. RÉ: MARIA DA SILVA SANTOS.';
    expect(checkPublication(t, 'Maria da Silva Santos', CPF).status).toBe('nao_informado');
  });

  it('não pega o CPF da parte seguinte quando a pessoa não tem CPF no texto', () => {
    const t = 'RÉ: MARIA DA SILVA SANTOS, AUTOR: JOÃO PEREIRA, CPF 239.481.244-34; ADVOGADO: FULANO OAB/PA 1234';
    expect(checkPublication(t, 'Maria da Silva Santos', CPF).status).toBe('nao_informado');
  });

  it('aceita CPF mascarado pelo tribunal', () => {
    expect(sameDoc('***.982.247-**', CPF)).toBe(true);
    expect(sameDoc('***.111.222-**', CPF)).toBe(false);
    expect(checkPublication('Parte: MARIA DA SILVA SANTOS (CPF ***.982.247-**)', 'Maria da Silva Santos', CPF).status).toBe('confirmado');
  });

  it('ignora números que não são CPF válido', () => {
    expect(docsNearName('MARIA DA SILVA SANTOS processo 123.456.789-00', 'Maria da Silva Santos')).toEqual([]);
  });

  it('sem CPF cadastrado não há como conferir', () => {
    expect(checkPublication('MARIA DA SILVA SANTOS CPF 529.982.247-25', 'Maria da Silva Santos', null).status).toBe('nao_informado');
  });

  it('uma confirmação prevalece sobre divergências no mesmo processo', () => {
    expect(mergeChecks({ status: 'divergente', found: 'x' }, { status: 'confirmado', found: 'y' }).status).toBe('confirmado');
    expect(mergeChecks({ status: 'nao_informado' }, { status: 'divergente', found: 'x' }).status).toBe('divergente');
  });
});
