/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE INVENTARIO Y DESPACHOS (/api/inventario)
 * ============================================================================
 */

import { Router } from 'express';
import {
  listarInventario,
  ajustarStock,
  obtenerKardex,
  colaDespachos
} from '../controllers/inventario.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { ajusteInventarioSchema } from '../schemas/staff.schema';

const router = Router();

// Proteccion de rol: exclusivo para operaciones y admin
router.use(verificarToken, requerirRol('operaciones', 'admin'));

router.get('/', listarInventario);
router.post('/ajustes/:varianteId', validar({ body: ajusteInventarioSchema }), ajustarStock);
router.get('/kardex/:varianteId', obtenerKardex);
router.get('/despachos', colaDespachos);

export default router;
