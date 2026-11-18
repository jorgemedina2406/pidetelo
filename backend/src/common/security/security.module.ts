import { Module, Global } from '@nestjs/common';
import { LoginBruteForceService } from './login-brute-force.service.js';
import { RateLimiterMiddleware } from './rate-limiter.middleware.js';

@Global()
@Module({
  providers: [LoginBruteForceService, RateLimiterMiddleware],
  exports: [LoginBruteForceService, RateLimiterMiddleware],
})
export class SecurityModule {}
