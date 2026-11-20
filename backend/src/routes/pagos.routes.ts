/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS PUBLICAS DE PAGOS PAYPAL (/api/pagos)
 * ============================================================================
 * Crear y capturar exigen sesion de cliente y propiedad del pedido.
 * simulado/aprobar existe solo en desarrollo y con PAYPAL_MODO=simulado.
 */

import { Router } from 'express';
import {
  crearOrdenPaypal,
  capturarOrdenPaypal,
  aprobarOrdenPaypalSimulada
} from '../controllers/paypal.controller';
import { obtenerDatosCobroCliente } from '../controllers/pagos.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import {
  crearOrdenPaypalSchema,
  capturarOrdenPaypalSchema,
  aprobarOrdenPaypalSimuladoSchema
} from '../schemas/compra.schema';

const router = Router();

// Datos bancarios y QR de simulacion para clientes autenticados
router.get(
  '/datos-cobro',
  verificarToken,
  requerirRol('cliente'),
  obtenerDatosCobroCliente
);

router.post(
  '/paypal/crear',
  verificarToken,
  requerirRol('cliente'),
  validar({ body: crearOrdenPaypalSchema }),
  crearOrdenPaypal
);

router.post(
  '/paypal/capturar',
  verificarToken,
  requerirRol('cliente'),
  validar({ body: capturarOrdenPaypalSchema }),
  capturarOrdenPaypal
);

router.post(
  '/paypal/simulado/aprobar',
  verificarToken,
  requerirRol('cliente'),
  validar({ body: aprobarOrdenPaypalSimuladoSchema }),
  aprobarOrdenPaypalSimulada
);

export default router;
