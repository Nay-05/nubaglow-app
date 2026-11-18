/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE AUTENTICACION Y SESIONES (RBAC)
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 3 y 9:
 * 1. Registro publico SIEMPRE fuerza rol = 'cliente'.
 * 2. Login separado: /login para clientes y /staff-login para personal interno.
 * 3. Bcrypt con coste >= 12.
 * 4. Mensajes genericos ("Credenciales invalidas") para prevenir enumeracion de emails.
 * 5. Cuentas desactivadas no pueden ingresar.
 * 6. Access Token JWT (15 min) + Refresh Token (7 dias) usando secretos de .env.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { consultar } from '../db';
import { AppError } from '../middlewares/errores';
import { gestorBloqueoCuenta } from '../middlewares/bloqueoCuenta';
import { RolUsuario, UsuarioAutenticado } from '../types';
import { RegistroInput, LoginInput } from '../schemas/auth.schema';

const BCRYPT_ROUNDS = 12;

interface TokenPayload {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

export interface AuthResultado {
  usuario: UsuarioAutenticado;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('Falta JWT_SECRET en las variables de entorno (.env)');
    }
    return secret;
  }

  private getJwtRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('Falta JWT_REFRESH_SECRET en las variables de entorno (.env)');
    }
    return secret;
  }

  /**
   * Genera el par de tokens: Access Token (15m) y Refresh Token (7d)
   */
  public generarTokens(usuario: UsuarioAutenticado): { accessToken: string; refreshToken: string } {
    const payload: TokenPayload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo
    };

    const accessToken = jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '15m'
    });

    const refreshToken = jwt.sign({ id: usuario.id }, this.getJwtRefreshSecret(), {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) || '7d'
    });

    return { accessToken, refreshToken };
  }

  /**
   * Registro publico de clientes.
   * Regla critica: SIEMPRE fuerza rol = 'cliente', ignorando cualquier valor externo.
   */
  async registrarCliente(datos: RegistroInput): Promise<AuthResultado> {
    const emailNormalizado = datos.email.trim().toLowerCase();

    // 1. Verificar si el correo ya existe
    const existe = await consultar('SELECT id FROM usuarios WHERE email = $1', [emailNormalizado]);
    if (existe.rows.length > 0) {
      throw new AppError('El correo electronico ya se encuentra registrado', 409);
    }

    // 2. Hashear contrasena con bcrypt (coste 12)
    const passwordHash = await bcrypt.hash(datos.password, BCRYPT_ROUNDS);

    // 3. Insertar usuario forzando estrictamente rol = 'cliente'
    const res = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ($1, $2, $3, 'cliente', TRUE)
       RETURNING id, nombre, email, rol, activo`,
      [datos.nombre.trim(), emailNormalizado, passwordHash]
    );

    const nuevoUsuario: UsuarioAutenticado = res.rows[0];
    const { accessToken, refreshToken } = this.generarTokens(nuevoUsuario);

    return {
      usuario: nuevoUsuario,
      accessToken,
      refreshToken
    };
  }

  /**
   * Autenticacion unificada con segregacion estricta de portales.
   * - esPortalStaff = false: solo permite rol 'cliente'. Rechaza staff.
   * - esPortalStaff = true: permite roles 'vendedor', 'operaciones', 'admin'. Rechaza 'cliente'.
   */
  async autenticar(datos: LoginInput, esPortalStaff: boolean): Promise<AuthResultado> {
    const emailNormalizado = datos.email.trim().toLowerCase();

    // 0. Verificar si la cuenta esta temporalmente bloqueada por exceso de intentos fallidos
    gestorBloqueoCuenta.verificarBloqueo(emailNormalizado);

    // 1. Buscar usuario por email
    const res = await consultar(
      'SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = $1',
      [emailNormalizado]
    );

    // Mensaje generico anti-enumeracion
    const errorCredenciales = new AppError('Credenciales invalidas. Verifique su correo y contrasena', 401);

    if (res.rows.length === 0) {
      gestorBloqueoCuenta.registrarFallo(emailNormalizado);
      throw errorCredenciales;
    }

    const usuario = res.rows[0];

    // 2. Validar que la cuenta este activa
    if (!usuario.activo) {
      throw new AppError('Su cuenta se encuentra desactivada. Comuniquese con administracion', 403);
    }

    // 3. Verificar contrasena con bcrypt
    const passwordValida = await bcrypt.compare(datos.password, usuario.password_hash);
    if (!passwordValida) {
      gestorBloqueoCuenta.registrarFallo(emailNormalizado);
      throw errorCredenciales;
    }

    // 4. Segregacion estricta de portales
    if (esPortalStaff) {
      if (usuario.rol === 'cliente') {
        throw new AppError('Acceso denegado: esta cuenta de cliente no pertenece al personal interno', 403);
      }
      // Registro obligatorio de auditoria para inicios de sesion del personal (CLAUDE.md Seccion 9)
      await consultar(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, 'LOGIN_STAFF', 'usuarios', $1, $2)`,
        [usuario.id, JSON.stringify({ rol: usuario.rol, email: usuario.email })]
      );
    } else {
      if (usuario.rol !== 'cliente') {
        throw new AppError('Esta cuenta corresponde al personal interno. Inicie sesion desde el portal de staff', 403);
      }
    }

    // Login exitoso: se resetea cualquier conteo de intentos fallidos
    gestorBloqueoCuenta.registrarExito(emailNormalizado);

    const usuarioAutenticado: UsuarioAutenticado = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo
    };

    const { accessToken, refreshToken } = this.generarTokens(usuarioAutenticado);

    return {
      usuario: usuarioAutenticado,
      accessToken,
      refreshToken
    };
  }

  /**
   * Renovacion de sesion mediante Refresh Token
   */
  async refrescarToken(tokenRecibido?: string): Promise<{ accessToken: string; usuario: UsuarioAutenticado }> {
    if (!tokenRecibido) {
      throw new AppError('Token de actualizacion no proporcionado', 401);
    }

    try {
      const decodificado = jwt.verify(tokenRecibido, this.getJwtRefreshSecret()) as { id: number };

      const res = await consultar(
        'SELECT id, nombre, email, rol, activo FROM usuarios WHERE id = $1',
        [decodificado.id]
      );

      if (res.rows.length === 0 || !res.rows[0].activo) {
        throw new AppError('Sesion invalida o usuario desactivado', 401);
      }

      const usuario: UsuarioAutenticado = res.rows[0];
      const { accessToken } = this.generarTokens(usuario);

      return { accessToken, usuario };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError('Token de actualizacion invalido o expirado. Inicie sesion nuevamente', 401);
    }
  }

  /**
   * Obtiene la informacion del perfil de un usuario por su ID
   */
  async obtenerPerfil(usuarioId: number): Promise<UsuarioAutenticado> {
    const res = await consultar(
      'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios WHERE id = $1',
      [usuarioId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    return res.rows[0];
  }
}

export const authService = new AuthService();
