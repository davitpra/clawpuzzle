import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ShopifyHmacGuard } from './shopify-hmac.guard';

const SECRET = 'shpss_test_secret';

const sign = (body: Buffer, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(body).digest('base64');

function contextFor(req: {
  headers: Record<string, string>;
  body: unknown;
}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

// Es la puerta de todas las órdenes: un fallo aquí deja pasar webhooks
// falsificados o rechaza los legítimos (y Shopify acaba desactivándolos).
describe('ShopifyHmacGuard', () => {
  const body = Buffer.from(JSON.stringify({ id: 1234, email: 'a@b.com' }));
  let guard: ShopifyHmacGuard;

  beforeEach(() => {
    guard = new ShopifyHmacGuard({ get: () => SECRET } as never);
  });

  it('deja pasar una firma válida sobre el body crudo', () => {
    const ctx = contextFor({
      headers: { 'x-shopify-hmac-sha256': sign(body) },
      body,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza un body alterado', () => {
    const ctx = contextFor({
      headers: { 'x-shopify-hmac-sha256': sign(body) },
      body: Buffer.from(JSON.stringify({ id: 1234, email: 'x@evil.com' })),
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza una firma hecha con otro secreto', () => {
    const ctx = contextFor({
      headers: { 'x-shopify-hmac-sha256': sign(body, 'otro') },
      body,
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza una petición sin cabecera', () => {
    const ctx = contextFor({ headers: {}, body });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  // Es lo que pasa si alguien mueve `express.raw` detrás del parser JSON en
  // main.ts: el body llega ya parseado y no hay bytes que firmar.
  it('rechaza un body ya parseado aunque la firma sea correcta', () => {
    const ctx = contextFor({
      headers: { 'x-shopify-hmac-sha256': sign(body) },
      body: JSON.parse(body.toString()),
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza una firma de otra longitud sin romper timingSafeEqual', () => {
    const ctx = contextFor({
      headers: { 'x-shopify-hmac-sha256': 'c2hvcnQ=' },
      body,
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza todo si SHOPIFY_WEBHOOK_SECRET no está configurado', () => {
    guard = new ShopifyHmacGuard({ get: () => undefined } as never);
    const ctx = contextFor({
      headers: { 'x-shopify-hmac-sha256': sign(body) },
      body,
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
