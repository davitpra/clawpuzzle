import request from 'supertest';

import {
  type TestApp,
  cookieValue,
  cookiesFrom,
  createTestApp,
  loginAdmin,
  resetState,
  seedUser,
  userSession,
} from './harness';

// Auth por cookie httpOnly: guard global, roles y rotación del refresh token.
describe('Auth (integración)', () => {
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

  const http = () => request(t.app.getHttpServer());

  it('sin cookie → 401', async () => {
    await http().get('/api/auth/me').expect(401);
    await http().get('/api/generations').expect(401);
  });

  it('un cliente no entra a /admin/*; un admin sí', async () => {
    const user = await seedUser(t.prisma);
    const admin = await seedUser(t.prisma, { role: 'admin' });

    await http()
      .get('/api/admin/orders')
      .set('Cookie', await userSession(user))
      .expect(403);

    const adminCookies = await loginAdmin(t.app, admin.email);
    await http()
      .get('/api/admin/orders')
      .set('Cookie', adminCookies)
      .expect(200);
  });

  it('el password no sirve para cuentas de cliente (solo Google)', async () => {
    const user = await seedUser(t.prisma);
    await http()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'test-password-123' })
      .expect(401);
  });

  it('refresh rota la sesión y el refresh viejo deja de valer', async () => {
    const admin = await seedUser(t.prisma, { role: 'admin' });
    const cookies = await loginAdmin(t.app, admin.email);
    const oldRefresh = cookieValue(cookies, 'refreshToken');
    expect(oldRefresh).toBeTruthy();

    const res = await http()
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${oldRefresh}`])
      .expect(200);
    const rotated = cookiesFrom(res);
    const newAccess = cookieValue(rotated, 'accessToken');
    const newRefresh = cookieValue(rotated, 'refreshToken');
    expect(newAccess).toBeTruthy();
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    await http()
      .get('/api/auth/me')
      .set('Cookie', [`accessToken=${newAccess}`])
      .expect(200);

    // Reutilizar el refresh ya rotado es señal de robo: 401.
    await http()
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${oldRefresh}`])
      .expect(401);
  });
});
