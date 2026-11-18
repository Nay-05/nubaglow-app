/**
 * ============================================================================
 * NUBAGLOW APP - VISTA PUBLICA: CATALOGO
 * ============================================================================
 * Consume /api/categorias y /api/productos con filtros combinables, busqueda
 * con retraso, ordenamiento y paginacion. Todo el estado vive en la URL para
 * que Atras, Adelante y F5 conserven la seleccion del usuario.
 */

import { el, icono } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { formatearBs } from '../../core/formato.js';
import { agregarAlCarritoVisitante } from '../../core/carritoVisitante.js';
import {
  encabezadoPagina,
  alerta,
  estadoVacio,
  imagenProducto
} from '../comunes.js';

const LIMITE_POR_PAGINA = 9;
const RETRASO_BUSQUEDA = 350;
const RETRASO_PRECIO = 450;
const TIPOS_PIEL = ['Seca', 'Grasa', 'Mixta', 'Sensible'];
const OPCIONES_ORDEN = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'precio_asc', etiqueta: 'Precio: menor a mayor' },
  { valor: 'precio_desc', etiqueta: 'Precio: mayor a menor' },
  { valor: 'mejor_valorados', etiqueta: 'Mejor valorados' }
];

function leerEstado(consulta) {
  const ordenSolicitado = consulta.get('orden') || '';
  const orden = OPCIONES_ORDEN.some((opcion) => opcion.valor === ordenSolicitado)
    ? ordenSolicitado
    : 'recientes';
  const tipoPiel = TIPOS_PIEL.includes(consulta.get('tipo_piel') || '')
    ? consulta.get('tipo_piel')
    : '';
  const pagina = Math.max(1, Number.parseInt(consulta.get('pagina') || '1', 10) || 1);

  const leerPrecio = (clave) => {
    const crudo = consulta.get(clave);
    if (crudo === null || crudo.trim() === '') return '';
    const numero = Number(crudo);
    return Number.isFinite(numero) && numero >= 0 ? numero : '';
  };

  return {
    categoria: consulta.get('categoria') || '',
    tipoPiel,
    precioMin: leerPrecio('precio_min'),
    precioMax: leerPrecio('precio_max'),
    buscar: (consulta.get('buscar') || '').trim(),
    orden,
    pagina
  };
}

function construirConsulta(estado) {
  const parametros = new URLSearchParams();
  if (estado.categoria) parametros.set('categoria', estado.categoria);
  if (estado.tipoPiel) parametros.set('tipo_piel', estado.tipoPiel);
  if (estado.precioMin !== '') parametros.set('precio_min', String(estado.precioMin));
  if (estado.precioMax !== '') parametros.set('precio_max', String(estado.precioMax));
  if (estado.buscar) parametros.set('buscar', estado.buscar);
  if (estado.orden !== 'recientes') parametros.set('orden', estado.orden);
  if (estado.pagina > 1) parametros.set('pagina', String(estado.pagina));
  return parametros.toString();
}

function construirConsultaApi(estado) {
  const parametros = new URLSearchParams({
    limite: String(LIMITE_POR_PAGINA),
    orden: estado.orden,
    pagina: String(estado.pagina)
  });
  if (estado.categoria) parametros.set('categoria', estado.categoria);
  if (estado.tipoPiel) parametros.set('tipo_piel', estado.tipoPiel);
  if (estado.precioMin !== '') parametros.set('precio_min', String(estado.precioMin));
  if (estado.precioMax !== '') parametros.set('precio_max', String(estado.precioMax));
  if (estado.buscar) parametros.set('buscar', estado.buscar);
  return parametros.toString();
}

function sincronizarUrl(estado, { reemplazar = false } = {}) {
  const sufijo = construirConsulta(estado);
  const destino = `/catalogo${sufijo ? `?${sufijo}` : ''}`;
  const actual = `${window.location.pathname}${window.location.search}`;
  if (destino === actual) return;

  if (reemplazar) {
    window.history.replaceState({}, '', destino);
  } else {
    window.history.pushState({}, '', destino);
  }
}

function crearDebounce(funcion, retraso) {
  let temporizador = null;

  const ejecutar = (...argumentos) => {
    if (temporizador) window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => {
      temporizador = null;
      funcion(...argumentos);
    }, retraso);
  };

  ejecutar.cancelar = () => {
    if (temporizador) window.clearTimeout(temporizador);
    temporizador = null;
  };

  return ejecutar;
}

function estrellas(promedio) {
  const valor = Number(promedio) || 0;
  const llenas = Math.round(valor);
  const nodos = [];

  for (let indice = 0; indice < 5; indice += 1) {
    const estrella = icono('estrella', 14);
    if (indice < llenas) estrella.classList.add('estrella-activa');
    nodos.push(estrella);
  }

  return el(
    'span',
    {
      clase: 'estrellas',
      atributos: {
        role: 'img',
        'aria-label': valor > 0 ? `Valoración ${valor.toFixed(1)} de 5` : 'Producto sin reseñas'
      }
    },
    ...nodos
  );
}

function valoracion(producto) {
  const promedio = Number(producto.promedioCalificacion) || 0;
  const total = Number(producto.totalResenas) || 0;

  return el(
    'div',
    { clase: 'valoracion' },
    estrellas(promedio),
    el('span', {
      texto: promedio > 0 ? `${promedio.toFixed(1)} (${total})` : 'Sin reseñas'
    })
  );
}

function disponibilidad(stock) {
  if (stock <= 0) return { texto: 'Agotado', clase: 'agotado' };
  if (stock <= 5) return { texto: 'Últimas unidades', clase: 'bajo' };
  return null;
}

function opcionRadio({ id, nombre, valor, etiqueta, activo, alCambiar }) {
  return el(
    'label',
    { clase: 'filtro-opcion', atributos: { for: id } },
    el('input', {
      clase: 'filtro-radio',
      id,
      type: 'radio',
      name: nombre,
      value: valor,
      checked: activo,
      on: { change: alCambiar }
    }),
    el('span', { clase: 'filtro-opcion-texto', texto: etiqueta })
  );
}

function grupoCategorias(categorias, estado, alCambiar) {
  const opciones = el(
    'div',
    { clase: 'filtro-opciones' },
    opcionRadio({
      id: 'filtro-categoria-todas',
      nombre: 'categoria',
      valor: '',
      etiqueta: 'Todas las categorías',
      activo: !estado.categoria,
      alCambiar
    }),
    ...categorias.map((categoria) =>
      opcionRadio({
        id: `filtro-categoria-${categoria.slug}`,
        nombre: 'categoria',
        valor: categoria.slug,
        etiqueta: categoria.nombre,
        activo: categoria.slug === estado.categoria,
        alCambiar
      })
    )
  );

  return el(
    'fieldset',
    { clase: 'filtro-grupo' },
    el('legend', { clase: 'filtro-leyenda', texto: 'Categoría' }),
    opciones
  );
}

function grupoTiposPiel(estado, alCambiar) {
  const opciones = el(
    'div',
    { clase: 'filtro-opciones' },
    opcionRadio({
      id: 'filtro-piel-todos',
      nombre: 'tipo_piel',
      valor: '',
      etiqueta: 'Todos los tipos',
      activo: !estado.tipoPiel,
      alCambiar
    }),
    ...TIPOS_PIEL.map((tipo, indice) =>
      opcionRadio({
        id: `filtro-piel-${indice}`,
        nombre: 'tipo_piel',
        valor: tipo,
        etiqueta: tipo,
        activo: tipo === estado.tipoPiel,
        alCambiar
      })
    )
  );

  return el(
    'fieldset',
    { clase: 'filtro-grupo' },
    el('legend', { clase: 'filtro-leyenda', texto: 'Tipo de piel' }),
    opciones
  );
}

function crearPaginacion(paginacion, alIrAPagina) {
  const totalPaginas = Number(paginacion.totalPaginas) || 0;
  const paginaActual = Number(paginacion.pagina) || 1;
  if (totalPaginas <= 1) return null;

  const crearBoton = (numero) =>
    el(
      'button',
      {
        clase: 'pagina-boton',
        atributos: {
          type: 'button',
          ...(numero === paginaActual ? { 'aria-current': 'page' } : {})
        },
        on: { click: () => alIrAPagina(numero) },
        texto: String(numero)
      }
    );

  const visibles = new Set([1, totalPaginas]);

  if (totalPaginas <= 7) {
    for (let numero = 1; numero <= totalPaginas; numero += 1) visibles.add(numero);
  } else {
    if (paginaActual <= 3) {
      [2, 3, 4].forEach((numero) => visibles.add(numero));
    } else if (paginaActual >= totalPaginas - 2) {
      [totalPaginas - 1, totalPaginas - 2, totalPaginas - 3].forEach((numero) =>
        visibles.add(numero)
      );
    } else {
      [paginaActual - 1, paginaActual, paginaActual + 1].forEach((numero) =>
        visibles.add(numero)
      );
    }
  }

  const numeros = Array.from(visibles)
    .filter((numero) => numero >= 1 && numero <= totalPaginas)
    .sort((a, b) => a - b);

  const botones = [];
  let anterior = 0;
  for (const numero of numeros) {
    if (anterior && numero - anterior > 1) {
      botones.push(el('span', { clase: 'pagina-puntos', texto: '…' }));
    }
    botones.push(crearBoton(numero));
    anterior = numero;
  }

  return el(
    'nav',
    { clase: 'paginacion', atributos: { 'aria-label': 'Paginación del catálogo' } },
    el(
      'button',
      {
        clase: 'pagina-boton pagina-boton-texto',
        atributos: { type: 'button', ...(paginaActual <= 1 ? { disabled: true } : {}) },
        on: { click: () => alIrAPagina(paginaActual - 1) },
        texto: 'Anterior'
      }
    ),
    ...botones,
    el(
      'button',
      {
        clase: 'pagina-boton pagina-boton-texto',
        atributos: { type: 'button', ...(paginaActual >= totalPaginas ? { disabled: true } : {}) },
        on: { click: () => alIrAPagina(paginaActual + 1) },
        texto: 'Siguiente'
      }
    )
  );
}

export const vistaCatalogo = {
  async render({ consulta, router, usuario }) {
    const estado = leerEstado(consulta);
    let cargaActual = 0;
    let categorias = [];

    const seccion = el(
      'section',
      { clase: 'pagina pagina-catalogo' },
      encabezadoPagina(
        'Catálogo',
        'Skincare y maquillaje con filtros por categoría, tipo de piel y precio.'
      )
    );

    const entradaBusqueda = el('input', {
      clase: 'entrada catalogo-entrada-busqueda',
      type: 'search',
      name: 'buscar',
      value: estado.buscar,
      placeholder: 'Buscar por nombre, marca o categoría',
      atributos: { 'aria-label': 'Buscar productos', autocomplete: 'off' }
    });

    const formularioBusqueda = el(
      'form',
      { clase: 'catalogo-buscador', atributos: { role: 'search' } },
      icono('buscar', 18),
      entradaBusqueda
    );

    const selectorOrden = el(
      'select',
      {
        clase: 'entrada catalogo-selector-orden',
        name: 'orden',
        atributos: { 'aria-label': 'Ordenar productos' }
      },
      ...OPCIONES_ORDEN.map((opcion) =>
        el('option', { value: opcion.valor, texto: opcion.etiqueta })
      )
    );
    selectorOrden.value = estado.orden;

    const contadorFiltros = el('span', { clase: 'filtros-contador' });
    const botonFiltros = el(
      'button',
      {
        clase: 'btn btn-outline boton-filtros',
        atributos: {
          type: 'button',
          'aria-expanded': 'false',
          'aria-controls': 'panel-filtros'
        }
      },
      icono('menu', 16),
      el('span', { texto: 'Filtros' }),
      contadorFiltros
    );

    const controles = el(
      'div',
      { clase: 'catalogo-controles' },
      el(
        'label',
        { clase: 'catalogo-orden' },
        el('span', { clase: 'catalogo-orden-etiqueta', texto: 'Ordenar por' }),
        selectorOrden
      ),
      botonFiltros
    );

    const barra = el('div', { clase: 'catalogo-barra' }, formularioBusqueda, controles);
    const resumen = el('p', { clase: 'catalogo-conteo' });
    const mensajes = el('div', { clase: 'mensajes' });
    const grilla = el('div', { clase: 'grilla-productos' });
    const contenedorPaginacion = el('div', { clase: 'catalogo-paginacion' });

    const principal = el(
      'div',
      { clase: 'catalogo-principal' },
      barra,
      resumen,
      mensajes,
      grilla,
      contenedorPaginacion
    );

    const grupoContenedorCategorias = el('div', {});
    const grupoPiel = grupoTiposPiel(estado, manejarCambioTipoPiel);
    const entradaPrecioMin = el('input', {
      clase: 'entrada',
      type: 'number',
      name: 'precio_min',
      min: '0',
      step: '1',
      value: estado.precioMin === '' ? '' : String(estado.precioMin),
      placeholder: '0',
      atributos: { 'aria-label': 'Precio mínimo en bolivianos', inputmode: 'numeric' }
    });
    const entradaPrecioMax = el('input', {
      clase: 'entrada',
      type: 'number',
      name: 'precio_max',
      min: '0',
      step: '1',
      value: estado.precioMax === '' ? '' : String(estado.precioMax),
      placeholder: 'Sin límite',
      atributos: { 'aria-label': 'Precio máximo en bolivianos', inputmode: 'numeric' }
    });

    const grupoPrecio = el(
      'fieldset',
      { clase: 'filtro-grupo' },
      el('legend', { clase: 'filtro-leyenda', texto: 'Rango de precio' }),
      el(
        'div',
        { clase: 'filtros-precio' },
        el(
          'label',
          { clase: 'filtros-precio-campo' },
          el('span', { clase: 'filtros-precio-etiqueta', texto: 'Mín. (Bs.)' }),
          entradaPrecioMin
        ),
        el(
          'label',
          { clase: 'filtros-precio-campo' },
          el('span', { clase: 'filtros-precio-etiqueta', texto: 'Máx. (Bs.)' }),
          entradaPrecioMax
        )
      )
    );

    const botonLimpiarPanel = el(
      'button',
      {
        clase: 'btn btn-outline boton-limpiar-filtros',
        atributos: { type: 'button' },
        on: { click: () => router.navegar('/catalogo') }
      },
      icono('cerrar', 16),
      el('span', { texto: 'Limpiar filtros' })
    );

    const botonCerrarPanel = el(
      'button',
      {
        clase: 'btn btn-icono boton-cerrar-filtros',
        atributos: { type: 'button', 'aria-label': 'Cerrar filtros' },
        on: { click: () => abrirPanel(false) }
      },
      icono('cerrar', 18)
    );

    const panel = el(
      'aside',
      { clase: 'filtros-panel', atributos: { id: 'panel-filtros', 'aria-label': 'Filtros del catálogo' } },
      el(
        'div',
        { clase: 'filtros-cabecera' },
        el('h2', { clase: 'filtros-titulo', texto: 'Filtros' }),
        botonCerrarPanel
      ),
      grupoContenedorCategorias,
      grupoPiel,
      grupoPrecio,
      botonLimpiarPanel
    );

    const velo = el('button', {
      clase: 'filtros-velo',
      atributos: { type: 'button', 'aria-label': 'Cerrar filtros' },
      on: { click: () => abrirPanel(false) }
    });

    const layout = el('div', { clase: 'catalogo-layout' }, principal, panel, velo);
    seccion.appendChild(layout);

    function abrirPanel(abrir) {
      layout.classList.toggle('filtros-abiertos', abrir);
      botonFiltros.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      if (abrir) botonCerrarPanel.focus();
      else botonFiltros.focus();
    }

    function actualizarContadorFiltros() {
      const cantidad = [
        Boolean(estado.categoria),
        Boolean(estado.tipoPiel),
        estado.precioMin !== '' || estado.precioMax !== ''
      ].filter(Boolean).length;

      contadorFiltros.textContent = cantidad > 0 ? String(cantidad) : '';
      contadorFiltros.hidden = cantidad === 0;
    }

    function hayCambioDePagina(nuevaPagina) {
      if (nuevaPagina === estado.pagina) return;
      estado.pagina = nuevaPagina;
    }

    async function cargarProductos({ desplazar = false } = {}) {
      const turno = ++cargaActual;
      mensajes.replaceChildren();
      resumen.textContent = '';
      contenedorPaginacion.replaceChildren();
      grilla.setAttribute('aria-busy', 'true');
      grilla.replaceChildren(
        el('p', { clase: 'catalogo-cargando', atributos: { role: 'status' }, texto: 'Cargando productos...' })
      );

      try {
        const respuesta = await api.obtener(`/productos?${construirConsultaApi(estado)}`);
        if (turno !== cargaActual) return;

        const productos = respuesta.datos.productos || [];
        const paginacion = respuesta.datos.paginacion || {};

        if (desplazar) window.scrollTo(0, 0);

        if (productos.length === 0) {
          resumen.textContent = '0 resultados';
          grilla.replaceChildren(
            el(
              'div',
              { clase: 'catalogo-estado' },
              estadoVacio('No encontramos productos con esos filtros.'),
              el(
                'button',
                {
                  clase: 'btn btn-outline',
                  atributos: { type: 'button' },
                  on: { click: () => router.navegar('/catalogo') }
                },
                icono('cerrar', 16),
                el('span', { texto: 'Limpiar filtros' })
              )
            )
          );
          return;
        }

        const inicio = (Number(paginacion.pagina) - 1) * Number(paginacion.limite) + 1;
        const fin = inicio + productos.length - 1;
        const total = Number(paginacion.total) || productos.length;
        resumen.textContent =
          total === 1
            ? 'Mostrando 1 de 1 resultado'
            : `Mostrando ${inicio}-${fin} de ${total} resultados`;

        grilla.replaceChildren(
          ...productos.map((producto) => crearTarjetaProducto(producto, { router, usuario }))
        );

        const paginacionNodo = crearPaginacion(paginacion, (pagina) => {
          if (pagina < 1 || pagina > Number(paginacion.totalPaginas)) return;
          hayCambioDePagina(pagina);
          sincronizarUrl(estado);
          cargarProductos({ desplazar: true });
        });

        if (paginacionNodo) contenedorPaginacion.appendChild(paginacionNodo);
      } catch (error) {
        if (turno !== cargaActual) return;
        grilla.replaceChildren();
        mensajes.appendChild(
          alerta(
            error.message ||
              'No pudimos cargar el catálogo. Revisa tu conexión e inténtalo nuevamente.'
          )
        );
        mensajes.appendChild(
          el(
            'button',
            {
              clase: 'btn btn-outline',
              atributos: { type: 'button' },
              on: { click: () => cargarProductos() }
            },
            icono('buscar', 16),
            el('span', { texto: 'Reintentar' })
          )
        );
      } finally {
        if (turno === cargaActual) grilla.removeAttribute('aria-busy');
      }
    }

    async function cargarCategorias() {
      try {
        const respuesta = await api.obtener('/categorias');
        categorias = respuesta.datos.categorias || [];
        grupoContenedorCategorias.replaceChildren(
          grupoCategorias(categorias, estado, manejarCambioCategoria)
        );
      } catch {
        grupoContenedorCategorias.replaceChildren(
          alerta('No pudimos cargar las categorías. Puedes filtrar por tipo de piel y precio.')
        );
      }
    }

    function manejarCambioCategoria(evento) {
      estado.categoria = evento.target.value;
      estado.pagina = 1;
      actualizarContadorFiltros();
      sincronizarUrl(estado);
      cargarProductos({ desplazar: true });
    }

    function manejarCambioTipoPiel(evento) {
      estado.tipoPiel = evento.target.value;
      estado.pagina = 1;
      actualizarContadorFiltros();
      sincronizarUrl(estado);
      cargarProductos({ desplazar: true });
    }

    const aplicarPrecio = crearDebounce(() => {
      estado.pagina = 1;
      actualizarContadorFiltros();
      sincronizarUrl(estado);
      cargarProductos({ desplazar: true });
    }, RETRASO_PRECIO);

    function leerPrecioEntrada(entrada) {
      const crudo = entrada.value.trim();
      if (crudo === '') return '';
      const numero = Number(crudo);
      return Number.isFinite(numero) && numero >= 0 ? numero : '';
    }

    for (const entrada of [entradaPrecioMin, entradaPrecioMax]) {
      entrada.addEventListener('input', () => {
        estado.precioMin = leerPrecioEntrada(entradaPrecioMin);
        estado.precioMax = leerPrecioEntrada(entradaPrecioMax);
        aplicarPrecio();
      });
    }

    const aplicarBusqueda = crearDebounce(() => {
      sincronizarUrl(estado, { reemplazar: true });
      cargarProductos();
    }, RETRASO_BUSQUEDA);

    entradaBusqueda.addEventListener('input', () => {
      estado.buscar = entradaBusqueda.value.trim();
      estado.pagina = 1;
      aplicarBusqueda();
    });

    formularioBusqueda.addEventListener('submit', (evento) => {
      evento.preventDefault();
      aplicarBusqueda.cancelar();
      estado.buscar = entradaBusqueda.value.trim();
      estado.pagina = 1;
      sincronizarUrl(estado);
      cargarProductos({ desplazar: true });
    });

    selectorOrden.addEventListener('change', () => {
      estado.orden = selectorOrden.value;
      estado.pagina = 1;
      sincronizarUrl(estado);
      cargarProductos({ desplazar: true });
    });

    botonFiltros.addEventListener('click', () => {
      abrirPanel(!layout.classList.contains('filtros-abiertos'));
    });

    actualizarContadorFiltros();
    await Promise.allSettled([cargarCategorias(), cargarProductos()]);

    return seccion;
  }
};

function crearTarjetaProducto(producto, { router, usuario }) {
  const stock = Number(producto.stockTotal) || 0;
  const ruta = `/producto/${encodeURIComponent(String(producto.slug || ''))}`;
  const precio = Number(producto.precioMin) || 0;
  const etiquetaStock = disponibilidad(stock);
  const estadoAccion = el('p', {
    clase: 'tarjeta-accion-estado',
    atributos: { role: 'status', 'aria-live': 'polite' }
  });

  const textoBoton = el('span', { texto: stock > 0 ? 'Agregar' : 'Agotado' });
  const botonAgregar = el(
    'button',
    {
      clase: 'btn btn-primary btn-pequeno boton-agregar',
      atributos: {
        type: 'button',
        ...(stock <= 0 ? { disabled: true } : {}),
        'aria-label':
          stock > 0
            ? `Agregar ${producto.nombre || 'producto'} al carrito`
            : `${producto.nombre || 'Producto'} agotado`
      }
    },
    icono('carrito', 16),
    textoBoton
  );

  if (stock > 0) {
    botonAgregar.addEventListener('click', () =>
      agregarProducto({ producto, boton: botonAgregar, textoBoton, estadoAccion, router, usuario })
    );
  }

  return el(
    'article',
    { clase: 'tarjeta-producto tarjeta-catalogo' },
    el(
      'a',
      { clase: 'tarjeta-imagen', href: ruta, atributos: { 'data-ruta': '' } },
      imagenProducto(producto.imagenPrincipal, producto.nombre)
    ),
    el(
      'div',
      { clase: 'tarjeta-cuerpo' },
      el('span', { clase: 'tarjeta-marca', texto: producto.marca || 'Nuba Beauty' }),
      el(
        'h2',
        { clase: 'tarjeta-titulo' },
        el('a', { href: ruta, atributos: { 'data-ruta': '' }, texto: producto.nombre || 'Producto Nuba Beauty' })
      ),
      el('p', {
        clase: 'tarjeta-precio',
        texto: precio > 0 ? `Desde ${formatearBs(precio)}` : 'Precio por confirmar'
      }),
      valoracion(producto),
      etiquetaStock
        ? el('span', { clase: `estado-stock ${etiquetaStock.clase}`, texto: etiquetaStock.texto })
        : null,
      el('div', { clase: 'tarjeta-acciones' }, estadoAccion, botonAgregar)
    )
  );
}

async function agregarProducto({ producto, boton, textoBoton, estadoAccion, router, usuario }) {
  if (Number(producto.stockTotal) <= 0) return;

  estadoAccion.classList.remove('exito', 'error');
  estadoAccion.textContent = '';
  boton.disabled = true;
  textoBoton.textContent = 'Agregando...';

  try {
    const respuesta = await api.obtener(
      `/productos/${encodeURIComponent(String(producto.slug || ''))}`
    );
    const detalle = respuesta.datos.producto;
    const variantes = detalle.variantes || [];
    const ruta = `/producto/${encodeURIComponent(String(producto.slug || ''))}`;

    if (variantes.length !== 1) {
      router.navegar(ruta);
      return;
    }

    const variante = variantes[0];
    if (Number(variante.stock) <= 0) {
      estadoAccion.textContent = 'Esta presentación está agotada.';
      estadoAccion.classList.add('error');
      return;
    }

    if (usuario && usuario.rol === 'cliente') {
      await api.crear('/carrito/items', { variante_id: variante.id, cantidad: 1 });
      estadoAccion.textContent = 'Agregado a tu carrito.';
    } else {
      const resultado = agregarAlCarritoVisitante({
        varianteId: variante.id,
        productoId: producto.id,
        productoSlug: producto.slug,
        productoNombre: producto.nombre,
        varianteNombre: variante.nombre,
        precio: variante.precio,
        imagen: producto.imagenPrincipal,
        cantidad: 1
      });

      if (!resultado.ok) {
        estadoAccion.textContent = 'No se pudo guardar el carrito en este navegador.';
        estadoAccion.classList.add('error');
        return;
      }

      estadoAccion.textContent = 'Agregado al carrito de visitante.';
    }

    estadoAccion.classList.add('exito');
  } catch (error) {
    const sesionVencida = error && error.estado === 401;
    estadoAccion.textContent = sesionVencida
      ? 'Inicia sesión para guardar tu carrito.'
      : error.message || 'No se pudo agregar el producto. Intenta nuevamente.';
    estadoAccion.classList.add('error');
  } finally {
    boton.disabled = false;
    textoBoton.textContent = 'Agregar';
  }
}
