import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller.js';
import { BranchesService } from './branches.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [SupabaseModule, UsersModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
