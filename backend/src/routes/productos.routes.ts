/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE PRODUCTOS (/api/productos)
 * ============================================================================
 */

import { Router } from 'express';
import {
  listarProductos,
  obtenerProductoPorSlug,
  crearProducto,
  actualizarProducto,
  eliminarProducto
} from '../controllers/productos.controller';
import {
  listarVariantesPorProducto,
  crearVariante
} from '../controllers/variantes.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import {
  consultaProductosSchema,
  crearProductoSchema,
  actualizarProductoSchema,
  crearVarianteSchema
} from '../schemas/catalogo.schema';

const router = Router();

// Rutas publicas de catalogo
router.get('/', validar({ query: consultaProductosSchema }), listarProductos);
router.get('/:slug', obtenerProductoPorSlug);

// Rutas administrativas (solo admin)
router.post('/', verificarToken, requerirRol('admin'), validar({ body: crearProductoSchema }), crearProducto);
router.put('/:id', verificarToken, requerirRol('admin'), validar({ body: actualizarProductoSchema }), actualizarProducto);
router.delete('/:id', verificarToken, requerirRol('admin'), eliminarProducto);

// Variantes anidadas al producto
router.get('/:productoId/variantes', listarVariantesPorProducto);
router.post(
  '/:productoId/variantes',
  verificarToken,
  requerirRol('admin'),
  validar({ body: crearVarianteSchema }),
  crearVariante
);

export default router;
