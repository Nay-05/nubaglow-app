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
import {
  listarImagenesProducto,
  crearImagenProducto,
  actualizarImagenProducto,
  eliminarImagenProducto
} from '../controllers/imagenes.controller';
import { validar } from '../middlewares/validar';
import {
  verificarToken,
  requerirRol,
  autenticacionOpcional
} from '../middlewares/autenticacion';
import {
  consultaProductosSchema,
  crearProductoSchema,
  actualizarProductoSchema,
  crearVarianteSchema,
  crearImagenProductoSchema,
  actualizarImagenProductoSchema
} from '../schemas/catalogo.schema';
import {
  idParamSchema,
  slugParamSchema,
  productoIdParamSchema,
  imagenProductoParamSchema
} from '../schemas/comun.schema';

const router = Router();

// Rutas publicas de catalogo. La autenticacion opcional permite que un admin
// consulte productos inactivos desde el portal interno.
router.get(
  '/',
  autenticacionOpcional,
  validar({ query: consultaProductosSchema }),
  listarProductos
);
router.get(
  '/:slug',
  autenticacionOpcional,
  validar({ params: slugParamSchema }),
  obtenerProductoPorSlug
);

// Rutas administrativas (solo admin)
router.post(
  '/',
  verificarToken,
  requerirRol('admin'),
  validar({ body: crearProductoSchema }),
  crearProducto
);
router.put(
  '/:id',
  verificarToken,
  requerirRol('admin'),
  validar({ params: idParamSchema, body: actualizarProductoSchema }),
  actualizarProducto
);
router.delete(
  '/:id',
  verificarToken,
  requerirRol('admin'),
  validar({ params: idParamSchema }),
  eliminarProducto
);

// Variantes anidadas al producto
router.get(
  '/:productoId/variantes',
  validar({ params: productoIdParamSchema }),
  listarVariantesPorProducto
);
router.post(
  '/:productoId/variantes',
  verificarToken,
  requerirRol('admin'),
  validar({ params: productoIdParamSchema, body: crearVarianteSchema }),
  crearVariante
);

// Imagenes del producto
router.get(
  '/:productoId/imagenes',
  validar({ params: productoIdParamSchema }),
  listarImagenesProducto
);
router.post(
  '/:productoId/imagenes',
  verificarToken,
  requerirRol('admin'),
  validar({
    params: productoIdParamSchema,
    body: crearImagenProductoSchema
  }),
  crearImagenProducto
);
router.put(
  '/:productoId/imagenes/:imagenId',
  verificarToken,
  requerirRol('admin'),
  validar({
    params: imagenProductoParamSchema,
    body: actualizarImagenProductoSchema
  }),
  actualizarImagenProducto
);
router.delete(
  '/:productoId/imagenes/:imagenId',
  verificarToken,
  requerirRol('admin'),
  validar({ params: imagenProductoParamSchema }),
  eliminarImagenProducto
);

export default router;
