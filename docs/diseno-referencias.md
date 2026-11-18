# Referencias de Diseño NubaGlow

## Brand assets (`assets/brand/`)

- **logo‑nubaglow.png**  
  Logotipo principal de la marca, versión horizontal sobre fondo transparente. Se utiliza en el header de la tienda, en el login de staff y en el encabezado de los comprobantes PDF. Proporciones aproximadamente 3:1 ancho/alto, trazo de línea delgado (1.5px) y color principal `--color-wine-plum`.

- **icono1.png** / **icono2.png**  
  Iconos de corazón dentro de un círculo, inspirados en la paleta de la marca. Se emplean como elementos decorativos en secciones de portada y en la distribución de tarjetas. Formato SVG de línea, peso 1.5px, rellenados con `--color-wine-plum` o `--color-almond-silk` según el contexto.

## Referencias de distribución de pantallas

### `ref1-home.png` – Portada principal
- **Header**: navbar pública minimalista con enlaces *Inicio, Catálogo, Pedidos, Carrito, Cuenta*. No aparecen enlaces de staff. El logo de NubaGlow está alineado a la izquierda.
- **Hero**: sección hero de ancho completo con fondo `--color-sand-dune`, título grande en **Cormorant Garamond** (o Playfair Display) y subtítulo en **DM Sans**. CTA principal (botón estilizado) con `--color-wine-plum`, altura 40px, bordes 8px, texto en blanco.
- **Sección de categorías**: lista horizontal de tarjetas de categoría con imagen pequeña y texto secundario `--color-almond-silk`. Espaciado horizontal 12px entre elementos.
- **Grid de productos**: cuadrícula de 3 columnas en desktop, 2 columnas en tablet, 1 columna en móvil. Cada tarjeta usa `--color-silver` para el borde, `--color-sand-dune` de fondo, y muestra imagen, nombre y precio. Espaciado interno 16px, margen externo 20px.
- **Filtros laterales**: barra lateral derecha con filtros combinables (categoría, tipo de piel, rango de precio). Los controles son selectores y rangos con estilo de botón plano, altura 36px. El filtro “Tipo de piel” muestra etiquetas `--color-smoky-rose` con fondo `--color-almond-silk`.
- **Pagination**: paginación inferior con enlaces *Anterior / 1 2 3 … Siguiente*, botones de misma estilística que el CTA principal, margen superior 24px.
- **Footer**: enlaces de ayuda, redes sociales (iconos SVG) y información de contacto. Fondo `--color-wine-plum`, texto en `#faf8f5`.

### `ref2-home.png` – Portada secundario / About
- **Distribución similar a ref1-home** pero con un *moodboard* visual en la parte superior (foto de producto en estilo editorial). El hero tiene una imagen de fondo con overlay `--color-wine-plum` en 20% de opacidad.
- **Sección “Nuestra historia”**: texto a la izquierda, imagen a la derecha. Tipografía: títulos en Cormorant Garamond, cuerpo en DM Sans. Espaciado vertical 32px entre párrafos.
- **Testimonios**: carrusel de citas con flechas laterales (iconos SVG). Cada tarjeta de testimonio tiene fondo `--color-almond-silk`, borde `--color-silver`, padding 16px.
- **Newsletter**: formulario de suscripción con campo de email y botón “Suscribirse”. Validación en front y back, botón con `--color-wine-plum`.

### `ref3-home.png` – Portada con promociones
- **Hero**: promociones destacadas con banner `--color-smoky-rose` sobre imagen de producto. El banner tiene altura 80px, texto en blanco, centrado.
- **Tarjetas de oferta**: grid de 2 columnas, cada tarjeta muestra precio tachado `--color-smoky-rose` y precio nuevo `--color-wine-plum`. Cada tarjeta usa `--color-almond-silk` de fondo y sombra ligera (solo 1px).
- **Barra de búsqueda**: barra superior con campo de texto y botón de lupa. El input tiene borde `--color-silver`, focus con `--color-wine-plum`.
- **Sección “Más vendidos”**: lista horizontal de productos con miniatura, nombre y precio. Espaciado entre items 16px.

### `ref4-home.png` – Portada con newsletter y CTA
- **Formulario de newsletter**: sección destacada con título en Cormorant Garamond, descripción breve en DM Sans. El input tiene ancho completo en móvil, y el botón ocupa el 100% en móvil y 40% en desktop.
- **CTA “Ver catálogo”**: botón grande `--color-wine-plum`, altura 48px, con texto “Ver catálogo”. Al hover el fondo se intensifica un 10%.
- **Footer**: idéntico al de ref1‑home, con enlaces rápidos, y pequeña sección “Síguenos” con íconos de redes sociales.

### `ref1-catalogo.png` – Catálogo de productos
- **Barra de búsqueda y filtros**: barra superior con input de búsqueda y tres selector de filtros (categoría, tipo de piel, precio). Los selects y rangos usan `--color-almond-silk` de fondo y `--color-silver` de borde.
- **Grid de productos**: similar al de la portada (3 columnas desktop, 2 tablet, 1 móvil). Cada tarjeta incluye imagen, nombre, precio y un badge de “Stock bajo” cuando aplica (fondo `--color-smoky-rose`, texto en blanco).
- **Ordenamiento**: selector “Ornar por: Precio ascendente/descendente, Más vendidos”. El selector tiene el mismo estilo que los filtros.
- **Paginación**: al final de la lista, botones de paginación con la misma estilística que en home. Si hay muchas páginas, se muestra un indicador de “Página X de Y”.

### `ref2-catalogo.png` – Catálogo con filtros avanzados
- **Filtros expandidos**: además de los filtros básicos, incluye un selector de “Rango de precio” con slide (no mostrado en detalle, pero se aprecia un control de tipo “range input” estilizado con `--color-wine-plum`).
- **Vista tabla alternativa**: en modo “Tabla”, la lista de productos se muestra en formato tabla con columnas *Imagen, Nombre, SKU, Precio, Stock*. Las filas tienen alternancia de fondo `--color-sand-dune` y `--color-almond-silk`. Los encabezados de tabla usan `--color-wine-plum` y son fijos en la parte superior.
- **Ordenamiento por columnas**: cabezales de tabla son interactivos; al hacer click el indicador de flecha ordenación aparece a la derecha.
- **Paginación**: similar a ref1‑catalogo, pero con un indicador de “Mostrando X‑Y de Z resultados” encima de la paginación.

## Notas de estilo (basado en CLAUDE.md)

- **Paleta de colores**: `--color-silver: #cebebe; --color-sand-dune: #ece2d0; --color-almond-silk: #d5b9b2; --color-smoky-rose: #a26769; --color-wine-plum: #6d2e46; --color-carbur: #2b2124; blanco #faf8f5.`
- **Tipografía**: Títulos y encabezados **Cormorant Garamond** (o Playfair Display); cuerpo, formularios, tablas y botones **DM Sans** (o Inter). Una única pareja tipográfica en toda la app.
- **Componentes UI**: botones altura 36‑40px, borde redondeado 8px, diseño plano sin sombras pesadas. Los enlaces y estados *hover* usan `--color-wine-plum` o `--color-smoky-rose` según contexto.
- **Espaciado**: uso consistente de 16px y 24px para márgenes y rellenos; 32px para separación de secciones mayores.
- **Filtros y paginación**: siempre visibles, con estado activo resaltado mediante `--color-wine-plum` y texto en blanco. Los elementos deshabilitados tienen opacidad 0.5 y color `--color-smoky-rose`.

Estas descripciones sirven como guía visual para la implementación del frontend y no contienen copia de imágenes, textos o marcas de terceros.