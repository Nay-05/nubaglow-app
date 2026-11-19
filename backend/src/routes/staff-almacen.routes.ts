/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS STAFF DE ALMACEN (/api/staff/almacen)
 * ============================================================================
 * Envoltorios finos sobre controladores existentes. La logica permanece en
 * inventarioService y enviosService.
 */

import { Router } from 'express';
import {
  listarInventario,
  ajustarStock,
  obtenerKardex,
  colaDespachosPreparacion
} from '../controllers/inventario.controller';
import { cambiarEstadoEnvio } from '../controllers/envios.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { ajusteInventarioSchema } from '../schemas/staff.schema';
import { cambiarEstadoEnvioSchema } from '../schemas/compra.schema';
import { idParamSchema, varianteIdParamSchema } from '../schemas/comun.schema';

const router = Router();

router.use(verificarToken, requerirRol('almacen', 'admin'));

router.get('/inventario', listarInventario);
router.post(
  '/inventario/ajustes/:varianteId',
  validar({ params: varianteIdParamSchema, body: ajusteInventarioSchema }),
  ajustarStock
);
router.get('/inventario/kardex/:varianteId', validar({ params: varianteIdParamSchema }), obtenerKardex);
router.get('/despachos', colaDespachosPreparacion);
router.patch(
  '/envios/:id/estado',
  validar({ params: idParamSchema, body: cambiarEstadoEnvioSchema }),
  cambiarEstadoEnvio
);

export default router;
