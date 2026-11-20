/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE CONFIGURACION PUBLICA
 * ============================================================================
 * Endpoints para informacion de configuracion que no expone secretos.
 */

import { Router } from 'express';
import { esPaypalSimulado, modoPaypal } from '../config/paypal';

const router = Router();

// Endpoint publico: modo de PayPal (simulado o sandbox)
// No expone credenciales, solo el modo de operacion
router.get('/', (req, res) => {
  const modo = modoPaypal();
  const simulado = esPaypalSimulado();
  const whatsappNumero =
    process.env.WHATSAPP_NUMERO?.trim() || '59170000000';
  res.json({
    exito: true,
    datos: {
      modo,
      simulado,
      whatsappNumero: whatsappNumero.replace(/[^\d]/g, ''),
      mensajePaypal: simulado
        ? 'PayPal (simulación académica)'
        : 'PayPal (modo sandbox)'
    }
  });
});

export default router;