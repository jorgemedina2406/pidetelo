import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications & Firebase Push')
@Controller(['api/notifications', 'notifications'])
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones en bandeja' })
  async getNotifications(
    @Query('condition') condition?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.notificationsService.findAll(condition || 'all', tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva notificación' })
  async createNotification(@Body() payload: any) {
    return this.notificationsService.create(payload);
  }

  @Post('register-token')
  @ApiOperation({ summary: 'Registrar token de dispositivo FCM para notificaciones push en segundo plano' })
  async registerPushToken(
    @Body() payload: { userId: string; role?: string; token: string; platform?: string },
  ) {
    return this.notificationsService.registerPushToken(payload);
  }

  @Post('test-push')
  @ApiOperation({ summary: 'Probar envío de notificación push' })
  async testPush(
    @Body() payload: { token?: string; userId?: string; title?: string; body?: string },
  ) {
    const tokens = payload.token ? [payload.token] : (payload.userId ? this.notificationsService.getTokensForUser(payload.userId) : []);
    return this.notificationsService.sendPushNotification({
      tokens,
      title: payload.title || '🧪 Prueba Push Pídetelo',
      body: payload.body || '¡Las notificaciones push funcionan exitosamente con la app cerrada!'
    });
  }
}
