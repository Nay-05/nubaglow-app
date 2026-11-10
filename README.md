# NubaGlow App — Proyecto Unificado (Ingeniería de Software)

Proyecto oficial de e-commerce y gestión Beauty-Tech para **Nuba Beauty**, unificando la experiencia visual de `proyecto_landing` con las funcionalidades de seguridad y control de acceso basado en roles (RBAC) de `NubaGlow-Seguridad`.

---

## 🌸 ¿Qué contiene este proyecto?

Este proyecto integra en una sola aplicación armónica:
1. **Diseño Visual Beauty-Tech (Base `proyecto_landing`):** Paleta cosmética oficial (Rosa Cuarzo, Oro Rosa, Nude Cream y Dorado Glow), efectos *glassmorphism*, animaciones sutiles y tipografía *Plus Jakarta Sans*.
2. **Sistema de Seguridad y Roles (Base `NubaGlow-Seguridad`):** Autenticación con tokens JWT, encriptación de contraseñas con bcrypt y restricción de pantallas según el rol del usuario (RBAC).
3. **Módulos de Gestión Empresarial:**
   * **Punto de Venta (POS):** Para registrar ventas físicas en tienda, calcular cambio en efectivo o generar cobro con QR Simple.
   * **Control de Inventario:** Control de existencias multi-almacén con aviso automático de punto de reorden (stock $\le$ 5 unidades).
   * **Envíos y Logística:** Monitoreo y avance de despachos en 4 etapas (*Pendiente ➔ En preparación ➔ En tránsito ➔ Entregado*).
   * **Panel Administrativo:** Altas, bajas y modificación (CRUD) de usuarios del sistema.
   * **Catálogo & Carrito Inteligente:** Con cálculo de envíos a departamentos de Bolivia y pasarela QR Simple simulada.
   * **Asistente IA Skin Advisor:** Recomendación personalizada de cosméticos y cuidado facial.

---

## 👥 Roles del Sistema (RBAC) y Credenciales de Prueba

Para probar o defender el proyecto ante el docente, puedes usar los botones de acceso rápido en la pantalla de [login.html](login.html) o escribir estas credenciales:

| Rol | Correo | Contraseña | Permisos y Pantallas |
| :--- | :--- | :--- | :--- |
| **👑 Administradora** | `admin@nuba.bo` | `admin1234` | **Acceso total:** Panel Admin, POS, Inventario, Envíos y Tienda |
| **🛍️ Vendedor/a** | `vendedor@nuba.bo` | `vendedor1234` | **Punto de Venta (POS)** y consulta de catálogo |
| **📦 Almacén** | `almacen@nuba.bo` | `almacen1234` | **Control de Stock**, semáforo y alertas de reorden |
| **🚚 Logística** | `logistica@nuba.bo` | `logistica1234` | **Envíos y trazabilidad** de despachos |
| **🌸 Cliente** | `cliente@nuba.bo` | `cliente1234` | **Catálogo**, Carrito QR, Asistente IA y Rastreo |

---

## 🚀 ¿Cómo Ejecutar el Proyecto?

El proyecto fue diseñado de manera **flexible e inteligente**: funciona tanto de forma directa en el navegador como con su servidor backend de Express + SQLite.

### Opción 1: Apertura Directa (Modo Rápido / Sin Comandos)
1. Ve a la carpeta `proyecto_unido`.
2. Haz doble clic en el archivo **`index.html`** (o en **`login.html`**).
3. ¡Listo! Se abrirá en tu navegador favorito (Chrome, Edge, Firefox). El sistema detecta automáticamente el modo local y te permite navegar y probar todos los roles.

---

### Opción 2: Ejecución Completa con Servidor Web y Backend Express (Recomendada para la defensa)

Abre una terminal en la carpeta `proyecto_unido`:

#### Paso 1: Iniciar el Backend de Seguridad (Puerto 4000)
```bash
# Entra a la carpeta del backend y corre el servidor
cd backend
npm run dev
```
*Verás en pantalla:* `Backend de Seguridad corriendo en http://localhost:4000` y la base de datos `nubaglow.sqlite` conectada.

#### Paso 2: Iniciar el Servidor Frontend (Puerto 3000)
Abre **otra ventana de terminal** en la carpeta principal `proyecto_unido`:
```bash
npx serve . -l 3000
```
Abre en tu navegador: **`http://localhost:3000`**

---

## 📁 Estructura de Archivos del Proyecto

```
proyecto_unido/
├── index.html            # Tienda oficial, catálogo interactivo, carrito QR y asistente IA
├── login.html            # Inicio de sesión con selector de roles rápido
├── panel.html            # Panel de Administración de Usuarios (CRUD)
├── pos.html              # Terminal de Punto de Venta (POS) para mostrador
├── inventario.html       # Control de existencias y semáforo de punto de reorden
├── envios.html           # Panel de trazabilidad de despachos para logística
├── css/
│   └── styles.css        # Sistema de diseño Beauty-Tech (Glow, Glassmorphism, colores)
├── js/
│   ├── auth.js           # Módulo de autenticación, control de roles (RBAC) y sesión
│   ├── app.js            # Lógica de tienda, carrito, chat IA y rastreo
│   ├── panel.js          # Lógica interactiva del CRUD de usuarios
│   ├── pos.js            # Lógica interactiva del ticket y cálculo de cambio/QR
│   ├── inventario.js     # Lógica del stock, ajustes en vivo y alertas
│   └── envios.js         # Lógica del avance de etapas de entrega
├── imagenes/             # Fotografías reales de cosméticos y productos Nuba
├── backend/              # Servidor Express + SQLite con JWT y RBAC
│   ├── src/
│   │   ├── index.ts      # Servidor principal (puerto 4000)
│   │   ├── db/database.ts# Base de datos SQLite y tabla de usuarios
│   │   ├── middleware/   # Middleware de verificación JWT y roles
│   │   └── routes/       # Rutas /auth y /usuarios
│   ├── package.json
│   └── tsconfig.json
├── package.json          # Scripts para iniciar frontend y backend
└── README.md             # Esta documentación
```
