# Arquitectura y Estrategia de Seguridad - NubaGlow App

Este documento detalla el modelo de seguridad integral implementado en el backend de NubaGlow (Ingeniería de Software - Grupo 11), estructurado conforme a los estándares de OWASP Top 10 y las especificaciones de diseño del proyecto (`CLAUDE.md`, Secciones 3 y 9).

---

## 1. Matriz de Mitigación de Amenazas (OWASP / Requisitos del Proyecto)

| Amenaza | Vector de Riesgo | Cómo la Mitigamos | Archivo Real de Implementación | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Inyección SQL** | Entrada no sanitizada en parámetros de consulta o payloads que alteran la sintaxis SQL. | Consultas 100% parametrizadas con marcadores de posición (`$1, $2, ...`) delegadas al driver oficial `pg`. En ningún caso se realiza interpolación directa ni concatenación de cadenas en sentencias SQL. | [`backend/src/db/index.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/db/index.ts)<br>[`backend/src/services/pedidos.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/pedidos.service.ts)<br>[`backend/src/services/productos.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/productos.service.ts) | **Implementado y Verificado** |
| **Cross-Site Scripting (XSS)** | Inyección de scripts maliciosos en campos de texto (reseñas, nombres, direcciones) reflejados o almacenados. | **En Backend:** Cabeceras HTTP endurecidas vía `helmet` (`x-xss-protection`, `x-content-type-options: nosniff`), respuestas de API forzadas a `application/json` (nunca HTML ejecutable), y validación estricta de esquemas Zod con recorte y límites de longitud.<br>**En Frontend:** Sanitización de contenido, renderizado exclusivo mediante `textContent` / propiedades seguras del DOM y prohibición de `innerHTML` sobre datos no confiables. | [`backend/src/index.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/index.ts)<br>[`backend/src/schemas/pedidos.schema.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/schemas/pedidos.schema.ts)<br>*(Frontend DOM sanitization)* | **Backend Implementado** / **Frontend pendiente: Fases 4 y 5** |
| **Cross-Site Request Forgery (CSRF)** | Envío de solicitudes no autorizadas en nombre de un usuario autenticado aprovechando cookies de sesión en el navegador. | 1. Cookies `access_token` y `refresh_token` configuradas con `SameSite: 'strict'`, `HttpOnly: true` y `Secure: true` en producción, bloqueando su envío en contextos cross-site.<br>2. Middleware `proteccionCsrf` que evalúa peticiones mutantes (`POST`, `PUT`, `PATCH`, `DELETE`) con cookies: valida cabeceras `Origin` o `Referer` contra la lista blanca permitida. Si faltan ambas cabeceras en presencia de cookies o el origen es ajeno, se rechaza con `403 Forbidden`. Las llamadas API que utilizan `Authorization: Bearer` o mutaciones públicas sin cookies (ej. registro) se permiten de forma segura. | [`backend/src/middlewares/csrf.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/middlewares/csrf.ts)<br>[`backend/src/controllers/auth.controller.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/controllers/auth.controller.ts)<br>[`backend/src/index.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/index.ts) | **Implementado y Verificado** |
| **Fuerza Bruta / Credential Stuffing** | Intentos continuos y automatizados de adivinación de contraseñas sobre `/api/auth/login`. | 1. Rate Limiting por IP: Máximo 5 intentos cada 15 minutos en `/api/auth/login` mediante `express-rate-limit`.<br>2. Bloqueo temporal por cuenta: Tras 5 intentos fallidos consecutivos sobre un mismo correo, la cuenta se bloquea automáticamente por 15 minutos respondiendo HTTP `429 Too Many Requests`. El bloqueo expira por tiempo (no permanente) y un inicio de sesión exitoso resetea el contador de fallos. | [`backend/src/middlewares/bloqueoCuenta.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/middlewares/bloqueoCuenta.ts)<br>[`backend/src/routes/auth.routes.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/routes/auth.routes.ts)<br>[`backend/src/services/auth.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/auth.service.ts) | **Implementado y Verificado** |
| **Escalada de Privilegios / Omisión de RBAC** | Un usuario estándar o con rol staff intenta acceder a recursos o mutaciones que requieren privilegios superiores. | Control de acceso basado en roles (RBAC) verificado en cada endpoint mediante los middlewares `verificarToken` y `requerirRol(...)`. En el endpoint de registro público se fuerza incondicionalmente el rol `cliente`. Para la gestión de staff, la base de datos y la lógica de servicio protegen contra la auto-desactivación del propio usuario autenticado y previenen la desactivación o cambio de rol del último administrador activo del sistema (HTTP 400). | [`backend/src/middlewares/autenticacion.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/middlewares/autenticacion.ts)<br>[`backend/src/routes/usuarios.routes.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/routes/usuarios.routes.ts)<br>[`backend/src/services/usuarios.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/usuarios.service.ts) | **Implementado y Verificado** |
| **Manipulación de Precios desde el Cliente** | Un atacante modifica el payload del carrito de compra enviando un precio unitario o subtotal alterado. | El servidor ignora por completo cualquier dato de precio o subtotal provisto en el payload del cliente. Los precios unitarios, descuentos aplicables y totales se consultan y calculan en el servidor directamente desde la tabla `variantes` y `productos`, utilizando bloqueos pesimistas `SELECT ... FOR UPDATE` ordenados ascendentemente para garantizar integridad transaccional e inmutabilidad económica. | [`backend/src/services/pedidos.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/pedidos.service.ts)<br>[`backend/src/services/pos.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/pos.service.ts)<br>[`backend/src/schemas/pedidos.schema.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/schemas/pedidos.schema.ts) | **Implementado y Verificado** |
| **Acceso a Pedidos Ajenos (IDOR / BOLA)** | Modificación de IDs en la URL para consultar información sensible o pedidos pertenecientes a otros clientes. | Validación de propiedad a nivel de servicio: si el solicitante tiene rol `cliente`, las consultas filtran obligatoriamente por su `usuario_id` extraído del JWT criptográficamente verificado. Si se solicita un pedido específico que no pertenece al usuario autenticado, se devuelve `403 Forbidden` o `404 Not Found`. En el endpoint público de rastreo por código de seguimiento, se anonimizan los datos del cliente omitiendo direcciones completas, teléfonos o montos monetarios. | [`backend/src/services/pedidos.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/pedidos.service.ts)<br>[`backend/src/services/envios.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/envios.service.ts) | **Implementado y Verificado** |
| **Exposición de Secretos / Credenciales** | Fugas de credenciales de base de datos, llaves JWT o contraseñas en el repositorio de control de versiones. | 1. Auditoría completa de historial Git (`git log -p`) confirmando que no existen contraseñas ni tokens reales comprometidos.<br>2. Exclusión estricta en `.gitignore` de `.env`, `node_modules`, `dist` y cualquier archivo con secretos locales (`seed_passwords.txt`).<br>3. Archivo `.env.example` saneado que únicamente contiene variables sintéticas y placeholders (`tu_clave_secreta_aqui`, etc.).<br>4. Almacenamiento seguro de contraseñas de usuarios con algoritmo de derivación de claves `bcryptjs` utilizando un factor de coste robusto (salt rounds = 12). | [`.gitignore`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/.gitignore)<br>[`.env.example`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/.env.example)<br>[`backend/src/db/sembrar.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/db/sembrar.ts)<br>[`backend/src/services/auth.service.ts`](file:///c:/Users/NAYDELIN/Documents/ingeneria%20de%20software/primera%20entrega/backend/src/services/auth.service.ts) | **Implementado y Verificado** |

---

## 2. Auditoría de Dependencias (`npm audit`)

Se ejecutó la auditoría automatizada de vulnerabilidades sobre la raíz del repositorio y sobre el paquete `backend`.

### 2.1. Raíz (`/`)
- **Dependencias runtime:** 0 (el `package.json` de la raíz opera únicamente como orquestador de scripts y monolito).
- **Resultado:** No aplican dependencias transitivas ni vulnerabilidades en la raíz.

### 2.2. Backend (`/backend`)
El reporte arrojó 7 alertas de severidad alta distribuidas en 3 librerías. A continuación se documenta el análisis y la justificación técnica de mitigación:

1. **`zod` (`<4.6.6` - GHSA-mrhx-c7xc-m3w5):**
   - *Descripción del aviso:* Posible consumo excesivo de memoria al validar colecciones recursivas o no acotadas.
   - *Corrección sugerida por npm:* Actualizar a `zod@4.6.7` (versión mayor con cambios incompatibles / breaking changes).
   - *Decisión técnica / Mitigación:* **Aceptado en v3.24.1**. No se aplica la versión 4 para no romper la compatibilidad de tipos ni la compilación de TypeScript en los esquemas existentes. La vulnerabilidad queda completamente mitigada en tiempo de ejecución porque **todos los esquemas de la aplicación están acotados** (límites explícitos en cadenas `.max(255)`, arreglos finitos `.min(1).max(50)`, y validación previa de tamaño de payload en Express con límite de 2MB).
2. **`nodemailer` (`<=10.1.3` - GHSA-mm7p-fcc7-pg87 y conexos):**
   - *Descripción del aviso:* Inyecciones de comandos SMTP en nombres de transporte y conflictos de interpretación de dominios.
   - *Corrección sugerida por npm:* Actualizar a `nodemailer@10.6.0` (versión mayor con breaking changes).
   - *Decisión técnica / Mitigación:* **Aceptado en v6.x (inactivo)**. La librería `nodemailer` es actualmente una dependencia declarada para futuras expansiones de notificaciones por correo pero **no está en uso en ninguna ruta activa ni módulo de servicio de `backend/src`**. Al no invocarse ningún transporte de red ni procesarse entradas de usuario mediante Nodemailer, el vector de ataque es nulo.
3. **`picomatch` / `chokidar` (ReDoS en patrones extglob - GHSA-fc5q-39xc-vjpf):**
   - *Descripción del aviso:* Posible denegación de servicio por expresiones regulares en globbing de archivos.
   - *Corrección sugerida por npm:* Sin parche disponible en el árbol actual de `ts-node-dev`.
   - *Decisión técnica / Mitigación:* **Aceptado (aislado en entorno de desarrollo)**. La dependencia proviene exclusivamente de `ts-node-dev`, el cual forma parte de `devDependencies` y se utiliza únicamente durante el desarrollo local (`npm run dev`). En el entorno de producción (`npm run build` y `npm run start`), el servidor se ejecuta directamente sobre Node.js con los archivos transpilados en `dist/`, sin cargar `chokidar` ni `picomatch`.

---

## 3. Guía de Arquitectura de Seguridad para Defensa Oral

Durante la sustentación del proyecto, el tribunal evaluará los siguientes pilares de seguridad y diseño arquitectónico:

### A. Autenticación y Ciclo de Vida de Tokens
- **Tokens duales (Access + Refresh):** Se utiliza `access_token` JWT de vida corta (15 minutos) firmado con clave secreta HMAC-SHA256, y `refresh_token` de 7 días.
- **Cookies Seguras:** Las cookies se emiten con directivas `HttpOnly` (inaccesibles por JavaScript malicioso), `SameSite=Strict` (inmunes a llamadas cross-site desde otros dominios) y `Secure` (forzado en entornos HTTPS de producción).
- **Protección contra fuerza bruta en doble capa:** Capa de red/IP mediante `express-rate-limit` (5 req / 15 min) y capa de aplicación/cuenta mediante `GestorBloqueoCuenta` (5 fallos consecutivos bloquean la cuenta durante 15 minutos con código 429).

### B. Autorización y Mínimo Privilegio (RBAC)
- 4 roles bien diferenciados: `admin`, `operaciones`, `vendedor`, `cliente`.
- Cada ruta valida explícitamente los roles permitidos mediante el middleware `requerirRol(...)`.
- Los clientes solo pueden consultar y gestionar sus propios pedidos y perfil; el personal de ventas tiene acceso a POS y catálogo; operaciones gestiona inventario y envíos; únicamente administradores gestionan cuentas de staff y reportes financieros consolidados.
- La base de datos y la capa de servicio imponen la invariante de seguridad: **siempre debe existir al menos un administrador activo en el sistema**. Intentar desactivarlo o degradar su rol arroja un error 400 y aborta la transacción.

### C. Integridad Financiera y Prevención de Concurrencia
- **Inmutabilidad de Precios:** Los precios se leen exclusivamente desde la base de datos dentro de transacciones SQL ACID con nivel de aislamiento `READ COMMITTED`.
- **Bloqueo Pesimista (`FOR UPDATE`):** Para evitar condiciones de carrera (*race conditions*) y reservas simultáneas de stock, las variantes se bloquean ordenando sus claves primarias de forma ascendente (`ORDER BY id ASC`), evitando bloqueos mutuos (*deadlocks*).
- **Validación de Stock No Negativo:** Restricciones `CHECK (stock >= 0)` en PostgreSQL y validación previa en la lógica de negocio impiden inventarios negativos.

### D. Trazabilidad y Auditoría Forense
- La tabla `auditoria` registra de manera inmutable todos los eventos críticos del sistema:
  - Inicios de sesión de personal staff (`LOGIN_STAFF`).
  - Creación y edición de usuarios de staff (`CREAR_USUARIO`, `EDITAR_USUARIO`).
  - Modificaciones en listas de precios con registro de precio anterior y precio nuevo (`CAMBIO_PRECIO`).
  - Ajustes manuales de inventario con motivo, responsable y cantidad (`AJUSTE_MANUAL_KARDEX`).
  - Transiciones en los estados logísticos de envío (`CAMBIAR_ESTADO_ENVIO`).
- Cada registro almacena: `usuario_id`, `accion`, `tabla_afectada`, `registro_id`, `detalles` (en formato JSONB) y `ip`.
