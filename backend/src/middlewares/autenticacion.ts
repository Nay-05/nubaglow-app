/**
 * ============================================================================
 * NUBAGLOW APP - MIDDLEWARES DE AUTENTICACION Y CONTROL DE ACCESO (RBAC)
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 3 y 9:
 * "El rol siempre se consulta o verifica desde la base de datos/token firmado;
 *  nunca se acepta el rol enviado por el cliente."
 * "Access Token JWT en cookie httpOnly con respaldo en header Authorization: Bearer."
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RolUsuario, UsuarioAutenticado } from '../types';

interface JwtPayloadUsuario {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Extrae el token de acceso desde cookies HttpOnly o header Authorization Bearer.
 */
function extraerToken(req: Request): string | null {
  // 1. Prioridad: Cookie segura HttpOnly (navegador cliente)
  if (req.cookies && (req.cookies.access_token || req.cookies.token)) {
    return req.cookies.access_token || req.cookies.token;
  }

  // 2. Respaldo: Header Authorization Bearer (pruebas Postman o clientes API)
  const cabeceraAuth = req.headers.authorization;
  if (cabeceraAuth && cabeceraAuth.startsWith('Bearer ')) {
    return cabeceraAuth.split(' ')[1].trim();
  }

  return null;
}

/**
 * Middleware: Verifica que la peticion contenga un token JWT valido y no expirado.
 * Inyecta al usuario autenticado en `req.usuario`.
 */
export function verificarToken(req: Request, res: Response, next: NextFunction): void {
  const token = extraerToken(req);

  if (!token) {
    res.status(401).json({
      exito: false,
      error: 'No autenticado. Token de acceso ausente o no proporcionado'
    });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('ERROR CRITICO: JWT_SECRET no esta definido en las variables de entorno.');
    res.status(500).json({
      exito: false,
      error: 'Error interno en la configuracion de seguridad'
    });
    return;
  }

  try {
    const decodificado = jwt.verify(token, jwtSecret) as JwtPayloadUsuario;

    // Verificar que la cuenta este activa
    if (decodificado.activo === false) {
      res.status(403).json({
        exito: false,
        error: 'Cuenta desactivada. Contacte a la administracion de Nuba Beauty'
      });
      return;
    }

    req.usuario = {
      id: decodificado.id,
      nombre: decodificado.nombre,
      email: decodificado.email,
      rol: decodificado.rol,
      activo: decodificado.activo
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        exito: false,
        error: 'La sesion ha expirado. Por favor inicie sesion nuevamente'
      });
      return;
    }

    res.status(401).json({
      exito: false,
      error: 'Token de acceso invalido o adulterado'
    });
  }
}

/**
 * Middleware: Autenticacion opcional. Si hay token valido inyecta req.usuario,
 * si no hay token continua la ejecucion sin bloquear al cliente anonimo.
 */
export function autenticacionOpcional(req: Request, _res: Response, next: NextFunction): void {
  const token = extraerToken(req);
  if (!token) {
    return next();
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next();
  }

  try {
    const decodificado = jwt.verify(token, jwtSecret) as JwtPayloadUsuario;
    if (decodificado.activo !== false) {
      req.usuario = {
        id: decodificado.id,
        nombre: decodificado.nombre,
        email: decodificado.email,
        rol: decodificado.rol,
        activo: decodificado.activo
      };
    }
  } catch {
    // Si falla la firma se ignora silenciosamente y se continua como anonimo
  }

  next();
}

/**
 * Middleware RBAC: Valida que el rol del usuario autenticado este dentro de la lista permitida.
 * 
 * Regla de CLAUDE.md:
 * El rol proviene EXCLUSIVAMENTE del token firmado criptograficamente en el backend,
 * NUNCA de parametros enviados por el cliente.
 * 
 * @param rolesPermitidos Lista de roles con autorizacion (ej: 'admin', 'operaciones')
 */
export function requerirRol(...rolesPermitidos: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Debe haber pasado previamente por verificarToken
    if (!req.usuario) {
      res.status(401).json({
        exito: false,
        error: 'No autenticado. Se requiere iniciar sesion para acceder a este recurso'
      });
      return;
    }

    // 2. Validar pertenencia del rol
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({
        exito: false,
        error: `Acceso denegado: permisos insuficientes para el rol '${req.usuario.rol}'. Roles autorizados: ${rolesPermitidos.join(', ')}`
      });
      return;
    }

    next();
  };
}
