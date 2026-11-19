/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE PEDIDOS Y CHECKOUT (/api/pedidos)
 * ============================================================================
 */

import { Router } from 'express';
import {
  cotizarPedido,
  crearPedido,
  listarMisPedidos,
  obtenerDetallePedido
} from '../controllers/pedidos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { crearPedidoSchema, cotizarPedidoSchema } from '../schemas/compra.schema';
import { idParamSchema } from '../schemas/comun.schema';

const router = Router();

// Cotizacion server-side (solo clientes autenticados)
router.post(
  '/cotizar',
  verificarToken,
  requerirRol('cliente'),
  validar({ body: cotizarPedidoSchema }),
  cotizarPedido
);

// Crear pedido (solo clientes autenticados)
router.post('/', verificarToken, requerirRol('cliente'), validar({ body: crearPedidoSchema }), crearPedido);

// Listar mis pedidos
router.get('/', verificarToken, listarMisPedidos);
router.get('/mis-pedidos', verificarToken, listarMisPedidos);

// Obtener detalle de pedido por ID (validando param id)
router.get('/:id', verificarToken, validar({ params: idParamSchema }), obtenerDetallePedido);

export default router;
