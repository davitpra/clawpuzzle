import {
  CANCELLABLE_STATUSES,
  PRODUCTION_QUEUE_STATUSES,
  ProductionStatus,
  VALID_TRANSITIONS,
  computeAutoEarlyStatus,
  transitionsFor,
} from './production-status.util';

const ALL_STATUSES: ProductionStatus[] = [
  'pending',
  'generating',
  'art_failed',
  'draft',
  'pre_production',
  'in_production',
  'printed',
  'packed',
  'shipped',
  'delivered',
  'on_hold',
  'cancelled',
  'refunded',
  'restocked',
];

const allows = (from: string, to: string) =>
  transitionsFor(from, 'puzzle').includes(to);

describe('production-status.util', () => {
  describe('máquina de estados', () => {
    it.each([
      ['draft', 'pre_production'],
      ['pre_production', 'in_production'],
      ['in_production', 'printed'],
      ['printed', 'packed'],
      ['packed', 'shipped'],
      ['shipped', 'delivered'],
      ['delivered', 'refunded'],
      ['on_hold', 'packed'],
      ['packed', 'on_hold'],
      ['pending', 'cancelled'],
    ])('permite %s → %s', (from, to) => {
      expect(allows(from, to)).toBe(true);
    });

    it.each([
      // Todo puzzle se empaca antes de enviarse.
      ['printed', 'shipped'],
      ['draft', 'shipped'],
      ['in_production', 'packed'],
      // Los tempranos los gobierna la auto-asignación, no el admin.
      ['pending', 'draft'],
      ['generating', 'draft'],
      ['shipped', 'cancelled'],
    ])('rechaza %s → %s', (from, to) => {
      expect(allows(from, to)).toBe(false);
    });

    it.each(['cancelled', 'refunded', 'restocked'])(
      '%s es terminal',
      (status) => {
        expect(transitionsFor(status, 'puzzle')).toEqual([]);
      },
    );

    it('un estado desconocido no tiene salidas', () => {
      expect(transitionsFor('nope', 'puzzle')).toEqual([]);
    });

    it('cubre todos los estados y solo apunta a estados conocidos', () => {
      expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual(
        [...ALL_STATUSES].sort(),
      );
      for (const targets of Object.values(VALID_TRANSITIONS)) {
        for (const t of targets) expect(ALL_STATUSES).toContain(t);
      }
    });

    it('packed se puede cancelar y está en la cola de producción', () => {
      expect(CANCELLABLE_STATUSES).toContain('packed');
      expect(PRODUCTION_QUEUE_STATUSES).toContain('packed');
      expect(CANCELLABLE_STATUSES).not.toContain('shipped');
    });
  });

  describe('computeAutoEarlyStatus', () => {
    it.each([
      ['pending', 'completed', 'pending'],
      ['authorized', 'completed', 'pending'],
      ['partially_paid', 'completed', 'draft'],
      ['partially_paid', 'processing', 'generating'],
      ['refunded', 'completed', 'refunded'],
      ['partially_refunded', 'pending', 'refunded'],
      ['voided', 'completed', 'cancelled'],
      ['paid', 'failed', 'art_failed'],
      ['paid', 'pending', 'generating'],
      ['paid', 'processing', 'generating'],
      ['paid', 'completed', 'draft'],
      ['paid', null, 'draft'],
      [null, 'completed', 'draft'],
    ])('pago %s + arte %s → %s', (financial, generation, expected) => {
      expect(computeAutoEarlyStatus(financial, generation)).toBe(expected);
    });
  });
});
