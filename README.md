# AbarrApp v1.0 — Inventario y punto de venta para tiendas de abarrotes

AbarrApp es una aplicación móvil hecha con **Ionic + Angular + Capacitor** que permite a los dueños de tiendas de abarrotes controlar su inventario, vender con un carrito tipo punto de venta y ver cuánto están ganando en realidad.

**Problema que resuelve:** muchos comerciantes pequeños venden sin saber cuánto ganan, si algún producto se vende con pérdida o cuándo se les va a acabar algo. AbarrApp junta esa información en un dashboard simple y además funciona cuando se va el internet.

| | |
|---|---|
| Versión | 1.0.0 |
| Plataforma probada | Android 17 (emulador Pixel 9) y navegador |
| Video demostrativo | _(pega aquí el enlace al video)_ |
| Bitácora de IA | [BITACORA_IA.md](BITACORA_IA.md) |

---

## Funcionalidades

- **Cuentas de usuario:** registro e inicio de sesión. La sesión se queda guardada en el teléfono.
- **Varias tiendas por usuario:** cada usuario puede crear tiendas o unirse a una con un código de invitación. **Cada tienda tiene su propio inventario.**
- **Roles por tienda:**
  - `admin`: acceso a todo.
  - `trabajador`: punto de venta y dashboard.
  - `lector`: solo dashboard.
- **CRUD de productos:** nombre, código de barras, categoría, costo, precio de venta y stock. Muestra el margen de ganancia de cada producto.
- **Punto de venta:** carrito con varios productos, búsqueda, control de stock y venta en una sola transacción. El carrito se conserva si se cierra la app.
- **Recepción de mercancía:** entradas de stock y alta rápida de productos nuevos.
- **Escáner de códigos de barras:** con la cámara (ZXing) o con un lector USB/Bluetooth tipo teclado.
- **Fotos de productos:** se toman con la cámara o se eligen de la galería (Capacitor Camera), se guardan en el servidor y se ven como miniatura en Productos y en el punto de venta. Un visor permite ampliarlas (tocar para acercar), cambiarlas o quitarlas. En pantallas anchas la lista de productos se acomoda en 2 o 3 columnas.
- **Dashboard:**
  - ingresos, costos, ganancia y unidades vendidas;
  - curva de ganancias de los últimos 14 días (Chart.js);
  - alertas de stock bajo y de productos que se venden con pérdida;
  - los productos más vendidos.
- **Gestión de miembros:** el admin acepta solicitudes y cambia roles.
- **Gestión de usuarios del sistema:** CRUD de usuarios.
- **Funciona sin conexión y sincroniza:** sin red se puede seguir vendiendo, recibiendo mercancía y editando productos; los cambios se guardan en el teléfono y se envían solos al volver la conexión. Una barra inferior indica siempre el estado (en línea, sin conexión, sincronizando, pendientes o con errores).

## Cómo cumple cada requisito de la v1.0

| Requisito | Dónde está |
|---|---|
| Proyecto Ionic funcional | `mi-app-ionic/` (Ionic 9, Angular 22, Capacitor 8) |
| Navegación | [Rutas y navegación](#navegación) — 9 páginas con *lazy loading* |
| Modelo de datos | [Modelo de datos](#modelo-de-datos) — tablas MySQL + interfaces TypeScript en `src/app/models/` |
| CRUD | Productos (`/productos`), usuarios (`/usuarios`), tiendas y miembros |
| Persistencia | [Persistencia y modo offline](#persistencia-y-modo-offline) — Capacitor Preferences |
| Manejo de errores | [Manejo de errores](#manejo-de-errores) — `mensajeError()` en `shared/network.service.ts` |
| Operación offline básica | Detección de red + caché local + cola de sincronización + barra de estado |
| Repositorio Git | Este repositorio |
| APK | [Compilar el APK](#4-compilar-y-ejecutar-en-android) |
| README | Este archivo |
| Bitácora de IA | [BITACORA_IA.md](BITACORA_IA.md) |

## Tecnologías

| Capa | Tecnología |
|---|---|
| App | Ionic 9, Angular 22 (zoneless), TypeScript |
| Nativo | Capacitor 8 (Android). Plugins: Preferences, Network, App, Keyboard, StatusBar, Haptics |
| HTTP | Axios (tiempo límite de 10 s por petición) |
| Gráficas | Chart.js 4 |
| Códigos de barras | @zxing/browser |
| API | PHP 8 con PDO (consultas preparadas) |
| Base de datos | MySQL / MariaDB (XAMPP) |

## Arquitectura

```
┌──────────────────────── App Ionic (Android / navegador) ────────────────────────┐
│  Páginas (login, tiendas, home, productos, movimientos, dashboard, ...)        │
│        │                                                                        │
│  StorageService ── Capacitor Preferences (sesión, caché, carrito)              │
│  NetworkService ── Capacitor Network (¿hay conexión?) + mensajeError()         │
│  ApiService ────── único acceso a la API: 1 método por endpoint (axios)        │
│        │  HTTP + JSON                                                           │
└────────┼────────────────────────────────────────────────────────────────────────┘
         ▼
   API REST en PHP (api-login/*.php) ──► MySQL (base login_app)
```

## Navegación

| Ruta | Pantalla | Quién la ve |
|---|---|---|
| `/login` | Inicio de sesión. Si ya hay sesión guardada, entra directo. | Todos |
| `/register` | Crear cuenta | Todos |
| `/tiendas` | Mis tiendas: crear una, unirse con código o entrar | Usuario con sesión |
| `/home` | Menú de la tienda activa (muestra botones según el rol) | Miembro aceptado |
| `/dashboard` | Ganancias, curva de 14 días, alertas y productos más vendidos | Todos los roles |
| `/movimientos` | Punto de venta (vender) y recepción de mercancía | admin, trabajador |
| `/productos` | CRUD de productos de la tienda | admin |
| `/miembros` | Aceptar solicitudes y cambiar roles | admin |
| `/usuarios` | CRUD de usuarios del sistema | admin |

Las páginas de inventario revisan al abrir que haya sesión y tienda activa; si falta alguna, mandan a `/login` o a `/tiendas`.

## Modelo de datos

### Base de datos (MySQL)

```
usuarios 1──* tiendas (dueño)
usuarios *──* tiendas      vía tienda_miembros (rol, estado)
tiendas  1──* productos    (cada tienda tiene su inventario)
productos 1──* movimientos (entradas y salidas)
```

| Tabla | Campos principales |
|---|---|
| `usuarios` | id, nombre, usuario, email, password (bcrypt), rol, estado, creado_en |
| `tiendas` | id, nombre, codigo_invitacion, dueno_id → usuarios, creado_en |
| `tienda_miembros` | id, tienda_id → tiendas, usuario_id → usuarios, rol (`admin`/`trabajador`/`lector`), estado (`pendiente`/`aceptado`) |
| `productos` | id, **tienda_id → tiendas**, nombre, codigo, categoria, costo, precio_venta, stock, creado_en |
| `movimientos` | id, producto_id → productos, tipo (`entrada`/`salida`), cantidad, costo_unitario, precio_unitario, fecha |

`movimientos` guarda el costo y el precio **del momento** de la venta. Así las ganancias pasadas no cambian si después se edita el precio de un producto.

El esquema completo está en [`api-login/database.sql`](api-login/database.sql).

### En la app (TypeScript)

Las interfaces están en [`mi-app-ionic/src/app/models/`](mi-app-ionic/src/app/models/):

| Archivo | Contenido |
|---|---|
| `producto.model.ts` | `Producto`, `ProductoVenta` |
| `movimiento.model.ts` | `Movimiento`, `TipoMovimiento`, `ItemCarrito` |
| `tienda.model.ts` | `Tienda`, `Miembro`, `RolTienda`, `EstadoMiembro` |
| `usuario.model.ts` | `Usuario` |
| `dashboard.model.ts` | `Resumen`, `GananciaDia`, `TopProducto`, `AlertaStock`, `AlertaPerdida`, `Dashboard` |
| `api.model.ts` | Forma del JSON de peticiones y respuestas: `RespuestaApi<T>`, `RespuestaSesion`, `ProductoForm`, `ItemVenta`, `RespuestaVenta`, `UsuarioForm`, `CambiosMiembro` |

## Persistencia y modo offline

Se usa **Capacitor Preferences** (SharedPreferences en Android). El sistema operativo no lo borra como al `localStorage`, así que los datos sobreviven al cerrar la app.

| Qué se guarda | Para qué |
|---|---|
| Sesión (`token`, `user`) y tienda activa | Abrir la app sin volver a iniciar sesión |
| Caché de productos, movimientos, dashboard y tiendas | Mostrar datos cuando no hay conexión |
| Carrito de venta en curso | No perder una venta a medias |

Estrategia **red primero, caché como respaldo** (`StorageService.obtenerConCache()`):

1. Si hay red, se pide la información a la API y se guarda una copia.
2. Si no hay red o la API falla, se muestra la última copia con el aviso *"mostrando los últimos datos guardados"*.
3. Sin red, la app no intenta la petición, para no esperar los 10 s de tiempo límite.

### Sincronización (`SyncService`)

Las operaciones que modifican datos (venta, entrada de mercancía, crear/editar/borrar producto) pasan por `SyncService.enviarOEncolar()`:

1. Si hay conexión y no hay cambios esperando, se envían a la API como siempre.
2. Si no hay conexión (o el servidor no responde), se guardan en una **cola persistente** (`sync_cola` en Preferences) y se aplican de inmediato en pantalla con el distintivo **«Pendiente»**. Los productos creados sin conexión reciben un id temporal negativo.
3. Cuando `NetworkService` (Capacitor Network) avisa que volvió la red —o cada 15 s si hay red pero el servidor no respondía—, la cola se envía **en el mismo orden** en que se hizo. Al crear un producto, su id temporal se reemplaza por el real en los cambios siguientes.
4. Si el servidor rechaza un cambio (por ejemplo, otro dispositivo ya vendió ese stock: HTTP 409), pasa a **«fallidas»** para no bloquear a los demás, y el usuario ve el motivo.
5. Al terminar, las pantallas recargan los datos reales del servidor y aparece el aviso *«N cambios sincronizados»*.

**Barra de estado** (siempre visible en la parte inferior; al tocarla muestra la lista de cambios):

| Estado | Color | Texto |
|---|---|---|
| En línea | verde | En línea · todo sincronizado |
| Sin conexión | naranja | Sin conexión · N cambios por enviar |
| Enviando la cola | azul | Sincronizando N cambios… |
| Hay red pero el servidor no responde | ámbar | N cambios pendientes · reintentando |
| El servidor rechazó algún cambio | rojo | N cambios no se pudieron enviar · toca para ver |

## Manejo de errores

`mensajeError()` clasifica cada error de la API y muestra un mensaje entendible:

| Caso | Mensaje |
|---|---|
| El dispositivo no tiene red | Sin conexión a internet. Revisá tu Wi-Fi o datos e intentá de nuevo. |
| Hay red pero el servidor no responde | No se pudo conectar con el servidor. Verificá que esté encendido. |
| Pasaron más de 10 s | El servidor tardó demasiado en responder. Intentá de nuevo. |
| Error 500 | Ocurrió un error en el servidor. Intentá más tarde. |
| Error de validación (400/404/409) | El mensaje que manda la API (p. ej. "Stock insuficiente…") |

La API responde con códigos HTTP correctos (201, 400, 404, 405, 409, 500) y usa transacciones con `SELECT … FOR UPDATE` en ventas y movimientos, para no vender stock que ya no existe.

---

## Instalación y ejecución

### Requisitos

- Node.js 20 o más reciente
- XAMPP (Apache + MySQL). En este proyecto Apache corre en el puerto **8080**.
- Android Studio con un emulador, para la versión Android

### 1. Base de datos

1. Prende Apache y MySQL en el panel de XAMPP.
2. Abre `http://localhost:8080/phpmyadmin`.
3. **Instalación nueva:** importa `api-login/database.sql`. Crea la base `login_app`, todas las tablas y datos de prueba.
4. **Si ya tenías una versión anterior:** ejecuta `api-login/migracion_v1_tiendas.sql` (agrega `tienda_id` a los productos y los asigna a la tienda más antigua) y luego `api-login/migracion_fotos.sql` (agrega la columna `foto`).
5. Las fotos se guardan en `api-login/uploads/productos/`; Apache debe poder escribir en esa carpeta (en XAMPP ya puede).

> Los archivos `db.sql`, `db_inventario.sql`, `db_tiendas.sql` y `alter_usuarios.sql` son de versiones anteriores y se conservan como historial.

### 2. API

Copia la carpeta `api-login/` a `C:\xampp\htdocs\api-login\`. Si tu MySQL tiene contraseña, ajústala en `api-login/config.php`.

Para comprobar que funciona, abre `http://localhost:8080/api-login/productos.php?tienda_id=1`; debe responder un JSON.

### 3. App en el navegador

```bash
cd mi-app-ionic
npm install
npx ng serve
```

Abre `http://localhost:4200`. En desarrollo, la URL de la API está en `src/environments/environment.ts` (`http://localhost:8080/api-login`).

### 4. Compilar y ejecutar en Android

La compilación de producción usa `src/environments/environment.prod.ts`, que apunta a `http://10.0.2.2:8080/api-login`. `10.0.2.2` es la dirección con la que el **emulador** llega a tu computadora. Para un teléfono físico, cambia esa IP por la de tu computadora en la red Wi-Fi (por ejemplo `192.168.1.50`).

```bash
cd mi-app-ionic
npx ng build                 # compila la app web
npx cap sync android         # copia la app al proyecto Android
npx cap open android         # abre Android Studio → elige el emulador → Run ▶
```

Para generar el APK sin abrir Android Studio:

```bash
cd mi-app-ionic/android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Credenciales de prueba

| Email | Contraseña | Tienda |
|---|---|---|
| demo@abarrapp.com | demo1234 | Abarrotes Demo (admin) |

Estas credenciales las crea `database.sql`.

---

## Estructura del proyecto

```
App II/
├── README.md
├── BITACORA_IA.md                 ← bitácora de desarrollo asistido por IA
├── api-login/                     ← API REST en PHP (se copia a htdocs)
│   ├── config.php                 ← conexión PDO + requerirTiendaId()
│   ├── login.php, register.php
│   ├── tiendas.php, miembros.php, usuarios.php
│   ├── productos.php              ← CRUD de productos por tienda
│   ├── movimientos.php, venta.php ← entradas y ventas (con transacción)
│   ├── dashboard.php
│   ├── database.sql               ← esquema completo v1.0
│   └── migracion_v1_tiendas.sql
└── mi-app-ionic/
    ├── android/                   ← proyecto nativo Android (Capacitor)
    ├── capacitor.config.ts
    └── src/app/
        ├── models/                ← interfaces del modelo de datos
        ├── shared/
        │   ├── api.service.ts     ← único acceso a la API REST (1 método por endpoint)
        │   ├── storage.service.ts ← persistencia + caché offline
        │   ├── sync.service.ts    ← cola de cambios offline y sincronización
        │   ├── foto.service.ts    ← cámara y galería (Capacitor Camera)
        │   ├── network.service.ts ← detección de red + mensajeError()
        │   ├── hid-scanner.service.ts
        │   └── barcode-scanner/   ← escáner con cámara
        ├── login/  register/  tiendas/  home/
        ├── productos/  movimientos/  dashboard/
        └── miembros/  usuarios/
```

## Limitaciones conocidas

- La API todavía **no valida el token** en cada petición. El control de acceso por rol se hace en la app. Para producción haría falta validar el token y el rol en el servidor.
- La sincronización resuelve conflictos rechazando el cambio que ya no es válido (p. ej. sin stock) y avisando al usuario; no fusiona cambios automáticamente.
- Para iOS se necesita una Mac con Xcode. Solo se probó en Android.

## Autor

Jorge Emilio González Salinas — Universidad Politécnica de Durango, Aplicaciones para Dispositivos Móviles II
