import { PUBLIC_STYLE_IMAGE_SELECT, PUBLIC_STYLE_SELECT } from './style-select';

describe('public style projection', () => {
  it('exposes landing fields without pipeline or storage internals', () => {
    expect(PUBLIC_STYLE_SELECT).toEqual(
      expect.objectContaining({
        id: true,
        displayName: true,
        difficulty: true,
      }),
    );
    expect(PUBLIC_STYLE_SELECT).not.toHaveProperty('promptTemplate');
    expect(PUBLIC_STYLE_SELECT).not.toHaveProperty('templateVars');
    expect(PUBLIC_STYLE_SELECT).not.toHaveProperty('strategyKey');
    expect(PUBLIC_STYLE_SELECT).not.toHaveProperty('visionConfigId');
    expect(PUBLIC_STYLE_SELECT).not.toHaveProperty('imageGenConfigId');
    expect(PUBLIC_STYLE_SELECT).not.toHaveProperty('styleReferenceStorageKey');
    expect(PUBLIC_STYLE_SELECT).not.toHaveProperty('styleReferenceUrl');

    expect(PUBLIC_STYLE_IMAGE_SELECT).toEqual(
      expect.objectContaining({
        id: true,
        imageUrl: true,
        altImage: true,
        orderIndex: true,
        isPrimary: true,
      }),
    );
    expect(PUBLIC_STYLE_IMAGE_SELECT).not.toHaveProperty('storageKey');
  });
});
