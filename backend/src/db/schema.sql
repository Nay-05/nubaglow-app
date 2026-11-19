-- ============================================================================
-- NubaGlow App — Esquema Relacional de Base de Datos (PostgreSQL en Supabase)
-- Proyecto de Ingenieria de Software — Grupo 11 (Nuba Beauty, Sucre, Bolivia)
-- Version: 1.1.0
-- Idempotente: seguro para ejecutarse multiples veces sin romper la estructura.
-- ============================================================================

-- Habilitar extension para generacion de identificadores UUID si se requiere
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLA: usuarios
-- Descripcion: Usuarios del sistema con control de acceso basado en roles (RBAC).
-- Roles permitidos: 'cliente', 'vendedor', 'almacen', 'logistica', 'admin'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuarios_email UNIQUE (email),
    CONSTRAINT chk_usuarios_rol CHECK (rol IN ('cliente', 'vendedor', 'almacen', 'logistica', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);

-- ----------------------------------------------------------------------------
-- 2. TABLA: categorias
-- Descripcion: Clasificacion de productos (Skincare, Maquillaje, Labios, etc.).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_categorias_nombre UNIQUE (nombre),
    CONSTRAINT uq_categorias_slug UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_categorias_slug ON categorias(slug);

-- ----------------------------------------------------------------------------
-- 3. TABLA: productos
-- Descripcion: Articulos principales del catalogo de belleza.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    marca VARCHAR(100) NOT NULL DEFAULT 'NubaGlow',
    tipo_piel VARCHAR(50) NOT NULL DEFAULT 'Todo tipo',
    descripcion TEXT NOT NULL,
    ingredientes TEXT NOT NULL,
    modo_uso TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_productos_slug UNIQUE (slug),
    CONSTRAINT chk_productos_tipo_piel CHECK (tipo_piel IN ('Todo tipo', 'Seca', 'Grasa', 'Mixta', 'Sensible'))
);

CREATE INDEX IF NOT EXISTS idx_productos_slug ON productos(slug);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_tipo_piel ON productos(tipo_piel);

-- ----------------------------------------------------------------------------
-- 4. TABLA: variantes
-- Descripcion: Presentaciones, tonos o tamanos especificos con SKU y stock individual.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS variantes (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    sku VARCHAR(60) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    precio NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    punto_reorden INTEGER NOT NULL DEFAULT 5,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_variantes_sku UNIQUE (sku),
    CONSTRAINT chk_variantes_precio CHECK (precio >= 0),
    CONSTRAINT chk_variantes_stock CHECK (stock >= 0),
    CONSTRAINT chk_variantes_reorden CHECK (punto_reorden >= 0)
);

CREATE INDEX IF NOT EXISTS idx_variantes_sku ON variantes(sku);
CREATE INDEX IF NOT EXISTS idx_variantes_producto_id ON variantes(producto_id);

-- ----------------------------------------------------------------------------
-- 5. TABLA: imagenes_producto
-- Descripcion: Galeria visual de cada producto cosmético.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imagenes_producto (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imagenes_producto_id ON imagenes_producto(producto_id);

-- ----------------------------------------------------------------------------
-- 6. TABLA: resenas
-- Descripcion: Valoraciones de 1 a 5 estrellas. Solo para compradores verificados.
-- Maximo una resena por producto por cliente.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resenas (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    calificacion INTEGER NOT NULL,
    comentario TEXT NOT NULL,
    verificado BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_resena_producto_usuario UNIQUE (producto_id, usuario_id),
    CONSTRAINT chk_resenas_calificacion CHECK (calificacion BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_resenas_producto_id ON resenas(producto_id);
CREATE INDEX IF NOT EXISTS idx_resenas_usuario_id ON resenas(usuario_id);

-- ----------------------------------------------------------------------------
-- 7. TABLA: carritos
-- Descripcion: Carrito persistente en base de datos para clientes autenticados.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carritos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_carritos_usuario UNIQUE (usuario_id)
);

-- ----------------------------------------------------------------------------
-- 8. TABLA: carrito_items
-- Descripcion: Articulos seleccionados dentro del carrito de compra.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrito_items (
    id SERIAL PRIMARY KEY,
    carrito_id INTEGER NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
    variante_id INTEGER NOT NULL REFERENCES variantes(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 1,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_carrito_variante UNIQUE (carrito_id, variante_id),
    CONSTRAINT chk_carrito_items_cantidad CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_carrito_items_carrito ON carrito_items(carrito_id);

-- ----------------------------------------------------------------------------
-- 9. TABLA: pedidos
-- Descripcion: Ordenes de compra web confirmadas con codigo de rastreo unico.
-- Formato de codigo_rastreo: NB-2026-XXXX.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    codigo_rastreo VARCHAR(60) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    costo_envio NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    nombre_cliente VARCHAR(150) NOT NULL,
    celular_cliente VARCHAR(30) NOT NULL,
    correo_cliente VARCHAR(255) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    notas TEXT,
    cancelado_at TIMESTAMPTZ,
    motivo_cancelacion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pedidos_codigo_rastreo UNIQUE (codigo_rastreo),
    CONSTRAINT chk_pedidos_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_pedidos_costo_envio CHECK (costo_envio >= 0),
    CONSTRAINT chk_pedidos_total CHECK (total >= 0),
    CONSTRAINT chk_pedidos_estado CHECK (estado IN ('Pendiente', 'En preparación', 'Empacado', 'En tránsito', 'Entregado', 'Cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_rastreo ON pedidos(codigo_rastreo);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);

-- ----------------------------------------------------------------------------
-- 10. TABLA: pedido_items
-- Descripcion: Detalle de productos y precios congelados al momento de la compra.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
    variante_id INTEGER NOT NULL REFERENCES variantes(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    CONSTRAINT chk_pedido_items_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_pedido_items_precio CHECK (precio_unitario >= 0),
    CONSTRAINT chk_pedido_items_subtotal CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);

-- ----------------------------------------------------------------------------
-- 11. TABLA: pagos
-- Descripcion: Registro de transacciones financieras y su verificacion manual.
-- Estados: 'Pendiente', 'En verificación', 'Aprobado', 'Rechazado'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
    metodo VARCHAR(50) NOT NULL,
    monto NUMERIC(10, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'BOB',
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    referencia VARCHAR(100),
    referencia_externa VARCHAR(150),
    paypal_order_id VARCHAR(150),
    -- TEXT porque el comprobante puede almacenarse como data URL (base64).
    comprobante_url TEXT,
    fecha_vencimiento TIMESTAMPTZ,
    verificado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_verificacion TIMESTAMPTZ,
    motivo_rechazo TEXT,
    simulado BOOLEAN NOT NULL DEFAULT TRUE,
    pagado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pagos_pedido UNIQUE (pedido_id),
    CONSTRAINT chk_pagos_monto CHECK (monto >= 0),
    CONSTRAINT chk_pagos_metodo CHECK (metodo IN ('qr', 'qr_simple', 'deposito_bancario', 'paypal', 'contra_entrega')),
    CONSTRAINT chk_pagos_estado CHECK (estado IN ('Pendiente', 'En verificación', 'Aprobado', 'Rechazado'))
);

CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- ----------------------------------------------------------------------------
-- 11.1 TABLA: pago_eventos
-- Descripcion: Historial inmutable de cada transicion de estado de un pago.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pago_eventos (
    id SERIAL PRIMARY KEY,
    pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE RESTRICT,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30) NOT NULL,
    descripcion TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pago_eventos_estado_nuevo CHECK (estado_nuevo IN ('Pendiente', 'En verificación', 'Aprobado', 'Rechazado'))
);

CREATE INDEX IF NOT EXISTS idx_pago_eventos_pago ON pago_eventos(pago_id);

-- ----------------------------------------------------------------------------
-- 11.2 TABLA: comprobantes_pago
-- Descripcion: Archivos de comprobante cargados por el cliente para verificacion.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comprobantes_pago (
    id SERIAL PRIMARY KEY,
    pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE RESTRICT,
    nombre_archivo VARCHAR(255) NOT NULL,
    -- El comprobante se guarda como data URL; TEXT evita el limite de 500 chars.
    url TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tamano_bytes INTEGER NOT NULL DEFAULT 0,
    hash_sha256 VARCHAR(64),
    subido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprobantes_tamano CHECK (tamano_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_pago ON comprobantes_pago(pago_id);

-- ----------------------------------------------------------------------------
-- 12. TABLA: envios
-- Descripcion: Gestion del paquete fisico, responsables y courier.
-- Estados: 'Pendiente', 'En preparación', 'Empacado', 'En tránsito', 'Entregado'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS envios (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
    codigo_rastreo VARCHAR(60) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    transportista VARCHAR(100) NOT NULL DEFAULT 'Nuba Express Sucre',
    preparado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    empacado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    despachado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    entregado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_despacho TIMESTAMPTZ,
    fecha_entrega TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_envios_pedido UNIQUE (pedido_id),
    CONSTRAINT uq_envios_codigo_rastreo UNIQUE (codigo_rastreo),
    CONSTRAINT chk_envios_estado CHECK (estado IN ('Pendiente', 'En preparación', 'Empacado', 'En tránsito', 'Entregado'))
);

CREATE INDEX IF NOT EXISTS idx_envios_codigo_rastreo ON envios(codigo_rastreo);
CREATE INDEX IF NOT EXISTS idx_envios_estado ON envios(estado);

-- ----------------------------------------------------------------------------
-- 12.1 TABLA: entregas
-- Descripcion: Acta de cierre de entrega con receptor, fecha, hora y nota.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entregas (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
    envio_id INTEGER NOT NULL REFERENCES envios(id) ON DELETE RESTRICT,
    receptor VARCHAR(150) NOT NULL,
    documento VARCHAR(50),
    fecha_entrega DATE NOT NULL,
    hora_entrega TIME NOT NULL,
    nota TEXT NOT NULL,
    comprobante_url VARCHAR(500),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_entregas_pedido UNIQUE (pedido_id),
    CONSTRAINT uq_entregas_envio UNIQUE (envio_id)
);

CREATE INDEX IF NOT EXISTS idx_entregas_usuario ON entregas(usuario_id);

-- ----------------------------------------------------------------------------
-- 13. TABLA: envio_eventos
-- Descripcion: Historial secuencial de cambios de estado del envio.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS envio_eventos (
    id SERIAL PRIMARY KEY,
    envio_id INTEGER NOT NULL REFERENCES envios(id) ON DELETE RESTRICT,
    estado VARCHAR(30) NOT NULL,
    descripcion TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_envio_eventos_estado CHECK (estado IN ('Pendiente', 'En preparación', 'Empacado', 'En tránsito', 'Entregado'))
);

CREATE INDEX IF NOT EXISTS idx_envio_eventos_envio ON envio_eventos(envio_id);

-- ----------------------------------------------------------------------------
-- 14. TABLA: ventas_pos
-- Descripcion: Ventas registradas en tienda fisica por un vendedor en mostrador.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_pos (
    id SERIAL PRIMARY KEY,
    numero_ticket VARCHAR(60) NOT NULL,
    vendedor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    subtotal NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    monto_recibido NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cambio NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cliente_nombre VARCHAR(150),
    cliente_nit_ci VARCHAR(50),
    cliente_correo VARCHAR(255),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ventas_pos_ticket UNIQUE (numero_ticket),
    CONSTRAINT chk_ventas_pos_total CHECK (total >= 0),
    CONSTRAINT chk_ventas_pos_metodo CHECK (metodo_pago IN ('Efectivo', 'QR Simple'))
);

CREATE INDEX IF NOT EXISTS idx_ventas_pos_vendedor ON ventas_pos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_pos_ticket ON ventas_pos(numero_ticket);

-- ----------------------------------------------------------------------------
-- 15. TABLA: facturas
-- Descripcion: Comprobantes o recibos emitidos (compra web o mostrador POS).
-- Nota: Simulado con fines academicos sin valor fiscal real.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE RESTRICT,
    venta_pos_id INTEGER REFERENCES ventas_pos(id) ON DELETE RESTRICT,
    numero_factura VARCHAR(60) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    monto_total NUMERIC(10, 2) NOT NULL,
    pdf_url VARCHAR(500),
    es_simulacion BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_facturas_numero UNIQUE (numero_factura),
    CONSTRAINT chk_facturas_tipo CHECK (tipo IN ('compra_web', 'venta_pos')),
    CONSTRAINT chk_facturas_monto CHECK (monto_total >= 0)
);

-- ----------------------------------------------------------------------------
-- 16. TABLA: movimientos_inventario
-- Descripcion: Kardex de entradas, salidas y ajustes de stock por variante.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id SERIAL PRIMARY KEY,
    variante_id INTEGER NOT NULL REFERENCES variantes(id) ON DELETE RESTRICT,
    tipo VARCHAR(30) NOT NULL,
    cantidad INTEGER NOT NULL,
    stock_anterior INTEGER NOT NULL,
    stock_nuevo INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_movimientos_tipo CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'venta_web', 'venta_pos', 'reposicion_cancelacion')),
    CONSTRAINT chk_movimientos_stock_nuevo CHECK (stock_nuevo >= 0)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_variante ON movimientos_inventario(variante_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_inventario(tipo);

-- ----------------------------------------------------------------------------
-- 17. TABLA: auditoria
-- Descripcion: Registro inmutable de acciones criticas en el sistema.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(60),
    registro_id INTEGER,
    detalles JSONB,
    ip_origen VARCHAR(60),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(creado_en);

-- ----------------------------------------------------------------------------
-- 18. TABLA: notificaciones
-- Descripcion: Registro de alertas enviadas por correo electronico, Telegram o WhatsApp.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE RESTRICT,
    canal VARCHAR(30) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    asunto VARCHAR(255),
    cuerpo TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    error TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enviado_en TIMESTAMPTZ,
    CONSTRAINT chk_notificaciones_canal CHECK (canal IN ('correo', 'telegram', 'whatsapp')),
    CONSTRAINT chk_notificaciones_estado CHECK (estado IN ('Pendiente', 'Enviado', 'Fallido'))
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_pedido ON notificaciones(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones(estado);

-- ============================================================================
-- MIGRACIONES IDEMPOTENTES 1.1.0 — FASE 5.5
-- Aplican sobre bases de datos ya existentes creadas con la version 1.0.0.
-- ============================================================================

-- 1. Cinco roles RBAC: operaciones se divide en almacen y logistica.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuarios_rol;
UPDATE usuarios SET rol = 'almacen' WHERE rol = 'operaciones';
UPDATE usuarios SET activo = FALSE WHERE email = 'operaciones@nuba.bo';
ALTER TABLE usuarios
    ADD CONSTRAINT chk_usuarios_rol
    CHECK (rol IN ('cliente', 'vendedor', 'almacen', 'logistica', 'admin'));

-- 2. Pedidos: cancelacion auditada y estado Empacado.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS chk_pedidos_estado;
ALTER TABLE pedidos
    ADD CONSTRAINT chk_pedidos_estado
    CHECK (estado IN ('Pendiente', 'En preparación', 'Empacado', 'En tránsito', 'Entregado', 'Cancelado'));

-- 3. Pagos: metodos, verificacion manual y datos de PayPal.
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) NOT NULL DEFAULT 'BOB';
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS referencia_externa VARCHAR(150);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS paypal_order_id VARCHAR(150);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
ALTER TABLE pagos ALTER COLUMN comprobante_url TYPE TEXT;
ALTER TABLE comprobantes_pago ALTER COLUMN url TYPE TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS verificado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_verificacion TIMESTAMPTZ;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS chk_pagos_metodo;
ALTER TABLE pagos
    ADD CONSTRAINT chk_pagos_metodo
    CHECK (metodo IN ('qr', 'qr_simple', 'deposito_bancario', 'paypal', 'contra_entrega'));
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS chk_pagos_estado;
ALTER TABLE pagos
    ADD CONSTRAINT chk_pagos_estado
    CHECK (estado IN ('Pendiente', 'En verificación', 'Aprobado', 'Rechazado'));
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_paypal_order ON pagos(paypal_order_id);

-- 4. Envios: nuevo estado Empacado y responsables por etapa.
ALTER TABLE envios ADD COLUMN IF NOT EXISTS preparado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS empacado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS despachado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS entregado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE envios DROP CONSTRAINT IF EXISTS chk_envios_estado;
ALTER TABLE envios
    ADD CONSTRAINT chk_envios_estado
    CHECK (estado IN ('Pendiente', 'En preparación', 'Empacado', 'En tránsito', 'Entregado'));
CREATE INDEX IF NOT EXISTS idx_envios_estado ON envios(estado);
ALTER TABLE envio_eventos DROP CONSTRAINT IF EXISTS chk_envio_eventos_estado;
ALTER TABLE envio_eventos
    ADD CONSTRAINT chk_envio_eventos_estado
    CHECK (estado IN ('Pendiente', 'En preparación', 'Empacado', 'En tránsito', 'Entregado'));

-- 5. Kardex: reposicion por cancelacion con referencia al pedido.
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS pedido_id INTEGER REFERENCES pedidos(id) ON DELETE RESTRICT;
ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS chk_movimientos_tipo;
ALTER TABLE movimientos_inventario
    ADD CONSTRAINT chk_movimientos_tipo
    CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'venta_web', 'venta_pos', 'reposicion_cancelacion'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_mov_reposicion_cancelacion
    ON movimientos_inventario(pedido_id, variante_id, tipo)
    WHERE tipo = 'reposicion_cancelacion';
