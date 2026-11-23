import { Module, Global } from '@nestjs/common';
import { LoginBruteForceService } from './login-brute-force.service.js';
import { RateLimiterMiddleware } from './rate-limiter.middleware.js';
import { AntiBotService } from './anti-bot.service.js';

@Global()
@Module({
  providers: [LoginBruteForceService, RateLimiterMiddleware, AntiBotService],
  exports: [LoginBruteForceService, RateLimiterMiddleware, AntiBotService],
})
export class SecurityModule {}
