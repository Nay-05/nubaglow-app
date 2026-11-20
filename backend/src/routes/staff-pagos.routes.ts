/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS STAFF DE VERIFICACION DE PAGOS (/api/staff/pagos)
 * ============================================================================
 * Vendedor y admin consultan la cola, revisan el comprobante y aprueban/rechazan.
 */

import { Router } from 'express';
import {
  listarPagosEnVerificacion,
  obtenerPago,
  aprobarPago,
  rechazarPago,
  cancelarPagosVencidos
} from '../controllers/pagos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import {
  consultaPagosSchema,
  rechazarPagoSchema
} from '../schemas/staff.schema';
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

router.use(verificarToken, requerirRol('vendedor', 'admin'));

router.get(
  '/',
  validar({ query: consultaPagosSchema }),
  listarPagosEnVerificacion
);
router.post('/vencidos/cancelar', requerirRol('admin'), cancelarPagosVencidos);
router.get('/:id', validar({ params: idParamSchema }), obtenerPago);
router.patch('/:id/aprobar', validar({ params: idParamSchema }), aprobarPago);
router.patch(
  '/:id/rechazar',
  validar({ params: idParamSchema, body: rechazarPagoSchema }),
  rechazarPago
);

export default router;
