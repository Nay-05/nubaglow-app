/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS STAFF DE LOGISTICA (/api/staff/logistica)
 * ============================================================================
 * Envoltorios finos sobre inventarioService y enviosService.
 */

import { Router } from 'express';
import { colaDespachosLogistica } from '../controllers/inventario.controller';
import { cambiarEstadoEnvio, cerrarEntrega } from '../controllers/envios.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { cambiarEstadoEnvioSchema, cerrarEntregaSchema } from '../schemas/compra.schema';
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

router.use(verificarToken, requerirRol('logistica', 'admin'));

router.get('/despachos', colaDespachosLogistica);
router.patch(
  '/envios/:id/estado',
  validar({ params: idParamSchema, body: cambiarEstadoEnvioSchema }),
  cambiarEstadoEnvio
);
router.post(
  '/envios/:id/entrega',
  validar({ params: idParamSchema, body: cerrarEntregaSchema }),
  cerrarEntrega
);

export default router;
