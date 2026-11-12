import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  Param,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { DeviceInfo } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleCodeLoginDto } from './dto/google-code-login.dto';
import { GuestSessionDto } from './dto/guest-session.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractDeviceInfo(req: Request): DeviceInfo {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }

  // Opciones compartidas por set y clear: si difieren en domain o sameSite el
  // navegador trata la cookie como otra distinta y el logout no la borra.
  //
  // COOKIE_DOMAIN ('.clawpuzzle.com') hace que la cookie emitida por
  // api.clawpuzzle.com viaje también al frontend del dominio raíz. Si algún día
  // frontend y API viven en dominios distintos, no basta con quitarlo: hay que
  // poner COOKIE_SAMESITE=none (que exige secure, y por tanto HTTPS).
  private cookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    const sameSite = (process.env.COOKIE_SAMESITE || 'lax') as
      | 'lax'
      | 'strict'
      | 'none';

    return {
      httpOnly: true, // httpOnly cookies prevent XSS attacks
      // sameSite 'none' solo es válido junto a secure, incluso fuera de producción.
      secure: isProduction || sameSite === 'none',
      sameSite, // 'strict' would block OAuth flows
      path: '/',
      ...(process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
    };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    refreshMaxAgeMs = 7 * 24 * 60 * 60 * 1000,
  ) {
    const options = this.cookieOptions();

    res.cookie('accessToken', accessToken, {
      ...options,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      ...options,
      // 7 días para una cuenta; un invitado lleva la suya (GUEST_SESSION_DAYS).
      maxAge: refreshMaxAgeMs,
    });
  }

  private clearAuthCookies(res: Response) {
    const options = this.cookieOptions();

    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Current user retrieved' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getCurrentUser(@CurrentUser() user: JwtPayload) {
    // JWT strategy already validates the token from httpOnly cookie
    // The user object comes from the JWT payload
    return { user };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get active sessions for current user' })
  @ApiResponse({ status: 200, description: 'Active sessions retrieved' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getActiveSessions(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const currentToken = req.cookies?.refreshToken as string | undefined;
    return this.authService.getActiveSessions(user.sub, currentToken);
  }

  @Post('sessions/revoke/:tokenId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('tokenId') tokenId: string,
  ) {
    return this.authService.revokeSession(user.sub, tokenId);
  }

  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({ status: 200, description: 'All other sessions revoked' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async revokeAllOtherSessions(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const currentToken = req.cookies?.refreshToken as string | undefined;
    return this.authService.revokeAllOtherSessions(user.sub, currentToken);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Password login (admin accounts only)' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      loginDto,
      this.extractDeviceInfo(req),
    );

    // Set tokens in httpOnly cookies
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return user data only (no tokens in response body)
    return { user: result.user };
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with a Google ID token' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithGoogle(
      googleLoginDto.idToken,
      this.extractDeviceInfo(req),
      await this.guestIdOf(req),
    );

    // Set tokens in httpOnly cookies
    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.refreshMaxAgeMs,
    );

    // Return user data only (no tokens in response body)
    return { user: result.user, isNewUser: result.isNewUser };
  }

  @Public()
  @Post('google/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login or register with a Google authorization code (popup flow)',
  })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({
    status: 401,
    description: 'Invalid Google authorization code',
  })
  async googleCodeLogin(
    @Body() googleCodeLoginDto: GoogleCodeLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithGoogleCode(
      googleCodeLoginDto.code,
      this.extractDeviceInfo(req),
      await this.guestIdOf(req),
    );

    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.refreshMaxAgeMs,
    );

    return { user: result.user, isNewUser: result.isNewUser };
  }

  // Rate limit por IP propio de esta ruta (el ThrottlerModule no tiene guard
  // global). `trust proxy` (app.setup.ts) hace que `req.ip` sea la del cliente.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a guest session (one free generation, no login)',
  })
  @ApiResponse({ status: 200, description: 'Guest session started' })
  @ApiResponse({ status: 403, description: 'Captcha verification failed' })
  @ApiResponse({ status: 429, description: 'Rate limit or daily cap reached' })
  @ApiResponse({ status: 503, description: 'Guest generation is disabled' })
  async guestSession(
    @Body() dto: GuestSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.startGuestSession(
      dto.turnstileToken,
      this.extractDeviceInfo(req),
      await this.guestIdOf(req),
    );

    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.refreshMaxAgeMs,
    );

    return { user: result.user };
  }

  /** Invitado de este navegador, según su cookie de refresh token. */
  private guestIdOf(req: Request): Promise<string | null> {
    return this.authService.guestIdFromRefreshToken(
      req.cookies?.refreshToken as string | undefined,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token successfully refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Read refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const result = await this.authService.refreshToken(refreshToken);

    // Set new tokens in httpOnly cookies
    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.refreshMaxAgeMs,
    );

    return { message: 'Token refreshed successfully' };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User successfully logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Read refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear auth cookies
    this.clearAuthCookies(res);

    return { message: 'Logged out successfully' };
  }
}
