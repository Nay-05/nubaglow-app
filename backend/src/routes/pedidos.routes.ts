/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE PEDIDOS Y CHECKOUT (/api/pedidos)
 * ============================================================================
 */

import { Router } from 'express';
import {
  crearPedido,
  listarMisPedidos,
  obtenerDetallePedido
} from '../controllers/pedidos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { crearPedidoSchema } from '../schemas/compra.schema';
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

// Crear pedido (solo clientes autenticados)
router.post('/', verificarToken, requerirRol('cliente'), validar({ body: crearPedidoSchema }), crearPedido);

// Listar mis pedidos
router.get('/', verificarToken, listarMisPedidos);
router.get('/mis-pedidos', verificarToken, listarMisPedidos);

// Obtener detalle de pedido por ID (validando param id)
router.get('/:id', verificarToken, validar({ params: idParamSchema }), obtenerDetallePedido);

export default router;
