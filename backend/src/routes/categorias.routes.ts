/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE CATEGORIAS (/api/categorias)
 * ============================================================================
 */

import { Router } from 'express';
import {
  listarCategorias,
  obtenerCategoriaPorSlug,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
} from '../controllers/categorias.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { crearCategoriaSchema, actualizarCategoriaSchema } from '../schemas/catalogo.schema';

const router = Router();

// Rutas publicas de catalogo
router.get('/', listarCategorias);
router.get('/:slug', obtenerCategoriaPorSlug);

// Rutas protegidas administrativas (solo rol admin)
router.post('/', verificarToken, requerirRol('admin'), validar({ body: crearCategoriaSchema }), crearCategoria);
router.put('/:id', verificarToken, requerirRol('admin'), validar({ body: actualizarCategoriaSchema }), actualizarCategoria);
router.delete('/:id', verificarToken, requerirRol('admin'), eliminarCategoria);

export default router;
