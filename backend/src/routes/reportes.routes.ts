/**
 * ============================================================================
 * NUBAGLOW APP - RUTAS DE REPORTES Y METRICAS (/api/reportes)
 * ============================================================================
 */

import { Router } from 'express';
import {
  resumenWebVsPos,
  ingresosPorDia,
  rankingProductos
} from '../controllers/reportes.controller';
import { validar } from '../middlewares/validar';
import { verificarToken, requerirRol } from '../middlewares/autenticacion';
import { consultaReportesSchema } from '../schemas/staff.schema';

const router = Router();

// Proteccion de rol: exclusivo para admin
router.use(verificarToken, requerirRol('admin'));

router.get('/web-vs-pos', resumenWebVsPos);
router.get('/ingresos-diarios', validar({ query: consultaReportesSchema }), ingresosPorDia);
router.get('/ranking', rankingProductos);

export default router;
