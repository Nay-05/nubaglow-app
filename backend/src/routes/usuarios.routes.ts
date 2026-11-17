/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE GESTION DE USUARIOS STAFF (/api/usuarios)
 * ============================================================================
 */

import { Router } from 'express';
import {
  listarStaff,
  crearStaff,
  actualizarStaff,
  restablecerPassword
} from '../controllers/usuarios.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import {
  crearUsuarioStaffSchema,
  actualizarUsuarioStaffSchema,
  restablecerPasswordStaffSchema
} from '../schemas/staff.schema';

const router = Router();

// Proteccion de rol: exclusivo para admin
router.use(verificarToken, requerirRol('admin'));

router.get('/', listarStaff);
router.post('/', validar({ body: crearUsuarioStaffSchema }), crearStaff);
router.put('/:id', validar({ body: actualizarUsuarioStaffSchema }), actualizarStaff);
router.patch('/:id/password', validar({ body: restablecerPasswordStaffSchema }), restablecerPassword);

export default router;
