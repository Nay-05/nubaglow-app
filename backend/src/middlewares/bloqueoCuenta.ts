/**
 * ============================================================================
 * NUBAGLOW APP - GESTOR DE BLOQUEO TEMPORAL POR CUENTA (ANTI-FUERZA BRUTA)
 * ============================================================================
 * Cumple con CLAUDE.md Seccion 9 y estandares OWASP:
 * 1. Limita intentos fallidos consecutivos por cuenta (email).
 * 2. Bloqueo temporal por 15 minutos tras 5 intentos fallidos.
 * 3. Reseteo inmediato tras un inicio de sesion exitoso.
 * 4. Independiente del rate limiting por direccion IP.
 */

import { AppError } from './errores';

interface RegistroFallo {
  intentos: number;
  bloqueadoHasta?: number;
}

export class GestorBloqueoCuenta {
  private intentosPorEmail = new Map<string, RegistroFallo>();
  private readonly MAX_INTENTOS = 5;
  private readonly TIEMPO_BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

  /**
   * Verifica si la cuenta asociada al email se encuentra bloqueada
   */
  public verificarBloqueo(email: string): void {
    const normalizado = email.trim().toLowerCase();
    const registro = this.intentosPorEmail.get(normalizado);

    if (!registro || !registro.bloqueadoHasta) {
      return;
    }

    const ahora = Date.now();
    if (ahora < registro.bloqueadoHasta) {
      const segundosRestantes = Math.ceil((registro.bloqueadoHasta - ahora) / 1000);
      const minutosRestantes = Math.ceil(segundosRestantes / 60);

      throw new AppError(
        `Cuenta temporalmente bloqueada por multiples intentos fallidos de inicio de sesion. Intente de nuevo en ${minutosRestantes} minuto(s)`,
        429,
        { segundosRestantes, minutosRestantes }
      );
    } else {
      // El tiempo de bloqueo ya expiro: limpiamos el registro
      this.intentosPorEmail.delete(normalizado);
    }
  }

  /**
   * Registra un fallo de autenticacion para la cuenta
   */
  public registrarFallo(email: string): void {
    const normalizado = email.trim().toLowerCase();
    const registro = this.intentosPorEmail.get(normalizado) || { intentos: 0 };

    registro.intentos += 1;

    if (registro.intentos >= this.MAX_INTENTOS) {
      registro.bloqueadoHasta = Date.now() + this.TIEMPO_BLOQUEO_MS;
    }

    this.intentosPorEmail.set(normalizado, registro);
  }

  /**
   * Restablece el contador de intentos fallidos tras un login exitoso
   */
  public registrarExito(email: string): void {
    const normalizado = email.trim().toLowerCase();
    this.intentosPorEmail.delete(normalizado);
  }

  /**
   * Metodo utilitario para reiniciar estado en pruebas automatizadas
   */
  public reiniciarParaPruebas(email?: string): void {
    if (email) {
      this.intentosPorEmail.delete(email.trim().toLowerCase());
    } else {
      this.intentosPorEmail.clear();
    }
  }
}

export const gestorBloqueoCuenta = new GestorBloqueoCuenta();
