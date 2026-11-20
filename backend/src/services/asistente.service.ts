/**
 * ============================================================================
 * NUBAGLOW APP - SERVICIO DEL ASISTENTE IA CON GROUNDING EN CATALOGO
 * ============================================================================
 * - Consulta productos activos con stock real en PostgreSQL/Supabase.
 * - Envia ese contexto a Gemini usando una clave exclusivamente del servidor.
 * - Si Gemini no esta configurado o falla, responde con un motor local de
 *   reglas sobre los mismos productos, sin devolver errores 500 al usuario.
 */

import { consultar } from '../db';
import {
  ConsultaAsistenteInput,
  HistorialAsistenteItem
} from '../schemas/asistente.schema';

const MODELO_POR_DEFECTO = 'gemini-2.5-flash';
const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

const STOPWORDS = new Set([
  'para',
  'por',
  'con',
  'una',
  'uno',
  'unos',
  'unas',
  'como',
  'que',
  'del',
  'las',
  'los',
  'mis',
  'tengo',
  'quiero',
  'busco',
  'necesito',
  'recomienda',
  'recomiendes',
  'algo',
  'sobre',
  'este',
  'esta',
  'estos',
  'estas',
  'hola',
  'gracias'
]);

const SINONIMOS: Record<string, string[]> = {
  hidratante: ['hidratante', 'crema', 'locion', 'barrera'],
  limpiador: ['limpiador', 'limpieza', 'gel', 'espuma', 'micelar'],
  serum: ['serum', 'acido', 'vitamina', 'niacinamida', 'retinol'],
  protector: ['protector', 'solar', 'spf', 'bruma'],
  maquillaje: [
    'maquillaje',
    'base',
    'corrector',
    'labial',
    'paleta',
    'mascara',
    'rubor',
    'iluminador',
    'polvo'
  ],
  acne: ['salicilico', 'niacinamida', 'matificante', 'limpiador'],
  manchas: ['vitamina c', 'niacinamida', 'retinol', 'acido'],
  regalo: ['set', 'paleta', 'labial', 'estuche', 'tono']
};

export interface VarianteAsistente {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

export interface ProductoAsistente {
  id: number;
  nombre: string;
  slug: string;
  categoria: string;
  tipoPiel: string;
  descripcion: string;
  ingredientes: string;
  imagenPrincipal: string | null;
  precio: number;
  precioMin: number;
  precioMax: number;
  varianteId: number;
  varianteNombre: string;
  stock: number;
  variantes: VarianteAsistente[];
}

export interface RespuestaAsistente {
  respuesta: string;
  slugsRecomendados: string[];
  productos: ProductoAsistente[];
  modoBasico: boolean;
}

interface ProductoSeleccionado {
  producto: ProductoAsistente;
  motivo: string;
  puntaje: number;
}

function normalizar(texto: string): string {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function limpiarEmojis(texto: string): string {
  return String(texto || '').replace(/\p{Extended_Pictographic}/gu, '');
}

function formatearBs(valor: number): string {
  const numero = Number(valor) || 0;
  return `Bs. ${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numero)}`;
}

function recortar(texto: string, maximo: number): string {
  const valor = String(texto || '').trim();
  if (valor.length <= maximo) return valor;
  return `${valor.slice(0, maximo - 1)}...`;
}

function detectarPresupuesto(mensaje: string): number | null {
  const texto = normalizar(mensaje);
  const patrones = [
    /(?:menos de|hasta|maximo|presupuesto(?: de)?)\s*(?:bs\.?\s*)?(\d{2,5})/,
    /(\d{2,5})\s*(?:bs|bolivianos)/
  ];
  for (const patron of patrones) {
    const coincidencia = texto.match(patron);
    if (coincidencia) return Number(coincidencia[1]);
  }
  return null;
}

function detectarTipoPiel(mensaje: string): string | null {
  const texto = normalizar(mensaje);
  if (texto.includes('piel grasa') || texto.includes('grasa')) return 'Grasa';
  if (texto.includes('piel seca') || texto.includes('seca')) return 'Seca';
  if (texto.includes('piel mixta') || texto.includes('mixta')) return 'Mixta';
  if (texto.includes('sensible')) return 'Sensible';
  if (texto.includes('todo tipo')) return 'Todo tipo';
  return null;
}

function puntuarProducto(
  producto: ProductoAsistente,
  mensaje: string,
  presupuesto: number | null,
  tipoPiel: string | null
): ProductoSeleccionado {
  const textoMensaje = normalizar(mensaje);
  const tokens = textoMensaje
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  const nombre = normalizar(producto.nombre);
  const categoria = normalizar(producto.categoria);
  const ingredientes = normalizar(producto.ingredientes);
  const descripcion = normalizar(producto.descripcion);
  const tipo = normalizar(producto.tipoPiel);
  const textoProducto =
    `${nombre} ${categoria} ${ingredientes} ${descripcion} ${tipo}`;
  let puntaje = 0;
  let motivo = '';

  for (const token of tokens) {
    if (nombre.includes(token)) {
      puntaje += 6;
      motivo = motivo || 'coincide con tu búsqueda';
    }
    if (categoria.includes(token)) {
      puntaje += 4;
      motivo = motivo || `pertenece a ${producto.categoria}`;
    }
    if (ingredientes.includes(token)) {
      puntaje += 3;
      motivo = motivo || 'contiene ingredientes relacionados';
    }
    if (descripcion.includes(token)) {
      puntaje += 2;
      motivo = motivo || 'su descripción encaja con tu consulta';
    }
    if (tipo.includes(token)) {
      puntaje += 5;
      motivo = motivo || `es adecuado para piel ${producto.tipoPiel}`;
    }
  }

  for (const [clave, palabras] of Object.entries(SINONIMOS)) {
    if (!textoMensaje.includes(clave)) continue;
    if (palabras.some((palabra) => textoProducto.includes(palabra))) {
      puntaje += 3;
      motivo = motivo || `relacionado con ${clave}`;
    }
  }

  if (tipoPiel) {
    if (producto.tipoPiel === tipoPiel || producto.tipoPiel === 'Todo tipo') {
      puntaje += 6;
      motivo = motivo || `indicado para piel ${tipoPiel}`;
    } else {
      puntaje -= 3;
    }
  }

  if (presupuesto !== null) {
    if (producto.precioMin > presupuesto) {
      puntaje = -100;
    } else if (producto.precio <= presupuesto) {
      puntaje += 2;
      motivo = motivo || `está dentro de tu presupuesto de ${formatearBs(
        presupuesto
      )}`;
    }
  }

  return {
    producto,
    motivo: motivo || 'es una opción disponible con stock',
    puntaje
  };
}

function respuestaLocal(
  productos: ProductoAsistente[],
  mensaje: string
): RespuestaAsistente {
  if (productos.length === 0) {
    return {
      respuesta:
        'No hay productos con stock disponible en este momento. ' +
        'Vuelve a consultar más tarde o revisa el catálogo.',
      slugsRecomendados: [],
      productos: [],
      modoBasico: true
    };
  }

  const presupuesto = detectarPresupuesto(mensaje);
  const tipoPiel = detectarTipoPiel(mensaje);
  const puntuados = productos
    .map((producto) => puntuarProducto(producto, mensaje, presupuesto, tipoPiel))
    .filter((item) => item.puntaje > -100)
    .sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      return a.producto.precio - b.producto.precio;
    });

  let seleccionados = puntuados.filter((item) => item.puntaje > 0).slice(0, 3);
  if (seleccionados.length === 0) {
    seleccionados = puntuados
      .filter(
        (item) =>
          presupuesto === null || item.producto.precioMin <= presupuesto
      )
      .sort((a, b) => a.producto.precio - b.producto.precio)
      .slice(0, 3);
  }

  if (seleccionados.length === 0) {
    return {
      respuesta:
        'No encontré opciones dentro de ese presupuesto con stock actual. ' +
        'Puedes indicarme otro rango y reviso el catalogo nuevamente.',
      slugsRecomendados: [],
      productos: [],
      modoBasico: true
    };
  }

  const lineas = seleccionados.map(
    (item, indice) =>
      `${indice + 1}. ${item.producto.nombre} ` +
      `(${formatearBs(item.producto.precio)}): ${item.motivo}.`
  );
  const texto = limpiarEmojis(
    `Encontré estas opciones con stock en NubaGlow:\n${lineas.join('\n')}`
  );

  return {
    respuesta: texto,
    slugsRecomendados: seleccionados.map((item) => item.producto.slug),
    productos: seleccionados.map((item) => item.producto),
    modoBasico: true
  };
}

export class AsistenteService {
  private async productosConStock(): Promise<ProductoAsistente[]> {
    const res = await consultar(
      `SELECT
         p.id,
         p.nombre,
         p.slug,
         p.tipo_piel AS "tipoPiel",
         p.descripcion,
         p.ingredientes,
         c.nombre AS categoria,
         (
           SELECT img.url
           FROM imagenes_producto img
           WHERE img.producto_id = p.id
           ORDER BY img.es_principal DESC, img.orden ASC, img.id ASC
           LIMIT 1
         ) AS "imagenPrincipal",
         jsonb_agg(
           jsonb_build_object(
             'id', v.id,
             'nombre', v.nombre,
             'precio', v.precio,
             'stock', v.stock
           )
           ORDER BY v.precio ASC, v.id ASC
         ) AS variantes
       FROM productos p
       INNER JOIN categorias c ON c.id = p.categoria_id
       INNER JOIN variantes v ON v.producto_id = p.id
         AND v.activo = TRUE
         AND v.stock > 0
       WHERE p.activo = TRUE
       GROUP BY p.id, c.nombre
       ORDER BY p.nombre ASC
       LIMIT 60`
    );

    return res.rows.map((fila) => {
      const variantes = (Array.isArray(fila.variantes) ? fila.variantes : [])
        .map((variante: Record<string, unknown>) => ({
          id: Number(variante.id),
          nombre: String(variante.nombre || 'Presentación'),
          precio: Number(variante.precio) || 0,
          stock: Number(variante.stock) || 0
        }))
        .filter((variante: VarianteAsistente) => variante.stock > 0);
      const precios = variantes.map((variante: VarianteAsistente) => variante.precio);
      const principal = variantes[0] || {
        id: 0,
        nombre: 'Sin variante',
        precio: 0,
        stock: 0
      };

      return {
        id: Number(fila.id),
        nombre: String(fila.nombre || 'Producto NubaGlow'),
        slug: String(fila.slug || ''),
        categoria: String(fila.categoria || 'Sin categoría'),
        tipoPiel: String(fila.tipoPiel || 'Todo tipo'),
        descripcion: recortar(String(fila.descripcion || ''), 320),
        ingredientes: recortar(String(fila.ingredientes || ''), 240),
        imagenPrincipal: fila.imagenPrincipal
          ? String(fila.imagenPrincipal)
          : null,
        precio: principal.precio,
        precioMin: precios.length > 0 ? Math.min(...precios) : principal.precio,
        precioMax: precios.length > 0 ? Math.max(...precios) : principal.precio,
        varianteId: principal.id,
        varianteNombre: principal.nombre,
        stock: principal.stock,
        variantes
      };
    });
  }

  private construirInstruccion(productos: ProductoAsistente[]): string {
    const contexto = productos.map((producto) => ({
      nombre: producto.nombre,
      slug: producto.slug,
      categoria: producto.categoria,
      tipoPiel: producto.tipoPiel,
      descripcion: producto.descripcion,
      precioDesde: producto.precioMin,
      precioHasta: producto.precioMax,
      variantes: producto.variantes.map((variante) => ({
        nombre: variante.nombre,
        precio: variante.precio,
        stock: variante.stock
      }))
    }));

    return [
      'Eres la asesora experta de cosméticos y skincare de NubaGlow,',
      'una tienda de Nuba Beauty en Sucre, Bolivia.',
      'Responde en español, con tono amable, profesional y conciso.',
      'No uses emojis ni inventes productos, marcas, precios o beneficios.',
      'Recomienda únicamente productos incluidos en el CONTEXTO.',
      'Indica siempre el precio en bolivianos con el formato Bs. y explica',
      'brevemente por qué el producto encaja con la consulta.',
      'Devuelve exclusivamente un objeto JSON con las claves',
      '"respuesta" (texto breve) y "slugsRecomendados" (hasta 3 slugs',
      'exactos de productos del contexto, sin inventar).',
      'Si ningun producto encaja, deja "slugsRecomendados" como lista vacia',
      'y explica la situación en "respuesta".',
      '',
      'CONTEXTO DE PRODUCTOS CON STOCK:',
      JSON.stringify(contexto)
    ].join('\n');
  }

  private async llamarGemini(
    mensaje: string,
    historial: HistorialAsistenteItem[],
    productos: ProductoAsistente[]
  ): Promise<{ respuesta: string; slugsRecomendados: string[] } | null> {
    const clave = process.env.GEMINI_API_KEY?.trim();
    if (!clave) return null;

    const modeloEnv = process.env.GEMINI_MODEL?.trim() || MODELO_POR_DEFECTO;
    const modelo = /^[a-zA-Z0-9._-]+$/.test(modeloEnv)
      ? modeloEnv
      : MODELO_POR_DEFECTO;
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 9000);

    try {
      const contenidoHistorial = historial.map((item) => ({
        role: item.rol === 'usuario' ? 'user' : 'model',
        parts: [{ text: item.contenido }]
      }));
      const respuestaHttp = await fetch(
        `${GEMINI_API_BASE}/${encodeURIComponent(modelo)}:generateContent` +
          `?key=${encodeURIComponent(clave)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controlador.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: this.construirInstruccion(productos) }]
            },
            contents: [
              ...contenidoHistorial,
              { role: 'user', parts: [{ text: mensaje }] }
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 700,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  respuesta: { type: 'STRING' },
                  slugsRecomendados: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  }
                },
                required: ['respuesta', 'slugsRecomendados']
              }
            }
          })
        }
      );

      if (!respuestaHttp.ok) {
        throw new Error('Gemini no respondio correctamente');
      }

      const datos = (await respuestaHttp.json()) as any;
      const partes = datos?.candidates?.[0]?.content?.parts || [];
      const texto = partes
        .map((parte: any) => String(parte?.text || ''))
        .join('\n')
        .trim();
      if (!texto) throw new Error('Gemini devolvio una respuesta vacia');

      const limpio = texto
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      let estructura: any;
      try {
        estructura = JSON.parse(limpio);
      } catch {
        return { respuesta: limpiarEmojis(limpio), slugsRecomendados: [] };
      }

      const respuesta = String(estructura?.respuesta || '').trim();
      if (!respuesta) throw new Error('Respuesta sin texto');
      const slugs = Array.isArray(estructura?.slugsRecomendados)
        ? estructura.slugsRecomendados.map((slug: unknown) => String(slug))
        : [];
      return { respuesta: limpiarEmojis(respuesta), slugsRecomendados: slugs };
    } catch {
      // Cualquier fallo de red, cuota o formato activa el modo local.
      return null;
    } finally {
      clearTimeout(temporizador);
    }
  }

  async consultar(datos: ConsultaAsistenteInput): Promise<RespuestaAsistente> {
    const productos = await this.productosConStock();
    const historial = datos.historial || [];
    const gemini = await this.llamarGemini(
      datos.mensaje,
      historial,
      productos
    );

    if (gemini) {
      const porSlug = new Map(productos.map((producto) => [producto.slug, producto]));
      const slugs = Array.from(
        new Set(
          gemini.slugsRecomendados
            .map((slug) => String(slug).trim())
            .filter((slug) => porSlug.has(slug))
        )
      ).slice(0, 3);
      return {
        respuesta: gemini.respuesta,
        slugsRecomendados: slugs,
        productos: slugs.map((slug) => porSlug.get(slug)!),
        modoBasico: false
      };
    }

    return respuestaLocal(productos, datos.mensaje);
  }
}

export const asistenteService = new AsistenteService();
