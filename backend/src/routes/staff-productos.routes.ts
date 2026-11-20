/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE ADMINISTRACION DE PRODUCTOS (/api/staff/productos)
 * ============================================================================
 * Envoltorio exclusivo para admin. La subida de archivos se recibe como
 * binario crudo y se valida por magic bytes en el servicio de imagenes.
 */

import express, { Router } from 'express';
import { subirImagenProducto } from '../controllers/imagenes.controller';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { validar } from '../middlewares/validar';
import { idParamSchema } from '../schemas/comun.schema';
import { subirImagenProductoQuerySchema } from '../schemas/catalogo.schema';

const router = Router();

router.use(verificarToken, requerirRol('admin'));

router.post(
  '/:id/imagen',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '3mb'
  }),
  validar({
    params: idParamSchema,
    query: subirImagenProductoQuerySchema
  }),
  subirImagenProducto
);

export default router;
