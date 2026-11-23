/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DEL TOTEM DE AUTOSERVICIO (/api/totem)
 * ============================================================================
 * Endpoints publicos del totem fisico (sin sesion de cliente). El cobro y el
 * descuento de stock se validan integramente en el servidor.
 */

import { Router } from 'express';
import {
  obtenerCatalogoTotem,
  registrarVentaTotem
} from '../controllers/totem.controller';
import { validar } from '../middlewares/validar';
import { limitadorTotem } from '../middlewares/seguridad';
import { crearVentaTotemSchema } from '../schemas/totem.schema';

const router = Router();

router.get('/catalogo', obtenerCatalogoTotem);

router.post(
  '/venta',
  limitadorTotem,
  validar({ body: crearVentaTotemSchema }),
  registrarVentaTotem
);

export default router;
