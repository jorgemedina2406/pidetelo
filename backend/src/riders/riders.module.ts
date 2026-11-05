import { Module } from '@nestjs/common';
import { RidersService } from './riders.service.js';
import { RidersController } from './riders.controller.js';
import { BiometricVerificationService } from './biometric-verification.service.js';

@Module({
  controllers: [RidersController],
  providers: [RidersService, BiometricVerificationService],
  exports: [RidersService, BiometricVerificationService],
})
export class RidersModule {}
