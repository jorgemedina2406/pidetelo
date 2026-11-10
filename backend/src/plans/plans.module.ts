import { Module, Global } from '@nestjs/common';
import { PlansService } from './plans.service.js';
import { PlansController } from './plans.controller.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Global()
@Module({
  imports: [SupabaseModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
