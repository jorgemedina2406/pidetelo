import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service.js';
import { CouponsController } from './coupons.controller.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  providers: [CouponsService],
  controllers: [CouponsController],
  exports: [CouponsService],
})
export class CouponsModule {}

