/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE COMPROBANTES DE PAGO (/api/comprobantes)
 * ============================================================================
 * GET /:id exige sesion. El servicio aplica RBAC: cliente dueno, vendedor y
 * admin pueden verlo; almacen y logistica reciben 403.
 */

import { Router } from 'express';
import { descargarComprobante } from '../controllers/comprobantes.controller';
import { verificarToken } from '../middlewares/autenticacion';
import { validar } from '../middlewares/validar';
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

router.get('/:id', verificarToken, validar({ params: idParamSchema }), descargarComprobante);

export default router;
