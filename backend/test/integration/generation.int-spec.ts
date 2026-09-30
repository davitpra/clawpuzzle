import request from 'supertest';

import {
  type TestApp,
  createTestApp,
  resetState,
  seedCatalog,
  seedPetWithPhoto,
  seedUser,
  userSession,
  waitFor,
} from './harness';

// POST /api/generations → transacción con el cobro → cola BullMQ → processor
// real con la estrategia mock (MOCK_AI=true) → completed. La Fase 1 lo cubrió
// con la DB mockeada; aquí el rollback y el ledger son los de Postgres.
describe('Generación con MOCK_AI (integración)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetState(t);
  });

  async function setup(credits: number) {
    const catalog = await seedCatalog(t.prisma);
    const user = await seedUser(t.prisma, { credits });
    const { pet, photo } = await seedPetWithPhoto(t.prisma, user.id);
    const cookies = await userSession(user);
    const body = {
      petId: pet.id,
      petPhotoId: photo.id,
      formatId: catalog.format.id,
      productRefId: catalog.product.id,
      styleId: catalog.style.id,
    };
    return { user, photo, cookies, body };
  }

  it('descuenta 1 crédito, procesa en la cola y termina en completed', async () => {
    const { user, photo, cookies, body } = await setup(1);

    const res = await request(t.app.getHttpServer())
      .post('/api/generations')
      .set('Cookie', cookies)
      .send(body)
      .expect(201);
    const generationId = (res.body as { data: { id: string } }).data.id;

    const done = await waitFor(async () => {
      const g = await t.prisma.generation.findUniqueOrThrow({
        where: { id: generationId },
      });
      return g.status === 'completed' || g.status === 'failed' ? g : null;
    });
    expect(done.status).toBe('completed');
    // La estrategia mock devuelve la foto de entrada como resultado.
    expect(done.resultUrl).toBe(photo.photoUrl);

    const after = await t.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.generationCredits).toBe(0);
    const ledger = await t.prisma.creditTransaction.findMany({
      where: { userId: user.id },
    });
    expect(ledger).toEqual([
      expect.objectContaining({
        reason: 'generation_spend',
        amount: -1,
        referenceId: generationId,
      }),
    ]);
  });

  it('sin saldo → 402 y la fila de la generación se revierte', async () => {
    const { user, cookies, body } = await setup(0);

    await request(t.app.getHttpServer())
      .post('/api/generations')
      .set('Cookie', cookies)
      .send(body)
      .expect(402);

    expect(await t.prisma.generation.count()).toBe(0);
    expect(
      await t.prisma.creditTransaction.count({ where: { userId: user.id } }),
    ).toBe(0);
    const after = await t.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.generationCredits).toBe(0);
  });
});
