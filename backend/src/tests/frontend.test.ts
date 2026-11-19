/**
 * ============================================================================
 * NUBAGLOW APP - PRUEBAS DEL FRONTEND MODULAR (FASE 4)
 * ============================================================================
 * Detecta errores que una prueba HTTP simple no ve: el navegador carga los
 * modulos ES y, si una ruta de import esta mal, el fallback SPA devolvia
 * index.html con Content-Type text/html. Esta suite:
 * 1. Recorre todos los imports de js/ y comprueba que el archivo existe.
 * 2. Verifica que index.html cargue /js/app.js con ruta absoluta.
 * 3. Analiza la sintaxis de TODOS los modulos como ES reales con
 *    `node --check` sobre copias .mjs, e incluye un control negativo.
 * 4. Recorre el grafo de modulos de /, /catalogo, /login y /staff/login como
 *    un navegador: cada import debe responder 200 y Content-Type JavaScript.
 * 5. Exige 404 real (no index.html) para rutas de archivo inexistentes.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import app from '../index';
import { cerrarPool } from '../db';

const raizProyecto = path.resolve(__dirname, '..', '..', '..');
const carpetaJs = path.join(raizProyecto, 'js');
const archivoIndex = path.join(raizProyecto, 'index.html');

const REGEX_IMPORT_ESTATICO = /^\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
const REGEX_IMPORT_DINAMICO = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REGEX_SCRIPT_MODULE = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i;

interface ArchivoModulo {
  absoluto: string;
  relativo: string;
  url: string;
}

function listarModulos(directorio: string): ArchivoModulo[] {
  const modulos: ArchivoModulo[] = [];

  const recorrer = (actual: string) => {
    for (const entrada of fs.readdirSync(actual, { withFileTypes: true })) {
      const rutaCompleta = path.join(actual, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(rutaCompleta);
      } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
        const relativo = path.relative(raizProyecto, rutaCompleta).split(path.sep).join('/');
        modulos.push({
          absoluto: rutaCompleta,
          relativo,
          url: `/${relativo}`
        });
      }
    }
  };

  recorrer(directorio);
  return modulos;
}

function extraerImports(contenido: string): string[] {
  const encontrados = new Set<string>();
  for (const regex of [REGEX_IMPORT_ESTATICO, REGEX_IMPORT_DINAMICO]) {
    regex.lastIndex = 0;
    let coincidencia: RegExpExecArray | null;
    while ((coincidencia = regex.exec(contenido)) !== null) {
      encontrados.add(coincidencia[1]);
    }
  }
  return Array.from(encontrados);
}

function resolverUrlModulo(urlBase: string, especificador: string): string {
  if (especificador.startsWith('/')) return especificador;
  if (especificador.startsWith('.')) {
    return new URL(especificador, `http://localhost${urlBase}`).pathname;
  }
  return especificador;
}

function resolverRutaFs(url: string): string {
  const segmentos = url.split('/').filter(Boolean);
  return path.join(raizProyecto, ...segmentos);
}

function esArchivoExistente(ruta: string): boolean {
  try {
    return fs.statSync(ruta).isFile();
  } catch {
    return false;
  }
}

interface ResultadoSintaxis {
  relativo: string;
  valido: boolean;
  detalle: string;
}

function ejecutarNodeCheck(ruta: string): { estado: number | null; salida: string } {
  const resultado = spawnSync(process.execPath, ['--check', ruta], {
    encoding: 'utf8'
  });

  return {
    estado: resultado.status,
    salida: `${resultado.stderr || ''}${resultado.stdout || ''}`.trim()
  };
}

/**
 * Copia cada .js a un .mjs temporal y lo analiza con `node --check`.
 * Copiar a .mjs garantiza que Node los parsee como modulos ES (import/export).
 */
function verificarSintaxisModulos(modulos: ArchivoModulo[]): ResultadoSintaxis[] {
  const directorioTemporal = fs.mkdtempSync(
    path.join(os.tmpdir(), 'nubaglow-sintaxis-')
  );
  const resultados: ResultadoSintaxis[] = [];

  try {
    for (const modulo of modulos) {
      const nombre = modulo.relativo.replace(/\.js$/, '.mjs').replace(/[\\/]/g, '__');
      const destino = path.join(directorioTemporal, nombre);
      fs.copyFileSync(modulo.absoluto, destino);

      const verificacion = ejecutarNodeCheck(destino);
      resultados.push({
        relativo: modulo.relativo,
        valido: verificacion.estado === 0,
        detalle: verificacion.salida
      });
    }
  } finally {
    fs.rmSync(directorioTemporal, { recursive: true, force: true });
  }

  return resultados;
}

/** Demuestra que el chequeo realmente falla ante un error de sintaxis. */
function controlNegativoSintaxis(): { detectado: boolean; salida: string } {
  const directorioTemporal = fs.mkdtempSync(
    path.join(os.tmpdir(), 'nubaglow-control-negativo-')
  );

  try {
    const archivoRoto = path.join(directorioTemporal, 'roto.mjs');
    fs.writeFileSync(archivoRoto, 'const respuesta = );\n');

    const verificacion = ejecutarNodeCheck(archivoRoto);
    return {
      detectado: verificacion.estado !== 0,
      salida: verificacion.salida
    };
  } finally {
    fs.rmSync(directorioTemporal, { recursive: true, force: true });
  }
}

async function recorrerGrafoModulos(
  baseUrl: string,
  urlModulo: string,
  visitados: Set<string>,
  errores: string[]
): Promise<void> {
  if (visitados.has(urlModulo)) return;
  visitados.add(urlModulo);

  const respuesta = await fetch(`${baseUrl}${urlModulo}`);
  if (respuesta.status !== 200) {
    errores.push(`${urlModulo} -> HTTP ${respuesta.status}`);
    return;
  }

  const tipoContenido = respuesta.headers.get('content-type') || '';
  if (!tipoContenido.toLowerCase().includes('javascript')) {
    errores.push(`${urlModulo} -> Content-Type '${tipoContenido}' (se esperaba JavaScript)`);
    return;
  }

  const contenido = await respuesta.text();
  for (const especificador of extraerImports(contenido)) {
    const urlDependencia = resolverUrlModulo(urlModulo, especificador);
    await recorrerGrafoModulos(baseUrl, urlDependencia, visitados, errores);
  }
}

function extraerScriptModule(html: string): string {
  const coincidencia = REGEX_SCRIPT_MODULE.exec(html);
  return coincidencia ? coincidencia[1] : '';
}

async function ejecutarPruebas() {
  console.log('Iniciando suite de pruebas automatizadas: Frontend modular (Fase 4)...');

  const servidor = app.listen(0);
  const direccion = servidor.address() as any;
  const baseUrl = `http://localhost:${direccion.port}`;

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

  try {
    // ------------------------------------------------------------------------
    // 1. index.html debe cargar el entrypoint con ruta absoluta
    // ------------------------------------------------------------------------
    const htmlIndex = fs.readFileSync(archivoIndex, 'utf8');
    const entradaHtml = extraerScriptModule(htmlIndex);
    asegurar(entradaHtml === '/js/app.js', `index.html carga '/js/app.js' con ruta absoluta (encontrado: '${entradaHtml}')`);

    // ------------------------------------------------------------------------
    // 2. Cada import de js/ debe apuntar a un archivo existente
    // ------------------------------------------------------------------------
    const modulos = listarModulos(carpetaJs);
    asegurar(modulos.length > 0, `Se encontraron ${modulos.length} modulos JavaScript en js/`);

    for (const modulo of modulos) {
      const contenido = fs.readFileSync(modulo.absoluto, 'utf8');
      const especificadores = extraerImports(contenido);
      const errores: string[] = [];

      for (const especificador of especificadores) {
        if (!especificador.startsWith('.') && !especificador.startsWith('/')) {
          errores.push(`${especificador} (import desnudo no permitido)`);
          continue;
        }
        const url = resolverUrlModulo(modulo.url, especificador);
        if (!esArchivoExistente(resolverRutaFs(url))) {
          errores.push(`${especificador} -> ${url} (no existe)`);
        }
      }

      asegurar(
        errores.length === 0,
        `${modulo.relativo}: ${especificadores.length} import(s) resuelven a archivos existentes`
      );
      for (const error of errores) console.error(`       Detalle: ${error}`);
    }

    // ------------------------------------------------------------------------
    // 3. Analisis real de sintaxis ES de todos los modulos (node --check)
    // ------------------------------------------------------------------------
    const resultadosSintaxis = verificarSintaxisModulos(modulos);
    const modulosConError = resultadosSintaxis.filter((r) => !r.valido);

    asegurar(
      modulosConError.length === 0,
      `Sintaxis ES valida en los ${resultadosSintaxis.length} modulos de js/ (node --check sobre copias .mjs)`
    );
    for (const resultado of modulosConError) {
      const lineas = resultado.detalle
        .split('\n')
        .map((linea) => linea.trim())
        .filter((linea) => linea.length > 0);
      console.error(`       Detalle: ${resultado.relativo} -> ${lineas.join(' | ')}`);
    }

    const controlNegativo = controlNegativoSintaxis();
    asegurar(
      controlNegativo.detectado,
      'El chequeo de sintaxis detecta un error introducido a propósito (control negativo)'
    );
    if (!controlNegativo.detectado) {
      console.error(`       Detalle: ${controlNegativo.salida}`);
    }

    // ------------------------------------------------------------------------
    // 4. Simular la carga del navegador en cada ruta de entrada
    // ------------------------------------------------------------------------
    const rutas = ['/', '/catalogo', '/login', '/staff/login'];

    for (const ruta of rutas) {
      const respuesta = await fetch(`${baseUrl}${ruta}`);
      const html = await respuesta.text();
      const script = extraerScriptModule(html);

      asegurar(respuesta.status === 200, `${ruta} responde 200 HTML (SPA servida)`);
      asegurar(
        script.startsWith('/js/'),
        `${ruta} referencia el entrypoint con ruta absoluta (${script || 'sin script module'})`
      );

      if (!script.startsWith('/js/')) continue;

      const erroresGrafo: string[] = [];
      const visitados = new Set<string>();
      await recorrerGrafoModulos(baseUrl, script, visitados, erroresGrafo);

      asegurar(
        erroresGrafo.length === 0,
        `${ruta}: los ${visitados.size} modulos del grafo responden 200 con Content-Type JavaScript`
      );
      for (const error of erroresGrafo) console.error(`       Detalle: ${error}`);
    }

    // ------------------------------------------------------------------------
    // 5. El fallback SPA no debe disfrazar archivos inexistentes con HTML
    // ------------------------------------------------------------------------
    const respuestaJsFaltante = await fetch(`${baseUrl}/js/core/archivo-inexistente.js`);
    const tipoJsFaltante = respuestaJsFaltante.headers.get('content-type') || '';
    asegurar(
      respuestaJsFaltante.status === 404,
      'Un modulo .js inexistente devuelve 404 real (no index.html)'
    );
    asegurar(
      !tipoJsFaltante.toLowerCase().includes('text/html'),
      `El 404 de un .js inexistente no se sirve como HTML (${tipoJsFaltante})`
    );

    const respuestaAssetFaltante = await fetch(`${baseUrl}/assets/brand/no-existe.png`);
    asegurar(
      respuestaAssetFaltante.status === 404,
      'Un asset .png inexistente devuelve 404 real (no index.html)'
    );

    const respuestaSpa = await fetch(`${baseUrl}/catalogo`);
    const tipoSpa = respuestaSpa.headers.get('content-type') || '';
    asegurar(
      respuestaSpa.status === 200 && tipoSpa.toLowerCase().includes('text/html'),
      'Una ruta SPA sin extension sigue devolviendo index.html (F5 funciona)'
    );

    console.log(`\n============================================================`);
    console.log(`Resultado final de la suite Frontend: ${exitos} aprobadas, ${fallos} fallidas.`);
    console.log(`============================================================\n`);

    servidor.close(async () => {
      await cerrarPool();
      process.exit(fallos > 0 ? 1 : 0);
    });
  } catch (error) {
    console.error('Error critico durante la suite Frontend:', error);
    servidor.close(async () => {
      await cerrarPool();
      process.exit(1);
    });
  }
}

ejecutarPruebas();
