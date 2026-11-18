import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BranchesModule } from '../branches/branches.module.js';

@Module({
  imports: [NotificationsModule, BranchesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
