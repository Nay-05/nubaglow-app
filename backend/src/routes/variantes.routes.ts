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
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

// Edicion y eliminacion de variantes por ID (solo admin)
router.put('/:id', verificarToken, requerirRol('admin'), validar({ params: idParamSchema, body: actualizarVarianteSchema }), actualizarVariante);
router.delete('/:id', verificarToken, requerirRol('admin'), validar({ params: idParamSchema }), eliminarVariante);

export default router;
