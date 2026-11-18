import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  // Buckets en memoria por IP y por Usuario
  private ipBuckets = new Map<string, RateLimitBucket>();
  private userBuckets = new Map<string, RateLimitBucket>();
  private authIpBuckets = new Map<string, RateLimitBucket>();

  // Límites estándar
  private readonly GLOBAL_IP_LIMIT = 150; // peticiones por minuto por IP
  private readonly USER_LIMIT = 200;      // peticiones por minuto por usuario autenticado
  private readonly AUTH_LIMIT = 15;       // intentos por minuto en rutas críticas de login/registro
  private readonly WINDOW_MS = 60 * 1000;

  use(req: Request, res: Response, next: NextFunction) {
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = rawIp.split(',')[0].trim();
    const authHeader = req.headers['authorization'] || '';
    const userId = req.headers['x-user-id'] as string || (authHeader.length > 20 ? authHeader.slice(-16) : null);
    const path = req.originalUrl || req.url || '';
    const isAuthRoute = path.includes('/login') || path.includes('/auth/') || path.includes('/register');

    const now = Date.now();

    // 1. Rate limiting especial para endpoints de autenticación y login
    if (isAuthRoute) {
      const authBucket = this.getBucket(this.authIpBuckets, clientIp, this.AUTH_LIMIT, now);
      if (authBucket.tokens <= 0) {
        res.setHeader('Retry-After', '60');
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Demasiadas solicitudes de autenticación desde esta dirección IP. Por favor espera 1 minuto.',
          error: 'TooManyRequests',
        });
        return;
      }
      authBucket.tokens -= 1;
    }

    // 2. Rate limiting por usuario autenticado (si aplica)
    if (userId) {
      const userBucket = this.getBucket(this.userBuckets, userId, this.USER_LIMIT, now);
      if (userBucket.tokens <= 0) {
        res.setHeader('Retry-After', '60');
        res.setHeader('X-RateLimit-Limit', this.USER_LIMIT.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Límite de solicitudes por usuario excedido. Por favor reduce la frecuencia de peticiones.',
          error: 'UserRateLimitExceeded',
        });
        return;
      }
      userBucket.tokens -= 1;
      res.setHeader('X-RateLimit-Limit', this.USER_LIMIT.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, Math.floor(userBucket.tokens)).toString());
    }

    // 3. Rate limiting general por dirección IP
    const ipBucket = this.getBucket(this.ipBuckets, clientIp, this.GLOBAL_IP_LIMIT, now);
    if (ipBucket.tokens <= 0) {
      res.setHeader('Retry-After', '60');
      res.setHeader('X-RateLimit-Limit', this.GLOBAL_IP_LIMIT.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Demasiadas peticiones al servidor desde esta dirección IP. Por favor espera un momento.',
        error: 'IpRateLimitExceeded',
      });
      return;
    }
    ipBucket.tokens -= 1;
    res.setHeader('X-RateLimit-Limit', this.GLOBAL_IP_LIMIT.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, Math.floor(ipBucket.tokens)).toString());

    // Limpieza periódica de buckets inactivos para evitar fugas de memoria
    if (this.ipBuckets.size > 10000) {
      this.cleanupExpired(now);
    }

    next();
  }

  private getBucket(map: Map<string, RateLimitBucket>, key: string, maxTokens: number, now: number): RateLimitBucket {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      map.set(key, bucket);
      return bucket;
    }

    // Rellenar tokens proporcionalmente al tiempo transcurrido
    const elapsed = now - bucket.lastRefill;
    if (elapsed > this.WINDOW_MS) {
      bucket.tokens = maxTokens;
      bucket.lastRefill = now;
    } else {
      const refill = (elapsed / this.WINDOW_MS) * maxTokens;
      bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
      bucket.lastRefill = now;
    }

    return bucket;
  }

  private cleanupExpired(now: number): void {
    for (const [key, b] of this.ipBuckets.entries()) {
      if (now - b.lastRefill > this.WINDOW_MS * 2) {
        this.ipBuckets.delete(key);
      }
    }
    for (const [key, b] of this.userBuckets.entries()) {
      if (now - b.lastRefill > this.WINDOW_MS * 2) {
        this.userBuckets.delete(key);
      }
    }
    for (const [key, b] of this.authIpBuckets.entries()) {
      if (now - b.lastRefill > this.WINDOW_MS * 2) {
        this.authIpBuckets.delete(key);
      }
    }
  }
}
