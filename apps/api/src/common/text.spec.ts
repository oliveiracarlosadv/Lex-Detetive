import { cleanText } from './text';

describe('cleanText', () => {
  it('remove marcação de página do DJEN', () => {
    expect(cleanText('<center> <h2>Processo sigiloso</h2> <p>Para visualização do documento consulte os autos digitais</p> </center>'))
      .toBe('Processo sigiloso. Para visualização do documento consulte os autos digitais.');
  });
  it('recupera acentos corrompidos frequentes', () => {
    expect(cleanText('A Secretaria de Distribuiï¿½ï¿½o do Tribunal de Justiï¿½a, parï¿½grafo ï¿½nico, Data Vinculaï¿½ï¿½o'))
      .toBe('A Secretaria de Distribuição do Tribunal de Justiça, parágrafo único, Data Vinculação');
  });
  it('recupera particípios e -ência', () => {
    expect(cleanText('foi distribuï¿½do; compet\uFFFDncia')).toBe('foi distribuído; competência');
  });
  it('decodifica letras acentuadas em código', () => {
    expect(cleanText('Fal&ecirc;ncia; R&Eacute;U; a&ccedil;&atilde;o')).toBe('Falência; RÉU; ação');
  });
  it('troca quebras de linha e entidades', () => {
    expect(cleanText('Apelante: GEAP<br/>Advogado(a): Fulano&nbsp;de Tal')).toBe('Apelante: GEAP Advogado(a): Fulano de Tal');
  });
});
