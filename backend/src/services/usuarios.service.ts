/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DE GESTION DE USUARIOS STAFF (RBAC ADMIN)
 * ============================================================================
 * Cumple con CLAUDE.md Secciones 7, 8 y 9:
 * 1. Creacion, edicion, activacion y restablecimiento de claves para personal interno.
 * 2. Hasheo bcrypt (coste 12).
 * 3. Regla critica: Un admin no puede desactivarse a si mismo.
 * 4. Regla critica: No se puede desactivar al ultimo administrador activo del sistema.
 * 5. Registro inmutable de auditoria en todas las operaciones.
 */

import bcrypt from 'bcryptjs';
import { consultar } from '../db';
import { AppError } from '../middlewares/errores';
import {
  CrearUsuarioStaffInput,
  ActualizarUsuarioStaffInput,
  RestablecerPasswordStaffInput
} from '../schemas/staff.schema';

const BCRYPT_ROUNDS = 12;

export interface UsuarioStaffItem {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  creadoEn: string;
}

export class UsuariosService {
  /**
   * Lista los usuarios de staff (excluye clientes por defecto)
   */
  async listarStaff(): Promise<UsuarioStaffItem[]> {
    const consulta = `
      SELECT 
        id, 
        nombre, 
        email, 
        rol, 
        activo, 
        creado_en AS "creadoEn"
      FROM usuarios
      WHERE rol != 'cliente'
      ORDER BY rol ASC, nombre ASC;
    `;
    const res = await consultar(consulta);
    return res.rows;
  }

  /**
   * Crea una nueva cuenta de personal interno (vendedor, almacen, logistica o admin)
   */
  async crearStaff(datos: CrearUsuarioStaffInput, adminId: number): Promise<UsuarioStaffItem> {
    const emailNormalizado = datos.email.trim().toLowerCase();

    // 1. Verificar unicidad de correo
    const existe = await consultar('SELECT id FROM usuarios WHERE email = $1', [emailNormalizado]);
    if (existe.rows.length > 0) {
      throw new AppError('El correo electronico ya esta registrado en el sistema', 409);
    }

    // 2. Hashear contrasena con bcrypt (coste 12)
    const hash = await bcrypt.hash(datos.password, BCRYPT_ROUNDS);

    // 3. Insertar usuario
    const res = await consultar(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, nombre, email, rol, activo, creado_en AS "creadoEn"`,
      [datos.nombre.trim(), emailNormalizado, hash, datos.rol]
    );

    const nuevoUsuario: UsuarioStaffItem = res.rows[0];

    // 4. Registro de auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'CREAR_USUARIO', 'usuarios', $2, $3)`,
      [adminId, nuevoUsuario.id, JSON.stringify({ nombre: nuevoUsuario.nombre, email: nuevoUsuario.email, rol: nuevoUsuario.rol })]
    );

    return nuevoUsuario;
  }

  /**
   * Actualiza el rol o estado de activacion de un usuario
   */
  async actualizarStaff(
    id: number,
    datos: ActualizarUsuarioStaffInput,
    adminId: number
  ): Promise<UsuarioStaffItem> {
    // 1. Verificar existencia del usuario
    const resUser = await consultar('SELECT id, nombre, email, rol, activo FROM usuarios WHERE id = $1', [id]);
    if (resUser.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }
    const usuarioActual = resUser.rows[0];

    // Regla critica: Un admin no puede desactivarse a si mismo
    if (id === adminId && datos.activo === false) {
      throw new AppError('Accion denegada: no puede desactivar su propia cuenta de administrador', 400);
    }

    // Regla critica: No se puede desactivar al ultimo administrador activo
    if (usuarioActual.rol === 'admin' && (datos.activo === false || (datos.rol && datos.rol !== 'admin'))) {
      const resAdminsActivos = await consultar(
        "SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'admin' AND activo = TRUE"
      );
      if (resAdminsActivos.rows[0].total <= 1) {
        throw new AppError(
          'Accion denegada: no puede desactivar ni revocar el rol al unico administrador activo del sistema',
          400
        );
      }
    }

    const nuevoNombre = datos.nombre !== undefined ? datos.nombre.trim() : usuarioActual.nombre;
    const nuevoRol = datos.rol !== undefined ? datos.rol : usuarioActual.rol;
    const nuevoActivo = datos.activo !== undefined ? datos.activo : usuarioActual.activo;

    const res = await consultar(
      `UPDATE usuarios SET
        nombre = $1,
        rol = $2,
        activo = $3,
        actualizado_en = NOW()
       WHERE id = $4
       RETURNING id, nombre, email, rol, activo, creado_en AS "creadoEn"`,
      [nuevoNombre, nuevoRol, nuevoActivo, id]
    );

    // Auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'EDITAR_USUARIO', 'usuarios', $2, $3)`,
      [
        adminId,
        id,
        JSON.stringify({
          antes: { nombre: usuarioActual.nombre, rol: usuarioActual.rol, activo: usuarioActual.activo },
          despues: { nombre: nuevoNombre, rol: nuevoRol, activo: nuevoActivo }
        })
      ]
    );

    return res.rows[0];
  }

  /**
   * Restablece la contrasena de un usuario de staff
   */
  async restablecerPassword(id: number, datos: RestablecerPasswordStaffInput, adminId: number): Promise<void> {
    const resUser = await consultar('SELECT id, email, rol FROM usuarios WHERE id = $1', [id]);
    if (resUser.rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const hash = await bcrypt.hash(datos.nueva_password, BCRYPT_ROUNDS);

    await consultar(
      'UPDATE usuarios SET password_hash = $1, actualizado_en = NOW() WHERE id = $2',
      [hash, id]
    );

    // Auditoria
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
       VALUES ($1, 'RESTABLECER_PASSWORD', 'usuarios', $2, $3)`,
      [adminId, id, JSON.stringify({ email: resUser.rows[0].email, rol: resUser.rows[0].rol })]
    );
  }
}

export const usuariosService = new UsuariosService();
