/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE VENTAS POS (/api/pos)
 * ============================================================================
 */

import { Router } from 'express';
import {
  registrarVentaPos,
  historialVentas,
  cierreCaja
} from '../controllers/pos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { crearVentaPosSchema } from '../schemas/staff.schema';

const router = Router();

// Proteccion de rol: exclusivo para vendedor y admin
router.use(verificarToken, requerirRol('vendedor', 'admin'));

router.post('/', validar({ body: crearVentaPosSchema }), registrarVentaPos);
router.get('/historial', historialVentas);
router.get('/cierre-caja', cierreCaja);

export default router;
