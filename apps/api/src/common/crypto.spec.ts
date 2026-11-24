import { randomBytes } from 'crypto';

process.env.LEX_MASTER_KEY = randomBytes(32).toString('base64');
process.env.LEX_DATA_DIR = require('os').tmpdir() + '/lex-test-' + Date.now();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { blindIndex, decrypt, encrypt } = require('./crypto');

describe('criptografia AES-256-GCM', () => {
  it('cifra e decifra', () => {
    const c = encrypt('52998224725');
    expect(c.startsWith('v1:')).toBe(true);
    expect(c).not.toContain('52998224725');
    expect(decrypt(c)).toBe('52998224725');
  });

  it('usa IV aleatório (mesmo texto gera cifras diferentes)', () => {
    expect(encrypt('abc')).not.toBe(encrypt('abc'));
  });

  it('detecta adulteração', () => {
    const c = encrypt('segredo').split(':');
    c[3] = Buffer.from('outra coisa').toString('base64');
    expect(() => decrypt(c.join(':'))).toThrow();
  });

  it('índice cego é determinístico e não revela o valor', () => {
    expect(blindIndex('123')).toBe(blindIndex('123'));
    expect(blindIndex('123')).not.toContain('123');
  });
});
