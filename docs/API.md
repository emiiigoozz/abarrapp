# API REST de AbarrApp — Documentación de endpoints

**Versión:** 2.0.0 · **Implementación:** PHP 8 + PDO + MySQL (carpeta [`api-login/`](../api-login/))

Todos los ejemplos de respuesta de este documento son respuestas reales de la API con la base de datos de demostración.

## Índice

- [Convenciones](#convenciones)
- [Resumen de endpoints](#resumen-de-endpoints)
- [Autenticación](#autenticación): `login.php`, `register.php`
- [Tiendas y miembros](#tiendas-y-miembros): `tiendas.php`, `miembros.php`
- [Productos](#productos): `productos.php`, `foto.php`
- [Movimientos y ventas](#movimientos-y-ventas): `movimientos.php`, `venta.php`
- [Dashboard](#dashboard): `dashboard.php`
- [Usuarios del sistema](#usuarios-del-sistema): `usuarios.php`
- [Cómo la consume la app](#cómo-la-consume-la-app)

---

## Convenciones

### URL base

| Entorno | URL base |
|---|---|
| Navegador (desarrollo) | `http://localhost:8080/api-login` |
| Emulador Android | `http://10.0.2.2:8080/api-login` |
| Teléfono físico | `http://<IP-de-la-PC>:8080/api-login` |

### Formato

- Peticiones y respuestas en **JSON** (`Content-Type: application/json`).
- Los parámetros de consulta van en la URL (`?tienda_id=3`); los datos para crear o modificar van en el cuerpo JSON.
- **Envoltura común** de todas las respuestas:

```json
{ "success": true,  "data": [ ... ] }            // consulta correcta
{ "success": true,  "message": "Producto creado", "id": 21 }   // creación correcta
{ "success": false, "message": "Falta indicar la tienda" }      // error
```

- MySQL (PDO) devuelve los números como **texto** (`"12.00"`, `"21"`). La app los convierte a número en `ApiService`.
- Las fechas tienen el formato `AAAA-MM-DD hh:mm:ss`.

### Inventario por tienda

Productos, movimientos, ventas, fotos y dashboard pertenecen a una tienda. Todos esos endpoints **requieren `tienda_id`** y rechazan operar sobre productos de otra tienda.

### Códigos de estado

| Código | Significado | Ejemplo |
|---|---|---|
| 200 | Consulta o modificación correcta | `GET productos.php?tienda_id=3` |
| 201 | Registro creado | `POST venta.php` |
| 400 | Faltan datos o son inválidos | `GET productos.php` sin `tienda_id` |
| 401 | Credenciales incorrectas | Login con contraseña equivocada |
| 403 | Sin permiso | Ver los miembros sin ser admin |
| 404 | No existe (o es de otra tienda) | Borrar un producto de otra tienda |
| 405 | Método no permitido | `GET venta.php` |
| 409 | Conflicto con el estado actual | Vender sin stock suficiente; email repetido |
| 413 | Archivo demasiado grande | Foto de más de 3 MB |
| 415 | Tipo de archivo no permitido | Subir algo que no es JPG/PNG/WEBP |
| 500 | Error del servidor o de la base de datos | MySQL apagado |

### CORS

Todos los endpoints responden `Access-Control-Allow-Origin: *` y atienden la petición previa `OPTIONS` con 200.

---

## Resumen de endpoints

| # | Método | Endpoint | Descripción | Método en `ApiService` |
|---|---|---|---|---|
| 1 | POST | `/login.php` | Iniciar sesión | `login()` |
| 2 | POST | `/register.php` | Crear cuenta | `registrar()` |
| 3 | GET | `/tiendas.php?usuario_id=` | Tiendas del usuario | `listarTiendas()` |
| 4 | POST | `/tiendas.php` (`accion: "crear"`) | Crear tienda | `crearTienda()` |
| 5 | POST | `/tiendas.php` (`accion: "unirse"`) | Pedir unirse con código | `unirseATienda()` |
| 6 | GET | `/miembros.php?tienda_id=&usuario_id=` | Miembros de la tienda (admin) | `listarMiembros()` |
| 7 | PUT | `/miembros.php?id=` | Aceptar miembro o cambiar su rol (admin) | `actualizarMiembro()` |
| 8 | DELETE | `/miembros.php?id=&usuario_id=` | Quitar miembro (admin) | `eliminarMiembro()` |
| 9 | GET | `/productos.php?tienda_id=` | Productos de la tienda | `listarProductos()` |
| 10 | POST | `/productos.php` | Crear producto | `crearProducto()` |
| 11 | PUT | `/productos.php?id=` | Editar producto | `actualizarProducto()` |
| 12 | DELETE | `/productos.php?id=&tienda_id=` | Borrar producto (y su foto) | `eliminarProducto()` |
| 13 | POST | `/foto.php` | Subir o reemplazar la foto de un producto | `subirFoto()` |
| 14 | DELETE | `/foto.php?producto_id=&tienda_id=` | Quitar la foto | `quitarFoto()` |
| 15 | GET | `/movimientos.php?tienda_id=&limit=` | Historial de entradas y ventas | `listarMovimientos()` |
| 16 | POST | `/movimientos.php` | Registrar entrada de mercancía | `registrarEntrada()` |
| 17 | POST | `/venta.php` | Registrar una venta (carrito) | `registrarVenta()` |
| 18 | GET | `/dashboard.php?tienda_id=` | Resumen, ganancias y alertas | `obtenerDashboard()` |
| 19 | GET | `/usuarios.php[?id=]` | Usuarios del sistema | `listarUsuarios()` |
| 20 | POST | `/usuarios.php` | Crear usuario | `crearUsuario()` |
| 21 | PUT | `/usuarios.php?id=` | Editar usuario | `actualizarUsuario()` |
| 22 | DELETE | `/usuarios.php?id=` | Borrar usuario | `eliminarUsuario()` |

**Total:** 10 archivos PHP y 22 operaciones.

---

## Autenticación

### `POST /login.php`

| Campo | Tipo | Obligatorio |
|---|---|---|
| `email` | string | sí |
| `password` | string | sí |

```http
POST /login.php
{ "email": "demo@abarrapp.com", "password": "demo1234" }
```

**200**
```json
{ "success": true, "message": "Login exitoso", "token": "9f652ccde389…",
  "user": { "id": 7, "nombre": "Demo AbarrApp", "email": "demo@abarrapp.com" } }
```

**Errores:** 400 si falta un campo · 401 `"Email o contraseña incorrectos"`.

### `POST /register.php`

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `nombre` | string | sí | |
| `email` | string | sí | formato de email, único |
| `password` | string | sí | mínimo 6 caracteres |

**201:** misma forma que el login (`token` + `user`). La contraseña se guarda con hash bcrypt.

**Errores:** 400 (faltan datos, email inválido, contraseña corta) · 409 `"Ese email ya está registrado"`.

---

## Tiendas y miembros

### `GET /tiendas.php?usuario_id=7`

Devuelve las tiendas a las que pertenece el usuario, con su rol y estado en cada una.

**200**
```json
{ "success": true, "data": [
  { "id": "3", "nombre": "Abarrotes Demo", "codigo_invitacion": "4AMAEU", "dueno_id": "7",
    "rol": "admin", "estado": "aceptado" } ] }
```

### `POST /tiendas.php` — crear tienda

```json
{ "accion": "crear", "usuario_id": 7, "nombre": "Abarrotes Don Jorge" }
```

**201** `{ "success": true, "message": "Tienda creada", "tienda_id": 4, "codigo_invitacion": "K3J9QX" }`. El creador queda como `admin` aceptado.

### `POST /tiendas.php` — unirse con código

```json
{ "accion": "unirse", "usuario_id": 7, "codigo_invitacion": "4AMAEU" }
```

**201** `"Solicitud enviada a \"…\". Un administrador debe aprobarte."`. Queda como `lector` en estado `pendiente`.

**Errores:** 404 `"No existe ninguna tienda con ese código"` · 409 si ya es miembro o ya lo pidió.

### `GET /miembros.php?tienda_id=3&usuario_id=7`

Solo para admins de la tienda.

**200**
```json
{ "success": true, "data": [
  { "id": "4", "usuario_id": "7", "nombre": "Demo AbarrApp", "email": "demo@abarrapp.com",
    "rol": "admin", "estado": "aceptado", "creado_en": "2026-10-02 07:35:00" } ] }
```

**Errores:** 400 si falta un parámetro · 403 `"Solo un administrador puede ver los miembros"`.

### `PUT /miembros.php?id=4`

```json
{ "usuario_id": 7, "estado": "aceptado" }      // aceptar una solicitud
{ "usuario_id": 7, "rol": "trabajador" }        // cambiar rol: admin | trabajador | lector
```

**200** `"Miembro actualizado"` · **Errores:** 400 rol o estado inválido · 403 no es admin · 404 no existe.

### `DELETE /miembros.php?id=4&usuario_id=7`

**200** `"Miembro eliminado"` · **Errores:** 400 `"No se puede eliminar al dueño de la tienda"` · 403 · 404.

---

## Productos

### `GET /productos.php?tienda_id=3`

**200**
```json
{ "success": true, "data": [
  { "id": "12", "tienda_id": "3", "nombre": "Coca Cola 600ml", "codigo": "7501055300210",
    "categoria": "Bebidas", "foto": "uploads/productos/3_12_1792993675.jpg",
    "costo": "12.00", "precio_venta": "18.00", "stock": "21", "creado_en": "2026-10-02 16:48:26" } ] }
```

`foto` es una ruta relativa a la URL base (o `null`). La imagen se descarga en `<URL base>/<foto>`.

**Errores:** 400 `"Falta indicar la tienda"`.

### `POST /productos.php`

| Campo | Tipo | Obligatorio |
|---|---|---|
| `tienda_id` | int | sí |
| `nombre` | string | sí |
| `codigo` | string \| null | no (código de barras) |
| `categoria` | string \| null | no |
| `costo` | number | sí |
| `precio_venta` | number | sí |
| `stock` | int | sí |

```json
{ "tienda_id": 3, "nombre": "Atún Dolores 140g", "codigo": "7501045400013",
  "categoria": "Enlatados", "costo": 18, "precio_venta": 25, "stock": 10 }
```

**201** `{ "success": true, "message": "Producto creado", "id": 21 }` · **Errores:** 400 `"El nombre es obligatorio"`.

### `PUT /productos.php?id=21`

Mismo cuerpo que el POST. Se reemplazan todos los campos menos la foto.

**200** `"Producto actualizado"` · **Errores:** 400 · 404 `"El producto no existe en esta tienda"`.

### `DELETE /productos.php?id=21&tienda_id=3`

Borra el producto, sus movimientos (en cascada) y el archivo de su foto.

**200** `"Producto eliminado"` · **Errores:** 404 `"El producto no existe en esta tienda"`.

### `POST /foto.php`

Sube o reemplaza la foto de un producto. La imagen va en **base64** (con o sin el prefijo `data:image/...;base64,`).

```json
{ "tienda_id": 3, "producto_id": 12, "imagen": "/9j/4AAQSkZJRgABAQ…" }
```

**201** `{ "success": true, "message": "Foto guardada", "foto": "uploads/productos/3_12_1792993675.jpg" }`

Validaciones del servidor:
- revisa el **contenido real** del archivo (`getimagesizefromstring`), sin confiar en lo que diga el cliente;
- solo acepta JPG, PNG o WEBP de hasta 3 MB;
- al reemplazar una foto, borra el archivo anterior.

**Errores:** 400 faltan datos o base64 inválido · 404 producto de otra tienda · 413 `"La imagen pesa más de 3 MB"` · 415 `"Formato no permitido (usa JPG, PNG o WEBP)"`.

### `DELETE /foto.php?producto_id=12&tienda_id=3`

**200** `"Foto eliminada"` (también se borra el archivo) · **Errores:** 400 · 404.

---

## Movimientos y ventas

### `GET /movimientos.php?tienda_id=3&limit=30`

`limit` es opcional (30 por defecto, máximo 200). Ordena del más reciente al más antiguo.

**200**
```json
{ "success": true, "data": [
  { "id": "18", "producto_id": "13", "producto_nombre": "Sabritas Original 45g", "tipo": "salida",
    "cantidad": "1", "costo_unitario": "9.50", "precio_unitario": "15.00", "fecha": "2026-10-20 22:56:28" } ] }
```

`costo_unitario` y `precio_unitario` guardan los valores **del momento** del movimiento: si después cambia el precio del producto, las ganancias pasadas no cambian.

### `POST /movimientos.php` — entrada de mercancía

```json
{ "tienda_id": 3, "producto_id": 12, "tipo": "entrada", "cantidad": 5 }
```

**201** `{ "success": true, "message": "Movimiento registrado", "stock_actual": 26 }`

**Errores:** 400 datos inválidos · 404 producto de otra tienda · 409 `"Stock insuficiente…"` (si `tipo` es `salida`).

### `POST /venta.php`

Registra todas las líneas del carrito en **una sola transacción** (`SELECT … FOR UPDATE`): si alguna línea no tiene stock, no se guarda ninguna.

```json
{ "tienda_id": 3, "items": [ { "producto_id": 12, "cantidad": 3 }, { "producto_id": 13, "cantidad": 2 } ] }
```

**201**
```json
{ "success": true, "message": "Venta registrada", "total": 84, "ganancia": 29,
  "items": [ { "producto_id": 12, "nombre": "Coca Cola 600ml", "cantidad": 3, "subtotal": 54, "stock_restante": 21 }, … ] }
```

**Errores:** 400 `"El carrito está vacío"` · 405 si no es POST · 409 `"Stock insuficiente de \"Sabritas Original 45g\" (disponible: 1)"` o producto de otra tienda.

---

## Dashboard

### `GET /dashboard.php?tienda_id=3`

**200**
```json
{ "success": true, "data": {
  "resumen": { "ingresos": "84.00", "costos": "55.00", "ganancia": "29.00", "unidades": "5" },
  "ganancias_por_dia": [ { "dia": "2026-10-02", "ganancia": "29.00" } ],
  "top_productos": [ { "id": "12", "nombre": "Coca Cola 600ml", "unidades_vendidas": "3", "ganancia": "18.00" } ],
  "stock_bajo": [ { "id": "13", "nombre": "Sabritas Original 45g", "stock": "1" } ],
  "productos_con_perdida": [] } }
```

| Campo | Contenido |
|---|---|
| `resumen` | Totales de todas las ventas de la tienda |
| `ganancias_por_dia` | Ganancia de cada día de los últimos 14 días con ventas |
| `top_productos` | Los 5 más vendidos |
| `stock_bajo` | Productos con 5 unidades o menos |
| `productos_con_perdida` | Productos cuyo precio de venta es menor o igual a su costo |

---

## Usuarios del sistema

### `GET /usuarios.php` · `GET /usuarios.php?id=7`

**200**
```json
{ "success": true, "data": [
  { "id": "7", "nombre": "Demo AbarrApp", "usuario": null, "email": "demo@abarrapp.com",
    "rol": "usuario", "estado": "1", "creado_en": "2026-10-02 07:35:00" } ] }
```

Con `?id=` devuelve un solo objeto, o 404.

### `POST /usuarios.php`

```json
{ "nombre": "Ana", "usuario": "ana", "email": "ana@ejemplo.com", "password": "secreta1", "rol": "usuario", "estado": 1 }
```

**201** `"Usuario creado correctamente"` con `id` · **Errores:** 400 (faltan datos, email inválido, contraseña < 6) · 409 email o usuario repetido.

### `PUT /usuarios.php?id=7`

Mismo cuerpo. Si `password` va vacío, se conserva la contraseña anterior.

**200** `"Usuario actualizado correctamente"` · **Errores:** 400 · 404 · 409.

### `DELETE /usuarios.php?id=7`

**200** `"Usuario eliminado correctamente"` · **Errores:** 400 · 404.

---

## Cómo la consume la app

- **`ApiService`** ([`api.service.ts`](../mi-app-ionic/src/app/shared/api.service.ts)) tiene un método por operación (columna de la derecha del resumen), con la URL base y un tiempo límite de 10 s. Convierte los números al modelo tipado de [`src/app/models/`](../mi-app-ionic/src/app/models/).
- **`SyncService`** envía por la API las ventas, entradas y cambios de productos hechos sin conexión, cuando vuelve la red.
- **`mensajeError()`** traduce los códigos de estado a mensajes para el usuario.

## Limitaciones

- La API todavía **no valida el token** en cada petición. Los permisos por rol de tiendas y productos se aplican en la app; solo `miembros.php` revisa en el servidor que quien llama sea admin.
- Las rutas son archivos PHP (`productos.php?id=`), no rutas REST anidadas (`/tiendas/3/productos/12`).
