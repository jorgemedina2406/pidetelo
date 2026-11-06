import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(
    @Query('code') code?: string,
    @Query('token_hash') tokenHash?: string,
    @Query('type') type?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Res() res?: Response,
  ) {
    // Si la solicitud contiene parámetros de autenticación/recuperación de contraseña de Supabase
    if (code || tokenHash || type === 'recovery' || error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const params = new URLSearchParams();
      if (code) params.append('code', code);
      if (tokenHash) params.append('token_hash', tokenHash);
      if (type) params.append('type', type);
      if (error) params.append('error', error);
      if (errorDescription) params.append('error_description', errorDescription);

      return res?.redirect(`${frontendUrl}/reset-password?${params.toString()}`);
    }

    return res?.send(this.appService.getHello());
  }
}
