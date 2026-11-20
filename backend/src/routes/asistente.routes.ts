/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DEL ASISTENTE IA (/api/asistente)
 * ============================================================================
 */

import { Router } from 'express';
import { consultarAsistente } from '../controllers/asistente.controller';
import { autenticacionOpcional } from '../middlewares/autenticacion';
import { limitadorAsistente } from '../middlewares/seguridad';
import { validar } from '../middlewares/validar';
import { consultaAsistenteSchema } from '../schemas/asistente.schema';

const router = Router();

router.post(
  '/',
  autenticacionOpcional,
  limitadorAsistente,
  validar({ body: consultaAsistenteSchema }),
  consultarAsistente
);

export default router;
