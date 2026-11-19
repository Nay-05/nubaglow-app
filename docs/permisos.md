# Matriz de permisos por endpoint (RBAC)

Documento generado a partir de los middlewares `verificarToken` / `requerirRol` de
`backend/src/routes/` y de las restricciones adicionales aplicadas en
`backend/src/services/`. El rol siempre se obtiene del JWT firmado, nunca de datos
enviados por el cliente.

## Leyenda

- **Público**: no requiere token.
- **Autenticado**: requiere `verificarToken`, sin restricción adicional de rol.
- Los roles permitidos en la columna **Roles (middleware)** son los declarados en la
  ruta. La columna **Restricción adicional** indica reglas del servicio que acotan
  todavía más lo que puede hacer cada rol.

## Rutas de pedidos y cobro

| Endpoint | Método | Roles (middleware) | Restricción adicional |
|---|---|---|---|
| `/api/pedidos/cotizar` | POST | `cliente` | Calcula subtotal, envío y total desde la BD; ignora cualquier precio enviado por el cliente. |
| `/api/pedidos` | POST | `cliente` | Crea el pedido en una transacción, descuenta stock y registra el pago en estado `Pendiente` (`qr_simple`, `deposito_bancario` o `contra_entrega`). |
| `/api/pedidos` | GET | Autenticado | Lista únicamente los pedidos del usuario autenticado. |
| `/api/pedidos/:id` | GET | Autenticado | El cliente solo puede ver pedidos propios; el personal interno puede consultar el detalle. |

## Rutas de envíos

| Endpoint | Método | Roles (middleware) | Restricción adicional |
|---|---|---|---|
| `/api/envios/rastreo/:codigo` | GET | Público | Devuelve datos personales enmascarados. |
| `/api/envios/:id/estado` | PATCH | `almacen`, `logistica`, `admin` | `almacen`: solo `En preparación` / `Empacado`. `logistica`: solo `En tránsito` / `Entregado`. `admin`: todos los estados. Flujo estricto sin saltos ni retrocesos. |
| `/api/staff/almacen/envios/:id/estado` | PATCH | `almacen`, `admin` | Mismo servicio de envíos: `almacen` solo avanza a `En preparación` / `Empacado`; `admin` puede operar cualquier etapa. |
| `/api/staff/logistica/envios/:id/estado` | PATCH | `logistica`, `admin` | Mismo servicio de envíos: `logistica` solo avanza a `En tránsito` / `Entregado`; `admin` puede operar cualquier etapa. |
| `/api/staff/logistica/envios/:id/entrega` | POST | `logistica`, `admin` | Cierra la entrega en `Entregado` con receptor, fecha, hora y nota. |

Reglas de negocio del servicio de envíos:

- No se prepara un pedido si el pago no está `Aprobado`, salvo método
  `contra_entrega`.
- La entrega exige comprobante (receptor, fecha, hora y nota).
- Al entregar un pedido `contra_entrega`, el pago se liquida como `Aprobado` en la
  misma transacción.

## Rutas de inventario y preparación

| Endpoint | Método | Roles (middleware) | Restricción adicional |
|---|---|---|---|
| `/api/inventario` | GET | `almacen`, `admin` | Listado de stock por variante. |
| `/api/inventario/ajustes/:varianteId` | POST | `almacen`, `admin` | Registra movimiento de Kardex y auditoría. |
| `/api/inventario/kardex/:varianteId` | GET | `almacen`, `admin` | Historial de movimientos de la variante. |
| `/api/inventario/despachos` | GET | `almacen`, `admin` | Cola de preparación. Solo pedidos con pago `Aprobado` o `contra_entrega`. |
| `/api/staff/almacen/inventario` | GET | `almacen`, `admin` | Mismo listado de inventario. |
| `/api/staff/almacen/inventario/ajustes/:varianteId` | POST | `almacen`, `admin` | Mismo ajuste con Kardex y auditoría. |
| `/api/staff/almacen/inventario/kardex/:varianteId` | GET | `almacen`, `admin` | Mismo Kardex. |
| `/api/staff/almacen/despachos` | GET | `almacen`, `admin` | Cola de preparación del almacén. |

## Rutas de pagos

| Endpoint | Método | Roles (middleware) | Restricción adicional |
|---|---|---|---|
| `/api/staff/pagos` | GET | `vendedor`, `admin` | Cola de pagos `En verificación`. |
| `/api/staff/pagos/:id` | GET | `vendedor`, `admin` | Detalle del pago y comprobante. |
| `/api/staff/pagos/:id/aprobar` | PATCH | `vendedor`, `admin` | Solo pagos `En verificación`. Registra evento y auditoría. |
| `/api/staff/pagos/:id/rechazar` | PATCH | `vendedor`, `admin` | Solo pagos `Pendiente` / `En verificación`. Cancela el pedido y repone stock en la misma transacción. |
| `/api/staff/pagos/vencidos/cancelar` | POST | `vendedor`, `admin` con `requerirRol('admin')` | Solo `admin`. Cancela pagos vencidos (`PAGO_VENCIMIENTO_HORAS`, por defecto 24 h), excluye `contra_entrega`, repone stock y audita. |
| `/api/staff/pedidos/:id/cancelar` | POST | `admin` | Cancelación administrativa con reposición atómica e idempotente. |

Reglas del servicio de pagos/cancelaciones:

- El rechazo y el vencimiento cancelan el pedido y reponen el stock con un movimiento
  de Kardex `reposicion_cancelacion`.
- La cancelación es idempotente: un segundo intento no vuelve a reponer stock.
- No se puede cancelar un pedido `En tránsito` o `Entregado`.
- Toda aprobación, rechazo, cancelación y reposición queda en `auditoria` y en
  `pago_eventos`.

## Rutas POS

| Endpoint | Método | Roles (middleware) | Restricción adicional |
|---|---|---|---|
| `/api/pos` | POST | `vendedor`, `admin` | Registra venta presencial, descuenta stock y genera factura. |
| `/api/pos/historial` | GET | `vendedor`, `admin` | Historial de ventas del vendedor autenticado (admin puede consultar). |
| `/api/pos/cierre-caja` | GET | `vendedor`, `admin` | Cierre de caja del turno. |

## Rutas staff administrativas relacionadas

| Endpoint | Método | Roles (middleware) | Restricción adicional |
|---|---|---|---|
| `/api/usuarios` | GET | `admin` | Listado de personal interno. |
| `/api/usuarios` | POST | `admin` | Crea cuentas de `vendedor`, `almacen`, `logistica` o `admin`. |
| `/api/usuarios/:id` | PUT | `admin` | Actualiza datos o estado del personal. |
| `/api/usuarios/:id/password` | PATCH | `admin` | Restablece contraseña de personal. |
| `/api/reportes/web-vs-pos` | GET | `admin` | Métricas consolidadas web vs POS. |
| `/api/reportes/ingresos-diarios` | GET | `admin` | Ingresos por día. |
| `/api/reportes/ranking` | GET | `admin` | Ranking de productos vendidos. |

## Matriz rol × endpoint

| Endpoint | cliente | vendedor | almacen | logistica | admin |
|---|---:|---:|---:|---:|---:|
| `POST /api/pedidos/cotizar` | X | - | - | - | - |
| `POST /api/pedidos` | X | - | - | - | - |
| `GET /api/envios/rastreo/:codigo` | Público | Público | Público | Público | Público |
| `PATCH /api/envios/:id/estado` | - | - | X | X | X |
| `PATCH /api/staff/almacen/envios/:id/estado` | - | - | X | - | X |
| `PATCH /api/staff/logistica/envios/:id/estado` | - | - | - | X | X |
| `POST /api/staff/logistica/envios/:id/entrega` | - | - | - | X | X |
| `GET /api/inventario` | - | - | X | - | X |
| `POST /api/inventario/ajustes/:varianteId` | - | - | X | - | X |
| `GET /api/inventario/kardex/:varianteId` | - | - | X | - | X |
| `GET /api/inventario/despachos` | - | - | X | - | X |
| `GET /api/staff/almacen/inventario` | - | - | X | - | X |
| `POST /api/staff/almacen/inventario/ajustes/:varianteId` | - | - | X | - | X |
| `GET /api/staff/almacen/inventario/kardex/:varianteId` | - | - | X | - | X |
| `GET /api/staff/almacen/despachos` | - | - | X | - | X |
| `GET /api/staff/pagos` | - | X | - | - | X |
| `GET /api/staff/pagos/:id` | - | X | - | - | X |
| `PATCH /api/staff/pagos/:id/aprobar` | - | X | - | - | X |
| `PATCH /api/staff/pagos/:id/rechazar` | - | X | - | - | X |
| `POST /api/staff/pagos/vencidos/cancelar` | - | - | - | - | X |
| `POST /api/staff/pedidos/:id/cancelar` | - | - | - | - | X |
| `POST /api/pos` | - | X | - | - | X |
| `GET /api/pos/historial` | - | X | - | - | X |
| `GET /api/pos/cierre-caja` | - | X | - | - | X |
| `GET /api/usuarios` | - | - | - | - | X |
| `POST /api/usuarios` | - | - | - | - | X |
| `PUT /api/usuarios/:id` | - | - | - | - | X |
| `PATCH /api/usuarios/:id/password` | - | - | - | - | X |
| `GET /api/reportes/web-vs-pos` | - | - | - | - | X |
| `GET /api/reportes/ingresos-diarios` | - | - | - | - | X |
| `GET /api/reportes/ranking` | - | - | - | - | X |

## Verificación automatizada de bypass

La suite `backend/src/tests/bloque_e.test.ts` comprueba rutas antiguas y nuevas:

- `almacen` no puede llevar un envío a `Entregado` por
  `/api/envios/:id/estado` ni por `/api/staff/almacen/envios/:id/estado`
  (ambas devuelven `403`).
- `logistica` no puede ajustar inventario por
  `/api/inventario/ajustes/:varianteId` ni por
  `/api/staff/almacen/inventario/ajustes/:varianteId` (ambas devuelven `403`).
- Un pago no aprobado bloquea la preparación (`409`) y `contra_entrega` sí puede
  prepararse.
- El rechazo, el vencimiento y la cancelación reponen stock una sola vez.
