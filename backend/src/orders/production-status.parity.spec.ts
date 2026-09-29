import * as path from 'path';
import {
  CANCELLABLE_STATUSES,
  VALID_TRANSITIONS,
} from './production-status.util';

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

  it.each(Object.keys(VALID_TRANSITIONS))(
    '%s tiene etiqueta y tono en el admin',
    (status) => {
      expect(labels.PRODUCTION_STATUS_LABELS[status]).toBeDefined();
      expect(labels.PRODUCTION_STATUS_TONES[status]).toBeDefined();
    },
  );
});
