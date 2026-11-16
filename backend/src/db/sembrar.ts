/**
 * ============================================================================
 * NUBAGLOW APP - SCRIPT DE POBLADO DE BASE DE DATOS (SEED)
 * ============================================================================
 * Inserta los datos maestros de prueba:
 * - 4 Usuarios correspondientes a los 4 roles RBAC (admin, operaciones, vendedor, cliente)
 *   con contrasenas hasheadas con bcrypt (coste >= 12). Las contrasenas se imprimen
 *   exclusivamente en la terminal y se guardan en el archivo local 'seed_passwords.txt'
 *   (ignorado por git).
 * - 6 Categorias oficiales de belleza.
 * - 32 Productos realistas de skincare y maquillaje con ingredientes, modo de uso y tipo de piel.
 * - Variantes con SKU, precio individual en Bs. y control de stock / reorden.
 * - Imagenes de producto asociadas.
 * - Resenas de clientes verificados y pedidos demo con trazabilidad NB-2026-XXXX.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { consultar, conTransaccion, cerrarPool } from './index';

// Genera una contrasena segura que cumple con la politica (8+ caracteres, mayuscula, numero)
function generarPasswordSegura(prefijo: string): string {
  const aleatorio = crypto.randomBytes(3).toString('hex');
  return `${prefijo.charAt(0).toUpperCase() + prefijo.slice(1)}!${aleatorio}26`;
}

async function sembrarBaseDeDatos() {
  console.log('============================================================');
  console.log('Iniciando poblado de datos iniciales (seed) para NubaGlow...');
  console.log('============================================================');

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: Falta DATABASE_URL en el archivo .env');
    process.exit(1);
  }

  // Generar contrasenas para los 4 roles (sin exponerlas en git ni en el codigo fuente)
  const cuentas = [
    {
      nombre: 'Administradora Nuba',
      email: 'admin@nuba.bo',
      rol: 'admin',
      passwordPlana: generarPasswordSegura('admin')
    },
    {
      nombre: 'Operaciones y Almacen Nuba',
      email: 'operaciones@nuba.bo',
      rol: 'operaciones',
      passwordPlana: generarPasswordSegura('operaciones')
    },
    {
      nombre: 'Vendedor Mostrador Nuba',
      email: 'vendedor@nuba.bo',
      rol: 'vendedor',
      passwordPlana: generarPasswordSegura('vendedor')
    },
    {
      nombre: 'Camila Morales (Cliente)',
      email: 'cliente@nuba.bo',
      rol: 'cliente',
      passwordPlana: generarPasswordSegura('cliente')
    }
  ];

  await conTransaccion(async (cliente) => {
    // ------------------------------------------------------------------------
    // 1. USUARIOS (4 Roles RBAC)
    // ------------------------------------------------------------------------
    console.log('\n1. Creando usuarios de prueba por rol con bcrypt (coste 12)...');
    const bcyrptRounds = 12;

    for (const cuenta of cuentas) {
      const hash = bcrypt.hashSync(cuenta.passwordPlana, bcyrptRounds);
      await cliente.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (email) DO UPDATE 
         SET nombre = EXCLUDED.nombre, password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol;`,
        [cuenta.nombre, cuenta.email, hash, cuenta.rol]
      );
    }

    // ------------------------------------------------------------------------
    // 2. CATEGORIAS (6 Categorias)
    // ------------------------------------------------------------------------
    console.log('2. Creando categorias de catalogo...');
    const categorias = [
      {
        nombre: 'Serums y Tratamientos',
        slug: 'serums-tratamientos',
        descripcion: 'Formulas dermocosmeticas concentradas con activos cientificamente probados para iluminar, reparar y transformar la piel.'
      },
      {
        nombre: 'Limpieza Facial',
        slug: 'limpieza-facial',
        descripcion: 'Geles, espumas y balsamos con pH fisiologico para remover impurezas sin alterar la barrera cutanea.'
      },
      {
        nombre: 'Hidratacion y Barrera',
        slug: 'hidratacion-barrera',
        descripcion: 'Cremas restauradoras y emulsiones enriquecidas con ceramidas, acidos grasos y escualano.'
      },
      {
        nombre: 'Proteccion Solar',
        slug: 'proteccion-solar',
        descripcion: 'Filtros solares minerales y quimicos de amplio espectro UVA/UVB adaptados al clima y altura de Bolivia.'
      },
      {
        nombre: 'Maquillaje de Rostro',
        slug: 'maquillaje-rostro',
        descripcion: 'Bases hibridas, correctores y rubores modulables que perfeccionan el rostro cuidando la salud cutanea.'
      },
      {
        nombre: 'Labios y Ojos',
        slug: 'labios-ojos',
        descripcion: 'Balsamos nutritivos, labiales satinados, mascaras y paletas de sombras con pigmentos de alta pureza.'
      }
    ];

    const mapaCategorias: Record<string, number> = {};
    for (const cat of categorias) {
      const res = await cliente.query(
        `INSERT INTO categorias (nombre, slug, descripcion)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion
         RETURNING id;`,
        [cat.nombre, cat.slug, cat.descripcion]
      );
      mapaCategorias[cat.slug] = res.rows[0].id;
    }

    // ------------------------------------------------------------------------
    // 3. PRODUCTOS Y VARIANTES (32 Productos)
    // ------------------------------------------------------------------------
    console.log('3. Creando 32 productos y sus variantes individuales...');

    const productosData = [
      // CATEGORIA: Serums y Tratamientos (5)
      {
        catSlug: 'serums-tratamientos',
        nombre: 'Serum Glow Vitamina C 15% + Acido Ferulico',
        slug: 'serum-vitamina-c-15-ferulico',
        marca: 'Nuba Skin',
        tipoPiel: 'Todo tipo',
        descripcion: 'Potente antioxidante diurno que ilumina la piel, atenua manchas pigmentarias y protege contra la radiacion ambiental.',
        ingredientes: 'Aqua, 3-O-Ethyl Ascorbic Acid (15%), Ferulic Acid (0.5%), Hyaluronic Acid, Tocopherol (Vitamina E), Propanediol.',
        modoUso: 'Aplicar 4 a 5 gotas por la manana sobre piel limpia y seca. Continuar con crema hidratante y protector solar.',
        variantes: [
          { sku: 'NS-VITC-30ML', nombre: 'Frasco Gotero 30 ml', precio: 145.00, stock: 18, puntoReorden: 5 },
          { sku: 'NS-VITC-50ML', nombre: 'Frasco Gotero 50 ml', precio: 195.00, stock: 10, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'serums-tratamientos',
        nombre: 'Serum Acido Hialuronico Multi-Molecular 2% + B5',
        slug: 'serum-acido-hialuronico-multi-molecular-b5',
        marca: 'Nuba Skin',
        tipoPiel: 'Seca',
        descripcion: 'Complejo de 4 pesos moleculares de acido hialuronico que penetra en multiples capas epidermicas reteniendo hidratacion.',
        ingredientes: 'Aqua, Sodium Hyaluronate, Panthenol (Provitamina B5), Glycerin, Pentylene Glycol, Ethylhexylglycerin.',
        modoUso: 'Aplicar 3 gotas sobre rostro ligeramente humedo, manana y noche, antes de cremas o aceites.',
        variantes: [
          { sku: 'NS-HA-30ML', nombre: 'Frasco 30 ml', precio: 120.00, stock: 24, puntoReorden: 6 },
          { sku: 'NS-HA-60ML', nombre: 'Frasco 60 ml', precio: 175.00, stock: 12, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'serums-tratamientos',
        nombre: 'Serum Niacinamida 10% + Zinc PCA 1%',
        slug: 'serum-niacinamida-10-zinc-pca',
        marca: 'Nuba Skin',
        tipoPiel: 'Grasa',
        descripcion: 'Regula la secrecion sebacea, disminuye la apariencia de poros dilatados y fortalece la tolerancia epidermica.',
        ingredientes: 'Aqua, Niacinamide (10%), Zinc PCA (1%), Dimethyl Isosorbide, Tamarindus Indica Seed Polysaccharide, Phenoxyethanol.',
        modoUso: 'Aplicar 3 a 4 gotas manana y noche sobre piel limpia. Evitar combinar en la misma rutina con Acido Ascorbico puro.',
        variantes: [
          { sku: 'NS-NIA-30ML', nombre: 'Frasco 30 ml', precio: 95.00, stock: 20, puntoReorden: 5 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'serums-tratamientos',
        nombre: 'Serum Retinol Puro 0.3% Renovador Nocturno',
        slug: 'serum-retinol-puro-03-nocturno',
        marca: 'Nuba Skin',
        tipoPiel: 'Todo tipo',
        descripcion: 'Tratamiento nocturno antiedad que estimula el recambio celular, alisa lineas finas y mejora la textura cutanea.',
        ingredientes: 'Caprylic/Capric Triglyceride, Squalane, Retinol (0.3%), Bisabolol, BHT, Simmondsia Chinensis Seed Oil.',
        modoUso: 'Uso exclusivo nocturno. Iniciar 2 noches por semana y aumentar progresivamente. Uso obligatorio de protector solar diurno.',
        variantes: [
          { sku: 'NS-RET-30ML', nombre: 'Frasco Opaco 30 ml', precio: 160.00, stock: 8, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'serums-tratamientos',
        nombre: 'Serum Descongestivo Acido Salicilico BHA 2%',
        slug: 'serum-acido-salicilico-bha-2',
        marca: 'Nuba Skin',
        tipoPiel: 'Grasa',
        descripcion: 'Exfoliante quimico liposoluble que penetra dentro de los poros disolviendo el exceso de grasa y puntos negros.',
        ingredientes: 'Aqua, Cocamidopropyl Dimethylamine, Salicylic Acid (2%), Hydroxyethylcellulose, Polysorbate 20, Citric Acid.',
        modoUso: 'Aplicar por la noche sobre zonas propensas a comedones o brotes. Limitar a 3 veces por semana.',
        variantes: [
          { sku: 'NS-BHA-30ML', nombre: 'Frasco 30 ml', precio: 110.00, stock: 15, puntoReorden: 5 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },

      // CATEGORIA: Limpieza Facial (5)
      {
        catSlug: 'limpieza-facial',
        nombre: 'Gel Limpiador Purificante con Acido Salicilico',
        slug: 'gel-limpiador-purificante-acido-salicilico',
        marca: 'Nuba Skin',
        tipoPiel: 'Grasa',
        descripcion: 'Espuma suave de limpieza profunda que retira impurezas sin deshidratar ni provocar efecto rebote de brillo.',
        ingredientes: 'Aqua, Sodium Cocoyl Isethionate, Glycerin, Salicylic Acid (1%), Melaleuca Alternifolia Leaf Oil, Chamomilla Recutita Extract.',
        modoUso: 'Emulsionar una pulsacion con agua en las palmas, masajear en rostro durante 60 segundos y aclarar con agua tibia.',
        variantes: [
          { sku: 'NS-GEL-200ML', nombre: 'Botella con Dispensador 200 ml', precio: 95.00, stock: 14, puntoReorden: 5 },
          { sku: 'NS-GEL-400ML', nombre: 'Tamano Ahorro 400 ml', precio: 150.00, stock: 7, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'limpieza-facial',
        nombre: 'Espuma Limpiadora Calmante Centella Asiatica',
        slug: 'espuma-limpiadora-calmante-centella-asiatica',
        marca: 'Nuba Skin',
        tipoPiel: 'Sensible',
        descripcion: 'Textura suave en nube que limpia delicadamente pieles reactivas, rojeces o alteradas tras tratamientos clinicos.',
        ingredientes: 'Centella Asiatica Leaf Water (45%), Aqua, Coco-Betaine, Disodium Cocoamphodiacetate, Allantoin, Madecassoside.',
        modoUso: 'Aplicar 2 pulsaciones sobre rostro humedo, masajear con suavidad y enjuagar abundantemente.',
        variantes: [
          { sku: 'NS-ESP-150ML', nombre: 'Envase Espumador 150 ml', precio: 110.00, stock: 16, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'limpieza-facial',
        nombre: 'Aceite Limpiador Desmaquillante Nutritivo',
        slug: 'aceite-limpiador-desmaquillante-nutritivo',
        marca: 'Nuba Skin',
        tipoPiel: 'Todo tipo',
        descripcion: 'Aceite hidrofilo de primera limpieza que emulsiona en leche al contacto con agua, disolviendo maquillaje waterproof y SPF.',
        ingredientes: 'Helianthus Annuus Seed Oil, PEG-20 Glyceryl Triisostearate, Simmondsia Chinensis Seed Oil, Prunus Amygdalus Dulcis Oil, Tocopherol.',
        modoUso: 'Aplicar sobre rostro seco con maquillaje, masajear en circulos, agregar agua para emulsionar y retirar con agua tibia.',
        variantes: [
          { sku: 'NS-OIL-150ML', nombre: 'Botella 150 ml', precio: 130.00, stock: 11, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'limpieza-facial',
        nombre: 'Balsamo Limpiador de Avena y Escualano',
        slug: 'balsamo-limpiador-avena-escualano',
        marca: 'Nuba Skin',
        tipoPiel: 'Seca',
        descripcion: 'Balsamo untuoso con avena coloidal y escualano vegetal que reconforta pieles secas y deshidratadas desde la limpieza.',
        ingredientes: 'Prunus Amygdalus Dulcis Oil, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Avena Sativa Kernel Flour, Squalane.',
        modoUso: 'Tomar la cantidad de una avellana, masajear en rostro seco y retirar con pano humedo o agua tibia.',
        variantes: [
          { sku: 'NS-BAL-100G', nombre: 'Tarro 100 g', precio: 125.00, stock: 9, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'limpieza-facial',
        nombre: 'Agua Micelar Calmante Agua de Rosas & Pantenol',
        slug: 'agua-micelar-calmante-rosas-pantenol',
        marca: 'Nuba Skin',
        tipoPiel: 'Sensible',
        descripcion: 'Solucion micelar que atrapa impurezas y maquillaje ligero respetando la flora cutanea, sin necesidad de aclarado forzoso.',
        ingredientes: 'Aqua, Rosa Damascena Flower Water, Poloxamer 184, Panthenol, Glycerin, Sodium Chloride, Disodium EDTA.',
        modoUso: 'Humedecer un disco de algodon y presionar suavemente sobre rostro, ojos y labios sin frotar agresivamente.',
        variantes: [
          { sku: 'NS-MIC-250ML', nombre: 'Botella 250 ml', precio: 75.00, stock: 22, puntoReorden: 6 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },

      // CATEGORIA: Hidratacion y Barrera (5)
      {
        catSlug: 'hidratacion-barrera',
        nombre: 'Crema Hidratante Ceramide Barrier Relief',
        slug: 'crema-hidratante-ceramide-barrier-relief',
        marca: 'Nuba Skin',
        tipoPiel: 'Seca',
        descripcion: 'Formula dermatologica con 3 ceramidas esenciales (1, 3, 6-II), acidos grasos y fitoesfingosina que repara la barrera cutanea.',
        ingredientes: 'Aqua, Glycerin, Caprylic/Capric Triglyceride, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol.',
        modoUso: 'Extender sobre rostro y cuello por la manana y por la noche como paso final de cuidado antes del protector solar.',
        variantes: [
          { sku: 'NS-CER-50G', nombre: 'Tubo 50 g', precio: 120.00, stock: 6, puntoReorden: 5 },
          { sku: 'NS-CER-100G', nombre: 'Tubo 100 g', precio: 180.00, stock: 12, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'hidratacion-barrera',
        nombre: 'Gel-Crema Hidratante Matificante Oil-Free',
        slug: 'gel-crema-hidratante-matificante-oil-free',
        marca: 'Nuba Skin',
        tipoPiel: 'Grasa',
        descripcion: 'Hidratacion liviana no comedogenica con acabado aterciopelado mate; no obstruye poros ni anade brillo.',
        ingredientes: 'Aqua, Dimethicone, Glycerin, Silica, Tapioca Starch, Niacinamide, Sodium Hyaluronate, Carbomer.',
        modoUso: 'Aplicar una pequena porcion sobre rostro limpio manana y noche. Excelente base previa al maquillaje.',
        variantes: [
          { sku: 'NS-GELC-50ML', nombre: 'Tubo Airless 50 ml', precio: 105.00, stock: 15, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'hidratacion-barrera',
        nombre: 'Crema Nutritiva de Noche con Peptidos de Cobre',
        slug: 'crema-nutritiva-noche-peptidos-cobre',
        marca: 'Nuba Skin',
        tipoPiel: 'Todo tipo',
        descripcion: 'Tratamiento nocturno regenerador con peptidos biometricos que refuerzan la firmeza y elasticidad mientras duermes.',
        ingredientes: 'Aqua, Butyrospermum Parkii Butter, Squalane, Copper Tripeptide-1, Palmitoyl Tripeptide-5, Niacinamide.',
        modoUso: 'Masajear sobre rostro limpio por la noche como ultimo paso de la rutina nocturna.',
        variantes: [
          { sku: 'NS-PEP-50ML', nombre: 'Tarro 50 ml', precio: 175.00, stock: 7, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'hidratacion-barrera',
        nombre: 'Tonico Hidratante y Equilibrante Niacinamida 5%',
        slug: 'tonico-hidratante-equilibrante-niacinamida-5',
        marca: 'Nuba Skin',
        tipoPiel: 'Mixta',
        descripcion: 'Locion refrescante que equilibra el pH tras la limpieza, suaviza la textura y prepara la piel para recibir los tratamientos.',
        ingredientes: 'Aqua, Rosa Centifolia Flower Water, Niacinamide (5%), Glycerin, Panthenol, Betaine, Sodium Hyaluronate.',
        modoUso: 'Dispensar unas gotas en las palmas y dar toques suaves sobre rostro y cuello. No requiere algodon.',
        variantes: [
          { sku: 'NS-TON-150ML', nombre: 'Frasco 150 ml', precio: 85.00, stock: 11, puntoReorden: 5 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'hidratacion-barrera',
        nombre: 'Mascarilla Nocturna Reparadora Cica & Alantoina',
        slug: 'mascarilla-nocturna-reparadora-cica-alantoina',
        marca: 'Nuba Skin',
        tipoPiel: 'Sensible',
        descripcion: 'Tratamiento intensivo en velo nocturno que calma quemaduras de sol, viento de altura y rojeces durante el descanso.',
        ingredientes: 'Aqua, Centella Asiatica Extract, Butylene Glycol, Allantoin, Trehalose, Madecassic Acid, Asiatic Acid.',
        modoUso: 'Aplicar una capa generosa 2 a 3 veces por semana antes de dormir. Enjuagar a la manana siguiente.',
        variantes: [
          { sku: 'NS-MASK-80ML', nombre: 'Tubo 80 ml', precio: 115.00, stock: 10, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },

      // CATEGORIA: Proteccion Solar (4)
      {
        catSlug: 'proteccion-solar',
        nombre: 'Protector Solar Toque Seco SPF 50+ Invisible',
        slug: 'protector-solar-toque-seco-spf-50-invisible',
        marca: 'Nuba Skin',
        tipoPiel: 'Todo tipo',
        descripcion: 'Alta proteccion solar de amplio espectro disenada para el clima y la radiacion UV de Sucre y los valles bolivianos. Acabado sedoso sin rastro blanco.',
        ingredientes: 'Aqua, Homosalate, Octocrylene, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Silica, Niacinamide.',
        modoUso: 'Aplicar uniformemente dos lineas en los dedos sobre rostro y cuello 15 minutos antes de la exposicion. Reaplicar cada 2 a 3 horas.',
        variantes: [
          { sku: 'NS-SPF-50ML', nombre: 'Tubo 50 ml', precio: 130.00, stock: 18, puntoReorden: 5 },
          { sku: 'NS-SPF-100ML', nombre: 'Tubo Familiar 100 ml', precio: 210.00, stock: 9, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'proteccion-solar',
        nombre: 'Protector Solar Mineral Calming SPF 50+ Oxido de Zinc',
        slug: 'protector-solar-mineral-calming-spf-50-zinc',
        marca: 'Nuba Skin',
        tipoPiel: 'Sensible',
        descripcion: 'Filtro solar 100% fisico con oxido de zinc no nano. Hipoalergenico y seguro para pieles reactivas, rosacea y ninos.',
        ingredientes: 'Zinc Oxide (21%), Aqua, Caprylic/Capric Triglyceride, C13-15 Alkane, Polyglyceryl-3 Polyricinoleate, Bisabolol.',
        modoUso: 'Extender de manera uniforme sobre rostro. Su textura adaptativa se difumina sin dejar efecto fantasma.',
        variantes: [
          { sku: 'NS-SPFMIN-50ML', nombre: 'Tubo 50 ml', precio: 145.00, stock: 12, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'proteccion-solar',
        nombre: 'Fluido Solar Matificante Ultra Ligero SPF 50+',
        slug: 'fluido-solar-matificante-ultra-ligero-spf-50',
        marca: 'Nuba Skin',
        tipoPiel: 'Grasa',
        descripcion: 'Emulsion ultra fluida con perlas matificantes que absorben la oleosidad ambiental manteniendo la piel fresca.',
        ingredientes: 'Aqua, Isododecane, Ethylhexyl Triazone, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol, Silica Silylate.',
        modoUso: 'Agitar antes de usar. Aplicar sobre el rostro antes de salir y reaplicar a mediodia.',
        variantes: [
          { sku: 'NS-SPFFLU-50ML', nombre: 'Frasco con Dosificador 50 ml', precio: 135.00, stock: 15, puntoReorden: 5 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'proteccion-solar',
        nombre: 'Bruma Solar Fijadora SPF 50 Reaplicacion Facial',
        slug: 'bruma-solar-fijadora-spf-50-reaplicacion',
        marca: 'Nuba Skin',
        tipoPiel: 'Todo tipo',
        descripcion: 'Bruma ultra fina en aerosol que permite reaplicar proteccion solar sobre el maquillaje sin necesidad de tocar el rostro.',
        ingredientes: 'Alcohol Denat., Butane, Isobutane, Octocrylene, Homosalate, Ethylhexyl Salicylate, Parfum.',
        modoUso: 'Cerrar ojos y boca, rociar a 20 cm de distancia del rostro realizando movimientos circulares continuos.',
        variantes: [
          { sku: 'NS-SPFMIST-75ML', nombre: 'Spray 75 ml', precio: 115.00, stock: 13, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },

      // CATEGORIA: Maquillaje de Rostro (6)
      {
        catSlug: 'maquillaje-rostro',
        nombre: 'Base Liquida Glow Serum Ligera SPF 20',
        slug: 'base-liquida-glow-serum-ligera-spf-20',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Base hibrida con cobertura modulable de ligera a media. Aporta luminosidad saludable imitando la textura natural de la piel.',
        ingredientes: 'Aqua, Cyclopentasiloxane, Ethylhexyl Methoxycinnamate, Niacinamide, Glycerin, Sodium Hyaluronate, Iron Oxides.',
        modoUso: 'Aplicar 1 a 2 pulsaciones en el centro del rostro y difuminar hacia afuera con brocha o esponja humeda.',
        variantes: [
          { sku: 'NG-BASE-100W', nombre: 'Tono 100W Calido Claro', precio: 160.00, stock: 8, puntoReorden: 3 },
          { sku: 'NG-BASE-120N', nombre: 'Tono 120N Neutro Claro', precio: 160.00, stock: 10, puntoReorden: 3 },
          { sku: 'NG-BASE-200C', nombre: 'Tono 200C Frio Medio', precio: 160.00, stock: 7, puntoReorden: 3 },
          { sku: 'NG-BASE-220W', nombre: 'Tono 220W Calido Medio', precio: 160.00, stock: 12, puntoReorden: 4 },
          { sku: 'NG-BASE-300N', nombre: 'Tono 300N Neutro Moreno', precio: 160.00, stock: 9, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'maquillaje-rostro',
        nombre: 'Base Mate Terciopelo Larga Duracion 24h',
        slug: 'base-mate-terciopelo-larga-duracion-24h',
        marca: 'Nuba Glow',
        tipoPiel: 'Grasa',
        descripcion: 'Cobertura completa transpirable con polimeros fijadores que resisten calor y humedad sin craquelarse.',
        ingredientes: 'Aqua, Dimethicone, Trimethylsiloxysilicate, Butylene Glycol, Talc, Silica, Peg-10 Dimethicone, CI 77891.',
        modoUso: 'Trabajar por sectores del rostro difuminando con rapidez con brocha tupida para un acabado profesional impecable.',
        variantes: [
          { sku: 'NG-BMAT-110N', nombre: 'Tono 110N Claro', precio: 165.00, stock: 9, puntoReorden: 3 },
          { sku: 'NG-BMAT-210W', nombre: 'Tono 210W Medio', precio: 165.00, stock: 11, puntoReorden: 4 },
          { sku: 'NG-BMAT-310C', nombre: 'Tono 310C Moreno', precio: 165.00, stock: 6, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'maquillaje-rostro',
        nombre: 'Corrector Hidratante Alta Cobertura Cafeina & Escualano',
        slug: 'corrector-hidratante-alta-cobertura-cafeina',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Descongestiona ojeras gracias a la cafeina activa mientras cubre imperfecciones sin marcar lineas de expresion.',
        ingredientes: 'Aqua, Isododecane, Dimethicone, Caffeine, Squalane, Tocopheryl Acetate, Triethoxycaprylylsilane.',
        modoUso: 'Aplicar dos puntos en el lagrimal y comisura exterior del ojo. Difuminar con yemas de los dedos o esponja suave.',
        variantes: [
          { sku: 'NG-CORR-FAIR', nombre: 'Tono Fair (Muy Claro)', precio: 95.00, stock: 14, puntoReorden: 4 },
          { sku: 'NG-CORR-LIGHT', nombre: 'Tono Light (Claro)', precio: 95.00, stock: 18, puntoReorden: 5 },
          { sku: 'NG-CORR-MED', nombre: 'Tono Medium (Medio)', precio: 95.00, stock: 15, puntoReorden: 4 },
          { sku: 'NG-CORR-TAN', nombre: 'Tono Tan (Bronce)', precio: 95.00, stock: 8, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'maquillaje-rostro',
        nombre: 'Rubor Liquido Soft Tint Rosé Acabado Natural',
        slug: 'rubor-liquido-soft-tint-rose-acabado-natural',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Formula liquida ultra pigmentada que se funde en la piel aportando un rubor juvenil y radiante todo el dia.',
        ingredientes: 'Hydrogenated Polyisobutene, Hydrogenated Poly(C6-14 Olefin), Mica, Silica, Helianthus Annuus Seed Oil, Gardenia Florida Extract.',
        modoUso: 'Colocar 1 o 2 puntos en los pomulos y difuminar suavemente hacia las sienes con dedos o brocha.',
        variantes: [
          { sku: 'NG-BLUSH-PETAL', nombre: 'Tono Petal (Rosa Suave)', precio: 110.00, stock: 14, puntoReorden: 4 },
          { sku: 'NG-BLUSH-JOY', nombre: 'Tono Joy (Durazno Radiante)', precio: 110.00, stock: 10, puntoReorden: 3 },
          { sku: 'NG-BLUSH-HOPE', nombre: 'Tono Hope (Malva Calido)', precio: 110.00, stock: 12, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'maquillaje-rostro',
        nombre: 'Iluminador Liquido Glow Drops Champagne',
        slug: 'iluminador-liquido-glow-drops-champagne',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Gotas iluminadoras modulables libres de escarcha pesada. Crea un efecto de piel mojada y resplandeciente.',
        ingredientes: 'Isododecane, Mica, Hydrogenated Polydecene, Synthetic Fluorphlogopite, Disteardimonium Hectorite, Propylene Carbonate.',
        modoUso: 'Aplicar sobre los puntos altos del rostro (pomulos, puente nasal, arco de cupido) o mezclar con la base de maquillaje.',
        variantes: [
          { sku: 'NG-ILUM-CHAMP', nombre: 'Tono Champagne Gold', precio: 125.00, stock: 12, puntoReorden: 4 },
          { sku: 'NG-ILUM-ROSE', nombre: 'Tono Rose Glow', precio: 125.00, stock: 9, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'maquillaje-rostro',
        nombre: 'Polvo Traslucido Fijador Matificante Ultrafino',
        slug: 'polvo-traslucido-fijador-matificante-ultrafino',
        marca: 'Nuba Glow',
        tipoPiel: 'Grasa',
        descripcion: 'Polvo fijador micro-pulverizado que sella el maquillaje por horas, controla brillos y difumina la textura visual de poros.',
        ingredientes: 'Zea Mays Starch, Silica, Magnesium Stearate, Caprylyl Glycol, Phenoxyethanol, Ethylhexylglycerin.',
        modoUso: 'Presionar suavemente con borla sobre la zona T o zonas con brillo. Retirar exceso con brocha amplia.',
        variantes: [
          { sku: 'NG-POLV-TRANSP', nombre: 'Tono Traslucido Universal', precio: 115.00, stock: 16, puntoReorden: 5 },
          { sku: 'NG-POLV-BANANA', nombre: 'Tono Banana Iluminador', precio: 115.00, stock: 8, puntoReorden: 3 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },

      // CATEGORIA: Labios y Ojos (7)
      {
        catSlug: 'labios-ojos',
        nombre: 'Balsamo Labial Reparador con Peptidos y Manteca de Karite',
        slug: 'balsamo-labial-reparador-peptidos-karite',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Tratamiento labial rico en emolientes y peptidos que repara labios agrietados, brindando volumen e hidratacion prolongada.',
        ingredientes: 'Petrolatum, Hydrogenated Polyisobutene, Butyrospermum Parkii Butter, Palmitoyl Tripeptide-1, Cera Alba, Aroma.',
        modoUso: 'Aplicar cuantas veces sea necesario a lo largo del dia y como mascarilla labial densa antes de dormir.',
        variantes: [
          { sku: 'NG-LIPB-BERRY', nombre: 'Tono Berry Tint', precio: 70.00, stock: 20, puntoReorden: 5 },
          { sku: 'NG-LIPB-NUDE', nombre: 'Tono Nude Glow', precio: 70.00, stock: 18, puntoReorden: 5 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'labios-ojos',
        nombre: 'Labial Liquido Mate Velvet Sedoso',
        slug: 'labial-liquido-mate-velvet-sedoso',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Color intenso en una sola pasada con sensacion ligera no pegajosa. No reseca ni se transfiere con facilidad.',
        ingredientes: 'Isododecane, Dimethicone, Trimethylsiloxysilicate, Polybutene, Silica Dimethyl Silylate, Tocopherol.',
        modoUso: 'Delinear primero el contorno labial y rellenar hacia el centro. Dejar secar 60 segundos para fijacion optima.',
        variantes: [
          { sku: 'NG-LIPM-VINT', nombre: 'Tono Vintage Rose', precio: 85.00, stock: 15, puntoReorden: 4 },
          { sku: 'NG-LIPM-SUCRE', nombre: 'Tono Carmin Sucre', precio: 85.00, stock: 12, puntoReorden: 4 },
          { sku: 'NG-LIPM-CANE', nombre: 'Tono Canela Nude', precio: 85.00, stock: 14, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'labios-ojos',
        nombre: 'Aceite Labial Nutritivo Lip Oil con Escualano & Jojoba',
        slug: 'aceite-labial-nutritivo-lip-oil-escualano',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Brillo espejo deslumbrante con confort de tratamiento nutritivo. Deja los labios jugosos sin sensacion grasa.',
        ingredientes: 'Polybutene, Octyldodecanol, Squalane, Simmondsia Chinensis Seed Oil, Rubus Idaeus Seed Oil, Tocopheryl Acetate.',
        modoUso: 'Aplicar solo para un brillo saludable o encima de tu labial favorito para multiplicar el volumen visual.',
        variantes: [
          { sku: 'NG-LIPOIL-CRIS', nombre: 'Tono Cristal Transparente', precio: 90.00, stock: 16, puntoReorden: 4 },
          { sku: 'NG-LIPOIL-CHERRY', nombre: 'Tono Cereza Silvestre', precio: 90.00, stock: 14, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'labios-ojos',
        nombre: 'Mascara de Pestanas Efecto Lifting y Longitud 24h',
        slug: 'mascara-pestanas-efecto-lifting-longitud-24h',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Cepillo de silicona curvado que eleva y separa cada pestana desde la raiz, sin formar grumos ni manchar ojeras.',
        ingredientes: 'Aqua, Cera Alba, Copernicia Cerifera Cera, Stearic Acid, Acacia Senegal Gum, Glyceryl Stearate, CI 77499.',
        modoUso: 'Posicionar el cepillo en la raiz de las pestanas y mover en zigzag hacia las puntas. Replicar para mayor impacto.',
        variantes: [
          { sku: 'NG-MASC-NEGRO', nombre: 'Tono Negro Carbon Ultra', precio: 105.00, stock: 17, puntoReorden: 5 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'labios-ojos',
        nombre: 'Gel Fijador de Cejas Invisible Lamination Effect',
        slug: 'gel-fijador-cejas-invisible-lamination-effect',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Fijacion fuerte pero flexible que peina y lamina las cejas en la direccion deseada durante toda la jornada.',
        ingredientes: 'Aqua, VP/VA Copolymer, Alcohol Denat., Propylene Glycol, Carbomer, Aminomethyl Propanol, Panthenol.',
        modoUso: 'Cepillar las cejas hacia arriba con el micro-cepillo y presionar suavemente para lograr efecto laminado pulido.',
        variantes: [
          { sku: 'NG-BROW-CLEAR', nombre: 'Tono Transparente', precio: 75.00, stock: 19, puntoReorden: 5 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'labios-ojos',
        nombre: 'Paleta de Sombras Sunset Rose 9 Tonos',
        slug: 'paleta-sombras-sunset-rose-9-tonos',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Armonia de 9 sombras en acabados mate aterciopelado y satinados metalizados. Pigmentacion intensa y facil difuminado.',
        ingredientes: 'Talc, Mica, Magnesium Stearate, Polyethylene, Mineral Oil, Ethylhexyl Palmitate, Dimethicone, CI 77891, CI 77491.',
        modoUso: 'Aplicar tonos mate en la cuenca del ojo para dar profundidad y tonos satinados en el parpado movil con brocha plana o dedo.',
        variantes: [
          { sku: 'NG-PAL-SUNSET', nombre: 'Estuche Rose Gold 9 Sombras', precio: 145.00, stock: 8, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      },
      {
        catSlug: 'labios-ojos',
        nombre: 'Paleta de Sombras Warm Earth Nudes 9 Tonos',
        slug: 'paleta-sombras-warm-earth-nudes-9-tonos',
        marca: 'Nuba Glow',
        tipoPiel: 'Todo tipo',
        descripcion: 'Gama neutra calida esencial con tonos canela, cafe moca y toffee para looks de dia a noche elegantes.',
        ingredientes: 'Mica, Talc, Kaolin, Zinc Stearate, Dimethicone, Silica, Caprylic/Capric Triglyceride, CI 77492, CI 77499.',
        modoUso: 'Combinar tonos claros para iluminar el arco de la ceja y lagrimal con tonos oscuros para delinear y enmarcar la mirada.',
        variantes: [
          { sku: 'NG-PAL-EARTH', nombre: 'Estuche Nude Elegance 9 Sombras', precio: 145.00, stock: 10, puntoReorden: 4 }
        ],
        imagenes: ['assets/brand/icono1.png']
      }
    ];

    let totalVariantes = 0;
    for (const p of productosData) {
      const categoriaId = mapaCategorias[p.catSlug];
      const resProd = await cliente.query(
        `INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         ON CONFLICT (slug) DO UPDATE 
         SET nombre = EXCLUDED.nombre, marca = EXCLUDED.marca, tipo_piel = EXCLUDED.tipo_piel,
             descripcion = EXCLUDED.descripcion, ingredientes = EXCLUDED.ingredientes, modo_uso = EXCLUDED.modo_uso
         RETURNING id;`,
        [categoriaId, p.nombre, p.slug, p.marca, p.tipoPiel, p.descripcion, p.ingredientes, p.modoUso]
      );
      const productoId = resProd.rows[0].id;

      // Insertar variantes del producto
      for (const v of p.variantes) {
        await cliente.query(
          `INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           ON CONFLICT (sku) DO UPDATE 
           SET precio = EXCLUDED.precio, stock = EXCLUDED.stock, punto_reorden = EXCLUDED.punto_reorden;`,
          [productoId, v.sku, v.nombre, v.precio, v.stock, v.puntoReorden]
        );
        totalVariantes++;
      }

      // Insertar imagenes
      for (let i = 0; i < p.imagenes.length; i++) {
        await cliente.query(
          `INSERT INTO imagenes_producto (producto_id, url, es_principal, orden)
           VALUES ($1, $2, $3, $4);`,
          [productoId, p.imagenes[i], i === 0, i]
        );
      }
    }
    console.log(`Se insertaron exitosamente ${productosData.length} productos con ${totalVariantes} variantes.`);

    // ------------------------------------------------------------------------
    // 4. RESENAS VERIFICADAS Y PEDIDOS DEMO
    // ------------------------------------------------------------------------
    console.log('4. Insertando resenas verificadas y pedidos demo con trazabilidad...');

    // Obtener id de cliente de prueba
    const resCliente = await cliente.query("SELECT id FROM usuarios WHERE email = 'cliente@nuba.bo'");
    const clienteId = resCliente.rows[0].id;

    // Obtener primer producto y variante para pedidos de prueba
    const resVar = await cliente.query("SELECT id, precio, producto_id FROM variantes LIMIT 2");
    const var1 = resVar.rows[0];
    const var2 = resVar.rows[1];

    // Pedido 1: En transito
    const resPed1 = await cliente.query(
      `INSERT INTO pedidos (usuario_id, codigo_rastreo, subtotal, costo_envio, total, estado, nombre_cliente, celular_cliente, correo_cliente, ciudad, direccion)
       VALUES ($1, 'NB-2026-0101', 265.00, 15.00, 280.00, 'En tránsito', 'Camila Morales', '71234567', 'cliente@nuba.bo', 'Sucre', 'Calle Calvo #340')
       ON CONFLICT (codigo_rastreo) DO NOTHING RETURNING id;`,
      [clienteId]
    );

    if (resPed1.rows.length > 0) {
      const pedido1Id = resPed1.rows[0].id;
      await cliente.query(
        `INSERT INTO pedido_items (pedido_id, variante_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, 1, $3, $3);`,
        [pedido1Id, var1.id, var1.precio]
      );
      await cliente.query(
        `INSERT INTO pagos (pedido_id, metodo, monto, estado, referencia, simulado, pagado_en)
         VALUES ($1, 'qr_simple', 280.00, 'Aprobado', 'QR-DEMO-8924', TRUE, NOW());`,
        [pedido1Id]
      );
      const resEnvio1 = await cliente.query(
        `INSERT INTO envios (pedido_id, codigo_rastreo, estado, transportista, fecha_despacho)
         VALUES ($1, 'NB-2026-0101', 'En tránsito', 'Nuba Express Sucre', NOW()) RETURNING id;`,
        [pedido1Id]
      );
      const envio1Id = resEnvio1.rows[0].id;
      await cliente.query(
        `INSERT INTO envio_eventos (envio_id, estado, descripcion)
         VALUES 
         ($1, 'Pendiente', 'Orden recibida y pago QR Simple verificado exitosamente.'),
         ($1, 'En preparación', 'Paquete acondicionado con empaque dermoprotector Eco-Glow.'),
         ($1, 'En tránsito', 'Despachado a courier local para entrega a domicilio en Sucre.');`,
        [envio1Id]
      );
    }

    // Pedido 2: Entregado (para habilitar resenas verificadas al cliente)
    const resPed2 = await cliente.query(
      `INSERT INTO pedidos (usuario_id, codigo_rastreo, subtotal, costo_envio, total, estado, nombre_cliente, celular_cliente, correo_cliente, ciudad, direccion)
       VALUES ($1, 'NB-2026-0102', 145.00, 0.00, 145.00, 'Entregado', 'Camila Morales', '71234567', 'cliente@nuba.bo', 'Sucre', 'Calle Calvo #340')
       ON CONFLICT (codigo_rastreo) DO NOTHING RETURNING id;`,
      [clienteId]
    );

    if (resPed2.rows.length > 0) {
      const pedido2Id = resPed2.rows[0].id;
      await cliente.query(
        `INSERT INTO pedido_items (pedido_id, variante_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, 1, $3, $3);`,
        [pedido2Id, var1.id, var1.precio]
      );
      await cliente.query(
        `INSERT INTO resenas (producto_id, usuario_id, calificacion, comentario, verificado)
         VALUES ($1, $2, 5, 'Excelente formulacion. Se absorbe de inmediato sin dejar sensacion grasa en el clima seco de Sucre. Muy recomendado.', TRUE)
         ON CONFLICT (producto_id, usuario_id) DO NOTHING;`,
        [var1.producto_id, clienteId]
      );
    }
  });

  // Guardar contrasenas en archivo local ignorado por git
  const rutaArchivoPasswords = path.resolve(process.cwd(), 'seed_passwords.txt');
  const contenidoArchivo = `============================================================\n` +
    `NUBAGLOW APP - CREDENCIALES DE PRUEBA (SOLO USO LOCAL / DEFENSA)\n` +
    `Generadas el: ${new Date().toISOString()}\n` +
    `ADVERTENCIA: Este archivo esta en .gitignore y NUNCA debe subirse a Git.\n` +
    `============================================================\n\n` +
    cuentas.map(c => `Rol: ${c.rol.toUpperCase()}\nNombre: ${c.nombre}\nEmail: ${c.email}\nPassword: ${c.passwordPlana}\n------------------------------------------------------------\n`).join('');

  fs.writeFileSync(rutaArchivoPasswords, contenidoArchivo, 'utf-8');

  console.log('\n============================================================');
  console.log('POBLADO DE DATOS (SEED) COMPLETADO EXITOSAMENTE');
  console.log('============================================================');
  console.log('Credenciales de prueba generadas con bcrypt (coste 12):');
  cuentas.forEach(c => {
    console.log(`- Rol: [${c.rol.padEnd(11)}] | Email: ${c.email.padEnd(20)} | Password: ${c.passwordPlana}`);
  });
  console.log('\nNota: Las contrasenas han sido respaldadas localmente en:');
  console.log(`-> ${rutaArchivoPasswords} (ignorado por git).`);
  console.log('============================================================\n');

  await cerrarPool();
}

sembrarBaseDeDatos().catch(async (error) => {
  console.error('\nERROR critico durante el sembrado de base de datos:', error);
  await cerrarPool();
  process.exit(1);
});
