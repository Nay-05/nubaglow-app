# CLAUDE.md — NubaGlow App (Ingeniería de Software, Grupo 11)

Este archivo es el contexto permanente del proyecto. Léelo completo antes de modificar cualquier cosa y respétalo en cada cambio.

## 1. Qué es el proyecto
E-commerce y sistema de gestión interna de cosméticos y skincare para **Nuba Beauty** (Sucre, Bolivia), que se muestra al público como **NubaGlow**. Es un proyecto académico diseñado con estándares de producción reales: tienda pública (catálogo, carrito, pagos, rastreo), portal interno unificado por roles, base de datos relacional persistente y seguridad robusta.

Se va a **defender oralmente**: el código debe ser limpio, modular, comentado en las partes críticas y fácilmente explicable por estudiantes (backend y frontend).

## 2. Stack Tecnológico (no cambiar sin avisar)
- **Backend:** Node.js + **Express** (TypeScript, carpeta `backend/src`).
- **Base de datos:** **PostgreSQL alojado en Supabase** (persistente en la nube, evita pérdida de datos en Render). Todo el acceso a datos va por consultas **parametrizadas** (`$1, $2...`) en `backend/src/db/`.
- **Frontend:** HTML5 + CSS3 + JavaScript vanilla modular (carpeta raíz, `css/`, `js/`). Sin frameworks externos.
- **Autenticación:** JWT (Access + Refresh Token en cookies `httpOnly`) + `bcrypt` + control de acceso basado en roles (RBAC).
- **Deploy:** Render (`https://nubaglow-app.onrender.com`). Secretos únicamente en variables de entorno.
- **Pruebas de API:** Colección de **Postman** documentada en `docs/postman/`.

## 3. Arquitectura de Acceso y Roles Unificados (RBAC)
Para mantener una experiencia limpia y simplificar la operación, el sistema separa estrictamente la **Tienda Pública** del **Portal Interno (Backoffice)** dentro de la misma aplicación:

### Puntos de entrada (Login separado)
1. **Clientes (`/` y `/login`):**
   - Acceso público desde el botón "Cuenta" en la barra superior.
   - Permite registro libre de nuevos clientes y recuperación de cuenta.
   - Nunca visualiza enlaces ni botones hacia rutas de empleados. Si un cliente intenta entrar a `/staff/*`, el sistema lo redirige automáticamente a `/` o devuelve `403 Forbidden`.
2. **Trabajadores (`/staff/login`):**
   - Ruta privada directa (sin enlaces visibles en la tienda pública; no existe opción de auto-registro, solo el `admin` crea cuentas internas).
   - Al iniciar sesión, el backend valida el rol en BD y redirige automáticamente a su vista de trabajo correspondiente.
   - Usa un **Layout Interno (Dashboard con sidebar lateral)** optimizado para productividad, sin distracciones visuales de la tienda.

### Roles Simplificados (4 Roles)
Para evitar fragmentación innecesaria de pantallas, **Almacén y Logística se unifican en un solo módulo operativo**:
1. **`cliente`:** Compra online, gestión de carrito, historial y rastreo de pedidos, reseñas verificadas.
2. **`vendedor`:** Módulo de **Punto de Venta (POS)** para ventas presenciales/WhatsApp, búsqueda rápida por SKU, emisión de recibos PDF y consulta de sus ventas.
3. **`operaciones` (Almacén + Logística unificados):** Control de stock por variante, alertas de inventario mínimo, registro de entradas/salidas de mercadería, preparación de paquetes y actualización de estados de envío (`En preparación` -> `En tránsito` -> `Entregado`).
4. **`admin`:** Control total. CRUD de productos, variantes y categorías, gestión de usuarios/roles internos, reportes consolidados de ventas y visor de auditoría.

*Regla de seguridad:* Los permisos se validan **siempre en el backend** mediante middlewares (`verificarToken`, `requerirRol(...)`), nunca solo ocultando elementos en el DOM.

## 4. Navegación y Sincronización de URLs (Enrutamiento SPA)
- **Cambio de URL obligatorio por módulo:** Al navegar entre secciones o módulos (tanto en la tienda pública como en el panel de empleados), **la URL en la barra del navegador debe actualizarse dinámicamente** usando la API nativa `window.history.pushState()` (sin recargar toda la página).
- **Rutas limpias y descriptivas:**
  - Públicas: `/`, `/catalogo`, `/producto/:slug`, `/pedidos`, `/carrito`, `/cuenta`, `/login`.
  - Privadas: `/staff/login`, `/staff/dashboard`, `/staff/pos`, `/staff/operaciones`, `/staff/productos`, `/staff/usuarios`, `/staff/reportes`.
- **Soporte de historial y recarga:** Escuchar el evento `window.onpopstate` para que los botones **Atrás / Adelante** del navegador funcionen correctamente, y configurar Express en el backend para servir `index.html` ante cualquier ruta frontend desconocida (fallback SPA) para que al presionar `F5` (recargar) en `/catalogo` o `/staff/pos` no dé error `404`.

## 5. Identidad Visual, Logo y Referencias (Espacio para Assets)
Organiza los recursos gráficos del proyecto en la carpeta `assets/` siguiendo esta estructura antes de maquetar:

- **Nombre visible de la marca:** Toda la interfaz, correos y comprobantes PDF deben mostrar **NubaGlow** (una sola palabra, con N y G mayúsculas). **Nuba Beauty** se reserva únicamente para referencias al negocio real (p. ej. "Una tienda de Nuba Beauty, Sucre, Bolivia"). No renombrar archivos ni rutas como `assets/brand/logo-nubaglow.png`.
- **Logotipo Oficial:**
  - Ruta: `assets/brand/logo-nubaglow.png` ( versión alternativa clara/oscura si aplica cambiar el fondo o busca crear un corazon del color mas oscuro de la paleta en un fondo con el color mas claro):
  - Favicon: `assets/brand/icono1.png`como inspiracion es un corazon en un redondo y tambien para decoraciones `assets/brand/icono2.png`.
  - *Instrucción para la IA:* Usar el PNG oficial (`assets/brand/logo-nubaglow.png`) en el header de la tienda, en el login de staff y en el encabezado de los comprobantes PDF.
- **Imágenes de Referencia de Diseño (Moodboard / UI):**
  - Carpeta: `assets/references/`
  - Guardar aquí capturas de inspiración visual para que la IA tome en cuenta la distribución y estética deseada:
    - `assets/references/ref1-home.png``assets/references/ref2-home.png` `assets/references/ref3-home.png` `assets/references/ref4-home.png`(Referencia de portada y estética general).
    - `assets/references/ref1-catalogo.png` y `assets/references/ref2-catalogo.png` (Referencia de tarjetas de producto y filtros).
    - Utilizar las otras referencias de inspiracion para referencia de tablas y paneles internos.

## 6. Reglas de Diseño e Interfaz
- **Cero emojis:** Prohibido usar emojis en interfaces, botones, alertas, mensajes de error o respuestas del asistente IA. Utilizar exclusivamente **iconos SVG de línea** (estilo Lucide Icons, trazo `1.5px`) coloreados con la paleta oficial.
- **Paleta de Colores (Variables CSS en `:root`):**
  - `--color-silver: #cebebe;` (Acentos metálicos sutiles, bordes suaves, detalles de lujo moderno).
  - `--color-sand-dune: #ece2d0;` (Fondos secundarios cálidos, tarjetas suaves, equilibrio natural).
  - `--color-almond-silk: #d5b9b2;` (Superficies destacadas, estados hover suaves, calidez).
  - `--color-smoky-rose: #a26769;` (Acentos interactivos secundarios, etiquetas, estados).
  - `--color-wine-plum: #6d2e46;` (Color primario de marca, botones principales, encabezados clave).
  - Complementar con blanco puro/marfil (`#faf8f5`) para fondos limpios y gris carbón (`#2b2124`) para lectura de alto contraste accesible.
- **Tipografía (Google Fonts):**
  - Títulos y encabezados: **Cormorant Garamond** (o **Playfair Display**).
  - Cuerpo, formularios, tablas y botones: **DM Sans** (o **Inter**).
  - *Regla:* Mantener una única pareja tipográfica en toda la aplicación.
- **Componentes UI:**
  - **Botones estilizados y compactos:** Altura `36px–40px`, borde redondeado `8px`, diseño plano (sin sombras pesadas ni degradados llamativos).
  - **Navbar pública minimalista:** Inicio, Catálogo, Pedidos (rastreo), Carrito, Cuenta. Sin enlaces administrativos visibles.
  - **Asistente IA:** Panel lateral derecho colapsable (estilo drawer), accesible en todas las vistas públicas mediante un botón flotante discreto con icono SVG.
  - Diseño editorial limpio, abundante espacio en blanco y *mobile-first*.

## 7. Funcionalidades por Módulo
### A. Tienda Pública (Cliente)
- **Catálogo inteligente:** Filtros combinables (categoría, tipo de piel, rango de precio), buscador en tiempo real y ordenamiento.
- **Ficha de producto (`/producto/:slug`):** Galería de imágenes, descripción, ingredientes clave, modo de uso, **selector de variantes** (tonos, ml, presentaciones con precio y stock individual) y sección de reseñas.
- **Reseñas verificadas:** Calificación de 1 a 5 estrellas, promedio dinámico y conteo. Solo habilitado para clientes con un pedido en estado `Entregado` que incluya ese producto (máximo 1 reseña por producto/cliente).
- **Carrito persistente:** Sincronizado con la base de datos para clientes autenticados (y respaldo temporal en `localStorage` para visitantes antes de iniciar sesión).
- **Checkout y Post-compra:**
  - Campos obligatorios validados en front y back: **nombre completo, celular, correo electrónico, ciudad y dirección exacta**.
  - Métodos de pago: **QR Simple (simulado con imagen QR dinámica)** y **Pago contra entrega**.
  - Confirmación inmediata con: **código de rastreo único** (ej. `NB-2026-XXXX`), **correo electrónico de confirmación**, **comprobante PDF descargable**, alerta interna por **Telegram** al equipo y botón de **WhatsApp** con el resumen prellenado.
- **Rastreo de Pedidos (`/pedidos`):** Consulta pública por código de rastreo e historial en cuenta propia, mostrando línea de tiempo visual (`Pendiente` -> `En preparación` -> `En tránsito` -> `Entregado`).

### B. Módulo de Ventas / POS (`vendedor` y `admin`)
- Buscador instantáneo de productos por nombre, categoría o SKU de variante.
- Carrito rápido de mostrador con cálculo automático de totales y registro de venta asociado al ID del vendedor.
- Generación inmediata de **recibo/factura académica en PDF** y envío opcional al correo del cliente.
- Historial de ventas realizadas por turno/vendedor.

### C. Módulo Unificado de Operaciones: Almacén + Logística (`operaciones` y `admin`)
- **Vista de Inventario:** Listado de stock por variante, indicadores visuales de stock bajo (alerta de reorden) y formulario para registrar ingresos de mercadería o ajustes (guardando motivo y responsable).
- **Vista de Despachos y Envíos:** Cola unificada de pedidos web pendientes de despacho. Permite cambiar el estado del envío paso a paso (`En preparación` -> `En tránsito` -> `Entregado`), registrando fecha, hora y usuario responsable en el historial de seguimiento.

### D. Módulo de Administración (`admin`)
- Gestión completa (CRUD) de productos, variantes, precios e imágenes.
- Gestión de personal interno (crear cuentas de `vendedor`, `operaciones` o `admin`, activar/desactivar accesos).
- Panel de métricas: ventas totales (web vs. POS), ingresos por día y ranking de productos más vendidos.
- Registro de auditoría de acciones críticas.

## 8. Base de Datos (Supabase)
Tablas mínimas requeridas:
`usuarios`, `categorias`, `productos`, `variantes`, `imagenes_producto`, `resenas`, `carritos`, `carrito_items`, `pedidos`, `pedido_items`, `pagos`, `envios`, `envio_eventos`, `ventas_pos`, `facturas`, `movimientos_inventario`, `auditoria`, `notificaciones`.

- **Integridad y Rendimiento:** Llaves foráneas estrictas (`ON DELETE RESTRICT` en historiales), índices en columnas de búsqueda (`slug`, `sku`, `codigo_rastreo`, `email`) y **transacciones SQL (`BEGIN ... COMMIT / ROLLBACK`)** al confirmar pedidos o ventas POS para garantizar que el descuento de stock y la creación del pedido ocurran de forma atómica.
- **Datos iniciales (`seed.sql`):** Mínimo **30 productos** realistas de skincare y maquillaje con sus respectivas variantes (tonos, tamaños) y usuarios de prueba por rol.
- Esquema versionado en `backend/src/db/schema.sql`.

## 9. Seguridad (No Negociable)
1. **Cero secretos en el código:** Todo dato sensible (`DATABASE_URL`, `JWT_SECRET`, credenciales SMTP, `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`) va en `.env`. Incluir `.env.example` y verificar `.gitignore`.
2. **Sin atajos de autenticación:** Prohibido incluir botones de "autocompletar credenciales" o modos sin login en la interfaz.
3. **Contraseñas:** Hash con `bcrypt` (coste >= 12) y validación de complejidad mínima (8+ caracteres, al menos una mayúscula y un número).
4. **Sesiones seguras:** Access Token JWT corto (15–30 min) + Refresh Token en cookies `httpOnly`, `Secure`, `SameSite=Strict` (o `Lax` según despliegue).
5. **Autorización en servidor:** El rol siempre se consulta o verifica desde la base de datos/token firmado; el endpoint público `/api/auth/register` fuerza siempre `rol = 'cliente'`.
6. **Validación y Anti-Inyección:** Validar todos los `req.body` y `req.params` con **Zod**. Usar consultas parametrizadas al 100%.
7. **Protección HTTP:** Configurar `helmet`, CORS restringido al dominio del frontend y `express-rate-limit` (con límite estricto en `/login` para frenar fuerza bruta).
8. **Prevención XSS:** Nunca insertar datos provenientes de usuarios o BD usando `innerHTML` sin sanitizar; preferir `textContent` o creación segura de nodos DOM.
9. **Auditoría:** Registrar en la tabla `auditoria` eventos clave (inicios de sesión de staff, creación/edición de usuarios, cambios de precio, ajustes manuales de stock y cambios de estado de envío).
10. **Manejo de errores:** Devolver mensajes claros y seguros al cliente sin exponer trazas internas de SQL o stack traces. Ejecutar `npm audit` antes de entregar.

## 10. Asistente IA Conectado al Catálogo
- Endpoint `POST /api/asistente` en el backend (la API key jamás se expone en el frontend).
- **Grounding con BD:** Antes de generar respuesta, consulta productos disponibles y stock real en Supabase para recomendar únicamente artículos existentes en tienda, permitiendo abrir su ficha o añadirlos al carrito.
- **Estilo:** Respuestas concisas, amables y profesionales, **sin emojis**. Rate limiting por IP/usuario.
- **Fallback:** Si no se detecta API key configurada, responder mediante un motor básico de reglas por palabras clave para garantizar continuidad durante la defensa oral.

## 11. Notificaciones y Comprobantes PDF
- **Correo:** `Nodemailer` (SMTP configurable por `.env`) para confirmación de pedidos y envío de recibos.
- **Telegram:** Notificación automática vía Bot API al canal/chat de operaciones cuando ingresa un nuevo pedido web.
- **PDF (`pdfkit`):** Generación de comprobante de compra online y factura o recibo de venta POS (enviado tambien al correo electronico) con el logotipo de NubaGlow, número correlativo, detalle de variantes, total en Bolivianos (Bs.) y código de rastreo. *(Nota visible en el documento: "Comprobante académico de simulación — Sin valor fiscal").*

## 12. Convenciones de Código y Definición de Terminado
- **Idioma:** Nombres de dominio, tablas, rutas de API y variables de negocio en **español** (`pedidos`, `variantes`, `obtenerStock`); términos técnicos del lenguaje en inglés (`controller`, `middleware`, `router`).
- **Arquitectura Backend:** Separación estricta por capas: `routes/` -> `controllers/` -> `services/` -> `db/`.
- **Criterios de entrega:**
  1. Arranca limpiamente con `npm install && npm run dev`.
  2. Navegación fluida con cambio de URL en cada módulo y soporte de recarga (`F5`).
  3. Colección Postman probando flujos exitosos y bloqueos de permisos (ej. `cliente` intentando acceder a `/api/staff/*` -> `403`).
  4. README actualizado con diagrama ER de la base de datos y documentación de endpoints.
  5. Desplegado y funcional en Render conectado a Supabase.