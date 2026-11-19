/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS STAFF DE PEDIDOS (/api/staff/pedidos)
 * ============================================================================
 * Cancelacion administrativa con reposicion atomica de stock.
 */

import { Router } from 'express';
import { cancelarPedidoAdmin } from '../controllers/pedidos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { cancelarPedidoSchema } from '../schemas/staff.schema';
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

router.use(verificarToken, requerirRol('admin'));

router.post(
  '/:id/cancelar',
  validar({ params: idParamSchema, body: cancelarPedidoSchema }),
  cancelarPedidoAdmin
);

export default router;
