/**
 * ============================================================================
 * NUBAGLOW APP - SCRIPT DE MIGRACION DE BASE DE DATOS
 * ============================================================================
 * Ejecuta el esquema versionado (schema.sql) contra la base de datos de Supabase.
 * Es idempotente: puede correrse multiples veces sin borrar datos ni fallar.
 */

import fs from 'fs';
import path from 'path';
import { pool, consultar, cerrarPool } from './index';

async function ejecutarMigracion() {
  console.log('------------------------------------------------------------');
  console.log('Iniciando migracion de base de datos NubaGlow (schema.sql)...');
  console.log('------------------------------------------------------------');

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: No se encontro la variable DATABASE_URL en el archivo .env');
    console.error('Por favor configura DATABASE_URL con tu cadena de conexion de Supabase.');
    process.exit(1);
  }

  const rutaSchema = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(rutaSchema)) {
    console.error(`ERROR: No se encontro el archivo de esquema en: ${rutaSchema}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(rutaSchema, 'utf-8');

  try {
    // 1. Probar conectividad con Supabase
    const infoConexion = await consultar('SELECT current_database(), current_user, version()');
    console.log(`Conectado a PostgreSQL: ${infoConexion.rows[0].current_database} (Usuario: ${infoConexion.rows[0].current_user})`);

    // 2. Ejecutar el esquema completo
    await consultar(sql);
    console.log('Esquema schema.sql ejecutado correctamente.');

    // 3. Verificar que las 18 tablas existen
    const consultaTablas = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const resTablas = await consultar(consultaTablas);
    const tablasEncontradas = resTablas.rows.map(r => r.table_name);

    console.log(`\nTablas verificadas en la base de datos (${tablasEncontradas.length} tablas):`);
    tablasEncontradas.forEach((nombre, idx) => {
      console.log(`  ${idx + 1}. ${nombre}`);
    });

    console.log('\nMigracion completada exitosamente.');
  } catch (error: any) {
    console.error('\nERROR durante la migracion:', error.message);
    process.exit(1);
  } finally {
    await cerrarPool();
  }
}

ejecutarMigracion();
