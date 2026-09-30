import { randomUUID } from 'node:crypto';

// uuid v13 es ESM-only y ts-jest no transforma node_modules. La app solo usa
// v4, que equivale a randomUUID; jest-integration.json mapea 'uuid' aquí para
// que los ids sigan siendo únicos (un mock constante rompería los uniques).
export const v4 = (): string => randomUUID();
