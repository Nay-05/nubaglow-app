/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: RASTREO DE PEDIDOS (/pedidos)
 * ============================================================================
 * Consulta publica por codigo (ej. NB-2026-0101). El backend anonimiza los
 * datos personales del destinatario antes de responder.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearFecha } from '../../core/formato.js';
import { encabezadoPagina, alerta } from '../comunes.js';

function claseEstado(estado) {
  if (estado === 'Entregado') return 'estado-badge estado-entregado';
  if (estado === 'En tránsito') return 'estado-badge estado-transito';
  if (estado === 'En preparación') return 'estado-badge estado-preparacion';
  return 'estado-badge estado-pendiente';
}

function bloqueRastreo(rastreo) {
  const eventos = rastreo.lineaDeTiempo || [];

  return el(
    'article',
    { clase: 'tarjeta-rastreo' },
    el(
      'header',
      { clase: 'rastreo-cabecera' },
      el(
        'div',
        {},
        el('p', { clase: 'rastreo-etiqueta', texto: 'Codigo de rastreo' }),
        el('h2', { clase: 'rastreo-codigo', texto: rastreo.codigoRastreo })
      ),
      el('span', { clase: claseEstado(rastreo.estado), texto: rastreo.estado })
    ),
    el(
      'dl',
      { clase: 'rastreo-datos' },
      el('div', {}, el('dt', { texto: 'Ciudad de destino' }), el('dd', { texto: rastreo.ciudadDestino || 'No registrada' })),
      el('div', {}, el('dt', { texto: 'Transportista' }), el('dd', { texto: rastreo.transportista || 'Pendiente de asignacion' })),
      el('div', {}, el('dt', { texto: 'Fecha del pedido' }), el('dd', { texto: formatearFecha(rastreo.fechaPedido) })),
      el('div', {}, el('dt', { texto: 'Destinatario' }), el('dd', { texto: rastreo.destinatarioProtegido?.nombre || 'Protegido' })),
      el('div', {}, el('dt', { texto: 'Contacto' }), el('dd', { texto: rastreo.destinatarioProtegido?.celular || 'Protegido' })),
      el('div', {}, el('dt', { texto: 'Direccion' }), el('dd', { texto: rastreo.destinatarioProtegido?.direccion || 'Protegida' }))
    ),
    el(
      'section',
      { clase: 'rastreo-linea' },
      el('h3', { clase: 'bloque-detalle-titulo', texto: 'Linea de tiempo' }),
      eventos.length
        ? el(
            'ol',
            { clase: 'linea-tiempo' },
            ...eventos.map((evento) =>
              el(
                'li',
                { clase: 'linea-evento' },
                el('span', { clase: 'linea-punto', atributos: { 'aria-hidden': 'true' } }),
                el(
                  'div',
                  { clase: 'linea-contenido' },
                  el('strong', { texto: evento.estado }),
                  el('span', { clase: 'linea-fecha', texto: formatearFecha(evento.fechaHora) }),
                  evento.descripcion ? el('p', { clase: 'texto-suave', texto: evento.descripcion }) : null
                )
              )
            )
          )
        : el('p', { clase: 'texto-suave', texto: 'Todavia no hay eventos registrados para este envio.' })
    )
  );
}

export const vistaPedidos = {
  async render() {
    const seccion = el(
      'section',
      { clase: 'pagina' },
      encabezadoPagina(
        'Rastreo de pedidos',
        'Ingresa el codigo que recibiste al confirmar tu compra (formato NB-2026-XXXX).'
      )
    );

    const entrada = el('input', {
      clase: 'entrada',
      type: 'text',
      name: 'codigo',
      id: 'campo-codigo',
      placeholder: 'NB-2026-0000',
      atributos: { autocomplete: 'off', maxlength: '20', spellcheck: 'false' }
    });

    const botonBuscar = el(
      'button',
      { clase: 'btn btn-primary', atributos: { type: 'submit' } },
      icono('buscar', 16),
      el('span', { texto: 'Rastrear' })
    );

    const formulario = el(
      'form',
      { clase: 'buscador' },
      el(
        'div',
        { clase: 'campo' },
        el('label', { clase: 'campo-etiqueta', atributos: { for: 'campo-codigo' }, texto: 'Codigo de rastreo' }),
        entrada
      ),
      botonBuscar
    );

    const resultado = el('div', { clase: 'rastreo-resultado', atributos: { 'aria-live': 'polite' } });

    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      resultado.replaceChildren();
      const codigo = entrada.value.trim();

      if (!codigo) {
        resultado.appendChild(alerta('Ingresa un codigo de rastreo para continuar.'));
        return;
      }

      botonBuscar.disabled = true;
      try {
        const respuesta = await api.obtener(`/envios/rastreo/${encodeURIComponent(codigo)}`);
        resultado.appendChild(bloqueRastreo(respuesta.datos.rastreo));
      } catch (error) {
        resultado.appendChild(
          alerta(
            error.estado === 404
              ? 'No encontramos un envio con ese codigo. Revisa el codigo e intenta nuevamente.'
              : error.message || 'No se pudo consultar el rastreo en este momento.'
          )
        );
      } finally {
        botonBuscar.disabled = false;
      }
    });

    seccion.append(formulario, resultado);
    return seccion;
  }
};
