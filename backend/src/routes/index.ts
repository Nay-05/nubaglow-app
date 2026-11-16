/**
 * ============================================================================
 * NUBAGLOW APP - ENRUTADOR PRINCIPAL DE LA API REST (/api)
 * ============================================================================
 * Centraliza y monta todos los modulos bajo la convencion REST en espanol.
 */

import { Router } from 'express';
import saludRoutes from './salud.routes';

const apiRouter = Router();

// Modulo de salud y diagnostico
apiRouter.use('/', saludRoutes);

export default apiRouter;
