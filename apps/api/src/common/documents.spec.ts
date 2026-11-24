import { buildCnj, courtFromCnj, formatCnj, isValidCnj, isValidCnpj, isValidCpf, maskCnpj, maskCpf } from './documents';

describe('documentos', () => {
  it('valida CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('valida CNPJ', () => {
    expect(isValidCnpj('33.000.167/0001-01')).toBe(true);
    expect(isValidCnpj('33.000.167/0001-02')).toBe(false);
  });

  it('mascara CPF e CNPJ (LGPD)', () => {
    expect(maskCpf('52998224725')).toBe('***.982.247-**');
    expect(maskCnpj('33000167000101')).toBe('33.000.***/****-01');
  });

  it('valida e formata número CNJ', () => {
    expect(isValidCnj('0000011-44.2026.8.26.0058')).toBe(true);
    expect(isValidCnj('0000011-45.2026.8.26.0058')).toBe(false);
    expect(formatCnj('00000114420268260058')).toBe('0000011-44.2026.8.26.0058');
  });

  it('identifica o tribunal pelo número CNJ', () => {
    expect(courtFromCnj('0000011-44.2026.8.26.0058')).toBe('TJSP');
    expect(courtFromCnj(buildCnj(1, 2024, '8', '07', '0001'))).toBe('TJDFT');
    expect(courtFromCnj(buildCnj(1, 2024, '4', '01', '3400'))).toBe('TRF1');
    expect(courtFromCnj(buildCnj(1, 2024, '5', '08', '0001'))).toBe('TRT8');
    expect(courtFromCnj(buildCnj(1, 2024, '5', '00', '0000'))).toBe('TST');
    expect(courtFromCnj(buildCnj(1, 2024, '3', '00', '0000'))).toBe('STJ');
  });

  it('números gerados têm dígito verificador válido', () => {
    for (let i = 0; i < 50; i++) expect(isValidCnj(buildCnj(1000000 + i * 7919, 2020, '8', '14', '9999'))).toBe(true);
  });
});
