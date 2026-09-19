// Google OAuth configuration

import { registerAs } from '@nestjs/config';

export default registerAs('google', () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  // Solo para el flujo auth-code (botón propio del navbar); el ID-token no lo usa.
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
}));
