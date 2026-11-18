/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: INICIO
 * ============================================================================
 */

import { el } from '../core/dom.js';
import { enlaceInterno } from './comunes.js';

const BENEFICIOS = [
  {
    titulo: 'Curaduria skincare',
    texto: 'Rutinas con ingredientes clave explicados y recomendaciones por tipo de piel.'
  },
  {
    titulo: 'Compra segura',
    texto: 'Sesiones con cookies HttpOnly, validacion de permisos y trazabilidad de pedidos.'
  },
  {
    titulo: 'Acompanamiento real',
    texto: 'Rastreo de envios paso a paso y atencion del equipo de Nuba Beauty en Sucre.'
  }
];

export const vistaInicio = {
  async render() {
    return el(
      'div',
      { clase: 'inicio' },
      el(
        'section',
        { clase: 'hero' },
        el('p', { clase: 'hero-etiqueta', texto: 'Nuba Beauty - Sucre, Bolivia' }),
        el('h1', { clase: 'hero-titulo' }, 'Belleza que cuida tu piel'),
        el('p', {
          clase: 'hero-texto',
          texto:
            'Cosmeticos y skincare seleccionados con criterio profesional. Descubre tu rutina ideal y acompania cada pedido hasta tu puerta.'
        }),
        el(
          'div',
          { clase: 'hero-acciones' },
          enlaceInterno('/catalogo', 'Explorar catalogo', {
            clase: 'btn btn-primary',
            nombreIcono: 'catalogo'
          }),
          enlaceInterno('/pedidos', 'Rastrear un pedido', {
            clase: 'btn btn-outline',
            nombreIcono: 'pedido'
          })
        )
      ),
      el(
        'section',
        { clase: 'beneficios', atributos: { 'aria-label': 'Beneficios de comprar en NubaGlow' } },
        ...BENEFICIOS.map((beneficio) =>
          el(
            'article',
            { clase: 'beneficio' },
            el('h2', { clase: 'beneficio-titulo', texto: beneficio.titulo }),
            el('p', { clase: 'texto-suave', texto: beneficio.texto })
          )
        )
      )
    );
  }
};
