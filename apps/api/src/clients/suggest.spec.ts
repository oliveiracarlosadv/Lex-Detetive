import { nameMatches } from './clients.service';

describe('sugestão de cliente pelo nome da parte', () => {
  it('reconhece o mesmo nome ignorando acentos, pontuação e LTDA/S.A.', () => {
    expect(nameMatches('Clínica Exemplo Saúde Ltda', 'CLINICA EXEMPLO SAUDE LTDA')).toBe(true);
    expect(nameMatches('Telefonica Brasil S.A.', 'TELEFONICA BRASIL S/A')).toBe(true);
    expect(nameMatches('João da Silva', '1. JOAO DA SILVA (RECORRENTE)')).toBe(true);
  });
  it('não confunde nomes parecidos', () => {
    expect(nameMatches('João Silva', 'JOAO SILVANO PEREIRA')).toBe(false);
    expect(nameMatches('Maria', 'MARIA DE SOUZA')).toBe(false);
  });
});
