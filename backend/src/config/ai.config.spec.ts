import {
  DEFAULT_GENERATION_CONCURRENCY,
  parseGenerationConcurrency,
} from './ai.config';

describe('parseGenerationConcurrency', () => {
  it('usa el valor configurado', () => {
    expect(parseGenerationConcurrency('1')).toBe(1);
    expect(parseGenerationConcurrency('5')).toBe(5);
  });

  it('sin valor o con uno inválido usa el valor por defecto', () => {
    for (const value of [undefined, '', 'abc', '0', '-2']) {
      expect(parseGenerationConcurrency(value)).toBe(
        DEFAULT_GENERATION_CONCURRENCY,
      );
    }
  });

  it('nunca pasa de 10', () => {
    expect(parseGenerationConcurrency('50')).toBe(10);
  });
});
