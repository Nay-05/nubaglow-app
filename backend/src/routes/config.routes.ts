/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE CONFIGURACION PUBLICA
 * ============================================================================
 * Endpoints para informacion de configuracion que no expone secretos.
 */

import { Router } from 'express';
import {
  esPaypalSimulado,
  modoPaypal,
  tipoCambioBobUsd
} from '../config/paypal';

const router = Router();

// Endpoint publico: modo de PayPal (simulado o sandbox)
// No expone credenciales, solo el modo de operacion
router.get('/', (req, res) => {
  const modo = modoPaypal();
  const simulado = esPaypalSimulado();
  const whatsappNumero = (process.env.WHATSAPP_NUMERO || '').trim();
  const whatsappDigitos = whatsappNumero.replace(/[^\d]/g, '');
  res.json({
    exito: true,
    datos: {
      modo,
      simulado,
      whatsappNumero: whatsappDigitos || null,
      mensajePaypal: simulado
        ? 'PayPal (simulación académica)'
        : 'PayPal (modo sandbox)',
      tipoCambioBobUsd: tipoCambioBobUsd()
    }
  });
});

export default router;
