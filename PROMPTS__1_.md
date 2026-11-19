# Prompts para construir NubaGlow (Antigravity / Claude Code / Claude)

Versión alineada con `CLAUDE.md`. Las referencias a secciones usan la numeración real de ese archivo:

| Tema | Sección de CLAUDE.md |
|---|---|
| Stack | 2 |
| Roles y accesos (RBAC) | 3 |
| Navegación SPA y URLs | 4 |
| Logo, assets y referencias | 5 |
| Diseño e interfaz | 6 |
| Funcionalidades por módulo | 7 |
| Base de datos | 8 |
| Seguridad | 9 |
| Asistente IA | 10 |
| Notificaciones y PDF | 11 |
| Convenciones y definición de terminado | 12 |

## Cómo usar este archivo

1. Coloca `CLAUDE.md` en la raíz del repositorio y la carpeta `assets/` con logo, íconos y referencias (sección 5).
2. Pega el **Prompt maestro** una sola vez al iniciar la sesión.
3. Ejecuta la **Fase 0** (solo diagnóstico, no modifica nada) y revisa el plan.
4. Pega las fases 1 a 12 (incluida la Fase 5.5) una por una. Al terminar cada una: corre los comandos que la IA indique, prueba, y haz commit antes de pasar a la siguiente.
5. Al final usa la auditoría, la preparación de defensa y la lista de verificación.

Si la sesión se reinicia o el contexto se pierde, pega de nuevo el **Prompt de reanudación** (al final de la sección de fases).

---

## PROMPT MAESTRO (pégalo primero, una sola vez)

```
Eres un ingeniero de software senior trabajando en NubaGlow App, el e-commerce y sistema de gestión interna de Nuba Beauty (Sucre, Bolivia), proyecto de Ingeniería de Software (Grupo 11). Se defenderá oralmente: el código debe ser limpio, modular y explicable por estudiantes.

Lee CLAUDE.md completo y trátalo como especificación obligatoria. Si algo que te pida contradice CLAUDE.md, avísame antes de hacerlo.

Reglas permanentes para todas las fases:
1. Stack fijo: Node.js + Express + TypeScript, PostgreSQL en Supabase con consultas parametrizadas, frontend HTML/CSS/JS vanilla modular. No agregues frameworks ni cambies el stack sin avisarme.
2. Arquitectura backend por capas: routes -> controllers -> services -> db. Nombres de dominio, tablas y rutas de API en español; términos técnicos en inglés.
3. Cero emojis en cualquier parte (interfaz, mensajes, README, asistente, comentarios). Solo iconos SVG de línea estilo Lucide, trazo 1.5px.
4. Paleta y tipografía únicamente mediante las variables CSS de CLAUDE.md sección 6.
5. Seguridad no negociable (sección 9): sin secretos en código, validación con Zod, permisos verificados siempre en el backend, nunca solo ocultando elementos en el DOM.
6. Honestidad: no inventes funcionalidades que no puedas demostrar. Lo simulado (QR, comprobantes, facturación) debe decir explícitamente que es simulado; PayPal se usa en modo sandbox con sus APIs oficiales.
7. Comenta las partes críticas (transacciones, middlewares de autorización, generación de tokens) de forma que un estudiante pueda explicarlas.
8. Trabaja por fases. No avances a la siguiente sin mi confirmación.

Al terminar cada fase entrégame siempre:
- Resumen de lo que cambió y archivos tocados.
- Comandos exactos para probar.
- Qué verificar manualmente (rutas, roles, casos de error).
- Mensaje de commit sugerido.
- Pendientes o decisiones que necesites de mí.

Ahora espera la Fase 0.
```

---

## FASE 0 — Diagnóstico (solo lectura, no modifiques nada)

```
Fase 0: diagnóstico. No modifiques ningún archivo en esta fase.

Revisa todo el repositorio contra CLAUDE.md y entrégame:
1. Inventario de lo que existe: qué es real (backend + base de datos) y qué solo vive en el frontend, en localStorage o como datos de demostración falsos.
2. Brecha contra CLAUDE.md: tabla con cada módulo (tienda pública, POS, pagos, almacén, logística, admin, asistente IA, notificaciones, PDF) y su estado: completo, parcial o ausente.
3. Vulnerabilidades de seguridad encontradas: credenciales o secretos en README o código, botones de acceso rápido o autocompletado, modo local que salta la autenticación, rutas internas expuestas o enlazadas en la tienda pública, validaciones ausentes, uso de innerHTML con datos dinámicos, consultas SQL concatenadas, CORS abierto, falta de rate limiting.
4. Estado de los assets: verifica si existen assets/brand/ (logo-nubaglow.png, icono1.png, icono2.png) y assets/references/ (ref1..ref4-home, ref1..ref2-catalogo). Lista los que falten.
5. Plan de trabajo: confirma o ajusta las fases 1 a 12 (incluida la Fase 5.5) de este documento indicando qué archivos tocarás en cada una y qué riesgos ves.

Termina con las preguntas que necesites que yo responda antes de empezar.
```

---

## FASE 1 — Base de datos en Supabase

```
Fase 1: base de datos relacional persistente (CLAUDE.md sección 8).

- Escribe backend/src/db/schema.sql versionado con las tablas: usuarios, categorias, productos, variantes, imagenes_producto, resenas, carritos, carrito_items, pedidos, pedido_items, pagos, pago_eventos, comprobantes_pago, envios, envio_eventos, entregas, ventas_pos, facturas, movimientos_inventario, auditoria, notificaciones.
- Llaves foráneas estrictas (ON DELETE RESTRICT en historiales), restricciones CHECK (stock >= 0, precio >= 0, calificación 1 a 5, estados y roles como valores válidos), UNIQUE donde corresponda (slug, sku, codigo_rastreo, email, paypal_order_id, una reseña por producto y cliente) e índices en slug, sku, codigo_rastreo, email y paypal_order_id.
- Roles de usuario restringidos a: cliente, vendedor, almacen, logistica, admin.
- Estados de pago: Pendiente, En verificación, Aprobado, Rechazado.
- Estados de envío: Pendiente, En preparación, Empacado, En tránsito, Entregado.
- Tablas de pago y entrega: pagos (método, estado, monto/moneda, referencia externa/PayPal, comprobante, vencimiento, verificado_por, motivo_rechazo), pago_eventos, comprobantes_pago, envios (preparado_por, empacado_por, despachado_por, entregado_por), envio_eventos y entregas (receptor, documento, fecha, hora, nota y comprobante).
- Módulo de conexión en backend/src/db/ con pool de pg, lectura de DATABASE_URL desde .env, y un helper para transacciones (BEGIN / COMMIT / ROLLBACK) reutilizable.
- Script de migración y seed.sql con mínimo 30 productos realistas de skincare y maquillaje, cada uno con marca, categoría, tipo de piel, descripción, ingredientes clave, modo de uso, imágenes y variantes (tonos, tamaños o presentaciones) con SKU, precio y stock propios. Incluye usuarios de prueba por rol con contraseñas hasheadas; las contraseñas de prueba NO se escriben en el README, solo en un archivo local ignorado por git o en la salida del script de seed.
- Scripts npm: db:migrate y db:seed.

Dime cómo crear el proyecto en Supabase, dónde copiar la cadena de conexión y cómo correr migración y seed.
```

---

## FASE 2 — Backend por capas y API REST

```
Fase 2: API REST completa por capas (routes -> controllers -> services -> db).

Reestructura backend/src y crea los endpoints, todos con rol requerido explícito:
- auth: registro público (siempre rol cliente), login de clientes, login de staff, refresh, logout.
- usuarios: gestión de personal interno (solo admin).
- categorias y productos: listado con búsqueda, filtros combinables (categoría, tipo de piel, rango de precio), orden y paginación; detalle por slug. CRUD solo admin.
- variantes: stock y precio individual.
- carrito: persistente en BD para clientes autenticados.
- pedidos: crear, listar los propios, detalle. Un cliente nunca puede ver pedidos de otro.
- pagos, envios y rastreo: consulta pública por código de rastreo; verificación de pagos solo vendedor y admin; preparación y empaque solo almacen y admin; despacho, transporte y cierre de entrega solo logistica y admin.
- resenas: solo clientes con pedido Entregado que incluya ese producto, máximo una por producto y cliente; promedio, conteo y distribución.
- ventas POS y facturas: vendedor y admin.
- inventario: movimientos y ajustes con motivo y responsable (almacen y admin).
- reportes: ventas web vs POS, ingresos por día, ranking de productos (admin).

Reglas críticas:
- Crear un pedido es UNA transacción: validar stock con bloqueo de fila (SELECT ... FOR UPDATE), descontar stock, crear pedido, items, pago, envío con código de rastreo único y evento inicial. Si algo falla, ROLLBACK.
- El precio y el total SIEMPRE se calculan en el servidor a partir de la BD; nunca se aceptan precios enviados por el cliente.
- Manejo de errores centralizado: mensajes claros al cliente sin trazas ni SQL expuestos.

Entrega la colección de Postman en docs/postman/ con variables de entorno, ejemplos y tests automáticos de código HTTP, incluyendo pruebas negativas de permisos: cliente accediendo a /api/staff/* o a rutas de admin debe recibir 403, sin token debe recibir 401, y un cliente consultando el pedido de otro debe recibir 403 o 404.

Documenta cada endpoint en el README con método, ruta, rol requerido y ejemplo.
```

---

## FASE 3 — Seguridad y autenticación (RBAC)

```
Fase 3: seguridad (CLAUDE.md secciones 3 y 9). Mi docente pidió que no se pueda entrar como administrador ni hackear el sistema.

- Elimina del código y del README TODAS las credenciales, botones de acceso rápido, autocompletado de credenciales y cualquier modo sin login o modo local que salte la autenticación.
- Secretos solo en .env (DATABASE_URL, JWT_SECRET, credenciales SMTP, TELEGRAM_BOT_TOKEN, GEMINI_API_KEY u otra clave de IA). Crea .env.example sin valores reales y verifica .gitignore. Si el historial de git ya expuso secretos, indícame qué rotar y cómo limpiar el historial.
- Contraseñas: bcrypt con coste >= 12; política mínima de 8 caracteres, una mayúscula y un número; bloqueo temporal tras intentos fallidos.
- Sesiones: Access Token JWT de 15 a 30 minutos y Refresh Token en cookie httpOnly, Secure, SameSite (Strict o Lax según el despliegue). Protección CSRF para los endpoints que usan cookies.
- Middlewares verificarToken y requerirRol(...). El rol se valida desde el token firmado y/o la base de datos, nunca desde datos enviados por el cliente. El registro público fuerza rol = 'cliente'. Solo admin crea cuentas vendedor, almacen, logistica o admin. No existe auto-registro de staff.
- Login separado: /login para clientes y /staff/login para trabajadores. El cliente que intente entrar a /staff/* es redirigido a / o recibe 403. En la tienda pública no debe existir ningún enlace hacia rutas de empleados.
- Protege las páginas y vistas internas con verificación real en el servidor (no solo redirección en JavaScript).
- Validación de todo req.body y req.params con Zod. Consultas 100% parametrizadas.
- helmet, CORS restringido al dominio del frontend (lista blanca), express-rate-limit general y uno estricto en /login.
- XSS: reemplaza innerHTML con datos de usuario o de BD por textContent o creación segura de nodos DOM, o sanitiza.
- Auditoría en la tabla auditoria: inicios de sesión de staff, creación y edición de usuarios, cambios de precio, ajustes manuales de stock y cambios de estado de envío.

Después ejecuta npm audit y corrige lo grave. Entrégame una tabla "Amenaza -> Cómo la mitigamos -> Archivo" para usar en la defensa (cubre: inyección SQL, XSS, CSRF, fuerza bruta, escalada de privilegios, manipulación de precios desde el cliente, acceso a pedidos ajenos, exposición de secretos).
```

---

## FASE 4 — Enrutamiento SPA y layout del portal interno

```
Fase 4: navegación y portal de staff (CLAUDE.md secciones 3 y 4).

- Router en JavaScript vanilla modular que usa window.history.pushState() para actualizar la URL en cada cambio de sección, sin recargar la página, y escucha window.onpopstate para que Atrás y Adelante funcionen.
- Rutas públicas: /, /catalogo, /producto/:slug, /pedidos, /carrito, /cuenta, /login.
- Rutas privadas: /staff/login, /staff/dashboard, /staff/pos, /staff/pagos, /staff/almacen, /staff/logistica, /staff/productos, /staff/usuarios, /staff/reportes.
- Express sirve index.html como fallback SPA para cualquier ruta de frontend desconocida (que F5 en /catalogo o /staff/almacen no dé 404), sin interferir con las rutas /api/*.
- Layout interno de staff: dashboard con sidebar lateral, sin elementos visuales de la tienda, que muestra solo los módulos permitidos para el rol de la sesión. Tras el login de staff, el backend valida el rol y redirige a su vista de trabajo (vendedor a /staff/pos, almacen a /staff/almacen, logistica a /staff/logistica, admin a /staff/dashboard).
- Guardas de ruta en el frontend como ayuda de UX, y verificación real de permisos en cada llamada a la API.

Dime cómo probar: navegación con botones Atrás/Adelante, recarga con F5 en cada ruta y acceso denegado cruzando roles.
```

---

## FASE 5 — Identidad visual y tienda pública

```
Fase 5: rediseño visual y tienda pública (CLAUDE.md secciones 5, 6 y 7A).

Identidad:
- Antes de maquetar, lee las imágenes de assets/references/ (ref1..ref4-home para portada y estética general; ref1 y ref2-catalogo para tarjetas y filtros; las demás para tablas y paneles internos) y úsalas como guía de distribución.
- Usa assets/brand/logo-nubaglow.png en el header de la tienda, en el login de staff y en el encabezado de los PDF. Favicon con assets/brand/icono1.png; icono2.png como decoración. Si hace falta una versión alternativa del logo para fondos oscuros o claros, créala como un corazón en el color más oscuro de la paleta sobre fondo del color más claro.
- Variables CSS en :root con la paleta de CLAUDE.md sección 6 (silver, sand-dune, almond-silk, smoky-rose, wine-plum, ivory #faf8f5, carbón #2b2124). Reescribe styles.css para que todo use esas variables.
- Una única pareja tipográfica: Cormorant Garamond (títulos) y DM Sans (cuerpo, formularios, tablas, botones).
- Elimina todos los emojis y reemplázalos por iconos SVG de línea (Lucide, trazo 1.5px) con colores de la paleta.
- Botones de 36 a 40 px de alto, radio 8px, planos, con estados hover, focus visible y disabled accesibles.

Tienda:
- Navbar pública minimalista: Inicio, Catálogo, Pedidos, Carrito, Cuenta. Sin Características, Beneficios, Contacto ni enlaces administrativos.
- Catálogo: cuadrícula uniforme; tarjetas con imagen, nombre, precio desde, valoración con estrellas y botón pequeño; filtros laterales combinables (categoría, tipo de piel, rango de precio), buscador en tiempo real y ordenamiento. Datos desde la API.
- Ficha /producto/:slug: galería, descripción, ingredientes clave, modo de uso en pestañas, selector de variante (tono, ml, presentación) que actualiza precio y stock individual, y reseñas con estrellas, promedio, conteo y distribución como Amazon. Solo compradores con pedido Entregado que incluya el producto pueden reseñar, una vez por producto.
- Carrito: persistente en BD para clientes autenticados y respaldo en localStorage para visitantes. No debe mostrar costo de envío cuando el subtotal es cero.
- Diseño editorial limpio, mucho espacio en blanco y mobile-first.
- Quita o reescribe con honestidad cualquier afirmación que no podamos demostrar (por ejemplo "certificación bancaria", "GPS en tiempo real", "inventario 100% verificado").

Entrégame una descripción (o captura) de cada pantalla modificada en versión móvil y escritorio.
```

---

## FASE 5.5 — Ajuste de backend: roles, pagos y logística

```
Fase 5.5: ajuste de backend previo al checkout (CLAUDE.md secciones 3, 7 y 8). No cambies el frontend todavía; deja la API y la base de datos preparadas.

Roles y permisos:
- Migra el rol operaciones a dos roles: almacen (inventario, preparación y empaque) y logistica (despacho, transporte y entrega). admin conserva acceso total. vendedor y admin verifican pagos.
- Crea los guards y rutas de staff para /api/staff/pagos, /api/staff/almacen y /api/staff/logistica. El backend debe devolver 403 ante cualquier acción fuera del rol, aunque el frontend oculte el botón.
- Actualiza el seed y las validaciones de usuarios.rol con los cinco roles: cliente, vendedor, almacen, logistica, admin.

Estados y transiciones:
- Pago: Pendiente -> En verificación -> Aprobado | Rechazado.
- Envío: Pendiente -> En preparación -> Empacado -> En tránsito -> Entregado.
- El almacén solo puede preparar/empacar si el pago está Aprobado o el método es contra_entrega. Valídalo en el backend, dentro de una transacción.
- Un pago Rechazado o vencido cancela el pedido y repone el stock con un movimiento de movimientos_inventario tipo reposicion_cancelacion, en la misma transacción. Impide stock negativo y doble reposición.

Stock:
- Refuerza el control de cantidad disponible por variante en carrito y checkout; rechaza cantidades mayores al stock y cualquier precio enviado por el cliente. Al crear el pedido, bloquea la fila con SELECT ... FOR UPDATE y descuenta stock en la misma transacción.

Pagos:
- Añade a pagos: método (qr, deposito_bancario, paypal, contra_entrega), estado, monto/moneda, referencia externa/paypal_order_id, comprobante, fecha_vencimiento, verificado_por, fecha_verificacion y motivo_rechazo.
- Crea pago_eventos y comprobantes_pago para auditar transiciones y guardar el comprobante del cliente.
- Implementa PayPal sandbox con sus APIs REST desde el backend (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE en .env): crear orden, capturar pago, guardar referencia y confirmar el estado server-side. Valida el monto contra la BD e implementa idempotencia; nunca marques un pago como Aprobado desde el frontend.
- Endpoints de verificación para vendedor y admin: listar pagos En verificación, ver el comprobante, aprobar o rechazar con motivo. Audita cada acción.
- Programa la expiración de pagos pendientes: al vencer, marca Rechazado, cancela el pedido y repone stock.

Entrega:
- Crea entregas (pedido/envío, receptor, documento, fecha, hora, nota, comprobante y usuario) y amplía envios/envio_eventos con los nuevos estados y responsables.
- Endpoint de cierre de entrega para logistica y admin: exige receptor, fecha, hora y nota; marca Entregado; si el pago es Contra entrega, lo pasa a Aprobado/cobrado en la misma transacción.

Pruebas:
- Amplía Postman con permisos: almacen no verifica pagos ni despacha, logistica no ajusta stock ni verifica pagos, vendedor no prepara/empaca/despacha. Incluye aprobación, rechazo, expiración, reposición de stock y cierre de entrega.
```

---

## FASE 6 — Checkout, pagos, notificaciones y comprobantes

```
Fase 6: compra completa (CLAUDE.md secciones 7A y 11).

- Formulario de checkout con nombre completo, celular, correo, ciudad y dirección exacta, validado en frontend y backend (celular boliviano, correo válido).
- Control de cantidad disponible: valida stock por variante en catálogo, carrito y checkout; rechaza cantidades mayores al stock y cualquier precio enviado por el cliente.
- Métodos de pago: QR Simple (simulado, con imagen QR dinámica y aviso visible de simulación), Depósito bancario (con carga obligatoria de comprobante), PayPal sandbox (API oficial, server-side) y Pago contra entrega (el pedido queda pendiente de cobro y el pago se marca al entregar).
- Estados de pago visibles en el pedido y en el rastreo: Pendiente, En verificación, Aprobado, Rechazado. QR y depósito pasan a En verificación hasta que vendedor o admin validen el comprobante.
- Verificación manual de comprobantes: cola para vendedor y admin con visualización del archivo, aprobación o rechazo con motivo y registro en auditoría. El pago aprobado habilita al almacén; el rechazado cancela el pedido y repone stock.
- PayPal: crea la orden y captura el pago desde el backend con las APIs de sandbox; nunca marques Aprobado desde el frontend ni confíes en el monto enviado por el navegador. Guarda paypal_order_id y aplica idempotencia.
- Pago vencido o rechazado: transacción que cancela el pedido, repone el stock y registra el movimiento de Kardex reposicion_cancelacion.
- Al confirmar: transacción atómica (la de la Fase 2), código de rastreo único con el formato NB-2026-XXXX definido en CLAUDE.md, y pantalla de confirmación inmediata.
- Correo de confirmación con Nodemailer (SMTP por .env) con resumen del pedido, código de rastreo, estado del pago y comprobante PDF adjunto.
- Comprobante PDF con pdfkit: logotipo de NubaGlow, número correlativo, detalle de variantes, total en Bolivianos (Bs.), código de rastreo, estado del pago y la nota "Comprobante académico de simulación — Sin valor fiscal". Descargable desde Pedidos. Incluye también constancia de pago verificado.
- Alerta interna por Telegram (Bot API, token y chat id por .env) al chat de operaciones cuando ingresa un pedido web o cambia el estado de un pago.
- Botón de WhatsApp con el resumen del pedido prellenado (wa.me). Explica en el README que la API oficial de WhatsApp requiere cuenta de Meta Business y por eso usamos este enfoque.
- Cada notificación (correo, Telegram) se registra en la tabla notificaciones con su estado, y si falla NO debe romper ni revertir la compra.
```

---

## FASE 7 — Pedidos y rastreo

```
Fase 7: sección Pedidos unificada (CLAUDE.md sección 7A, Rastreo de Pedidos).

- Ruta /pedidos: consulta pública por código de rastreo y, para clientes autenticados, historial de sus pedidos. Muestra línea de tiempo visual del pago (Pendiente -> En verificación -> Aprobado/Rechazado) y del envío (Pendiente -> En preparación -> Empacado -> En tránsito -> Entregado) con fecha y hora de cada evento, leída de pago_eventos y envio_eventos.
- Elimina todos los pedidos de demostración falsos del frontend: todo sale de la base de datos.
- Un cliente solo ve sus propios pedidos; la consulta pública por código no debe exponer datos personales completos (por ejemplo, ocultar parcialmente dirección y contacto).
- Al cambiar el estado desde almacén o logística se crea un registro en envio_eventos con usuario y fecha, se audita y se notifica al cliente por correo.
```

---

## FASE 8 — Módulo de ventas / POS (vendedor y admin)

```
Fase 8: Punto de Venta en /staff/pos (CLAUDE.md sección 7B).

- Buscador instantáneo por nombre, categoría o SKU de variante, con selección de variante y control de stock.
- Carrito de mostrador con totales automáticos y registro de venta asociado al ID del vendedor, en una transacción que descuenta stock y crea el movimiento de inventario.
- Datos opcionales del cliente (nombre, NIT/CI, correo) y método de pago.
- Recibo o factura en PDF con número correlativo, detalle y total en Bs., con la nota "Comprobante académico de simulación — Sin valor fiscal"; envío opcional al correo del cliente.
- Historial de ventas por turno y vendedor, y cierre de caja diario.
- El vendedor solo ve sus propias ventas; el admin ve todas.
```

---

## FASE 9 — Módulos separados de Almacén y Logística

```
Fase 9: /staff/almacen para el rol almacen y admin; /staff/logistica para el rol logistica y admin (CLAUDE.md secciones 7C y 7D).

Almacén:
- Vista de inventario: stock por variante, indicador visual de stock bajo (alerta de reorden con umbral configurable), formulario de ingreso de mercadería y ajustes manuales que guardan motivo y responsable en movimientos_inventario y en auditoria.
- Cola de preparación: solo pedidos con pago Aprobado o método Contra entrega. El backend debe bloquear cualquier intento de preparar un pedido pendiente, en verificación o rechazado.
- Preparación y empaque: avance Pendiente -> En preparación -> Empacado, registrando responsable, fecha, hora y observaciones en envio_eventos. No puede saltar ni retroceder estados.
- No puede verificar pagos, despachar, entregar ni cerrar el pedido.

Logística:
- Cola de despachos: pedidos en estado Empacado, listos para salir.
- Transporte y entrega: avance Empacado -> En tránsito -> Entregado, sin saltar ni retroceder estados, registrando fecha, hora y usuario en envio_eventos.
- Cierre de entrega: exige comprobante con receptor, fecha, hora y nota; guarda el registro en entregas y marca Entregado. Si el pago es Contra entrega, lo pasa a Aprobado/cobrado en la misma transacción.
- No puede ajustar inventario ni verificar pagos.

Reglas comunes:
- Cada acción valida el rol en el backend y se audita.
- Los cambios de estado se reflejan en el rastreo público del cliente.
```

---

## FASE 10 — Módulo de administración

```
Fase 10: panel de admin (CLAUDE.md sección 7E).

- CRUD de productos, variantes, categorías, precios e imágenes (cambios de precio auditados).
- Gestión de personal interno: crear cuentas vendedor, almacen, logistica o admin, activar y desactivar accesos, restablecer contraseña. Un admin no puede desactivarse a sí mismo ni eliminar al último admin.
- Panel de métricas: ventas totales (web vs POS), ingresos por día y ranking de productos más vendidos, con gráficos SVG simples sin librerías externas.
- Visor de auditoría con filtros por usuario, acción y fecha.
```

---

## FASE 11 — Asistente IA conectado al catálogo

```
Fase 11: asistente IA (CLAUDE.md sección 10).

- Panel lateral derecho colapsable (drawer), disponible en todas las vistas públicas mediante un botón flotante discreto con icono SVG, sin emojis y con la paleta de la marca.
- Endpoint POST /api/asistente. La clave de API va solo en .env y jamás llega al navegador. Proveedor configurable (Claude o Gemini).
- Grounding con la BD: antes de generar la respuesta, consulta productos reales con stock disponible (filtrando por tipo de piel, categoría y precio) y pásalos como contexto. El asistente solo puede recomendar productos existentes, con enlace a su ficha y botón de agregar al carrito.
- Respuestas concisas, amables y profesionales, sin emojis. Rate limiting por IP o usuario, validación de entrada con Zod y manejo de errores.
- Fallback: si no hay clave configurada, usa un motor básico de reglas por palabras clave para que la demo oral no falle. Indica en la interfaz de forma discreta cuándo se usa el modo básico.
```

---

## FASE 12 — Documentación, pruebas y despliegue

```
Fase 12: cierre (CLAUDE.md sección 12, criterios de entrega).

- README: descripción, arquitectura por capas, diagrama entidad-relación en Mermaid, tabla de endpoints con rol requerido, instalación, variables de entorno (sin valores reales) y qué es real y qué es simulado.
- Pruebas con Vitest o Jest + supertest: autenticación, permisos por rol (cliente a ruta de staff devuelve 403), creación de pedido con stock insuficiente, concurrencia sobre el último producto, cálculo de totales en el servidor y registro público que siempre crea cliente.
- Pruebas del flujo de pago: QR y depósito con comprobante, verificación por vendedor/admin, PayPal sandbox server-side, pago rechazado o vencido con cancelación y reposición de stock, y bloqueo de acciones de pago para almacen/logistica.
- Pruebas del flujo de entrega: el almacén no prepara sin pago Aprobado (salvo Contra entrega), transiciones Pendiente -> En preparación -> Empacado -> En tránsito -> Entregado, y cierre obligatorio con receptor, fecha, hora y nota.
- Verifica que npm install && npm run dev arranque limpio.
- Despliegue en Render conectado a Supabase: variables de entorno, comando de build y start, CORS con el dominio final, cookies Secure. Mantén la capa db/ desacoplada.
- Script de datos de demostración para la defensa y lista de verificación de despliegue.
- Ejecuta npm audit y deja el resultado documentado.
```

---

## PROMPT DE REANUDACIÓN (si se pierde el contexto)

```
Retomamos NubaGlow App. Lee CLAUDE.md completo y revisa el estado actual del repositorio (git log y git status). Dime en qué fase estamos, qué está terminado, qué quedó a medias y cuál es el siguiente paso. No modifiques nada hasta que yo confirme.
```

---

## PROMPT DE AUDITORÍA FINAL (como si fuera el docente)

```
Actúa como un docente exigente de Ingeniería de Software y como pentester. Revisa el proyecto completo contra CLAUDE.md y entrega:
1. Fallos de seguridad restantes con severidad y arreglo. Intenta, en la práctica o mentalmente: escalar a admin, entrar a /staff/* siendo cliente, modificar precios desde el cliente, ver pedidos de otros usuarios, inyección SQL, XSS, CSRF, fuerza bruta en login, abuso del asistente IA, secretos en el repositorio.
2. Requisitos de CLAUDE.md no cumplidos, módulo por módulo, y cada criterio de entrega de la sección 12.
3. Código difícil de explicar o duplicado que convenga simplificar.
4. Inconsistencias visuales: emojis restantes, tipografías o colores fuera de la paleta, botones fuera de 36-40 px, enlaces administrativos visibles en la tienda.
5. Rutas SPA: URL actualizada en cada módulo, Atrás/Adelante y F5 funcionando.
Corrige lo que puedas y lista lo pendiente con prioridad.
```

---

## PROMPT PARA PREPARAR LA DEFENSA

```
Voy a defender este proyecto oralmente. Actúa como un tribunal. Genera:
1. Explicación de la arquitectura completa en lenguaje simple (frontend SPA, backend por capas, PostgreSQL en Supabase, seguridad) y el recorrido de una compra de punta a punta, archivo por archivo.
2. 40 preguntas probables de backend, frontend, base de datos y seguridad, con respuestas modelo cortas. Incluye preguntas trampa: por qué PostgreSQL en Supabase y no SQLite o archivos locales en Render, qué es JWT y dónde se guarda cada token, por qué refresh token en cookie httpOnly, cómo evitan la inyección SQL, qué es RBAC y dónde se valida, qué pasa si dos clientes compran el último producto a la vez, por qué el precio se calcula en el servidor, cómo evitan XSS, qué es real y qué es simulado (QR, facturación, WhatsApp).
3. Guion de demostración de 8 minutos con el orden exacto de pantallas y qué decir en cada una: compra como cliente, pago QR o depósito con comprobante, verificación por vendedor, rastreo, login de staff, POS, almacén preparando y empacando, logística cerrando la entrega, admin con métricas y auditoría, intento fallido de acceso cruzado entre roles.
4. Resumen de cada archivo clave con "qué hace" y "por qué está así".
Luego hazme preguntas una por una, evalúa mi respuesta y corrígeme.
```

---

## Lista de verificación previa a la defensa

- [ ] `npm install && npm run dev` arranca sin errores en una máquina limpia.
- [ ] Sitio desplegado en Render responde y está conectado a Supabase.
- [ ] Seed cargado: 30 o más productos y un usuario de prueba por rol.
- [ ] Colección de Postman importada, con pruebas de 403 pasando.
- [ ] Recarga con F5 en `/catalogo`, `/producto/:slug`, `/staff/pos` sin 404.
- [ ] Ningún emoji, ninguna credencial ni botón de acceso rápido visibles.
- [ ] Flujo completo probado en el sitio desplegado: compra, correo, Telegram, PDF, rastreo, cambio de estado, reseña.
- [ ] Pago con QR y depósito bancario probado con comprobante y verificación manual por vendedor/admin.
- [ ] PayPal sandbox probado server-side (crear orden, capturar pago y registrar referencia).
- [ ] Pago rechazado o vencido probado: cancela el pedido y repone stock con movimiento de Kardex.
- [ ] Almacén no prepara pedidos sin pago Aprobado (salvo Contra entrega); logística cierra la entrega solo con receptor, fecha, hora y nota.
- [ ] Modo de reglas del asistente probado sin clave de API.
- [ ] `npm audit` revisado.

## Tareas manuales que la IA no puede hacer por ti

- Rotar cualquier contraseña o secreto que ya esté publicado en GitHub y limpiar el historial si hace falta.
- Crear el proyecto en Supabase y copiar la cadena de conexión.
- Crear el bot de Telegram con BotFather y obtener el chat id del equipo.
- Crear la contraseña de aplicación del correo (Gmail) o una cuenta en Resend o Brevo.
- Cargar las variables de entorno en Render.
- Colocar en `assets/` el logo, los íconos y las imágenes de referencia.
- Instalar Postman e importar la colección.
- Probar el flujo completo en el sitio desplegado antes de la defensa.
