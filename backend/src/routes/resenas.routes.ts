/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE RESENAS Y VALORACIONES (/api/resenas)
 * ============================================================================
 */

import { Router } from 'express';
import { crearResena, listarResenasPorProducto } from '../controllers/resenas.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { crearResenaSchema } from '../schemas/compra.schema';

const router = Router();

// Listado publico de resenas por ID de producto
router.get('/producto/:productoId', listarResenasPorProducto);

// Publicar resena verificada (solo clientes autenticados con pedido entregado)
router.post('/', verificarToken, requerirRol('cliente'), validar({ body: crearResenaSchema }), crearResena);

export default router;
