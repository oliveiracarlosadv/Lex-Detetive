import { mapCnpja, mergeCnpj } from './brasilapi.connector';
import { diffRegistry } from '../targets/ingest';

describe('CNPJ por duas APIs abertas', () => {
  const cnpja = {
    taxId: '02428931000110', alias: 'Fantasia', founded: '1998-03-04', head: true, status: { text: 'Ativa' },
    company: { name: 'EMPRESA LTDA', equity: 1000, members: [{ since: '1998-03-04', person: { name: 'Fulano' }, role: { text: 'Sócio-Administrador' } }], simples: { optant: true, since: '2020-01-01' }, simei: { optant: false } },
    address: { street: 'Rua A', number: '1', city: 'Belém', state: 'PA', zip: '66000000' }, phones: [{ area: '91', number: '99999999' }], emails: [{ address: 'a@b.com' }],
  };
  it('lê a resposta do CNPJá', () => {
    const r = mapCnpja(cnpja);
    expect(r.cnpj).toBe('02.428.931/0001-10');
    expect(r.simples).toBe('Sim (desde 01/01/2020)');
    expect(r.socios[0].nome).toBe('Fulano');
    expect(r.telefones).toBe('(91) 99999999');
  });
  it('BrasilAPI é a base e o CNPJá completa', () => {
    const m = mergeCnpj({ razaoSocial: 'BASE', nomeFantasia: null, socios: [] }, mapCnpja(cnpja))!;
    expect(m.razaoSocial).toBe('BASE');
    expect(m.nomeFantasia).toBe('Fantasia');
    expect(m.socios).toHaveLength(1);
  });
  it('campo novo ou ausente não é alteração cadastral', () => {
    expect(diffRegistry({ situacao: 'ATIVA' }, { situacao: 'ATIVA', simples: 'Sim' })).toEqual([]);
    expect(diffRegistry({ situacao: 'ATIVA', simples: 'Sim' }, { situacao: 'ATIVA', simples: null })).toEqual([]);
    expect(diffRegistry({ situacao: 'ATIVA' }, { situacao: 'BAIXADA' })).toHaveLength(1);
  });
});
