/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE AUTENTICACION Y SESIONES (/api/auth)
 * ============================================================================
 */

import { Router } from 'express';
import {
  registro,
  loginCliente,
  loginStaff,
  refrescarSesion,
  logout,
  obtenerPerfil,
  obtenerSesionActual
} from '../controllers/auth.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, autenticacionOpcional } from '../middlewares/autenticacion';
import { limitadorLogin, limitadorRegistro } from '../middlewares/seguridad';
import { registroSchema, loginSchema, refreshSchema } from '../schemas/auth.schema';

const router = Router();

// Registro publico (soporta /register y /registro)
router.post('/register', limitadorRegistro, validar({ body: registroSchema }), registro);
router.post('/registro', limitadorRegistro, validar({ body: registroSchema }), registro);

// Login de clientes (tienda publica)
router.post('/login', limitadorLogin, validar({ body: loginSchema }), loginCliente);

// Login de personal interno (portal de staff: vendedor, almacen, logistica, admin)
router.post('/staff-login', limitadorLogin, validar({ body: loginSchema }), loginStaff);

// Renovacion de token (Refresh)
router.post('/refresh', validar({ body: refreshSchema }), refrescarSesion);

// Cierre de sesion
router.post('/logout', logout);

// Estado de sesion para el arranque de la SPA (siempre 200, usuario puede ser null)
router.get('/sesion', autenticacionOpcional, obtenerSesionActual);
router.get('/session', autenticacionOpcional, obtenerSesionActual);

// Perfil del usuario autenticado
router.get('/perfil', verificarToken, obtenerPerfil);
router.get('/me', verificarToken, obtenerPerfil);

export default router;
