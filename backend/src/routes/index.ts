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
import carritoRoutes from './carrito.routes';
import pedidosRoutes from './pedidos.routes';
import pagosRoutes from './pagos.routes';
import comprobantesRoutes from './comprobantes.routes';
import enviosRoutes from './envios.routes';
import resenasRoutes from './resenas.routes';
import posRoutes from './pos.routes';
import inventarioRoutes from './inventario.routes';
import reportesRoutes from './reportes.routes';
import usuariosRoutes from './usuarios.routes';
import configRoutes from './config.routes';
import staffAlmacenRoutes from './staff-almacen.routes';
import staffLogisticaRoutes from './staff-logistica.routes';
import staffPagosRoutes from './staff-pagos.routes';
import staffPedidosRoutes from './staff-pedidos.routes';

const apiRouter = Router();

// Modulo de salud y diagnostico
apiRouter.use('/', saludRoutes);

// Modulo de autenticacion y sesiones RBAC
apiRouter.use('/auth', authRoutes);

// Modulo de catalogo: categorias, productos y variantes
apiRouter.use('/categorias', categoriasRoutes);
apiRouter.use('/productos', productosRoutes);
apiRouter.use('/variantes', variantesRoutes);

// Modulo de compra: carrito, pedidos, envios y resenas
apiRouter.use('/carrito', carritoRoutes);
apiRouter.use('/pedidos', pedidosRoutes);
apiRouter.use('/pagos', pagosRoutes);
apiRouter.use('/comprobantes', comprobantesRoutes);
apiRouter.use('/envios', enviosRoutes);
apiRouter.use('/resenas', resenasRoutes);

// Modulo de gestion interna (Staff): POS, inventario, reportes y administracion de usuarios
apiRouter.use('/pos', posRoutes);
apiRouter.use('/inventario', inventarioRoutes);
apiRouter.use('/reportes', reportesRoutes);
apiRouter.use('/usuarios', usuariosRoutes);

// Modulo de configuracion publico (modos de pago, etc)
apiRouter.use('/config', configRoutes);

// Envoltorios por rol para el portal interno (reutilizan los servicios existentes)
apiRouter.use('/staff/almacen', staffAlmacenRoutes);
apiRouter.use('/staff/logistica', staffLogisticaRoutes);
apiRouter.use('/staff/pagos', staffPagosRoutes);
apiRouter.use('/staff/pedidos', staffPedidosRoutes);

export default apiRouter;
