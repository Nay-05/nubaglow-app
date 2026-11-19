-- ============================================================================
-- NubaGlow App — Script SQL de Datos Maestros de Prueba (seed.sql)
-- Proyecto de Ingenieria de Software — Grupo 11 (Nuba Beauty, Sucre, Bolivia)
-- Version: 1.1.0
-- Idempotente: puede ejecutarse en el SQL Editor de Supabase o mediante npm run db:seed
-- ============================================================================

-- ============================================================================
-- 1. CATEGORIAS DE PRODUCTOS
-- ============================================================================
INSERT INTO categorias (nombre, slug, descripcion) VALUES
('Serums y Tratamientos', 'serums-tratamientos', 'Formulas dermocosmeticas concentradas con activos cientificamente probados para iluminar, reparar y transformar la piel.'),
('Limpieza Facial', 'limpieza-facial', 'Geles, espumas y balsamos con pH fisiologico para remover impurezas sin alterar la barrera cutanea.'),
('Hidratacion y Barrera', 'hidratacion-barrera', 'Cremas restauradoras y emulsiones enriquecidas con ceramidas, acidos grasos y escualano.'),
('Proteccion Solar', 'proteccion-solar', 'Filtros solares minerales y quimicos de amplio espectro UVA/UVB adaptados al clima y altura de Bolivia.'),
('Maquillaje de Rostro', 'maquillaje-rostro', 'Bases hibridas, correctores y rubores modulables que perfeccionan el rostro cuidando la salud cutanea.'),
('Labios y Ojos', 'labios-ojos', 'Balsamos nutritivos, labiales satinados, mascaras y paletas de sombras con pigmentos de alta pureza.')
ON CONFLICT (slug) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

-- ============================================================================
-- 2. PRODUCTOS (32 PRODUCTOS REALISTAS DE BELLEZA)
-- ============================================================================

-- Categoria 1: Serums y Tratamientos (5 productos)
INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo) VALUES
((SELECT id FROM categorias WHERE slug = 'serums-tratamientos'),
 'Serum Glow Vitamina C 15% + Acido Ferulico', 'serum-vitamina-c-15-ferulico', 'Nuba Skin', 'Todo tipo',
 'Potente antioxidante diurno que ilumina la piel, atenua manchas pigmentarias y protege contra la radiacion ambiental.',
 'Aqua, 3-O-Ethyl Ascorbic Acid (15%), Ferulic Acid (0.5%), Hyaluronic Acid, Tocopherol (Vitamina E), Propanediol.',
 'Aplicar 4 a 5 gotas por la manana sobre piel limpia y seca. Continuar con crema hidratante y protector solar.', TRUE),

((SELECT id FROM categorias WHERE slug = 'serums-tratamientos'),
 'Serum Acido Hialuronico Multi-Molecular 2% + B5', 'serum-acido-hialuronico-multi-molecular-b5', 'Nuba Skin', 'Seca',
 'Complejo de 4 pesos moleculares de acido hialuronico que penetra en multiples capas epidermicas reteniendo hidratacion.',
 'Aqua, Sodium Hyaluronate, Panthenol (Provitamina B5), Glycerin, Pentylene Glycol, Ethylhexylglycerin.',
 'Aplicar 3 gotas sobre rostro ligeramente humedo, manana y noche, antes de cremas o aceites.', TRUE),

((SELECT id FROM categorias WHERE slug = 'serums-tratamientos'),
 'Serum Niacinamida 10% + Zinc PCA 1%', 'serum-niacinamida-10-zinc-pca', 'Nuba Skin', 'Grasa',
 'Regula la secrecion sebacea, disminuye la apariencia de poros dilatados y fortalece la tolerancia epidermica.',
 'Aqua, Niacinamide (10%), Zinc PCA (1%), Dimethyl Isosorbide, Tamarindus Indica Seed Polysaccharide, Phenoxyethanol.',
 'Aplicar 3 a 4 gotas manana y noche sobre piel limpia. Evitar combinar en la misma rutina con Acido Ascorbico puro.', TRUE),

((SELECT id FROM categorias WHERE slug = 'serums-tratamientos'),
 'Serum Retinol Puro 0.3% Renovador Nocturno', 'serum-retinol-puro-03-nocturno', 'Nuba Skin', 'Todo tipo',
 'Tratamiento nocturno antiedad que estimula el recambio celular, alisa lineas finas y mejora la textura cutanea.',
 'Caprylic/Capric Triglyceride, Squalane, Retinol (0.3%), Bisabolol, BHT, Simmondsia Chinensis Seed Oil.',
 'Uso exclusivo nocturno. Iniciar 2 noches por semana y aumentar progresivamente. Uso obligatorio de protector solar diurno.', TRUE),

((SELECT id FROM categorias WHERE slug = 'serums-tratamientos'),
 'Serum Descongestivo Acido Salicilico BHA 2%', 'serum-acido-salicilico-bha-2', 'Nuba Skin', 'Grasa',
 'Exfoliante quimico liposoluble que penetra dentro de los poros disolviendo el exceso de grasa y puntos negros.',
 'Aqua, Cocamidopropyl Dimethylamine, Salicylic Acid (2%), Hydroxyethylcellulose, Polysorbate 20, Citric Acid.',
 'Aplicar por la noche sobre zonas propensas a comedones o brotes. Limitar a 3 veces por semana.', TRUE)
ON CONFLICT (slug) DO UPDATE SET
    nombre = EXCLUDED.nombre, marca = EXCLUDED.marca, tipo_piel = EXCLUDED.tipo_piel,
    descripcion = EXCLUDED.descripcion, ingredientes = EXCLUDED.ingredientes, modo_uso = EXCLUDED.modo_uso;

-- Categoria 2: Limpieza Facial (5 productos)
INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo) VALUES
((SELECT id FROM categorias WHERE slug = 'limpieza-facial'),
 'Gel Limpiador Purificante con Acido Salicilico', 'gel-limpiador-purificante-acido-salicilico', 'Nuba Skin', 'Grasa',
 'Espuma suave de limpieza profunda que retira impurezas sin deshidratar ni provocar efecto rebote de brillo.',
 'Aqua, Sodium Cocoyl Isethionate, Glycerin, Salicylic Acid (1%), Melaleuca Alternifolia Leaf Oil, Chamomilla Recutita Extract.',
 'Emulsionar una pulsacion con agua en las palmas, masajear en rostro durante 60 segundos y aclarar con agua tibia.', TRUE),

((SELECT id FROM categorias WHERE slug = 'limpieza-facial'),
 'Espuma Limpiadora Calmante Centella Asiatica', 'espuma-limpiadora-calmante-centella-asiatica', 'Nuba Skin', 'Sensible',
 'Textura suave en nube que limpia delicadamente pieles reactivas, rojeces o alteradas tras tratamientos clinicos.',
 'Centella Asiatica Leaf Water (45%), Aqua, Coco-Betaine, Disodium Cocoamphodiacetate, Allantoin, Madecassoside.',
 'Aplicar 2 pulsaciones sobre rostro humedo, masajear con suavidad y enjuagar abundantemente.', TRUE),

((SELECT id FROM categorias WHERE slug = 'limpieza-facial'),
 'Aceite Limpiador Desmaquillante Nutritivo', 'aceite-limpiador-desmaquillante-nutritivo', 'Nuba Skin', 'Todo tipo',
 'Aceite hidrofilo de primera limpieza que emulsiona en leche al contacto con agua, disolviendo maquillaje waterproof y SPF.',
 'Helianthus Annuus Seed Oil, PEG-20 Glyceryl Triisostearate, Simmondsia Chinensis Seed Oil, Prunus Amygdalus Dulcis Oil, Tocopherol.',
 'Aplicar sobre rostro seco con maquillaje, masajear en circulos, agregar agua para emulsionar y retirar con agua tibia.', TRUE),

((SELECT id FROM categorias WHERE slug = 'limpieza-facial'),
 'Balsamo Limpiador de Avena y Escualano', 'balsamo-limpiador-avena-escualano', 'Nuba Skin', 'Seca',
 'Balsamo untuoso con avena coloidal y escualano vegetal que reconforta pieles secas y deshidratadas desde la limpieza.',
 'Prunus Amygdalus Dulcis Oil, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Avena Sativa Kernel Flour, Squalane.',
 'Tomar la cantidad de una avellana, masajear en rostro seco y retirar con pano humedo o agua tibia.', TRUE),

((SELECT id FROM categorias WHERE slug = 'limpieza-facial'),
 'Agua Micelar Calmante Agua de Rosas & Pantenol', 'agua-micelar-calmante-rosas-pantenol', 'Nuba Skin', 'Sensible',
 'Solucion micelar que atrapa impurezas y maquillaje ligero respetando la flora cutanea, sin necesidad de aclarado forzoso.',
 'Aqua, Rosa Damascena Flower Water, Poloxamer 184, Panthenol, Glycerin, Sodium Chloride, Disodium EDTA.',
 'Humedecer un disco de algodon y presionar suavemente sobre rostro, ojos y labios sin frotar agresivamente.', TRUE)
ON CONFLICT (slug) DO UPDATE SET
    nombre = EXCLUDED.nombre, marca = EXCLUDED.marca, tipo_piel = EXCLUDED.tipo_piel,
    descripcion = EXCLUDED.descripcion, ingredientes = EXCLUDED.ingredientes, modo_uso = EXCLUDED.modo_uso;

-- Categoria 3: Hidratacion y Barrera (5 productos)
INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo) VALUES
((SELECT id FROM categorias WHERE slug = 'hidratacion-barrera'),
 'Crema Hidratante Ceramide Barrier Relief', 'crema-hidratante-ceramide-barrier-relief', 'Nuba Skin', 'Seca',
 'Formula dermatologica con 3 ceramidas esenciales (1, 3, 6-II), acidos grasos y fitoesfingosina que repara la barrera cutanea.',
 'Aqua, Glycerin, Caprylic/Capric Triglyceride, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol.',
 'Extender sobre rostro y cuello por la manana y por la noche como paso final de cuidado antes del protector solar.', TRUE),

((SELECT id FROM categorias WHERE slug = 'hidratacion-barrera'),
 'Gel-Crema Hidratante Matificante Oil-Free', 'gel-crema-hidratante-matificante-oil-free', 'Nuba Skin', 'Grasa',
 'Hidratacion liviana no comedogenica con acabado aterciopelado mate; no obstruye poros ni anade brillo.',
 'Aqua, Dimethicone, Glycerin, Silica, Tapioca Starch, Niacinamide, Sodium Hyaluronate, Carbomer.',
 'Aplicar una pequena porcion sobre rostro limpio manana y noche. Excelente base previa al maquillaje.', TRUE),

((SELECT id FROM categorias WHERE slug = 'hidratacion-barrera'),
 'Crema Nutritiva de Noche con Peptidos de Cobre', 'crema-nutritiva-noche-peptidos-cobre', 'Nuba Skin', 'Todo tipo',
 'Tratamiento nocturno regenerador con peptidos biometricos que refuerzan la firmeza y elasticidad mientras duermes.',
 'Aqua, Butyrospermum Parkii Butter, Squalane, Copper Tripeptide-1, Palmitoyl Tripeptide-5, Niacinamide.',
 'Masajear sobre rostro limpio por la noche como ultimo paso de la rutina nocturna.', TRUE),

((SELECT id FROM categorias WHERE slug = 'hidratacion-barrera'),
 'Tonico Hidratante y Equilibrante Niacinamida 5%', 'tonico-hidratante-equilibrante-niacinamida-5', 'Nuba Skin', 'Mixta',
 'Locion refrescante que equilibra el pH tras la limpieza, suaviza la textura y prepara la piel para recibir los tratamientos.',
 'Aqua, Rosa Centifolia Flower Water, Niacinamide (5%), Glycerin, Panthenol, Betaine, Sodium Hyaluronate.',
 'Dispensar unas gotas en las palmas y dar toques suaves sobre rostro y cuello. No requiere algodon.', TRUE),

((SELECT id FROM categorias WHERE slug = 'hidratacion-barrera'),
 'Mascarilla Nocturna Reparadora Cica & Alantoina', 'mascarilla-nocturna-reparadora-cica-alantoina', 'Nuba Skin', 'Sensible',
 'Tratamiento intensivo en velo nocturno que calma quemaduras de sol, viento de altura y rojeces durante el descanso.',
 'Aqua, Centella Asiatica Extract, Butylene Glycol, Allantoin, Trehalose, Madecassic Acid, Asiatic Acid.',
 'Aplicar una capa generosa 2 a 3 veces por semana antes de dormir. Enjuagar a la manana siguiente.', TRUE)
ON CONFLICT (slug) DO UPDATE SET
    nombre = EXCLUDED.nombre, marca = EXCLUDED.marca, tipo_piel = EXCLUDED.tipo_piel,
    descripcion = EXCLUDED.descripcion, ingredientes = EXCLUDED.ingredientes, modo_uso = EXCLUDED.modo_uso;

-- Categoria 4: Proteccion Solar (4 productos)
INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo) VALUES
((SELECT id FROM categorias WHERE slug = 'proteccion-solar'),
 'Protector Solar Toque Seco SPF 50+ Invisible', 'protector-solar-toque-seco-spf-50-invisible', 'Nuba Skin', 'Todo tipo',
 'Alta proteccion solar de amplio espectro disenada para el clima y la radiacion UV de Sucre y los valles bolivianos. Acabado sedoso sin rastro blanco.',
 'Aqua, Homosalate, Octocrylene, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Silica, Niacinamide.',
 'Aplicar uniformemente dos lineas en los dedos sobre rostro y cuello 15 minutos antes de la exposicion. Reaplicar cada 2 a 3 horas.', TRUE),

((SELECT id FROM categorias WHERE slug = 'proteccion-solar'),
 'Protector Solar Mineral Calming SPF 50+ Oxido de Zinc', 'protector-solar-mineral-calming-spf-50-zinc', 'Nuba Skin', 'Sensible',
 'Filtro solar 100% fisico con oxido de zinc no nano. Hipoalergenico y seguro para pieles reactivas, rosacea y ninos.',
 'Zinc Oxide (21%), Aqua, Caprylic/Capric Triglyceride, C13-15 Alkane, Polyglyceryl-3 Polyricinoleate, Bisabolol.',
 'Extender de manera uniforme sobre rostro. Su textura adaptativa se difumina sin dejar efecto fantasma.', TRUE),

((SELECT id FROM categorias WHERE slug = 'proteccion-solar'),
 'Fluido Solar Matificante Ultra Ligero SPF 50+', 'fluido-solar-matificante-ultra-ligero-spf-50', 'Nuba Skin', 'Grasa',
 'Emulsion ultra fluida con perlas matificantes que absorben la oleosidad ambiental manteniendo la piel fresca.',
 'Aqua, Isododecane, Ethylhexyl Triazone, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol, Silica Silylate.',
 'Agitar antes de usar. Aplicar sobre el rostro antes de salir y reaplicar a mediodia.', TRUE),

((SELECT id FROM categorias WHERE slug = 'proteccion-solar'),
 'Bruma Solar Fijadora SPF 50 Reaplicacion Facial', 'bruma-solar-fijadora-spf-50-reaplicacion', 'Nuba Skin', 'Todo tipo',
 'Bruma ultra fina en aerosol que permite reaplicar proteccion solar sobre el maquillaje sin necesidad de tocar el rostro.',
 'Alcohol Denat., Butane, Isobutane, Octocrylene, Homosalate, Ethylhexyl Salicylate, Parfum.',
 'Cerrar ojos y boca, rociar a 20 cm de distancia del rostro realizando movimientos circulares continuos.', TRUE)
ON CONFLICT (slug) DO UPDATE SET
    nombre = EXCLUDED.nombre, marca = EXCLUDED.marca, tipo_piel = EXCLUDED.tipo_piel,
    descripcion = EXCLUDED.descripcion, ingredientes = EXCLUDED.ingredientes, modo_uso = EXCLUDED.modo_uso;

-- Categoria 5: Maquillaje de Rostro (6 productos)
INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo) VALUES
((SELECT id FROM categorias WHERE slug = 'maquillaje-rostro'),
 'Base Liquida Glow Serum Ligera SPF 20', 'base-liquida-glow-serum-ligera-spf-20', 'Nuba Glow', 'Todo tipo',
 'Base hibrida con cobertura modulable de ligera a media. Aporta luminosidad saludable imitando la textura natural de la piel.',
 'Aqua, Cyclopentasiloxane, Ethylhexyl Methoxycinnamate, Niacinamide, Glycerin, Sodium Hyaluronate, Iron Oxides.',
 'Aplicar 1 a 2 pulsaciones en el centro del rostro y difuminar hacia afuera con brocha o esponja humeda.', TRUE),

((SELECT id FROM categorias WHERE slug = 'maquillaje-rostro'),
 'Base Mate Terciopelo Larga Duracion 24h', 'base-mate-terciopelo-larga-duracion-24h', 'Nuba Glow', 'Grasa',
 'Cobertura completa transpirable con polimeros fijadores que resisten calor y humedad sin craquelarse.',
 'Aqua, Dimethicone, Trimethylsiloxysilicate, Butylene Glycol, Talc, Silica, Peg-10 Dimethicone, CI 77891.',
 'Trabajar por sectores del rostro difuminando con rapidez con brocha tupida para un acabado profesional impecable.', TRUE),

((SELECT id FROM categorias WHERE slug = 'maquillaje-rostro'),
 'Corrector Hidratante Alta Cobertura Cafeina & Escualano', 'corrector-hidratante-alta-cobertura-cafeina', 'Nuba Glow', 'Todo tipo',
 'Descongestiona ojeras gracias a la cafeina activa mientras cubre imperfecciones sin marcar lineas de expresion.',
 'Aqua, Isododecane, Dimethicone, Caffeine, Squalane, Tocopheryl Acetate, Triethoxycaprylylsilane.',
 'Aplicar dos puntos en el lagrimal y comisura exterior del ojo. Difuminar con yemas de los dedos o esponja suave.', TRUE),

((SELECT id FROM categorias WHERE slug = 'maquillaje-rostro'),
 'Rubor Liquido Soft Tint Rosé Acabado Natural', 'rubor-liquido-soft-tint-rose-acabado-natural', 'Nuba Glow', 'Todo tipo',
 'Formula liquida ultra pigmentada que se funde en la piel aportando un rubor juvenil y radiante todo el dia.',
 'Hydrogenated Polyisobutene, Hydrogenated Poly(C6-14 Olefin), Mica, Silica, Helianthus Annuus Seed Oil, Gardenia Florida Extract.',
 'Colocar 1 o 2 puntos en los pomulos y difuminar suavemente hacia las sienes con dedos o brocha.', TRUE),

((SELECT id FROM categorias WHERE slug = 'maquillaje-rostro'),
 'Iluminador Liquido Glow Drops Champagne', 'iluminador-liquido-glow-drops-champagne', 'Nuba Glow', 'Todo tipo',
 'Gotas iluminadoras modulables libres de escarcha pesada. Crea un efecto de piel mojada y resplandeciente.',
 'Isododecane, Mica, Hydrogenated Polydecene, Synthetic Fluorphlogopite, Disteardimonium Hectorite, Propylene Carbonate.',
 'Aplicar sobre los puntos altos del rostro (pomulos, puente nasal, arco de cupido) o mezclar con la base de maquillaje.', TRUE),

((SELECT id FROM categorias WHERE slug = 'maquillaje-rostro'),
 'Polvo Traslucido Fijador Matificante Ultrafino', 'polvo-traslucido-fijador-matificante-ultrafino', 'Nuba Glow', 'Grasa',
 'Polvo fijador micro-pulverizado que sella el maquillaje por horas, controla brillos y difumina la textura visual de poros.',
 'Zea Mays Starch, Silica, Magnesium Stearate, Caprylyl Glycol, Phenoxyethanol, Ethylhexylglycerin.',
 'Presionar suavemente con borla sobre la zona T o zonas con brillo. Retirar exceso con brocha amplia.', TRUE)
ON CONFLICT (slug) DO UPDATE SET
    nombre = EXCLUDED.nombre, marca = EXCLUDED.marca, tipo_piel = EXCLUDED.tipo_piel,
    descripcion = EXCLUDED.descripcion, ingredientes = EXCLUDED.ingredientes, modo_uso = EXCLUDED.modo_uso;

-- Categoria 6: Labios y Ojos (7 productos)
INSERT INTO productos (categoria_id, nombre, slug, marca, tipo_piel, descripcion, ingredientes, modo_uso, activo) VALUES
((SELECT id FROM categorias WHERE slug = 'labios-ojos'),
 'Balsamo Labial Reparador con Peptidos y Manteca de Karite', 'balsamo-labial-reparador-peptidos-karite', 'Nuba Glow', 'Todo tipo',
 'Tratamiento labial rico en emolientes y peptidos que repara labios agrietados, brindando volumen e hidratacion prolongada.',
 'Petrolatum, Hydrogenated Polyisobutene, Butyrospermum Parkii Butter, Palmitoyl Tripeptide-1, Cera Alba, Aroma.',
 'Aplicar cuantas veces sea necesario a lo largo del dia y como mascarilla labial densa antes de dormir.', TRUE),

((SELECT id FROM categorias WHERE slug = 'labios-ojos'),
 'Labial Liquido Mate Velvet Sedoso', 'labial-liquido-mate-velvet-sedoso', 'Nuba Glow', 'Todo tipo',
 'Color intenso en una sola pasada con sensacion ligera no pegajosa. No reseca ni se transfiere con facilidad.',
 'Isododecane, Dimethicone, Trimethylsiloxysilicate, Polybutene, Silica Dimethyl Silylate, Tocopherol.',
 'Delinear primero el contorno labial y rellenar hacia el centro. Dejar secar 60 segundos para fijacion optima.', TRUE),

((SELECT id FROM categorias WHERE slug = 'labios-ojos'),
 'Aceite Labial Nutritivo Lip Oil con Escualano & Jojoba', 'aceite-labial-nutritivo-lip-oil-escualano', 'Nuba Glow', 'Todo tipo',
 'Brillo espejo deslumbrante con confort de tratamiento nutritivo. Deja los labios jugosos sin sensacion grasa.',
 'Polybutene, Octyldodecanol, Squalane, Simmondsia Chinensis Seed Oil, Rubus Idaeus Seed Oil, Tocopheryl Acetate.',
 'Aplicar solo para un brillo saludable o encima de tu labial favorito para multiplicar el volumen visual.', TRUE),

((SELECT id FROM categorias WHERE slug = 'labios-ojos'),
 'Mascara de Pestanas Efecto Lifting y Longitud 24h', 'mascara-pestanas-efecto-lifting-longitud-24h', 'Nuba Glow', 'Todo tipo',
 'Cepillo de silicona curvado que eleva y separa cada pestana desde la raiz, sin formar grumos ni manchar ojeras.',
 'Aqua, Cera Alba, Copernicia Cerifera Cera, Stearic Acid, Acacia Senegal Gum, Glyceryl Stearate, CI 77499.',
 'Posicionar el cepillo en la raiz de las pestanas y mover en zigzag hacia las puntas. Replicar para mayor impacto.', TRUE),

((SELECT id FROM categorias WHERE slug = 'labios-ojos'),
 'Gel Fijador de Cejas Invisible Lamination Effect', 'gel-fijador-cejas-invisible-lamination-effect', 'Nuba Glow', 'Todo tipo',
 'Fijacion fuerte pero flexible que peina y lamina las cejas en la direccion deseada durante toda la jornada.',
 'Aqua, VP/VA Copolymer, Alcohol Denat., Propylene Glycol, Carbomer, Aminomethyl Propanol, Panthenol.',
 'Cepillar las cejas hacia arriba con el micro-cepillo y presionar suavemente para lograr efecto laminado pulido.', TRUE),

((SELECT id FROM categorias WHERE slug = 'labios-ojos'),
 'Paleta de Sombras Sunset Rose 9 Tonos', 'paleta-sombras-sunset-rose-9-tonos', 'Nuba Glow', 'Todo tipo',
 'Armonia de 9 sombras en acabados mate aterciopelado y satinados metalizados. Pigmentacion intensa y facil difuminado.',
 'Talc, Mica, Magnesium Stearate, Polyethylene, Mineral Oil, Ethylhexyl Palmitate, Dimethicone, CI 77891, CI 77491.',
 'Aplicar tonos mate en la cuenca del ojo para dar profundidad y tonos satinados en el parpado movil con brocha plana o dedo.', TRUE),

((SELECT id FROM categorias WHERE slug = 'labios-ojos'),
 'Paleta de Sombras Warm Earth Nudes 9 Tonos', 'paleta-sombras-warm-earth-nudes-9-tonos', 'Nuba Glow', 'Todo tipo',
 'Gama neutra calida esencial con tonos canela, cafe moca y toffee para looks de dia a noche elegantes.',
 'Mica, Talc, Kaolin, Zinc Stearate, Dimethicone, Silica, Caprylic/Capric Triglyceride, CI 77492, CI 77499.',
 'Combinar tonos claros para iluminar el arco de la ceja y lagrimal con tonos oscuros para delinear y enmarcar la mirada.', TRUE)
ON CONFLICT (slug) DO UPDATE SET
    nombre = EXCLUDED.nombre, marca = EXCLUDED.marca, tipo_piel = EXCLUDED.tipo_piel,
    descripcion = EXCLUDED.descripcion, ingredientes = EXCLUDED.ingredientes, modo_uso = EXCLUDED.modo_uso;

-- ============================================================================
-- 3. VARIANTES DE PRODUCTO (SKU, PRECIO EN BS., STOCK Y PUNTO DE REORDEN)
-- ============================================================================
INSERT INTO variantes (producto_id, sku, nombre, precio, stock, punto_reorden, activo) VALUES
-- Serums y Tratamientos
((SELECT id FROM productos WHERE slug = 'serum-vitamina-c-15-ferulico'), 'NS-VITC-30ML', 'Frasco Gotero 30 ml', 145.00, 18, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'serum-vitamina-c-15-ferulico'), 'NS-VITC-50ML', 'Frasco Gotero 50 ml', 195.00, 10, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'serum-acido-hialuronico-multi-molecular-b5'), 'NS-HA-30ML', 'Frasco 30 ml', 120.00, 24, 6, TRUE),
((SELECT id FROM productos WHERE slug = 'serum-acido-hialuronico-multi-molecular-b5'), 'NS-HA-60ML', 'Frasco 60 ml', 175.00, 12, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'serum-niacinamida-10-zinc-pca'), 'NS-NIA-30ML', 'Frasco 30 ml', 95.00, 20, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'serum-retinol-puro-03-nocturno'), 'NS-RET-30ML', 'Frasco Opaco 30 ml', 160.00, 8, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'serum-acido-salicilico-bha-2'), 'NS-BHA-30ML', 'Frasco 30 ml', 110.00, 15, 5, TRUE),

-- Limpieza Facial
((SELECT id FROM productos WHERE slug = 'gel-limpiador-purificante-acido-salicilico'), 'NS-GEL-200ML', 'Botella con Dispensador 200 ml', 95.00, 14, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'gel-limpiador-purificante-acido-salicilico'), 'NS-GEL-400ML', 'Tamano Ahorro 400 ml', 150.00, 7, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'espuma-limpiadora-calmante-centella-asiatica'), 'NS-ESP-150ML', 'Envase Espumador 150 ml', 110.00, 16, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'aceite-limpiador-desmaquillante-nutritivo'), 'NS-OIL-150ML', 'Botella 150 ml', 130.00, 11, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'balsamo-limpiador-avena-escualano'), 'NS-BAL-100G', 'Tarro 100 g', 125.00, 9, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'agua-micelar-calmante-rosas-pantenol'), 'NS-MIC-250ML', 'Botella 250 ml', 75.00, 22, 6, TRUE),

-- Hidratacion y Barrera
((SELECT id FROM productos WHERE slug = 'crema-hidratante-ceramide-barrier-relief'), 'NS-CER-50G', 'Tubo 50 g', 120.00, 6, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'crema-hidratante-ceramide-barrier-relief'), 'NS-CER-100G', 'Tubo 100 g', 180.00, 12, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'gel-crema-hidratante-matificante-oil-free'), 'NS-GELC-50ML', 'Tubo Airless 50 ml', 105.00, 15, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'crema-nutritiva-noche-peptidos-cobre'), 'NS-PEP-50ML', 'Tarro 50 ml', 175.00, 7, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'tonico-hidratante-equilibrante-niacinamida-5'), 'NS-TON-150ML', 'Frasco 150 ml', 85.00, 11, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'mascarilla-nocturna-reparadora-cica-alantoina'), 'NS-MASK-80ML', 'Tubo 80 ml', 115.00, 10, 4, TRUE),

-- Proteccion Solar
((SELECT id FROM productos WHERE slug = 'protector-solar-toque-seco-spf-50-invisible'), 'NS-SPF-50ML', 'Tubo 50 ml', 130.00, 18, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'protector-solar-toque-seco-spf-50-invisible'), 'NS-SPF-100ML', 'Tubo Familiar 100 ml', 210.00, 9, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'protector-solar-mineral-calming-spf-50-zinc'), 'NS-SPFMIN-50ML', 'Tubo 50 ml', 145.00, 12, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'fluido-solar-matificante-ultra-ligero-spf-50'), 'NS-SPFFLU-50ML', 'Frasco con Dosificador 50 ml', 135.00, 15, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'bruma-solar-fijadora-spf-50-reaplicacion'), 'NS-SPFMIST-75ML', 'Spray 75 ml', 115.00, 13, 4, TRUE),

-- Maquillaje de Rostro
((SELECT id FROM productos WHERE slug = 'base-liquida-glow-serum-ligera-spf-20'), 'NG-BASE-100W', 'Tono 100W Calido Claro', 160.00, 8, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'base-liquida-glow-serum-ligera-spf-20'), 'NG-BASE-120N', 'Tono 120N Neutro Claro', 160.00, 10, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'base-liquida-glow-serum-ligera-spf-20'), 'NG-BASE-200C', 'Tono 200C Frio Medio', 160.00, 7, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'base-liquida-glow-serum-ligera-spf-20'), 'NG-BASE-220W', 'Tono 220W Calido Medio', 160.00, 12, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'base-liquida-glow-serum-ligera-spf-20'), 'NG-BASE-300N', 'Tono 300N Neutro Moreno', 160.00, 9, 3, TRUE),

((SELECT id FROM productos WHERE slug = 'base-mate-terciopelo-larga-duracion-24h'), 'NG-BMAT-110N', 'Tono 110N Claro', 165.00, 9, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'base-mate-terciopelo-larga-duracion-24h'), 'NG-BMAT-210W', 'Tono 210W Medio', 165.00, 11, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'base-mate-terciopelo-larga-duracion-24h'), 'NG-BMAT-310C', 'Tono 310C Moreno', 165.00, 6, 3, TRUE),

((SELECT id FROM productos WHERE slug = 'corrector-hidratante-alta-cobertura-cafeina'), 'NG-CORR-FAIR', 'Tono Fair (Muy Claro)', 95.00, 14, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'corrector-hidratante-alta-cobertura-cafeina'), 'NG-CORR-LIGHT', 'Tono Light (Claro)', 95.00, 18, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'corrector-hidratante-alta-cobertura-cafeina'), 'NG-CORR-MED', 'Tono Medium (Medio)', 95.00, 15, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'corrector-hidratante-alta-cobertura-cafeina'), 'NG-CORR-TAN', 'Tono Tan (Bronce)', 95.00, 8, 3, TRUE),

((SELECT id FROM productos WHERE slug = 'rubor-liquido-soft-tint-rose-acabado-natural'), 'NG-BLUSH-PETAL', 'Tono Petal (Rosa Suave)', 110.00, 14, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'rubor-liquido-soft-tint-rose-acabado-natural'), 'NG-BLUSH-JOY', 'Tono Joy (Durazno Radiante)', 110.00, 10, 3, TRUE),
((SELECT id FROM productos WHERE slug = 'rubor-liquido-soft-tint-rose-acabado-natural'), 'NG-BLUSH-HOPE', 'Tono Hope (Malva Calido)', 110.00, 12, 4, TRUE),

((SELECT id FROM productos WHERE slug = 'iluminador-liquido-glow-drops-champagne'), 'NG-ILUM-CHAMP', 'Tono Champagne Gold', 125.00, 12, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'iluminador-liquido-glow-drops-champagne'), 'NG-ILUM-ROSE', 'Tono Rose Glow', 125.00, 9, 3, TRUE),

((SELECT id FROM productos WHERE slug = 'polvo-traslucido-fijador-matificante-ultrafino'), 'NG-POLV-TRANSP', 'Tono Traslucido Universal', 115.00, 16, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'polvo-traslucido-fijador-matificante-ultrafino'), 'NG-POLV-BANANA', 'Tono Banana Iluminador', 115.00, 8, 3, TRUE),

-- Labios y Ojos
((SELECT id FROM productos WHERE slug = 'balsamo-labial-reparador-peptidos-karite'), 'NG-LIPB-BERRY', 'Tono Berry Tint', 70.00, 20, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'balsamo-labial-reparador-peptidos-karite'), 'NG-LIPB-NUDE', 'Tono Nude Glow', 70.00, 18, 5, TRUE),

((SELECT id FROM productos WHERE slug = 'labial-liquido-mate-velvet-sedoso'), 'NG-LIPM-VINT', 'Tono Vintage Rose', 85.00, 15, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'labial-liquido-mate-velvet-sedoso'), 'NG-LIPM-SUCRE', 'Tono Carmin Sucre', 85.00, 12, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'labial-liquido-mate-velvet-sedoso'), 'NG-LIPM-CANE', 'Tono Canela Nude', 85.00, 14, 4, TRUE),

((SELECT id FROM productos WHERE slug = 'aceite-labial-nutritivo-lip-oil-escualano'), 'NG-LIPOIL-CRIS', 'Tono Cristal Transparente', 90.00, 16, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'aceite-labial-nutritivo-lip-oil-escualano'), 'NG-LIPOIL-CHERRY', 'Tono Cereza Silvestre', 90.00, 14, 4, TRUE),

((SELECT id FROM productos WHERE slug = 'mascara-pestanas-efecto-lifting-longitud-24h'), 'NG-MASC-NEGRO', 'Tono Negro Carbon Ultra', 105.00, 17, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'gel-fijador-cejas-invisible-lamination-effect'), 'NG-BROW-CLEAR', 'Tono Transparente', 75.00, 19, 5, TRUE),
((SELECT id FROM productos WHERE slug = 'paleta-sombras-sunset-rose-9-tonos'), 'NG-PAL-SUNSET', 'Estuche Rose Gold 9 Sombras', 145.00, 8, 4, TRUE),
((SELECT id FROM productos WHERE slug = 'paleta-sombras-warm-earth-nudes-9-tonos'), 'NG-PAL-EARTH', 'Estuche Nude Elegance 9 Sombras', 145.00, 10, 4, TRUE)
ON CONFLICT (sku) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    precio = EXCLUDED.precio,
    stock = EXCLUDED.stock,
    punto_reorden = EXCLUDED.punto_reorden;

-- ============================================================================
-- 4. IMAGENES PRINCIPALES DE PRODUCTOS (ASOCIADAS A ASSETS OFICIALES)
-- ============================================================================
INSERT INTO imagenes_producto (producto_id, url, es_principal, orden)
SELECT p.id, 'assets/brand/icono1.png', TRUE, 0
FROM productos p
WHERE NOT EXISTS (
    SELECT 1 FROM imagenes_producto img WHERE img.producto_id = p.id
);

-- ============================================================================
-- 5. NOTA SOBRE USUARIOS Y CONTRASENAS (SEGURIDAD ESTRICTA)
-- ============================================================================
-- Por mandato de seguridad estricta de CLAUDE.md, las contrasenas nunca deben
-- estar quemadas en texto plano en este archivo SQL ni en el repositorio Git.
-- 
-- Para sembrar los 5 usuarios (admin, almacen, logistica, vendedor, cliente) con
-- contrasenas criptograficas unicas generadas al vuelo mediante bcrypt (coste >= 12):
-- Ejecute en la terminal:
-- npm run db:seed
--
-- Dicho comando mostrara las contrasenas una sola vez en la consola y las
-- respaldara localmente en seed_passwords.txt (archivo protegido en .gitignore).
-- ============================================================================