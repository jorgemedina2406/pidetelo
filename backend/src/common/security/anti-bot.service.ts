import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export interface RegistrationChallengeResponse {
  challengeToken: string;
  prompt: string;
  minDelayMs: number;
  expiresInSeconds: number;
}

export interface VerifyRegistrationParams {
  clientIp: string;
  email: string;
  password: string;
  name?: string;
  phone?: string;
  challengeToken?: string;
  challengeAnswer?: string;
  website?: string;
  honeypot?: string;
}

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'sharklasers.com',
  'grr.la',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'maildrop.cc',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'fakeinbox.com',
  'mohmal.com',
  'burnermail.io',
  'emailondeck.com',
  'mintemail.com',
  'mytemp.email',
  'inboxbear.com',
  'mailnesia.com',
  'spamgourmet.com',
  'getairmail.com',
  'crazymailing.com',
  'tmpmail.org',
  'tmpmail.net',
  'anonbox.net',
  'dropmail.me',
  'harakirimail.com',
  'mailcatch.com',
  'wegwerfmail.de',
  'example.com',
  'test.com',
]);

@Injectable()
export class AntiBotService {
  private readonly secret: string;
  private readonly CHALLENGE_TTL_MS = 5 * 60 * 1000;
  private readonly MIN_HUMAN_DELAY_MS = 1800;
  private readonly RATE_WINDOW_MS = 60 * 60 * 1000;
  private readonly MAX_SUCCESS_PER_IP_HOUR = 3;
  private readonly MAX_FAILED_PER_IP_HOUR = 10;

  private usedNonces = new Map<string, number>();
  private successByIp = new Map<string, number[]>();
  private failedByIp = new Map<string, number[]>();

  constructor() {
    this.secret =
      process.env.ANTI_BOT_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      randomBytes(32).toString('hex');
  }

  issueChallenge(): RegistrationChallengeResponse {
    const now = Date.now();
    this.cleanup(now);

    const nonce = randomBytes(12).toString('hex');
    const issuedAt = now;
    const expiresAt = now + this.CHALLENGE_TTL_MS;

    const a = 2 + randomInt(11);
    const b = 1 + randomInt(9);
    let op = '+';
    let answer = String(a + b);
    if (a > b && randomInt(2) === 1) {
      op = '-';
      answer = String(a - b);
    }

    const sig = createHmac('sha256', this.secret)
      .update(`${nonce}|${issuedAt}|${expiresAt}|${answer}`)
      .digest('hex');

    const challengeToken = Buffer.from(
      JSON.stringify({ nonce, issuedAt, expiresAt, sig }),
      'utf8',
    ).toString('base64url');

    return {
      challengeToken,
      prompt: `${a} ${op} ${b} = ?`,
      minDelayMs: this.MIN_HUMAN_DELAY_MS,
      expiresInSeconds: Math.floor(this.CHALLENGE_TTL_MS / 1000),
    };
  }

  verifyRegistrationSubmission(params: VerifyRegistrationParams): void {
    const now = Date.now();
    this.cleanup(now);

    const ip = this.normalizeIp(params.clientIp);

    // 1. Límite estricto por IP en ventana de 1 hora
    const recentSuccesses = this.pruneWindow(this.successByIp, ip, now);
    if (recentSuccesses.length >= this.MAX_SUCCESS_PER_IP_HOUR) {
      throw new HttpException(
        'Has alcanzado el límite de registros permitidos desde esta red (máximo 3 por hora). Intenta más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const recentFailures = this.pruneWindow(this.failedByIp, ip, now);
    if (recentFailures.length >= this.MAX_FAILED_PER_IP_HOUR) {
      throw new HttpException(
        'Demasiados intentos fallidos de registro desde esta red. Intenta nuevamente en una hora.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Honeypot
    if (String(params.website || params.honeypot || '').trim().length > 0) {
      this.recordFailure(ip, now);
      throw new BadRequestException('Solicitud de registro rechazada por verificación de seguridad.');
    }

    // 3. Validación de correo y bloqueo de dominios temporales/desechables
    const cleanEmail = String(params.email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(cleanEmail)) {
      this.recordFailure(ip, now);
      throw new BadRequestException('Ingresa un correo electrónico válido.');
    }

    const emailDomain = cleanEmail.split('@')[1] || '';
    if (this.isDisposableDomain(emailDomain)) {
      this.recordFailure(ip, now);
      throw new BadRequestException(
        'No se permiten correos temporales o desechables. Usa un correo personal válido.',
      );
    }

    // 4. Validación de contraseña fuerte, nombre y teléfono
    const password = String(params.password || '');
    const specialRegex = /[-!@#$%^&*(),.?":{}|<>_+=~`[\]\\/]/;
    if (password.length < 8 || !/[A-Z]/.test(password) || !specialRegex.test(password)) {
      this.recordFailure(ip, now);
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres, una letra mayúscula y un carácter especial (*, ., @, #, etc.).',
      );
    }

    const cleanName = String(params.name || '').trim();
    if (cleanName && /(https?:\/\/|www\.)/i.test(cleanName)) {
      this.recordFailure(ip, now);
      throw new BadRequestException('El nombre ingresado no es válido.');
    }

    const cleanPhone = String(params.phone || '').trim();
    if (cleanPhone.length > 0) {
      if (!/^[0-9+\-\s()]+$/.test(cleanPhone)) {
        this.recordFailure(ip, now);
        throw new BadRequestException('El número de teléfono contiene caracteres no permitidos.');
      }
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 16) {
        this.recordFailure(ip, now);
        throw new BadRequestException('Ingresa un número de teléfono válido.');
      }
    }

    // 5. Validación del reto humano firmado HMAC-SHA256
    const rawToken = String(params.challengeToken || '').trim();
    const rawAnswer = String(params.challengeAnswer || '').trim();
    if (!rawToken || !rawAnswer) {
      this.recordFailure(ip, now);
      throw new BadRequestException('Completa la verificación humana antes de registrarte.');
    }

    let parsed: { nonce?: string; issuedAt?: number; expiresAt?: number; sig?: string } | null = null;
    try {
      const jsonStr = Buffer.from(rawToken, 'base64url').toString('utf8');
      parsed = JSON.parse(jsonStr);
    } catch (_) {
      this.recordFailure(ip, now);
      throw new BadRequestException('El código de verificación humana no es válido. Solicita uno nuevo.');
    }

    const nonce = String(parsed?.nonce || '').trim();
    const issuedAt = Number(parsed?.issuedAt || 0);
    const expiresAt = Number(parsed?.expiresAt || 0);
    const sig = String(parsed?.sig || '').trim();

    if (!nonce || !issuedAt || !expiresAt || !sig || expiresAt <= issuedAt) {
      this.recordFailure(ip, now);
      throw new BadRequestException('El código de verificación humana no es válido. Solicita uno nuevo.');
    }

    if (now > expiresAt) {
      this.recordFailure(ip, now);
      throw new BadRequestException(
        'El código de verificación humana expiró. Solicita uno nuevo e intenta de nuevo.',
      );
    }

    if (now - issuedAt < this.MIN_HUMAN_DELAY_MS) {
      this.recordFailure(ip, now);
      throw new BadRequestException(
        'Verificación enviada demasiado rápido. Completa el formulario e intenta de nuevo.',
      );
    }

    if (this.usedNonces.has(nonce)) {
      this.recordFailure(ip, now);
      throw new BadRequestException('Esta verificación ya fue utilizada. Solicita una nueva.');
    }

    const expectedSig = createHmac('sha256', this.secret)
      .update(`${nonce}|${issuedAt}|${expiresAt}|${rawAnswer}`)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (
      sigBuf.length === 0 ||
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      this.recordFailure(ip, now);
      throw new BadRequestException('Respuesta de verificación humana incorrecta. Intenta de nuevo.');
    }

    // Consumo único (anti-replay)
    this.usedNonces.set(nonce, expiresAt);
  }

  recordSuccessfulRegistration(clientIp: string): void {
    const now = Date.now();
    const ip = this.normalizeIp(clientIp);
    const list = this.pruneWindow(this.successByIp, ip, now);
    list.push(now);
    this.successByIp.set(ip, list);
  }

  private normalizeIp(clientIp: string): string {
    const raw = String(clientIp || 'unknown').split(',')[0].trim();
    return raw || 'unknown';
  }

  private isDisposableDomain(domain: string): boolean {
    const clean = domain.trim().toLowerCase();
    if (!clean) return true;
    if (DISPOSABLE_EMAIL_DOMAINS.has(clean)) return true;
    for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
      if (clean.endsWith(`.${blocked}`)) {
        return true;
      }
    }
    return false;
  }

  private pruneWindow(map: Map<string, number[]>, key: string, now: number): number[] {
    const existing = map.get(key) || [];
    const valid = existing.filter(ts => now - ts < this.RATE_WINDOW_MS);
    if (valid.length > 0) {
      map.set(key, valid);
    } else {
      map.delete(key);
    }
    return valid;
  }

  private recordFailure(ip: string, now: number): void {
    const list = this.pruneWindow(this.failedByIp, ip, now);
    list.push(now);
    this.failedByIp.set(ip, list);
  }

  private cleanup(now: number): void {
    for (const [nonce, exp] of this.usedNonces.entries()) {
      if (exp < now) {
        this.usedNonces.delete(nonce);
      }
    }
    for (const key of this.successByIp.keys()) {
      this.pruneWindow(this.successByIp, key, now);
    }
    for (const key of this.failedByIp.keys()) {
      this.pruneWindow(this.failedByIp, key, now);
    }
  }
}
