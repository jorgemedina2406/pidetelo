import { BadRequestException } from '@nestjs/common';

export class InputValidator {
  /**
   * Sanitiza texto eliminando etiquetas HTML peligrosas y caracteres de inyección.
   */
  static sanitize(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/<[^>]*>/g, '') // Elimina tags HTML
      .replace(/javascript:/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  /**
   * Valida correo electrónico con formato estándar.
   */
  static validateEmail(email: string, fieldName = 'correo electrónico'): string {
    const clean = (email || '').toLowerCase().trim();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clean || !regex.test(clean)) {
      throw new BadRequestException(`El ${fieldName} proporcionado no tiene un formato válido.`);
    }
    return clean;
  }

  /**
   * Valida número telefónico móvil.
   */
  static validatePhone(phone: string, fieldName = 'número de teléfono'): string {
    const clean = (phone || '').trim().replace(/[\s\-\(\)]/g, '');
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      throw new BadRequestException(`El ${fieldName} es obligatorio y debe tener entre 8 y 15 dígitos.`);
    }
    return clean;
  }

  /**
   * Valida montos o números positivos.
   */
  static validatePositiveNumber(num: any, fieldName = 'monto'): number {
    const val = Number(num);
    if (isNaN(val) || val < 0) {
      throw new BadRequestException(`El campo '${fieldName}' debe ser un valor numérico mayor o igual a cero.`);
    }
    return val;
  }

  /**
   * Valida documento de identidad / cédula.
   */
  static validateNationalId(id: string): string {
    const clean = this.sanitize(id).toUpperCase();
    if (!clean || clean.length < 5 || clean.length > 20) {
      throw new BadRequestException('El documento de identidad o cédula es obligatorio (mínimo 5 caracteres).');
    }
    return clean;
  }

  /**
   * Valida placa de vehículo.
   */
  static validatePlate(plate: string): string {
    const clean = this.sanitize(plate).toUpperCase().replace(/\s+/g, '');
    if (!clean || clean === 'SIN-PLACA' || clean.length < 3 || clean.length > 15) {
      throw new BadRequestException('La placa del vehículo es obligatoria y debe ser válida (mínimo 3 caracteres).');
    }
    return clean;
  }
}
