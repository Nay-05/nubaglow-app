/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: INICIO
 * ============================================================================
 */

import { el } from '../../core/dom.js';
import { enlaceInterno } from '../comunes.js';

const BENEFICIOS = [
  {
    titulo: 'Curaduría skincare',
    texto: 'Rutinas con ingredientes clave explicados y recomendaciones por tipo de piel.'
  },
  {
    titulo: 'Compra segura',
    texto: 'Sesiones con cookies HttpOnly, validación de permisos y trazabilidad de pedidos.'
  },
  {
    titulo: 'Acompañamiento real',
    texto: 'Rastreo de envíos paso a paso y atención del equipo de Nuba Beauty en Sucre.'
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
            'Cosméticos y skincare seleccionados con criterio profesional. Descubre tu rutina ideal y acompaña cada pedido hasta tu puerta.'
        }),
        el(
          'div',
          { clase: 'hero-acciones' },
          enlaceInterno('/catalogo', 'Explorar catálogo', {
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
