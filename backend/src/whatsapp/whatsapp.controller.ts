import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service.js';

@Controller('api/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  // ==========================================
  // INSTANCIAS & CONEXIÓN
  // ==========================================

  @Get('instance/:tenantId')
  async getInstance(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.whatsappService.getInstance(tenantId, branchId);
  }

  @Post('instance/:tenantId/connect')
  async connectInstance(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.whatsappService.connectInstance(tenantId, branchId);
  }

  @Post('instance/:tenantId/disconnect')
  async disconnectInstance(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.whatsappService.disconnectInstance(tenantId, branchId);
  }

  @Put('instance/:tenantId/settings')
  async updateSettings(
    @Param('tenantId') tenantId: string,
    @Body() settings: { greeting_message?: string; auto_reply_enabled?: boolean; pause_duration_minutes?: number },
    @Query('branchId') branchId?: string,
  ) {
    return this.whatsappService.updateSettings(tenantId, settings, branchId);
  }

  // ==========================================
  // WEBHOOK (Evolution API)
  // ==========================================

  @Post('webhook')
  async handleWebhook(@Body() payload: any) {
    return this.whatsappService.handleWebhook(payload);
  }

  // ==========================================
  // BANDEJA DE MENSAJERÍA EN VIVO (LIVE CHAT)
  // ==========================================

  @Get('conversations/:tenantId')
  async getConversations(@Param('tenantId') tenantId: string) {
    return this.whatsappService.getConversations(tenantId);
  }

  @Get('conversations/:conversationId/messages')
  async getMessages(@Param('conversationId') conversationId: string) {
    return this.whatsappService.getMessages(conversationId);
  }

  @Post('conversations/:conversationId/send')
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body('text') text: string,
  ) {
    return this.whatsappService.sendAgentMessage(conversationId, text);
  }

  @Post('conversations/:conversationId/toggle-mode')
  async toggleMode(
    @Param('conversationId') conversationId: string,
    @Body('mode') mode: 'bot' | 'human',
    @Body('minutes') minutes?: number,
  ) {
    return this.whatsappService.toggleConversationMode(conversationId, mode, minutes);
  }
}

