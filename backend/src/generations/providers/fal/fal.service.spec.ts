import { fal } from '@fal-ai/client';
import { FalService } from './fal.service';
import { resolveImageSize } from '../../pipeline/pipeline.types';

jest.mock('@fal-ai/client', () => ({
  fal: { config: jest.fn(), subscribe: jest.fn() },
}));

const falMock = jest.mocked(fal);

// La forma de la imagen es lo que decide si un formato sirve para imprimir:
// flux/dev ignora `aspect_ratio`, así que sin `image_size` un A3 vertical
// saldría apaisado con el tamaño por defecto del modelo.
describe('FalService', () => {
  let service: FalService;

  beforeEach(() => {
    jest.clearAllMocks();
    falMock.subscribe.mockResolvedValue({
      requestId: 'req-1',
      data: { images: [{ url: 'https://fal.test/out.png' }] },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
      headers: { get: () => 'image/png' },
    }) as unknown as typeof fetch;
    service = new FalService({ get: jest.fn() } as never);
  });

  function sentInput(): Record<string, unknown> {
    const calls = falMock.subscribe.mock.calls as Array<
      [string, { input: Record<string, unknown> }]
    >;
    return calls[0][1].input;
  }

  it('sends the image size as image_size', async () => {
    await service.generate({
      model: 'fal-ai/flux/dev',
      prompt: 'a dog',
      aspectRatio: '5:7',
      imageSize: { width: 848, height: 1200 },
    });

    expect(sentInput().image_size).toEqual({ width: 848, height: 1200 });
  });

  it('lets the ImageGenConfig parameters override image_size', async () => {
    await service.generate({
      model: 'fal-ai/flux/dev',
      prompt: 'a dog',
      imageSize: { width: 848, height: 1200 },
      params: { image_size: 'square_hd' },
    });

    expect(sentInput().image_size).toBe('square_hd');
  });

  it('omits image_size when none is given', async () => {
    await service.generate({ model: 'fal-ai/flux/dev', prompt: 'a dog' });

    expect(sentInput()).not.toHaveProperty('image_size');
  });
});

describe('resolveImageSize', () => {
  const format = { width: 848, height: 1200 } as never;

  it('takes the size from the format', () => {
    expect(resolveImageSize({ format, constraints: {} })).toEqual({
      width: 848,
      height: 1200,
    });
  });

  it('yields to an aspect ratio forced by the constraints', () => {
    expect(
      resolveImageSize({ format, constraints: { aspectRatio: '1:1' } }),
    ).toBeUndefined();
  });

  it('returns nothing without a format', () => {
    expect(resolveImageSize({ format: null, constraints: {} })).toBeUndefined();
  });
});
