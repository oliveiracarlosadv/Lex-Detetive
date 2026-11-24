import { inlineImages } from './mail.service';

describe('assinatura em imagem no e-mail', () => {
  it('converte imagens embutidas em anexos inline (cid)', () => {
    const png = Buffer.from('89504e470d0a', 'hex').toString('base64');
    const { body, inline } = inlineImages(`<p>Texto</p><div data-signature="1">Dr. Carlos<img src="data:image/png;base64,${png}" alt="Assinatura"></div>`);
    expect(body).toContain('src="cid:imagem1@lexdetetive"');
    expect(body).not.toContain('data:image');
    expect(inline).toHaveLength(1);
    expect(inline[0]).toMatchObject({ contentType: 'image/png', filename: 'imagem1.png', contentDisposition: 'inline' });
  });

  it('mantém o texto sem imagens como está', () => {
    expect(inlineImages('<p>Olá</p>')).toEqual({ body: '<p>Olá</p>', inline: [] });
  });
});
