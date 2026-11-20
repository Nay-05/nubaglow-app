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
  obtenerDetallePedido,
  obtenerDetallePedidoPorCodigo,
  registrarComprobantePago
} from '../controllers/pedidos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import {
  crearPedidoSchema,
  cotizarPedidoSchema,
  subirComprobantePagoSchema
} from '../schemas/compra.schema';
import { idParamSchema, codigoRastreoParamSchema } from '../schemas/comun.schema';

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

// Subir comprobante de pago QR simple / deposito bancario (solo el cliente dueño)
router.post(
  '/:id/comprobante',
  verificarToken,
  requerirRol('cliente'),
  validar({ params: idParamSchema, body: subirComprobantePagoSchema }),
  registrarComprobantePago
);

// Listar mis pedidos
router.get('/', verificarToken, listarMisPedidos);
router.get('/mis-pedidos', verificarToken, listarMisPedidos);

// Detalle de un pedido propio por codigo de rastreo (debe ir antes de /:id)
router.get(
  '/codigo/:codigo',
  verificarToken,
  requerirRol('cliente'),
  validar({ params: codigoRastreoParamSchema }),
  obtenerDetallePedidoPorCodigo
);

// Obtener detalle de pedido por ID (validando param id)
router.get('/:id', verificarToken, validar({ params: idParamSchema }), obtenerDetallePedido);

export default router;
