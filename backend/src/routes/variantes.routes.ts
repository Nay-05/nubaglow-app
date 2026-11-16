/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE VARIANTES DIRECTAS (/api/variantes)
 * ============================================================================
 */

import { Router } from 'express';
import { actualizarVariante, eliminarVariante } from '../controllers/variantes.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { actualizarVarianteSchema } from '../schemas/catalogo.schema';

const router = Router();

// Edicion y eliminacion de variantes por ID (solo admin)
router.put('/:id', verificarToken, requerirRol('admin'), validar({ body: actualizarVarianteSchema }), actualizarVariante);
router.delete('/:id', verificarToken, requerirRol('admin'), eliminarVariante);

export default router;
