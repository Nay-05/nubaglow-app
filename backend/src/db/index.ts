/**
 * ============================================================================
 * NUBAGLOW APP - MODULO DE CONEXION A BASE DE DATOS (PostgreSQL / Supabase)
 * ============================================================================
 * 
 * Explicacion para la defensa:
 * Este modulo centraliza todas las conexiones hacia la base de datos PostgreSQL
 * alojada en Supabase. Utiliza un "Pool de conexiones" que permite reutilizar
 * sockets abiertos para atender multiples peticiones concurrentes sin agotar
 * los recursos del servidor.
 * 
 * Cumple con dos reglas obligatorias de CLAUDE.md:
 * 1. Consultas 100% parametrizadas (anti inyeccion SQL mediante $1, $2...).
 * 2. Transacciones SQL atomicas (BEGIN / COMMIT / ROLLBACK) para asegurar que si
 *    un paso falla (ej. descuento de stock o creacion de pedido), NADA quede a medias.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde la raiz o desde backend/
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const connectionString = process.env.DATABASE_URL;

// Configuracion del Pool de conexiones de PostgreSQL
export const pool = new Pool({
  connectionString: connectionString || undefined,
  // Supabase requiere conexion SSL cifrada para comunicarse en la nube
  ssl: process.env.NODE_ENV === 'test' ? false : { rejectUnauthorized: false },
  max: 10, // Maximo de conexiones simultaneas en el pool
  idleTimeoutMillis: 30000, // Cerrar conexiones inactivas tras 30 segundos
  connectionTimeoutMillis: 10000 // Esperar maximo 10 segundos para conectar
});

// Evento: Alerta en caso de error inesperado en una conexion inactiva del pool
pool.on('error', (err) => {
  console.error('Error imprevisto en el pool de PostgreSQL:', err.message);
});

/**
 * Ejecuta una consulta SQL parametrizada de manera segura.
 * 
 * @param textoSQL Sentencia SQL con marcadores ($1, $2, etc.)
 * @param parametros Array de valores que reemplazan a los marcadores
 * @returns Promesa con el resultado de la consulta
 * 
 * Ejemplo de uso:
 * const res = await consultar('SELECT * FROM productos WHERE id = $1', [id]);
 */
export async function consultar<T extends QueryResultRow = any>(
  textoSQL: string,
  parametros?: any[]
): Promise<QueryResult<T>> {
  const inicio = Date.now();
  try {
    const resultado = await pool.query<T>(textoSQL, parametros);
    const duracion = Date.now() - inicio;
    if (process.env.DEBUG_SQL === 'true') {
      console.log(`[SQL] Ejecutado en ${duracion}ms:`, textoSQL.substring(0, 100));
    }
    return resultado;
  } catch (error: any) {
    console.error('Error al ejecutar consulta SQL:', {
      mensaje: error.message,
      consulta: textoSQL.substring(0, 120),
      parametros
    });
    throw error;
  }
}

/**
 * Helper para ejecutar una transaccion SQL atomica reutilizable.
 * 
 * Explicacion para la defensa:
 * Cuando se procesa una compra o una venta POS, intervienen multiples tablas:
 * 1. Verificar stock con bloqueo (SELECT FOR UPDATE)
 * 2. Descontar inventario
 * 3. Registrar el pedido y sus items
 * 4. Registrar el pago y el evento de envio inicial
 * 
 * Si cualquiera de esos pasos falla, esta funcion ejecuta 'ROLLBACK' de forma
 * automatica, devolviendo la base de datos a su estado original para evitar
 * inconsistencias o perdida de mercaderia. Si todo concluye con exito, ejecuta 'COMMIT'.
 * 
 * @param operacion Funcion asincrona que recibe el cliente de conexion dedicado
 */
export async function conTransaccion<T>(
  operacion: (cliente: PoolClient) => Promise<T>
): Promise<T> {
  const cliente = await pool.connect();
  try {
    // 1. Iniciar el bloque de transaccion
    await cliente.query('BEGIN');

    // 2. Ejecutar la logica de negocio
    const resultado = await operacion(cliente);

    // 3. Confirmar y persistir todos los cambios de forma atomica
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    // 4. Si ocurrio cualquier excepcion, deshacer todos los cambios
    await cliente.query('ROLLBACK');
    console.error('Transaccion cancelada (ROLLBACK ejecutado debido a error):', error);
    throw error;
  } finally {
    // 5. Devolver siempre la conexion al pool para que otro cliente pueda usarla
    cliente.release();
  }
}

/**
 * Cierra limpiamente el pool de conexiones (usado en scripts de seed/migracion o tests)
 */
export async function cerrarPool(): Promise<void> {
  await pool.end();
}
