import { isRecentMovement } from './targets.service';

describe('alerta só para movimentação recente', () => {
  const now = new Date('2026-10-21T12:00:00Z').getTime();
  const last = new Date('2026-07-21T12:00:00Z');
  it('publicação antiga que apareceu tarde não alerta', () => {
    expect(isRecentMovement('2026-02-13T12:00:00Z', last, now)).toBe(false);
  });
  it('movimentação posterior à última conhecida alerta', () => {
    expect(isRecentMovement('2026-08-01T12:00:00Z', last, now)).toBe(true);
  });
  it('movimentação dos últimos 15 dias sempre alerta', () => {
    expect(isRecentMovement('2026-10-15T12:00:00Z', new Date('2026-10-20T12:00:00Z'), now)).toBe(true);
  });
});
