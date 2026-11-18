import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';

interface AttemptRecord {
  count: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

@Injectable()
export class LoginBruteForceService {
  private readonly MAX_ATTEMPTS = 3;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos de bloqueo
  private readonly attempts = new Map<string, AttemptRecord>();

  private getNormalizedKey(identifier: string, ip?: string): string {
    const cleanId = (identifier || '').toLowerCase().trim();
    const cleanIp = (ip || '').trim();
    return `${cleanId}::${cleanIp}`;
  }

  /**
   * Verifica si la cuenta o IP está actualmente bloqueada.
   * Lanza UnauthorizedException con el tiempo restante si está bloqueada.
   */
  checkLocked(identifier: string, ip?: string): void {
    const key = this.getNormalizedKey(identifier, ip);
    const record = this.attempts.get(key);

    if (record?.lockedUntil) {
      const now = Date.now();
      if (now < record.lockedUntil) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Cuenta bloqueada temporalmente por exceso de intentos fallidos. Por favor espera ${remainingMinutes} minuto(s) para volver a intentar o restablece tu contraseña.`,
            error: 'AccountLocked',
            remainingMinutes,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        // El tiempo de bloqueo ya expiró, reiniciar registro
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Registra un intento fallido y devuelve el mensaje de advertencia con los intentos restantes.
   */
  recordFailedAttempt(identifier: string, ip?: string): string {
    const key = this.getNormalizedKey(identifier, ip);
    const now = Date.now();
    const record = this.attempts.get(key) || { count: 0, lastAttemptAt: now, lockedUntil: null };

    record.count += 1;
    record.lastAttemptAt = now;

    if (record.count >= this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_DURATION_MS;
      this.attempts.set(key, record);
      const remainingMinutes = Math.ceil(this.LOCKOUT_DURATION_MS / 60000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Has superado el límite de 3 intentos fallidos consecutivos. Tu cuenta ha sido bloqueada temporalmente por ${remainingMinutes} minutos por motivos de seguridad.`,
          error: 'AccountLocked',
          remainingMinutes,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.attempts.set(key, record);
    const remainingAttempts = this.MAX_ATTEMPTS - record.count;
    const attemptWord = remainingAttempts === 1 ? 'intento' : 'intentos';
    return `Credenciales incorrectas. Te queda solo ${remainingAttempts} ${attemptWord} antes del bloqueo temporal de tu cuenta por seguridad.`;
  }

  /**
   * Registra un inicio de sesión exitoso y reinicia los contadores.
   */
  recordSuccessfulLogin(identifier: string, ip?: string): void {
    const key = this.getNormalizedKey(identifier, ip);
    this.attempts.delete(key);
  }
}
