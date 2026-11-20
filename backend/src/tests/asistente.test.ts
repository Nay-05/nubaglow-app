/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBAS DEL ASISTENTE IA
 * ============================================================================
 * Valida Zod, grounding real en PostgreSQL, fallback sin clave, verificacion de
 * slugs recomendados y rate limiting por IP/sesion.
 */

import app from '../index';
import { consultar, cerrarPool } from '../db';

async function ejecutarPruebas() {
  console.log('Iniciando pruebas del asistente IA...');

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;
  const sufijo = Date.now().toString().slice(-6);
  const claveOriginal = process.env.GEMINI_API_KEY;

  let productoId: number | null = null;
  let productoAgotadoId: number | null = null;
  let productoInactivoId: number | null = null;

  let exitos = 0;
  let fallos = 0;

  function asegurar(condicion: boolean, descripcion: string) {
    if (condicion) {
      console.log(`[PASS] ${descripcion}`);
      exitos++;
    } else {
      console.error(`[FAIL] ${descripcion}`);
      fallos++;
    }
  }

  async function postAsistente(cuerpo: unknown) {
    return fetch(`${baseUrl}/api/asistente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
  }

  try {
    const categoria = await consultar('SELECT id FROM categorias LIMIT 1');
    const categoriaId = categoria.rows[0].id;

    const producto = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion,
        ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Seca', $4, $5, $6, TRUE)
       RETURNING id`,
      [
        categoriaId,
        `Asistente Prueba ${sufijo}`,
        `asistente-prueba-${sufijo}`,
        'Hidratante intensivo para piel seca con ceramidas.',
        'Ceramida, escualano, glicerina',
        'Aplicar por la noche'
      ]
    );
    productoId = producto.rows[0].id;

    await consultar(
      `INSERT INTO variantes
       (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Tubo 50 ml', 123.00, 4, 1, TRUE)`,
      [productoId, `ASIS-${sufijo}`]
    );

    const agotado = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion,
        ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Seca', $4, $5, $6, TRUE)
       RETURNING id`,
      [
        categoriaId,
        `Asistente Agotado ${sufijo}`,
        `asistente-agotado-${sufijo}`,
        'Producto sin stock para validar el grounding.',
        'Ceramida',
        'Aplicar por la noche'
      ]
    );
    productoAgotadoId = agotado.rows[0].id;

    await consultar(
      `INSERT INTO variantes
       (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Tubo 50 ml', 50.00, 0, 1, TRUE)`,
      [productoAgotadoId, `ASIS-AGOT-${sufijo}`]
    );

    const inactivo = await consultar(
      `INSERT INTO productos
       (categoria_id, nombre, slug, marca, tipo_piel, descripcion,
        ingredientes, modo_uso, activo)
       VALUES ($1, $2, $3, 'Nuba Test', 'Seca', $4, $5, $6, FALSE)
       RETURNING id`,
      [
        categoriaId,
        `Asistente Inactivo ${sufijo}`,
        `asistente-inactivo-${sufijo}`,
        'Producto inactivo que no debe aparecer en el grounding.',
        'Ceramida',
        'Aplicar por la noche'
      ]
    );
    productoInactivoId = inactivo.rows[0].id;

    await consultar(
      `INSERT INTO variantes
       (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
       VALUES ($1, $2, 'Tubo 50 ml', 40.00, 5, 1, TRUE)`,
      [productoInactivoId, `ASIS-INACT-${sufijo}`]
    );

    const resVacio = await postAsistente({ mensaje: '' });
    asegurar(resVacio.status === 400, 'Zod rechaza un mensaje vacio (400)');

    const resLargo = await postAsistente({ mensaje: 'x'.repeat(601) });
    asegurar(
      resLargo.status === 400,
      'Zod rechaza un mensaje demasiado largo (400)'
    );

    delete process.env.GEMINI_API_KEY;
    const resFallback = await postAsistente({
      mensaje: `Busco Asistente Prueba ${sufijo} para piel seca`
    });
    const dataFallback = (await resFallback.json()) as any;
    asegurar(resFallback.status === 200, 'Fallback sin clave responde 200');
    asegurar(
      dataFallback.datos?.modoBasico === true,
      'Sin GEMINI_API_KEY se activa modoBasico'
    );
    asegurar(
      Array.isArray(dataFallback.datos?.productos) &&
        dataFallback.datos.productos.some(
          (productoActual: any) => productoActual.slug === `asistente-prueba-${sufijo}`
        ),
      'El fallback recomienda el producto real con stock'
    );
    asegurar(
      !dataFallback.datos.productos.some(
        (productoActual: any) => productoActual.slug === `asistente-agotado-${sufijo}`
      ),
      'El grounding excluye productos sin stock'
    );
    asegurar(
      !dataFallback.datos.productos.some(
        (productoActual: any) =>
          productoActual.slug === `asistente-inactivo-${sufijo}`
      ),
      'El grounding excluye productos inactivos'
    );
    asegurar(
      dataFallback.datos.slugsRecomendados.every(
        (slug: string) =>
          dataFallback.datos.productos.some(
            (productoActual: any) => productoActual.slug === slug
          )
      ),
      'Los slugs recomendados pertenecen a productos devueltos'
    );

    process.env.GEMINI_API_KEY = 'clave-prueba';
    const fetchOriginal = global.fetch;
    global.fetch = async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        respuesta: 'Te recomiendo una opcion del catalogo real.',
                        slugsRecomendados: [
                          `asistente-prueba-${sufijo}`,
                          'slug-inventado-que-no-existe'
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return fetchOriginal(input, init);
    };

    try {
      const resGemini = await postAsistente({ mensaje: 'Hidratante para piel seca' });
      const dataGemini = (await resGemini.json()) as any;
      asegurar(resGemini.status === 200, 'La ruta Gemini simulada responde 200');
      asegurar(
        dataGemini.datos?.modoBasico === false,
        'Con Gemini disponible modoBasico es false'
      );
      asegurar(
        dataGemini.datos.slugsRecomendados.length === 1 &&
          dataGemini.datos.slugsRecomendados[0] === `asistente-prueba-${sufijo}`,
        'Los slugs inventados por Gemini se filtran contra la BD'
      );
    } finally {
      global.fetch = fetchOriginal;
    }

    process.env.GEMINI_API_KEY = 'clave-prueba';
    const fetchOriginalFallo = global.fetch;
    global.fetch = async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes('generativelanguage.googleapis.com')) {
        throw new Error('Falla de red simulada');
      }
      return fetchOriginalFallo(input, init);
    };

    try {
      const resFallo = await postAsistente({ mensaje: 'Hidratante para piel seca' });
      const dataFallo = (await resFallo.json()) as any;
      asegurar(
        resFallo.status === 200 && dataFallo.datos?.modoBasico === true,
        'Un fallo de Gemini activa el fallback sin error 500'
      );
    } finally {
      global.fetch = fetchOriginalFallo;
    }

    delete process.env.GEMINI_API_KEY;
    let recibioLimite = false;
    let respuestaLimite = '';
    for (let intento = 0; intento < 20; intento++) {
      const respuesta = await postAsistente({
        mensaje: 'Hidratante para piel seca'
      });
      if (respuesta.status === 429) {
        recibioLimite = true;
        const datos = (await respuesta.json()) as any;
        respuestaLimite = String(datos.error || '');
        break;
      }
    }
    asegurar(recibioLimite, 'El rate limit bloquea consultas excesivas (429)');
    asegurar(
      respuestaLimite.includes('Demasiadas consultas'),
      'El rate limit devuelve un mensaje claro'
    );

    console.log(`\nResultado final del asistente: ${exitos} aprobadas, ${fallos} fallidas.`);
  } catch (error) {
    console.error('Error critico en pruebas del asistente:', error);
    fallos++;
  } finally {
    if (claveOriginal === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = claveOriginal;
    }

    try {
      if (productoId) {
        await consultar(
          'DELETE FROM movimientos_inventario WHERE variante_id IN ' +
            '(SELECT id FROM variantes WHERE producto_id = $1)',
          [productoId]
        );
        await consultar('DELETE FROM variantes WHERE producto_id = $1', [productoId]);
        await consultar('DELETE FROM productos WHERE id = $1', [productoId]);
      }
      if (productoAgotadoId) {
        await consultar(
          'DELETE FROM variantes WHERE producto_id = $1',
          [productoAgotadoId]
        );
        await consultar('DELETE FROM productos WHERE id = $1', [
          productoAgotadoId
        ]);
      }
      if (productoInactivoId) {
        await consultar(
          'DELETE FROM variantes WHERE producto_id = $1',
          [productoInactivoId]
        );
        await consultar('DELETE FROM productos WHERE id = $1', [
          productoInactivoId
        ]);
      }
    } catch (error) {
      console.error('Error durante la limpieza del asistente:', error);
    }

    server.close(async () => {
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  }
}

ejecutarPruebas();
