/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE SALUD Y VERIFICACION BASE
 * ============================================================================
 */

import { Router } from 'express';
import { obtenerSalud, verificarAutenticacionPrueba } from '../controllers/salud.controller';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';

const router = Router();

// 1. Diagnostico de salud publico (requerido por CLAUDE.md y la especificacion de entrega)
router.get('/salud', obtenerSalud);

// 2. Ruta protegida de prueba para validar que verificarToken funciona
router.get('/salud/protegida', verificarToken, verificarAutenticacionPrueba);

// 3. Ruta protegida con RBAC para validar requerirRol('admin')
router.get('/salud/solo-admin', verificarToken, requerirRol('admin'), verificarAutenticacionPrueba);

// 4. Ruta protegida con RBAC para roles de personal interno
router.get(
  '/salud/solo-staff',
  verificarToken,
  requerirRol('vendedor', 'operaciones', 'admin'),
  verificarAutenticacionPrueba
);

export default router;
