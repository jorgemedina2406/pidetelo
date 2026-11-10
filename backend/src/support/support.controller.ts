import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { SupportService } from './support.service.js';

@Controller('api/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  async getTickets(@Query('tenantId') tenantId?: string) {
    return this.supportService.getTickets(tenantId);
  }

  @Get('tickets/:id')
  async getTicket(@Param('id') id: string) {
    return this.supportService.getTicket(id);
  }

  @Post('tickets')
  async createTicket(
    @Body() payload: {
      tenant_id: string;
      tenant_name: string;
      branch_name?: string;
      subject: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      initial_message: string;
      sender_name: string;
    },
  ) {
    return this.supportService.createTicket(payload);
  }

  @Get('tickets/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.supportService.getMessages(id);
  }

  @Post('tickets/:id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() payload: {
      sender_type: 'merchant' | 'superadmin';
      sender_name: string;
      message: string;
    },
  ) {
    return this.supportService.addMessage(id, payload);
  }

  @Put('tickets/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'open' | 'in_progress' | 'resolved' | 'closed',
  ) {
    return this.supportService.updateTicketStatus(id, status);
  }
}
