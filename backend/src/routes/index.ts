/**
 * ============================================================================
 * NUBAGLOW APP - ENRUTADOR PRINCIPAL DE LA API REST (/api)
 * ============================================================================
 * Centraliza y monta todos los modulos bajo la convencion REST en espanol.
 */

import { Router } from 'express';
import saludRoutes from './salud.routes';
import authRoutes from './auth.routes';
import categoriasRoutes from './categorias.routes';
import productosRoutes from './productos.routes';
import variantesRoutes from './variantes.routes';

const apiRouter = Router();

// Modulo de salud y diagnostico
apiRouter.use('/', saludRoutes);

// Modulo de autenticacion y sesiones RBAC
apiRouter.use('/auth', authRoutes);

// Modulo de catalogo: categorias, productos y variantes
apiRouter.use('/categorias', categoriasRoutes);
apiRouter.use('/productos', productosRoutes);
apiRouter.use('/variantes', variantesRoutes);

export default apiRouter;
