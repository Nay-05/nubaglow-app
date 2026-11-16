/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE ENVIOS Y RASTREO (/api/envios)
 * ============================================================================
 */

import { Router } from 'express';
import { rastreoPublico, cambiarEstadoEnvio } from '../controllers/envios.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { cambiarEstadoEnvioSchema } from '../schemas/compra.schema';

const router = Router();

// Consulta publica de rastreo por codigo unico (ej: NB-2026-0101)
router.get('/rastreo/:codigo', rastreoPublico);

// Cambio de estado de envio paso a paso (restringido a operaciones y admin)
router.patch(
  '/:id/estado',
  verificarToken,
  requerirRol('operaciones', 'admin'),
  validar({ body: cambiarEstadoEnvioSchema }),
  cambiarEstadoEnvio
);

export default router;
