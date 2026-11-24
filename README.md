# NubaGlow — E-commerce y gestión interna

NubaGlow es la tienda digital de **Nuba Beauty**, un emprendimiento de cosméticos y
skincare de Sucre, Bolivia. El sistema combina una tienda pública con carrito,
checkout, pagos, rastreo, reseñas y asistente IA, junto con un portal interno
separado para administración, ventas POS, almacén y logística.

Proyecto académico de Ingeniería de Software — Grupo 11.

---

## 1. Arquitectura

El backend usa una arquitectura estricta por capas:

`routes/ -> controllers/ -> services/ -> db/`

- **Routes:** define rutas, middlewares de autenticación, RBAC y validación Zod.
- **Controllers:** traduce HTTP a llamadas de servicio y respuestas JSON.
- **Services:** contiene reglas de negocio, transacciones y auditoría.
- **DB:** centraliza PostgreSQL/Supabase mediante consultas parametrizadas.
- **Frontend:** HTML5, CSS3 y JavaScript vanilla modular, sin frameworks.

### Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Base de datos | PostgreSQL en Supabase |
| Autenticación | JWT, cookies HttpOnly, bcrypt coste 12, RBAC |
| Seguridad | Helmet, CORS, rate limiting, CSRF, Zod |
| Pagos | PayPal sandbox server-side, QR y depósito simulados |
| Documentos | PDFKit para comprobantes y actas |
| Notificaciones | Nodemailer, Telegram Bot API y WhatsApp `wa.me` |
| IA | Gemini server-side con fallback local por reglas |
| Deploy | Render + Supabase |

---

## 2. Roles y flujo operativo

| Rol | Responsabilidad |
|---|---|
| `cliente` | Compra web, carrito, pedidos, rastreo y reseñas verificadas |
| `vendedor` | POS presencial, recibos y verificación de pagos |
| `almacen` | Inventario, Kardex y preparación/empaque de pedidos |
| `logistica` | Despacho, tránsito y cierre de entrega con comprobante |
| `admin` | Control total, productos, usuarios, reportes y auditoría |

Estados de pago: `Pendiente`, `En verificación`, `Aprobado`, `Rechazado`.

Estados de envío: `Pendiente`, `En preparación`, `Empacado`, `En tránsito`,
`Entregado`.

Todas las reglas de permisos se validan en el servidor con `verificarToken` y
`requerirRol(...)`. El sidebar solo mejora la experiencia; no sustituye al RBAC.

---

## 3. Instalación local

Requisitos: Node.js 18+, npm 9+ y PostgreSQL 14+ o una instancia de Supabase.

```bash
# 1. Dependencias
npm install
npm run backend:install

# 2. Variables de entorno
cp .env.example .env
# Completar DATABASE_URL, secretos JWT y credenciales opcionales.

# 3. Base de datos
npm run db:migrate
npm run db:seed
npm run db:imagenes

# 4. Preparar la demo oral (idempotente, no borra historiales)
npm run demo:preparar

# 5. Desarrollo
npm run dev
```

La aplicación queda disponible en `http://localhost:4000`. En desarrollo el
servidor sirve la API, los archivos estáticos y el fallback SPA.

### Variables de entorno

Los valores siguientes son ficticios y sirven como ejemplo. Nunca se commitea el
archivo `.env` real.

| Variable | Ejemplo | Uso |
|---|---|---|
| `PORT` | `4000` | Puerto del servidor |
| `NODE_ENV` | `production` | Entorno de ejecución |
| `APP_URL` | `https://nubaglow-web.onrender.com` | URL pública del sistema |
| `FRONTEND_URL` | `https://nubaglow-web.onrender.com` | Origen permitido por CORS |
| `CLIENT_URL` | `http://localhost:3000` | Origen alternativo de desarrollo |
| `DATABASE_URL` | `postgresql://usuario:clave@host:5432/postgres` | PostgreSQL/Supabase |
| `JWT_SECRET` | `clave_ficticia_larga` | Firma del access token |
| `JWT_REFRESH_SECRET` | `otra_clave_ficticia_larga` | Firma del refresh token |
| `JWT_EXPIRES_IN` | `15m` | Vigencia del access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Vigencia del refresh token |
| `SMTP_HOST` | `smtp.ejemplo.com` | Servidor de correo |
| `SMTP_PORT` | `587` | Puerto SMTP |
| `SMTP_USER` | `correo@ejemplo.com` | Usuario SMTP |
| `SMTP_PASS` | `password_ficticio` | Clave SMTP |
| `SMTP_FROM` | `NubaGlow <correo@ejemplo.com>` | Remitente |
| `RESEND_API_KEY` | `re_clave_ficticia` | Respaldo de correo por HTTP (Resend) |
| `RESEND_FROM` | `NubaGlow <no-responder@dominio.com>` | Remitente para Resend |
| `BREVO_API_KEY` | `clave_ficticia_brevo` | Respaldo de correo por HTTP (Brevo) |
| `BREVO_FROM` | `NubaGlow <no-responder@dominio.com>` | Remitente para Brevo |
| `EMAIL_REPLY_TO` | `respuestas@dominio.com` | Responder a (opcional) |
| `NOTIFICACIONES_TEST_KEY` | `clave_larga_privada` | Autoriza la prueba real sin admin |
| `NOTIFICACIONES_TEST_EMAIL` | `pruebas@dominio.com` | Destinatario por defecto de la prueba |
| `PAGO_VENCIMIENTO_HORAS` | `24` | Vencimiento de pagos pendientes |
| `PAYPAL_MODO` | `simulado` | `simulado` o `sandbox` |
| `PAYPAL_CLIENT_ID` | `client_id_ficticio` | Credencial sandbox |
| `PAYPAL_CLIENT_SECRET` | `client_secret_ficticio` | Credencial sandbox |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` | API PayPal sandbox |
| `PAYPAL_TIPO_CAMBIO_BOB_USD` | `6.96` | Bs. por 1 USD |
| `COMPROBANTE_MAX_MB` | `2` | Límite de comprobantes |
| `ENVIO_COSTO` | `15` | Costo de envío en Bs. |
| `ENVIO_GRATIS_DESDE` | `200` | Umbral de envío gratis |
| `COBRO_BANCO` | `Banco Demo Académico` | Datos de cobro simulados |
| `COBRO_TITULAR` | `NubaGlow Simulación` | Titular simulado |
| `COBRO_CUENTA` | `0000000000` | Cuenta simulada |
| `COBRO_REFERENCIA_QR` | `NB-QR-DEMO-2026` | Referencia QR simulada |
| `WHATSAPP_NUMERO` | `59170000000` | Número público ficticio |
| `TELEGRAM_BOT_TOKEN` | `token_ficticio` | Bot de alertas |
| `TELEGRAM_CHAT_ID` | `chat_ficticio` | Chat de operaciones |
| `GEMINI_API_KEY` | `clave_ficticia` | Clave del asistente IA |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo Gemini |

---

## 4. Base de datos

El esquema implementa **21 tablas reales**: las 18 tablas mínimas solicitadas y
tres tablas de soporte (`pago_eventos`, `comprobantes_pago` y `entregas`). El
esquema versionado está en `backend/src/db/schema.sql`.

### Diagrama entidad-relación

```mermaid
erDiagram
    usuarios ||--o{ carritos : posee
    usuarios ||--o{ resenas : escribe
    usuarios ||--o{ pedidos : realiza
    usuarios ||--o{ ventas_pos : registra
    usuarios ||--o{ movimientos_inventario : responsable
    usuarios ||--o{ auditoria : ejecuta
    usuarios ||--o{ pago_eventos : registra
    usuarios ||--o{ comprobantes_pago : sube
    usuarios ||--o{ entregas : cierra

    categorias ||--o{ productos : clasifica
    productos ||--o{ variantes : contiene
    productos ||--o{ imagenes_producto : muestra
    productos ||--o{ resenas : recibe

    carritos ||--o{ carrito_items : contiene
    variantes ||--o{ carrito_items : agregado

    pedidos ||--o{ pedido_items : contiene
    variantes ||--o{ pedido_items : vendido
    pedidos ||--o{ pagos : genera
    pagos ||--o{ pago_eventos : historial
    pagos ||--o{ comprobantes_pago : adjunta
    pedidos ||--o{ envios : despacha
    envios ||--o{ envio_eventos : historial
    pedidos ||--o| entregas : cierra
    envios ||--o| entregas : confirma
    pedidos ||--o{ facturas : factura
    pedidos ||--o{ notificaciones : notifica

    ventas_pos ||--o| facturas : emite
    variantes ||--o{ movimientos_inventario : mueve
    pedidos ||--o{ movimientos_inventario : referencia

    usuarios {
        int id PK
        string nombre
        string email UK
        string celular
        string password_hash
        string rol
        boolean activo
    }
    categorias {
        int id PK
        string nombre
        string slug UK
        string descripcion
    }
    productos {
        int id PK
        int categoria_id FK
        string nombre
        string slug UK
        string marca
        string tipo_piel
        boolean activo
    }
    variantes {
        int id PK
        int producto_id FK
        string sku UK
        numeric precio
        int stock
        int punto_reorden
        boolean activo
    }
    imagenes_producto {
        int id PK
        int producto_id FK
        string url
        boolean es_principal
        int orden
    }
    resenas {
        int id PK
        int producto_id FK
        int usuario_id FK
        int calificacion
        string comentario
    }
    carritos {
        int id PK
        int usuario_id FK
    }
    carrito_items {
        int id PK
        int carrito_id FK
        int variante_id FK
        int cantidad
    }
    pedidos {
        int id PK
        int usuario_id FK
        string codigo_rastreo UK
        numeric total
        string estado
        string nombre_cliente
        string celular_cliente
        string correo_cliente
        string ciudad
        string direccion
        timestamp cancelado_at
    }
    pedido_items {
        int id PK
        int pedido_id FK
        int variante_id FK
        int cantidad
        numeric subtotal
    }
    pagos {
        int id PK
        int pedido_id FK
        string metodo
        numeric monto
        string estado
        string referencia_externa
        timestamp fecha_vencimiento
    }
    pago_eventos {
        int id PK
        int pago_id FK
        string estado_anterior
        string estado_nuevo
        int usuario_id FK
    }
    comprobantes_pago {
        int id PK
        int pago_id FK
        string nombre_archivo
        string url
        string mime_type
        int subido_por FK
    }
    envios {
        int id PK
        int pedido_id FK
        string codigo_rastreo UK
        string estado
        string transportista
        int preparado_por FK
        int empacado_por FK
        int despachado_por FK
        int entregado_por FK
    }
    envio_eventos {
        int id PK
        int envio_id FK
        string estado
        string descripcion
        int usuario_id FK
    }
    entregas {
        int id PK
        int pedido_id FK
        int envio_id FK
        string receptor
        date fecha_entrega
        time hora_entrega
        string nota
        int usuario_id FK
    }
    ventas_pos {
        int id PK
        int vendedor_id FK
        string numero_ticket UK
        numeric subtotal
        numeric total
        string metodo_pago
        string cliente_correo
        jsonb detalle
    }
    facturas {
        int id PK
        int pedido_id FK
        int venta_pos_id FK
        string numero_factura UK
        string tipo
        numeric monto_total
        boolean es_simulacion
    }
    movimientos_inventario {
        int id PK
        int variante_id FK
        string tipo
        int cantidad
        int stock_anterior
        int stock_nuevo
        string motivo
        int usuario_id FK
        int pedido_id FK
    }
    auditoria {
        int id PK
        int usuario_id FK
        string accion
        string tabla_afectada
        int registro_id
        jsonb detalles
        timestamp creado_en
    }
    notificaciones {
        int id PK
        int pedido_id FK
        string canal
        string destinatario
        string asunto
        string cuerpo
        string estado
    }
```

Las operaciones de compra, POS, cancelación y cierre de entrega usan
transacciones (`BEGIN` / `COMMIT` / `ROLLBACK`), bloqueo `FOR UPDATE` cuando hay
stock involucrado y movimientos de Kardex para conservar trazabilidad.

---

## 5. Endpoints REST

Todas las respuestas usan JSON estructurado. Las rutas `/api/staff/*` también
validan el rol en el servidor; no dependen del sidebar.

### 5.1. Salud, configuración y autenticación

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/salud` | público | Estado del servidor y conexión a PostgreSQL |
| GET | `/api/salud/protegida` | autenticado | Comprobación de sesión |
| GET | `/api/salud/solo-admin` | admin | Comprobación de RBAC de administrador |
| GET | `/api/config` | público | WhatsApp y modos de pago públicos |
| POST | `/api/auth/register` | público | Registro de cliente; fuerza `rol = cliente` |
| POST | `/api/auth/registro` | público | Alias de registro |
| POST | `/api/auth/login` | público | Login de clientes |
| POST | `/api/auth/staff-login` | público | Login de personal interno |
| POST | `/api/auth/refresh` | público | Renueva el access token |
| POST | `/api/auth/logout` | público | Cierra sesión y limpia cookies |
| GET | `/api/auth/sesion` | público | Devuelve usuario o `null` |
| GET | `/api/auth/session` | público | Alias de sesión |
| GET | `/api/auth/perfil` | autenticado | Perfil del usuario |
| GET | `/api/auth/me` | autenticado | Alias de perfil |

### 5.2. Catálogo

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/categorias` | público | Categorías con conteo de productos |
| GET | `/api/categorias/:slug` | público | Detalle de categoría |
| POST | `/api/categorias` | admin | Crea categoría |
| PUT | `/api/categorias/:id` | admin | Edita categoría |
| DELETE | `/api/categorias/:id` | admin | Elimina si no tiene productos |
| GET | `/api/productos` | público | Catálogo con filtros, búsqueda y paginación |
| GET | `/api/productos/:slug` | público | Ficha con variantes, imágenes y reseñas |
| POST | `/api/productos` | admin | Crea producto |
| PUT | `/api/productos/:id` | admin | Edita producto y audita estado |
| DELETE | `/api/productos/:id` | admin | Elimina o desactiva con historial |
| GET | `/api/productos/:productoId/variantes` | público | Variantes disponibles |
| POST | `/api/productos/:productoId/variantes` | admin | Crea variante |
| PUT | `/api/variantes/:id` | admin | Edita precio, stock o estado |
| DELETE | `/api/variantes/:id` | admin | Elimina o desactiva variante |
| GET | `/api/productos/:productoId/imagenes` | público | Galería del producto |
| POST | `/api/productos/:productoId/imagenes` | admin | Agrega imagen por URL |
| PUT | `/api/productos/:productoId/imagenes/:imagenId` | admin | Edita imagen |
| DELETE | `/api/productos/:productoId/imagenes/:imagenId` | admin | Elimina imagen |
| POST | `/api/staff/productos/:id/imagen` | admin | Sube JPG/PNG/WEBP real |

### 5.3. Compra, pedidos y pagos

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/carrito` | cliente | Carrito persistente |
| POST | `/api/carrito/items` | cliente | Agrega ítem con stock validado |
| PATCH | `/api/carrito/items/:itemId` | cliente | Cambia cantidad |
| DELETE | `/api/carrito/items/:itemId` | cliente | Quita ítem |
| DELETE | `/api/carrito` | cliente | Vacía carrito |
| POST | `/api/pedidos/cotizar` | cliente | Cotiza envío y total server-side |
| POST | `/api/pedidos` | cliente | Checkout atómico con stock y pago |
| POST | `/api/pedidos/:id/comprobante` | cliente | Sube comprobante QR/depósito |
| GET | `/api/comprobantes/:id` | dueño/staff autorizado | Descarga comprobante validado |
| GET | `/api/pedidos` | autenticado | Historial propio o global |
| GET | `/api/pedidos/mis-pedidos` | autenticado | Alias de historial |
| GET | `/api/pedidos/codigo/:codigo` | cliente | Detalle por rastreo |
| GET | `/api/pedidos/:codigo/comprobante-pdf` | dueño/vendedor/admin | PDF del pedido |
| GET | `/api/pedidos/:id` | autenticado | Detalle por ID |
| GET | `/api/pagos/datos-cobro` | cliente | Datos QR/bancarios simulados |
| POST | `/api/pagos/paypal/crear` | cliente | Crea orden sandbox server-side |
| POST | `/api/pagos/paypal/capturar` | cliente | Captura y valida monto/moneda |
| POST | `/api/pagos/paypal/simulado/aprobar` | cliente | Simulación solo en desarrollo |
| GET | `/api/envios/rastreo/:codigo` | público | Rastreo con datos anonimizados |
| PATCH | `/api/envios/:id/estado` | almacén/logística/admin | Avanza estado de envío |
| GET | `/api/resenas/producto/:productoId` | público | Reseñas y promedio |
| POST | `/api/resenas` | cliente | Reseña verificada |

### 5.4. POS, inventario y reportes

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/pos` | vendedor/admin | Venta atómica en mostrador |
| GET | `/api/pos/historial` | vendedor/admin | Historial filtrable por fecha |
| GET | `/api/pos/cierre-caja` | vendedor/admin | Cierre diario de caja |
| GET | `/api/pos/ventas/:id/comprobante-pdf` | vendedor/admin | Comprobante POS |
| GET | `/api/inventario` | almacén/admin | Stock y alertas |
| POST | `/api/inventario/ajustes/:varianteId` | almacén/admin | Entrada o ajuste con Kardex |
| GET | `/api/inventario/kardex/:varianteId` | almacén/admin | Movimientos de una variante |
| GET | `/api/inventario/despachos` | almacén/admin | Cola de preparación |
| GET | `/api/staff/almacen/inventario` | almacén/admin | Alias de inventario |
| POST | `/api/staff/almacen/inventario/ajustes/:varianteId` | almacén/admin | Alias de ajuste |
| GET | `/api/staff/almacen/inventario/kardex/:varianteId` | almacén/admin | Alias de Kardex |
| GET | `/api/staff/almacen/despachos` | almacén/admin | Alias de preparación |
| PATCH | `/api/staff/almacen/envios/:id/estado` | almacén/admin | Preparar/empacar |
| GET | `/api/staff/logistica/despachos` | logística/admin | Cola de despacho |
| PATCH | `/api/staff/logistica/envios/:id/estado` | logística/admin | Tránsito/entrega |
| POST | `/api/staff/logistica/envios/:id/entrega` | logística/admin | Acta de entrega |
| GET | `/api/reportes/web-vs-pos` | admin | Comparativo web vs POS |
| GET | `/api/reportes/ingresos-diarios` | admin | Ingresos por día |
| GET | `/api/reportes/ranking` | admin | Ranking web + POS |
| GET | `/api/reportes/auditoria/opciones` | admin | Filtros disponibles |
| GET | `/api/reportes/auditoria` | admin | Visor paginado de auditoría |

### 5.5. Administración y asistente

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/usuarios` | admin | Lista de personal interno |
| POST | `/api/usuarios` | admin | Crea cuenta interna |
| PUT | `/api/usuarios/:id` | admin | Cambia rol o acceso |
| PATCH | `/api/usuarios/:id/password` | admin | Restablece contraseña |
| GET | `/api/staff/pagos` | vendedor/admin | Cola de pagos en verificación |
| GET | `/api/staff/pagos/:id` | vendedor/admin | Detalle de pago |
| PATCH | `/api/staff/pagos/:id/aprobar` | vendedor/admin | Aprueba pago |
| PATCH | `/api/staff/pagos/:id/rechazar` | vendedor/admin | Rechaza con motivo |
| POST | `/api/staff/pagos/vencidos/cancelar` | admin | Cancela vencidos |
| POST | `/api/staff/pedidos/:id/cancelar` | admin | Cancela y repone stock |
| POST | `/api/asistente` | público | Asistente IA con grounding y fallback |

---

## 6. Qué es real y qué es simulado

| Componente | Estado |
|---|---|
| PostgreSQL/Supabase, JWT, bcrypt, RBAC y auditoría | Real |
| Transacciones de stock, pedidos, POS y Kardex | Real |
| Comprobantes PDF y envío SMTP | Real si SMTP está configurado |
| Correo por API HTTP (Resend/Brevo) | Respaldo automático si SMTP falla o no existe |
| Telegram | Real si el bot y chat están configurados |
| WhatsApp | Enlace `wa.me` con mensaje prellenado, sin API Business |
| QR y depósito bancario | Simulación académica con verificación manual |
| PayPal | Sandbox server-side; montos y moneda validados en backend |
| Gemini | Real si la clave y el modelo están disponibles; fallback local |
| Datos de cobro, cuentas y número de WhatsApp de ejemplo | Ficticios |
| Comprobantes y facturas | Académicos, sin valor fiscal |

El asistente devuelve `modoBasico: true` si Gemini no está configurado, falla la
red o se agota la cuota. En ese caso responde con reglas locales y productos
reales con stock. Nunca expone claves al navegador.

---

## 7. Preparación para Render + Supabase

### Build y arranque

```bash
npm run build
npm start
```

En Render se recomienda:

- **Build command:** `npm run backend:install && npm run build`
- **Start command:** `npm start`
- Variables de entorno cargadas desde el panel de Render, nunca desde git.
- Ejecutar una sola vez en la consola del servicio: `npm run db:migrate`,
  `npm run db:seed`, `npm run db:imagenes` y `npm run demo:preparar`.

El servidor compilado sirve la API, `/css`, `/js`, `/assets`, `/favicon.ico`,
las rutas SPA y el fallback de `index.html`. Las rutas `/api/*` no caen en el
fallback y los archivos inexistentes responden `404`, no HTML.

### Diagnóstico y prueba de notificaciones en Render

Al arrancar, el servidor imprime siempre el estado de Telegram, SMTP y correo
HTTP, indicando la longitud y los últimos 4 caracteres de cada secreto (nunca
el valor completo):

```text
[NubaGlow][Notificaciones] Telegram: ACTIVO -> chat configurado: si.
[NubaGlow][Notificaciones]   TELEGRAM_BOT_TOKEN: presente (longitud=46, ultimos4=2pQ4)
[NubaGlow][Notificaciones] Correo SMTP: ACTIVO -> smtp.gmail.com:587 ...
[NubaGlow][Notificaciones] Correo HTTP: INACTIVO. Variables faltantes: ...
```

Endpoints de verificación rápida, sin llenar el carrito:

```bash
# Solo configuración (público, sin secretos completos)
curl https://nubaglow-web.onrender.com/api/salud/notificaciones

# Prueba REAL de correo y Telegram con la clave compartida
curl -X POST https://nubaglow-web.onrender.com/api/salud/probar-notificaciones \
  -H "Content-Type: application/json" \
  -H "x-notificaciones-key: TU_NOTIFICACIONES_TEST_KEY" \
  -d '{"correo":"destino@tudominio.com"}'
```

La respuesta incluye `resultados.correo` y `resultados.telegram` con el
resultado exacto de cada intento (SMTP, Resend/Brevo y Telegram API). Si el
correo SMTP falla, el sistema intenta automáticamente el respaldo HTTP cuando
`RESEND_API_KEY` o `BREVO_API_KEY` están configuradas. El mismo endpoint acepta
un JWT de `admin` en lugar de la clave.

### Verificación de producción

Se verificó con `NODE_ENV=production`:

- `/`, `/catalogo` y `/staff/login` devuelven HTML.
- `/api/salud` y los endpoints de API responden JSON.
- `/assets/images/*` responde `200` con MIME de imagen.
- `/api/noexiste` y `/js/noexiste.js` responden `404`.
- CORS acepta `https://nubaglow-web.onrender.com` y bloquea orígenes ajenos.
- Helmet entrega CSP, HSTS y `X-Content-Type-Options: nosniff`.
- Las cookies de autenticación en producción son `HttpOnly`, `Secure` y
  `SameSite=Strict`.
- `/staff/dashboard` sin sesión redirige a `/staff/login`.

### Demo oral

```bash
npm run demo:preparar
```

El script es idempotente. Asegura que los 32 productos reales estén activos, con
imagen principal real y al menos 10 unidades de stock. Cualquier reposición se
registra como movimiento de Kardex y no elimina pedidos, ventas ni historiales.

---

## 8. Pruebas y auditoría

```bash
npm run test:todos
npx tsc --noEmit
```

Suites principales:

- Bloque A: 13 pruebas.
- Bloque B: 42 pruebas.
- Bloque C: 53 pruebas.
- Bloque D: 110 pruebas.
- Notificaciones: 20 pruebas.
- Frontend: 63 pruebas.

La suite `test:todos` también cubre seguridad, comprobantes, PayPal,
notificaciones, PDF y asistente IA. El frontend se verifica con `node --check`
sobre los módulos y con recorrido HTTP del grafo de imports.

### Resultado de `npm audit`

El 20 de noviembre de 2026, `npm audit` en `backend/` reportó:

- **0 vulnerabilidades críticas.**
- **1 vulnerabilidad alta** en `zod@3.24.1` por consumo de memoria con
  colecciones sobredimensionadas (`GHSA-mrhx-c7xc-m3w5`).
- La corrección disponible es `zod@4.6.7`, un cambio mayor. Se mantiene la
  versión actual porque la API, los límites de body y el rate limiting reducen
  el vector; la migración a Zod 4 queda como tarea posterior controlada.

No se dejan vulnerabilidades críticas abiertas en dependencias controlables.

---

## 9. Estructura del proyecto

```text
backend/
  src/
    config/         Configuración de envío, PayPal y comprobantes
    controllers/    Adaptadores HTTP
    db/             Conexión, esquema, seed, imágenes y demo
    middlewares/    Auth, RBAC, Zod, CSRF, errores y rate limiting
    routes/         Definición de la API
    schemas/        Validación Zod
    services/       Reglas de negocio y transacciones
    tests/          Suites automatizadas
assets/
  brand/            Logo e iconos oficiales
  images/           Fotografías reales del catálogo
css/                Estilos y paleta NubaGlow
js/
  core/             API, sesión, carrito y helpers DOM
  layouts/          Layouts público, auth, staff y asistente
  vistas/           Vistas públicas y del portal interno
docs/postman/       Colección y entorno de Postman
```

---

## 10. Colección Postman

La carpeta `docs/postman/` contiene la colección y el entorno de pruebas. Las
variables de credenciales se completan localmente y nunca se versionan. La
colección incluye assertions para respuestas exitosas, autenticación, RBAC y
casos negativos.

---

Proyecto académico — NubaGlow / Nuba Beauty, Sucre, Bolivia.
