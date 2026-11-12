import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifica el token del widget de Cloudflare Turnstile que protege la sesión
 * de invitado. Sin `TURNSTILE_SECRET_KEY` no verifica nada (desarrollo y
 * tests); en ese caso solo quedan el rate limit y el tope diario.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    const secret = this.config.get<string>('guest.turnstileSecret');
    if (!secret) return;

    if (!token) {
      throw new ForbiddenException('Captcha required');
    }

    let success = false;
    try {
      const body = new URLSearchParams({ secret, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5_000),
      });
      const json = (await response.json()) as { success?: boolean };
      success = json.success === true;
    } catch (error) {
      // Cloudflare caído: se rechaza. Regalar generaciones sin captcha es peor
      // que mandar a este visitante al flujo con login.
      this.logger.warn(`Turnstile verification failed: ${String(error)}`);
    }

    if (!success) {
      throw new ForbiddenException('Captcha verification failed');
    }
  }
}
