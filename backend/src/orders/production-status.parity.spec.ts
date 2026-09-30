import * as path from 'path';
import {
  CANCELLABLE_STATUSES,
  VALID_TRANSITIONS,
  transitionsFor,
} from './production-status.util';
import { OrderItemKind, orderItemKind } from './order-item-kind.util';

// El admin del frontend decide qué botones ofrecer con su propio espejo de la
// máquina de estados. Si diverge, el admin pulsa una transición y el backend
// la rechaza con 400. La ruta se resuelve en tiempo de ejecución para que el
// `tsc` del backend no siga los imports del frontend (alias `@/`).
const FRONT_LIB = path.resolve(
  __dirname,
  '../../../frontend/src/entities/admin/lib',
);

/* eslint-disable @typescript-eslint/no-require-imports */
const front = require(path.join(FRONT_LIB, 'order-transitions.ts')) as {
  VALID_TRANSITIONS: Record<string, string[]>;
  CANCELLABLE_STATUSES: string[];
  transitionsFor: (status: string) => string[];
};
const frontKind = require(path.join(FRONT_LIB, 'order-item-kind.ts')) as {
  orderItemKind: (item: {
    creditAmount: number | null;
    productRef: { isCreditPack: boolean; template: string | null } | null;
  }) => string;
};
const labels = require(path.join(FRONT_LIB, 'production-status.ts')) as {
  PRODUCTION_STATUS_LABELS: Record<string, string>;
  PRODUCTION_STATUS_TONES: Record<string, string>;
};
/* eslint-enable @typescript-eslint/no-require-imports */

describe('paridad backend ↔ frontend de productionStatus', () => {
  it('las transiciones son las mismas', () => {
    expect(front.VALID_TRANSITIONS).toEqual(VALID_TRANSITIONS);
  });

  it('los estados cancelables son los mismos', () => {
    expect([...front.CANCELLABLE_STATUSES].sort()).toEqual(
      [...CANCELLABLE_STATUSES].sort(),
    );
  });

  // ClawAndSoul tenía una máquina reducida para accesorios; ClawPuzzle tiene
  // una sola, y el admin no debe ofrecer nada distinto según el item.
  it.each(Object.keys(VALID_TRANSITIONS))(
    'transitionsFor(%s) ofrece lo mismo que el backend',
    (status) => {
      expect(front.transitionsFor(status)).toEqual(
        transitionsFor(status, 'puzzle'),
      );
    },
  );

  it.each(Object.keys(VALID_TRANSITIONS))(
    '%s tiene etiqueta y tono en el admin',
    (status) => {
      expect(labels.PRODUCTION_STATUS_LABELS[status]).toBeDefined();
      expect(labels.PRODUCTION_STATUS_TONES[status]).toBeDefined();
    },
  );
});

// El admin decide con el tipo qué card pinta (la de producción o la de
// créditos). En el backend el arte se llama `puzzle`; en el admin, `art`.
describe('paridad backend ↔ frontend de orderItemKind', () => {
  const FRONT_NAME: Record<OrderItemKind, string> = {
    puzzle: 'art',
    credits: 'credits',
  };

  it.each([
    ['puzzle', { isCreditPack: false, template: 'Puzzle' }],
    ['pack de créditos', { isCreditPack: true, template: 'Credits' }],
    ['plantilla Credits', { isCreditPack: false, template: 'Credits' }],
    ['producto antiguo sin plantilla', { isCreditPack: false, template: null }],
    ['sin producto enlazado', null],
  ])('%s', (_label, ref) => {
    const expected = FRONT_NAME[orderItemKind(ref)];

    expect(
      frontKind.orderItemKind({ creditAmount: null, productRef: ref }),
    ).toBe(expected);
  });

  it('una línea con creditAmount es de créditos aunque el producto no lo diga', () => {
    expect(
      frontKind.orderItemKind({
        creditAmount: 10,
        productRef: { isCreditPack: false, template: 'Puzzle' },
      }),
    ).toBe('credits');
  });
});
