import { Module, forwardRef } from '@nestjs/common';
import { RidersService } from './riders.service.js';
import { RidersController } from './riders.controller.js';
import { BiometricVerificationService } from './biometric-verification.service.js';
import { TenantsModule } from '../tenants/tenants.module.js';

@Module({
  imports: [forwardRef(() => TenantsModule)],
  controllers: [RidersController],
  providers: [RidersService, BiometricVerificationService],
  exports: [RidersService, BiometricVerificationService],
})
export class RidersModule {}
