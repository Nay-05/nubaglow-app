/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE CARRITO PERSISTENTE (/api/carrito)
 * ============================================================================
 */

import { Router } from 'express';
import {
  obtenerCarrito,
  agregarItem,
  actualizarCantidad,
  eliminarItem,
  vaciarCarrito
} from '../controllers/carrito.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { agregarCarritoItemSchema, actualizarCarritoItemSchema } from '../schemas/compra.schema';

const router = Router();

// Todas las rutas del carrito exigen autenticacion de cliente
router.use(verificarToken, requerirRol('cliente'));

router.get('/', obtenerCarrito);
router.post('/items', validar({ body: agregarCarritoItemSchema }), agregarItem);
router.patch('/items/:itemId', validar({ body: actualizarCarritoItemSchema }), actualizarCantidad);
router.delete('/items/:itemId', eliminarItem);
router.delete('/', vaciarCarrito);

export default router;
