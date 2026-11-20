/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE VENTAS POS (/api/pos)
 * ============================================================================
 */

import { Router } from 'express';
import {
  registrarVentaPos,
  historialVentas,
  cierreCaja,
  descargarComprobantePosPdf
} from '../controllers/pos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import {
  consultaFechaPosSchema,
  crearVentaPosSchema
} from '../schemas/staff.schema';
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

// Proteccion de rol: exclusivo para vendedor y admin
router.use(verificarToken, requerirRol('vendedor', 'admin'));

router.post('/', validar({ body: crearVentaPosSchema }), registrarVentaPos);
router.get(
  '/historial',
  validar({ query: consultaFechaPosSchema }),
  historialVentas
);
router.get(
  '/cierre-caja',
  validar({ query: consultaFechaPosSchema }),
  cierreCaja
);
router.get(
  '/ventas/:id/comprobante-pdf',
  validar({ params: idParamSchema }),
  descargarComprobantePosPdf
);

export default router;
