import { Module } from '@nestjs/common';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}

