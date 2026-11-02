import { Module } from '@nestjs/common';
import { BannersService } from './banners.service.js';
import { BannersController } from './banners.controller.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}

