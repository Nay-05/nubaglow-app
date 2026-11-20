# NubaGlow App - Backend API REST

Sistema e-commerce y plataforma de gestión interna de **Nuba Beauty** (Sucre, Bolivia). Desarrollado para la materia de Ingeniería de Software (Grupo 11).

Arquitectura por capas estricta:
`Rutas (routes/) -> Controladores (controllers/) -> Servicios (services/) -> Base de Datos (db/)`

---

## 1. Requisitos Previos

- **Node.js** (v18 o superior recomendado)
- **PostgreSQL** (v14 o superior, local o instancia remota en Supabase)
- **npm** (v9 o superior)

---

## 2. Instalación y Configuración

### 2.1. Clonar e Instalar Dependencias

```bash
# Instalar dependencias en el proyecto raiz y en el backend
npm install
npm run backend:install
```

### 2.2. Variables de Entorno

Copia el archivo `.env.example` a `.env` en la raíz del proyecto y completa tus credenciales:

```bash
cp .env.example .env
```

Contenido de `.env`:

```env
# Puerto del servidor backend
PORT=3000
NODE_ENV=development

# Conexion a base de datos PostgreSQL (con soporte SSL para Supabase)
DATABASE_URL=postgresql://usuario:password@host:5432/postgres?sslmode=require

# Claves secretas para firma de tokens JWT (deben ser unicas y seguras)
JWT_SECRET=tu_clave_secreta_jwt_debe_tener_minimo_32_caracteres_aleatorios
JWT_REFRESH_SECRET=tu_clave_secreta_refresh_debe_tener_minimo_32_caracteres

# Origen permitido para CORS (Frontend)
CLIENT_URL=http://localhost:5173

# Reglas de negocio de envio (las define el negocio)
ENVIO_COSTO=15
ENVIO_GRATIS_DESDE=200

# Tamano maximo por comprobante de pago en MB (se guarda en la BD)
COMPROBANTE_MAX_MB=2

# PayPal: simulado por defecto. Para sandbox completar credenciales ficticias.
PAYPAL_MODO=simulado
PAYPAL_CLIENT_ID=tu_client_id_de_sandbox_aqui
PAYPAL_CLIENT_SECRET=tu_client_secret_de_sandbox_aqui
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
# Bs. por 1 USD. DEFINIR POR EL NEGOCIO (ejemplo academico).
PAYPAL_TIPO_CAMBIO_BOB_USD=6.96
```

### 2.3. Reglas de negocio configurables del envio

El costo de envio y el umbral de envio gratis **no son requisitos fijos del sistema**: los define el negocio. Se configuran exclusivamente por entorno:

- `ENVIO_COSTO`: costo fijo en Bolivianos (Bs.) cuando el subtotal no alcanza el umbral. Ejemplo: `15`.
- `ENVIO_GRATIS_DESDE`: subtotal minimo en Bs. desde el cual el envio es gratuito. Ejemplo: `200`.

La logica vive en `backend/src/config/envio.ts` y se aplica tanto en la cotizacion (`POST /api/pedidos/cotizar`) como al crear el pedido, por lo que modificar estas variables cambia el monto cotizado sin tocar codigo. Si la variable falta o no es un numero valido, se usa el valor de ejemplo como respaldo.

### 2.4. PayPal: modo simulado y sandbox

PayPal no opera con bolivianos. El servidor toma el total del pedido en Bs., lo convierte a USD con `PAYPAL_TIPO_CAMBIO_BOB_USD` (Bs. por 1 USD, valor de ejemplo `6.96` que debe definir el negocio) y guarda en `pagos` el monto original, el tipo de cambio y el monto USD.

- **Modo simulado (por defecto):** `PAYPAL_MODO=simulado`. No se hacen llamadas externas. `POST /api/pagos/paypal/crear` genera una orden en memoria, `POST /api/pagos/paypal/simulado/aprobar` simula la aprobacion del comprador y `POST /api/pagos/paypal/capturar` la captura. El endpoint simulado responde `404` si `PAYPAL_MODO` no es `simulado` o si `NODE_ENV=production`.
- **Modo sandbox:** cambiar a `PAYPAL_MODO=sandbox` y completar `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET` de una app sandbox de PayPal. Opcionalmente ajustar `PAYPAL_BASE_URL` (por defecto `https://api-m.sandbox.paypal.com`). El backend usa OAuth2 y PayPal Orders v2: crea la orden con `intent=CAPTURE`, redirige con el enlace `payer-action` y captura en `/v2/checkout/orders/{id}/capture`. Si faltan credenciales responde `503`; nunca cae automaticamente a simulacion.
- **Seguridad:** el cliente nunca envia montos ni estados de aprobacion. El pago solo pasa a `Aprobado` tras verificar en el servidor que la orden pertenece al pedido, que esta aprobada, que la moneda es USD y que el monto capturado coincide con el calculado. La URL de retorno no aprueba nada y la captura es idempotente.
- **Pruebas:** `npm run test:paypal` cubre el flujo simulado, la idempotencia, los rechazos por monto/moneda/orden ajena, los permisos y el bloqueo del endpoint simulado en sandbox y produccion.

### 2.5. Notificaciones reales y omitidas

Al confirmar un pedido web, el backend dispara las notificaciones **despues** de confirmar la transaccion:

- **Correo real:** se envia al cliente con resumen del pedido, codigo de
  rastreo, instrucciones segun el metodo de pago y el comprobante PDF adjunto.
  Requiere `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`.
- **Telegram real:** se envia una alerta al chat del negocio con codigo, total,
  metodo de pago y ciudad, sin datos personales completos. Requiere
  `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.

Cada intento queda en la tabla `notificaciones` con estado `enviada`, `fallida`
u `omitida`. Si falta configuracion, la notificacion se registra como `omitida`
y la compra continua normalmente. Un fallo de correo o Telegram nunca revierte
el pedido ni devuelve error al cliente.

Las pruebas usan transporte simulado y no envian mensajes reales.

### 2.6. WhatsApp del pedido

El boton de WhatsApp en `/pedido/:codigo` usa el numero publico de
`/api/config`, alimentado por `WHATSAPP_NUMERO` en formato internacional, por
ejemplo `59170000000` (ficticio en `.env.example`). Si la variable no existe,
el boton no se muestra.

Se usa el enlace `wa.me` porque la API oficial de WhatsApp Business exige una
cuenta de Meta Business, verificacion y credenciales de plataforma. Para el
alcance academico del proyecto, `wa.me` permite abrir una conversacion con el
resumen prellenado sin depender de esa infraestructura.

---

## 3. Base de Datos: Migraciones y Semilla

La base de datos relacional persistente implementa 18 tablas con restricciones de integridad referencial estricta (`ON DELETE RESTRICT`), reglas `CHECK`, índices optimizados y disparadores de auditoría inmutable.

```bash
# 1. Ejecutar migracion estructurada (idempotente)
npm run db:migrate

# 2. Poblar catalogo base (30+ productos con variantes y usuarios de cada rol)
npm run db:seed
```

> **Nota de seguridad:** Al correr `npm run db:seed`, las contraseñas generadas dinámicamente para las cuentas de demostración se imprimen en consola y se guardan temporalmente en `seed_passwords.txt` (archivo ignorado por `.gitignore`). Nunca se exponen contraseñas en código o documentación.

---

## 4. Ejecución del Servidor

```bash
# Modo desarrollo con recarga automatica (ts-node-dev)
npm run dev

# Compilar TypeScript a JavaScript de produccion
npm run build

# Iniciar en modo produccion
npm start
```

El servidor estará escuchando en `http://localhost:3000`.

---

## 5. Pruebas Automatizadas

El backend cuenta con suites de pruebas unitarias y de integración end-to-end con cobertura completa de flujos de negocio, transacciones atómicas y restricciones RBAC:

```bash
# Ejecutar suite Bloque A (Base del servidor, seguridad y middlewares RBAC) - 13 pruebas
npm run test:bloque-a

# Ejecutar suite Bloque B (Autenticacion, segregacion de portales y catalogo) - 36 pruebas
npm run test:bloque-b

# Ejecutar suite Bloque C (Carrito persistente, pedidos atomicos, rastreo y resenas) - 36 pruebas
npm run test:bloque-c

# Ejecutar suite Bloque D (POS, facturacion, inventario, reportes y auditoria) - 106 pruebas
npm run test:bloque-d

# Verificar que el costo y el umbral de envio se leen de ENVIO_COSTO / ENVIO_GRATIS_DESDE
npm run test:envio

# Probar la carga del comprobante de pago QR/deposito (requiere BD)
npm run test:comprobante

# Probar PayPal en modo simulado (crear, aprobar, capturar e idempotencia)
npm run test:paypal

# Ejecutar todas las suites secuencialmente
npm run test:todos
```

---

## 6. Documentación Exhaustiva de Endpoints de la API

Todos los endpoints responden en formato JSON estructurado y siguen las convenciones REST en español.

### Roles del Sistema (RBAC)
- **`público`**: Sin autenticación requerida.
- **`cliente`**: Usuario registrado desde la tienda virtual.
- **`vendedor`**: Personal de mostrador en tienda física (POS).
- **`operaciones`**: Personal de almacén, logística e inventario.
- **`admin`**: Administrador del sistema con privilegios gerenciales completos.

---

### 6.1. Diagnóstico y Salud

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición |
|---|---|---|---|---|
| `GET` | `/api/salud` | `público` | Verifica estado del servidor, versión y conexión a BD | `GET http://localhost:3000/api/salud` |

---

### 6.2. Autenticación y Sesiones

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | `público` | Registro público. Fuerza siempre `rol = 'cliente'` | `POST /api/auth/register`<br>`{"nombre": "Carla Mendez", "email": "carla@ejemplo.com", "password": "Password123!"}` |
| `POST` | `/api/auth/login` | `público` | Login de clientes. Rechaza personal de staff con mensaje genérico anti-enumeración | `POST /api/auth/login`<br>`{"email": "cliente@nubaglow.bo", "password": "Password123!"}` |
| `POST` | `/api/auth/staff-login` | `público` | Login de personal interno (vendedor, operaciones, admin). Rechaza clientes y audita `LOGIN_STAFF` | `POST /api/auth/staff-login`<br>`{"email": "vendedor@nubaglow.bo", "password": "Password123!"}` |
| `POST` | `/api/auth/refresh` | `público` | Renueva Access Token usando la cookie HttpOnly `refresh_token` | `POST /api/auth/refresh` |
| `POST` | `/api/auth/logout` | `público` | Cierra sesión y revoca cookies HttpOnly | `POST /api/auth/logout` |
| `GET` | `/api/auth/perfil` | `autenticado` | Retorna los datos del usuario en sesión | `GET /api/auth/perfil`<br>`Header: Authorization: Bearer <token>` |

---

### 6.3. Catálogo: Categorías

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/categorias` | `público` | Listado general de categorías con conteo de productos | `GET /api/categorias` |
| `GET` | `/api/categorias/:slug` | `público` | Detalle de categoría por slug | `GET /api/categorias/serums` |
| `POST` | `/api/categorias` | `admin` | Crea una nueva categoría | `POST /api/categorias`<br>`{"nombre": "Mascarillas", "slug": "mascarillas", "descripcion": "Tratamientos intensivos"}` |
| `PUT` | `/api/categorias/:id` | `admin` | Actualiza nombre o descripción de categoría | `PUT /api/categorias/1`<br>`{"nombre": "Limpiadores Faciales"}` |
| `DELETE` | `/api/categorias/:id` | `admin` | Elimina categoría (rechazado si tiene productos por `ON DELETE RESTRICT`) | `DELETE /api/categorias/1` |

---

### 6.4. Catálogo: Productos

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/productos` | `público` | Listado con búsqueda (`q`), filtros combinables (`categoria`, `tipo_piel`, `precio_min`, `precio_max`), orden y paginación | `GET /api/productos?categoria=serums&tipo_piel=Seca&precio_min=50&precio_max=200&orden=precio_asc&pagina=1&limite=10` |
| `GET` | `/api/productos/:slug` | `público` | Detalle completo de producto por slug con variantes, imágenes y promedio de reseñas | `GET /api/productos/serum-acido-hialuronico-multi-molecular-b5` |
| `POST` | `/api/productos` | `admin` | Crea producto maestro con validación Zod | `POST /api/productos`<br>`{"categoria_id": 1, "nombre": "Gel Limpiador Suave", "slug": "gel-limpiador-suave", "marca": "NubaGlow", "tipo_piel": "Sensible", "descripcion": "...", "ingredientes": "...", "modo_uso": "..."}` |
| `PUT` | `/api/productos/:id` | `admin` | Actualiza información del producto | `PUT /api/productos/1`<br>`{"nombre": "Serum Acido Hialuronico Pro Edition"}` |
| `DELETE` | `/api/productos/:id` | `admin` | Elimina producto | `DELETE /api/productos/1` |

---

### 6.5. Catálogo: Variantes

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/productos/:productoId/variantes` | `público` | Lista variantes de un producto con stock y precio | `GET /api/productos/1/variantes` |
| `POST` | `/api/productos/:productoId/variantes` | `admin` | Crea variante con SKU único | `POST /api/productos/1/variantes`<br>`{"sku": "NB-SERUM-100ML", "nombre": "Presentacion 100ml", "precio": 140.00, "stock": 20, "punto_reorden": 5}` |
| `PUT` | `/api/variantes/:id` | `admin` | Modifica precio, stock o estado. Audita `CAMBIO_PRECIO`, `CAMBIO_ESTADO_VARIANTE` y registra el ajuste de stock en el Kardex | `PUT /api/variantes/1`<br>`{"precio": 150.00, "stock": 25}` |
| `DELETE` | `/api/variantes/:id` | `admin` | Elimina variante si no tiene historial de ventas | `DELETE /api/variantes/1` |

### 6.5.1. Cat?logo: Im?genes de producto

| M?todo | Ruta | Rol Requerido | Descripci?n | Ejemplo de Petici?n / Body |
|---|---|---|---|---|
| `GET` | `/api/productos/:productoId/imagenes` | `p?blico` | Lista las im?genes y marca la principal | `GET /api/productos/1/imagenes` |
| `POST` | `/api/productos/:productoId/imagenes` | `admin` | Agrega una imagen. Garantiza una sola principal. Audita `CREAR_IMAGEN_PRODUCTO` | `POST /api/productos/1/imagenes`<br>`{"url": "/assets/brand/icono1.png", "es_principal": true, "orden": 0}` |
| `PUT` | `/api/productos/:productoId/imagenes/:imagenId` | `admin` | Edita URL, orden o imagen principal. Audita `ACTUALIZAR_IMAGEN_PRODUCTO` | `PUT /api/productos/1/imagenes/3`<br>`{"orden": 1, "es_principal": false}` |
| `DELETE` | `/api/productos/:productoId/imagenes/:imagenId` | `admin` | Elimina una imagen y promueve otra como principal. Audita `ELIMINAR_IMAGEN_PRODUCTO` | `DELETE /api/productos/1/imagenes/3` |

---

### 6.6. Compra: Carrito Persistente

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/carrito` | `cliente` | Consulta el carrito activo del cliente con subtotales calculados | `GET /api/carrito` |
| `POST` | `/api/carrito/items` | `cliente` | Agrega ítem validando stock disponible en BD | `POST /api/carrito/items`<br>`{"variante_id": 1, "cantidad": 2}` |
| `PATCH` | `/api/carrito/items/:itemId` | `cliente` | Modifica cantidad del ítem sin exceder stock | `PATCH /api/carrito/items/5`<br>`{"cantidad": 3}` |
| `DELETE` | `/api/carrito/items/:itemId` | `cliente` | Quita un artículo del carrito | `DELETE /api/carrito/items/5` |
| `DELETE` | `/api/carrito` | `cliente` | Vacía el carrito por completo | `DELETE /api/carrito` |

---

### 6.7. Compra: Pedidos y Checkout

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `POST` | `/api/pedidos/cotizar` | `cliente` | Cotiza subtotal, costo de envío y total desde la BD (ignora precios del cliente). El envío usa `ENVIO_COSTO` y `ENVIO_GRATIS_DESDE`. | `POST /api/pedidos/cotizar`<br>`{"ciudad": "Sucre", "items": [{"variante_id": 1, "cantidad": 2}]}` |
| `POST` | `/api/pedidos` | `cliente` | Checkout atómico en 1 sola transacción (`SELECT ... FOR UPDATE`, descuenta stock, Kardex, genera `NB-2026-XXXX`, pago, envío inicial 'Pendiente', vacía carrito) | `POST /api/pedidos`<br>`{"nombre_completo": "Mariana Gomez", "celular": "71234567", "correo": "mariana@ejemplo.com", "ciudad": "Sucre", "direccion": "Calle Nicolas Ortiz 45", "metodo_pago": "qr_simple", "notas": "Entregar en porteria"}` |
| `POST` | `/api/pedidos/:id/comprobante` | `cliente` | Sube el comprobante de pago para QR simple o depósito (JPEG, PNG, WebP o PDF, máx. `COMPROBANTE_MAX_MB`, 2 MB por defecto). Exige referencia, fecha no futura y monto pagado. Pasa el pago a `En verificación` y audita. | `POST /api/pedidos/12/comprobante`<br>`{"nombre_archivo": "comprobante.png", "mime_type": "image/png", "referencia": "OP-123456", "fecha_deposito": "2026-11-19", "monto_pagado": 95, "contenido_base64": "iVBORw0KG..."}` |
| `GET` | `/api/comprobantes/:id` | Dueño / vendedor / admin | Devuelve el comprobante inline con MIME validado y `X-Content-Type-Options: nosniff`. Almacén y logística reciben `403`. | `GET /api/comprobantes/5` |
| `POST` | `/api/pagos/paypal/crear` | `cliente` | Crea la orden PayPal para un pedido con método `paypal` y pago `Pendiente`. Convierte Bs. a USD y devuelve `urlAprobacion`. | `POST /api/pagos/paypal/crear`<br>`{"pedido_id": 12}` |
| `POST` | `/api/pagos/paypal/capturar` | `cliente` | Captura una sola vez la orden aprobada, valida monto/moneda y aprueba el pago. | `POST /api/pagos/paypal/capturar`<br>`{"pedido_id": 12, "orden_id": "SIM-PAYPAL-ABC123"}` |
| `POST` | `/api/pagos/paypal/simulado/aprobar` | `cliente` | Solo en modo simulado y fuera de producción (`404` en otro caso). Simula la aprobación del comprador. | `POST /api/pagos/paypal/simulado/aprobar`<br>`{"pedido_id": 12, "orden_id": "SIM-PAYPAL-ABC123"}` |
| `GET` | `/api/pedidos` | `autenticado` | Historial de pedidos (cliente solo ve los suyos; staff ve todos) | `GET /api/pedidos` |
| `GET` | `/api/pedidos/:id` | `autenticado` | Detalle de pedido (retorna `403` si un cliente intenta ver pedido ajeno) | `GET /api/pedidos/12` |

---

### 6.8. Compra: Envíos y Rastreo

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/envios/rastreo/:codigo` | `público` | Consulta pública de rastreo con línea de tiempo y datos de destinatario anonimizados (`Ma**** Go****`) | `GET /api/envios/rastreo/NB-2026-0001` |
| `PATCH` | `/api/envios/:id/estado` | `operaciones`, `admin` | Transición secuencial de estado (`Pendiente` -> `En preparación` -> `En tránsito` -> `Entregado`). Si es contra-entrega y pasa a Entregado, autoliquida pago a 'Aprobado'. Audita `CAMBIAR_ESTADO_ENVIO` | `PATCH /api/envios/1/estado`<br>`{"estado": "En preparación", "descripcion": "Paquete acondicionado en caja protectora"}` |

---

### 6.9. Calidad: Reseñas Verificadas

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/resenas/producto/:productoId` | `público` | Lista reseñas aprobadas con promedio de calificación y total | `GET /api/resenas/producto/1` |
| `POST` | `/api/resenas` | `cliente` | Publica reseña (1 a 5 estrellas). Solo permitido si el cliente compró el producto y el pedido fue 'Entregado'. Máximo 1 reseña por producto | `POST /api/resenas`<br>`{"producto_id": 1, "calificacion": 5, "comentario": "Excelente serum, textura ligera y resultados visibles."}` |

---

### 6.10. Gestión Interna: Ventas POS (Mostrador)

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `POST` | `/api/pos` | `vendedor`, `admin` | Venta en mostrador en 1 transacción atómica (`FOR UPDATE`, descuenta stock, Kardex, genera factura correlativa). Precios y totales siempre calculados en el servidor. Envía el comprobante PDF al correo si se informa `cliente_correo` | `POST /api/pos`<br>`{"items": [{"variante_id": 1, "cantidad": 2}], "metodo_pago": "Efectivo", "monto_recibido": 200.00, "cliente_nombre": "Carlos Mendoza", "cliente_nit_ci": "5689123", "cliente_correo": "carlos@email.com"}` |
| `GET` | `/api/pos/historial` | `vendedor`, `admin` | Historial de ventas segregado por vendedor. Acepta `?fecha=YYYY-MM-DD` y agrupa por fecha local de Bolivia | `GET /api/pos/historial?fecha=2026-11-20` |
| `GET` | `/api/pos/cierre-caja` | `vendedor`, `admin` | Arqueo diario de caja (total ventas, desglose en Efectivo y QR Simple). Acepta `?fecha=YYYY-MM-DD` | `GET /api/pos/cierre-caja?fecha=2026-11-20` |
| `GET` | `/api/pos/ventas/:id/comprobante-pdf` | `vendedor`, `admin` | Descarga el comprobante PDF de una venta POS. El vendedor solo accede a sus propias ventas; el admin accede a cualquiera | `GET /api/pos/ventas/15/comprobante-pdf` |

---

### 6.11. Gestión Interna: Inventario y Kardex

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/inventario` | `operaciones`, `admin` | Stock consolidado por variante con indicador `alertaStockBajo` (`stock <= punto_reorden`) | `GET /api/inventario` |
| `POST` | `/api/inventario/ajustes/:varianteId` | `operaciones`, `admin` | Ingreso o ajuste manual de stock con motivo y responsable obligatorios. Audita `AJUSTE_STOCK` e impide stock negativo | `POST /api/inventario/ajustes/1`<br>`{"tipo": "entrada", "cantidad": 15, "motivo": "Ingreso por reposicion de lote"}` |
| `GET` | `/api/inventario/kardex/:varianteId` | `operaciones`, `admin` | Historial cronológico de movimientos de inventario (`venta_web`, `venta_pos`, `entrada`, `ajuste`) | `GET /api/inventario/kardex/1` |
| `GET` | `/api/inventario/despachos` | `operaciones`, `admin` | Cola operativa de pedidos web pendientes de despacho | `GET /api/inventario/despachos` |

---

### 6.12. Gestión Interna: Reportes Gerenciales

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición |
|---|---|---|---|---|
| `GET` | `/api/reportes/web-vs-pos` | `admin` | Comparativa de rendimiento entre ventas web y ventas mostrador POS (ingresos y porcentajes) | `GET /api/reportes/web-vs-pos` |
| `GET` | `/api/reportes/ingresos-diarios` | `admin` | Ingresos día por día filtrables por rango de fechas | `GET /api/reportes/ingresos-diarios?fecha_inicio=2026-01-01&fecha_fin=2026-12-31` |
| `GET` | `/api/reportes/ranking` | `admin` | Top de productos más vendidos ordenados por cantidad vendida e ingresos | `GET /api/reportes/ranking?limite=10` |

---

### 6.13. Gestión Interna: Usuarios de Staff y Auditoría

| Método | Ruta | Rol Requerido | Descripción | Ejemplo de Petición / Body |
|---|---|---|---|---|
| `GET` | `/api/usuarios` | `admin` | Lista usuarios de staff (excluye clientes) | `GET /api/usuarios` |
| `POST` | `/api/usuarios` | `admin` | Crea cuenta de staff con bcrypt (coste 12). Audita `CREAR_USUARIO` | `POST /api/usuarios`<br>`{"nombre": "Laura Vendedora", "email": "laura@nubaglow.bo", "password": "Password123!", "rol": "vendedor"}` |
| `PUT` | `/api/usuarios/:id` | `admin` | Modifica rol o estado activo/inactivo. Protegido contra auto-desactivación del admin y contra desactivar al último admin activo. Audita `EDITAR_USUARIO` | `PUT /api/usuarios/2`<br>`{"activo": false}` |
| `PATCH` | `/api/usuarios/:id/password` | `admin` | Restablece contraseña de staff. Audita `RESTABLECER_PASSWORD` | `PATCH /api/usuarios/2/password`<br>`{"nueva_password": "NuevaPassword123!"}` |

---

## 7. Colección Postman

En la carpeta `docs/postman/` se proporcionan los archivos oficiales para pruebas de API:

- `docs/postman/NubaGlow.postman_collection.json`: Colección completa con todos los módulos, assertions automáticos en cada petición y carpeta de casos negativos (401, 403, 404).
- `docs/postman/NubaGlow.postman_environment.json`: Entorno con variables configurables:
  - `base_url`: `http://localhost:3000`
  - `token_admin`, `token_vendedor`, `token_operaciones`, `token_cliente`
  - `password_admin`, `password_vendedor`, `password_operaciones`, `password_cliente`

> **Importante:** Ninguna contraseña está hardcodeada en la colección. Las variables de credenciales deben ser completadas localmente en Postman al ejecutar las pruebas.
