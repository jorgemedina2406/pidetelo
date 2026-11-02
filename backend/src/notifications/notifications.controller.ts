import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

@Controller(['api/notifications', 'notifications'])
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Query('condition') condition?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.notificationsService.findAll(condition || 'all', tenantId);
  }

  @Post()
  async createNotification(@Body() payload: any) {
    return this.notificationsService.create(payload);
  }
}

