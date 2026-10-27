import { cropRect, parsePrintCrop } from './print-crop.util';

describe('cropRect', () => {
  it('covers the format at zoom 1, centered by default', () => {
    expect(cropRect(3584, 4800, 2 / 3)).toEqual({
      left: 192,
      top: 0,
      width: 3200,
      height: 4800,
    });
  });

  it('clamps the centre so the rect stays inside the image', () => {
    expect(cropRect(3584, 4800, 2 / 3, { x: 0, y: 0.5, zoom: 1 }).left).toBe(0);
    expect(cropRect(3584, 4800, 2 / 3, { x: 1, y: 0.5, zoom: 1 }).left).toBe(
      384,
    );
  });

  it('shrinks the rect when zooming in', () => {
    const rect = cropRect(3584, 4800, 2 / 3, { x: 0.5, y: 0.5, zoom: 2 });
    expect(rect.width).toBe(1600);
    expect(rect.height).toBe(2400);
  });
});

describe('parsePrintCrop', () => {
  it('rejects malformed values', () => {
    expect(parsePrintCrop(null)).toBeNull();
    expect(parsePrintCrop({ x: '0.5', y: 0.5, zoom: 1 })).toBeNull();
    expect(parsePrintCrop({ x: 0.2, y: 0.5, zoom: 1.5 })).toEqual({
      x: 0.2,
      y: 0.5,
      zoom: 1.5,
    });
  });
});
