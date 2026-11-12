const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    role?: 'user' | 'premium' | 'admin' | 'guest';
  };
  /** Solo en el login con Google: `true` si la cuenta se acaba de crear. */
  isNewUser?: boolean;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function login(data: LoginDto): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies in request
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new AuthError(
        response.status,
        json.message || 'Error al iniciar sesión'
      );
    }

    // Backend now returns user only, tokens are in httpOnly cookies
    return {
      user: json.data?.user,
      accessToken: '', // Not used anymore
      refreshToken: '', // Not used anymore
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error en login:', error);
    throw new AuthError(500, 'Error de conexión al servidor');
  }
}

// `/auth/google` recibe el ID token del botón oficial de Google; `/auth/google/code`
// el code del popup auth-code (botón propio "Sign up"). La respuesta es la misma.
async function postGoogleAuth(
  path: '/auth/google' | '/auth/google/code',
  body: { idToken: string } | { code: string },
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies in request
      body: JSON.stringify(body),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new AuthError(
        response.status,
        json.message || 'Error al iniciar sesión con Google'
      );
    }

    // Backend returns user only, tokens are in httpOnly cookies
    return {
      user: json.data?.user,
      isNewUser: json.data?.isNewUser === true,
      accessToken: '', // Not used anymore
      refreshToken: '', // Not used anymore
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error en login con Google:', error);
    throw new AuthError(500, 'Error de conexión al servidor');
  }
}

/**
 * Sesión de invitado: la imagen gratis sin login. Falla (503 apagado, 429 tope
 * o rate limit, 403 captcha) cuando el backend no la concede; el llamador cae
 * entonces al paso de cuenta.
 */
export async function createGuestSession(
  turnstileToken?: string,
): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(turnstileToken ? { turnstileToken } : {}),
    });
  } catch {
    throw new AuthError(500, 'Error de conexión al servidor');
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthError(
      response.status,
      json.message || 'No se pudo iniciar la sesión de invitado',
    );
  }

  return {
    user: json.data?.user,
    accessToken: '',
    refreshToken: '',
  };
}

export function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  return postGoogleAuth('/auth/google', { idToken });
}

export function loginWithGoogleCode(code: string): Promise<AuthResponse> {
  return postGoogleAuth('/auth/google/code', { code });
}

export async function refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Send cookies with request
    });

    const json = await response.json();

    if (!response.ok) {
      throw new AuthError(
        response.status,
        json.message || 'Error al refrescar token'
      );
    }

    // Tokens are now in httpOnly cookies, return empty strings
    return {
      accessToken: '',
      refreshToken: '',
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error al refrescar token:', error);
    throw new AuthError(500, 'Error de conexión al servidor');
  }
}

export async function logout(): Promise<{ message: string }> {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Send cookies with request
    });

    const json = await response.json();

    if (!response.ok) {
      throw new AuthError(
        response.status,
        json.message || 'Error al cerrar sesión'
      );
    }

    return json;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error al cerrar sesión:', error);
    throw new AuthError(500, 'Error de conexión al servidor');
  }
}

