# Bitácora de desarrollo asistido por IA — AbarrApp

**Proyecto:** AbarrApp v1.0, inventario y punto de venta para tiendas de abarrotes
**Autor:** Jorge Emilio González Salinas
**Herramienta de IA:** Claude (Anthropic), usado como asistente de programación en el chat y en VS Code (Claude Code)

En este documento registro para qué usé la IA en cada etapa del proyecto: qué le pedí, qué generó, qué acepté, qué cambié o descarté y qué problemas resolvimos. La IA escribía y modificaba el código; yo revisaba los resultados, probaba la app y decidía qué se quedaba.

---

## Resumen de sesiones

| # | Fecha | Tema | Resultado |
|---|---|---|---|
| 1 | 2026-09-07 | Diseño del login | Pantalla de login y registro con estilo futurista |
| 2 | 2026-09-07 | API de autenticación | `login.php`, `register.php`, `config.php`, `db.sql` |
| 3 | 2026-09-09 | CRUD de usuarios | `usuarios.php` + pantalla `/usuarios` |
| 4 | 2026-09-11 | Módulo de inventario | Productos, movimientos y dashboard con Chart.js |
| 5 | 2026-09-17 | Tiendas, roles, punto de venta y escáner | Varias tiendas por usuario, carrito de venta, lector de códigos de barras |
| 6 | 2026-09-28 | Persistencia | Capacitor Preferences + caché de datos + carrito guardado |
| 7 | 2026-10-01 | Compilar para Android | Plataforma Android, conexión del emulador con la API, APK |
| 8 | 2026-10-02 | Manejo de conexión y errores | Detección de red, mensajes por tipo de error, prueba offline |
| 9 | 2026-10-02 | Versión 1.0 | Modelo de datos centralizado, inventario por tienda, README, APK v1.0.0 |
| 10 | 2026-10-12 | Arquitectura cliente → API → BD | `ApiService` centralizado, modelos JSON, análisis de la arquitectura |

---

## Sesión 1 — Diseño de interfaz de login

**Prompt enviado:**
> "Ayúdame a diseñar un login o una interfaz de inicio, por favor, con diseño minimalista y futurista"

**Resultado:** Claude generó el HTML, SCSS y TypeScript completos de la pantalla de login, con:
- estética oscura (fondo #05060c) y efecto glassmorphism en la tarjeta;
- manchas de luz difuminadas (glow cian y violeta);
- tipografía Orbitron/Space Grotesk desde Google Fonts;
- inputs con íconos y resaltado neón al enfocarlos;
- botón con gradiente cian→violeta.

También configuró el modo oscuro forzado en `global.scss` y actualizó `app-routing.module.ts` para que la app arranque directo en `/login`.

---

## Sesión 2 — API REST de autenticación en PHP

**Prompt enviado:**
> "Ocupo una API de login, esta será consumida por Ionic desde Axios. Genérame el archivo PHP y el SQL de la tabla que ocupe"

**Resultado:** Claude generó:
- `login.php`: verifica las credenciales con `password_verify()` y devuelve un token aleatorio;
- `register.php`: valida el email, la longitud mínima de la contraseña y los duplicados, y guarda la contraseña con hash bcrypt;
- `config.php`: conexión PDO a MySQL;
- `db.sql`: tabla `usuarios` con un usuario de prueba.

También configuró los headers CORS para permitir peticiones desde el servidor de desarrollo de Ionic.

---

## Sesión 3 — CRUD de usuarios con formulario

**Prompt enviado:**
> "Ahora quiero un formulario con CRUD, para después del login, que conecte a la base de datos con API, con nombre, usuario, correo, contraseña, rol, estado, y botón de registrar. Recuerda que es CRUD: create, read, update, delete."

**Resultado:** Claude generó:
- `usuarios.php`: endpoint REST con GET, POST, PUT y DELETE;
- la pantalla `/usuarios`: formulario y lista de tarjetas con botones de editar y eliminar, modo creación/edición y confirmación antes de eliminar;
- los estilos con la misma paleta del login.

---

## Sesión 4 — Módulo de inventario (productos, movimientos, dashboard)

**Prompt enviado:**
> "Quiero que mi app sea para inventariar rápido una tienda de abarrotes, saber todo lo que tenemos, y poder hacer una curva de ganancias. Mi problema es que estoy vendiendo lo de mi tienda pero no sé cuánto estoy sacando o si estoy perdiendo."

**Resultado:** Claude propuso la arquitectura del módulo y generó:
- las tablas SQL `productos` y `movimientos`;
- los endpoints `productos.php`, `movimientos.php` y `dashboard.php`;
- tres pantallas: CRUD de productos, registro de ventas y entradas, y dashboard con curva de ganancias (Chart.js), alertas de stock bajo y ranking de los más vendidos.

---

## Sesión 5 — Tiendas, roles, punto de venta y escáner

**Prompt:** no lo registré textualmente. La petición fue que varios usuarios pudieran trabajar en la misma tienda con distintos permisos, que vender fuera rápido, como en una caja, y retomar el escáner de códigos de barras.

**Resultado:**
- **Tiendas y roles:** tablas `tiendas` y `tienda_miembros`, endpoints `tiendas.php` y `miembros.php`, y pantallas `/tiendas` y `/miembros`. Cada tienda tiene un código de invitación; quien se une queda como `pendiente` hasta que un admin lo acepta. Los roles son `admin`, `trabajador` y `lector`.
- **Punto de venta:** carrito en `/movimientos` y `venta.php`, que registra todas las líneas en una sola transacción y valida el stock con `SELECT … FOR UPDATE`.
- **Escáner:** componente con la cámara (`@zxing/browser`) y `HidScannerService` para lectores USB/Bluetooth que "escriben" el código como teclado. Si se escanea un código que no existe, se abre el alta rápida del producto.

---

## Sesión 6 — Persistencia

**Prompt enviado:**
> "vamos a agregar algo a la app, no se si ya este integrado […] Agregar persistencia para evitar que la información desaparezca al cerrar la aplicación. Puede utilizarse, según el proyecto: Ionic Storage, Preferences, SQLite, almacenamiento de archivos…"

**Qué hizo la IA:**
- Revisó el proyecto y encontró que solo la sesión se guardaba, y en `localStorage`, que Android puede borrar.
- Instaló `@capacitor/preferences` y creó `StorageService`, que carga todo a memoria al arrancar para que las páginas sigan leyendo de forma síncrona.
- Agregó una migración automática de `localStorage` a Preferences.
- Creó `obtenerConCache()`: guarda productos, movimientos, tiendas y dashboard, y los muestra si la API no responde.
- Guardó el carrito de venta en curso.

**Decisión:** elegí Preferences sobre SQLite porque los datos que se guardan son pocos y de tipo clave-valor; la base de datos real está en el servidor.

---

## Sesión 7 — Compilar para Android y consumir la API

**Prompt enviado:**
> "ahora necesito que mi telefono consuma mis apis y compilarlo en mi cel, tengo iphone, asi que necesito hacerlo en un simulador de android studio."

**Qué hizo la IA:**
- Me explicó que no se puede compilar para iPhone desde Windows; necesito una Mac con Xcode.
- Agregó la plataforma Android de Capacitor y configuró la URL de la API para el emulador (`10.0.2.2`), el tráfico HTTP sin cifrar y el permiso de cámara.
- Compiló el APK con Gradle, lo instaló en el emulador y confirmó en el log de Apache que la petición del emulador llegaba al servidor.

**Pregunta de seguimiento:** "¿es normal que el emulador se trabe demasiado?" La IA midió la memoria de la PC: quedaba menos de 1 GB libre, y un proceso de Gradle que ella misma había dejado abierto usaba 1.2 GB. Lo cerró y me recomendó usar una imagen de Android sin Play Store y cerrar Android Studio mientras uso el emulador.

---

## Sesión 8 — Manejo de conexión y errores

**Prompt:** la descripción de la entrega (detección de conexión, manejo de errores, mensajes al usuario, caché, prueba sin conexión y bitácora), con la petición de armar el documento Word con capturas.

**Qué hizo la IA:**
- Me advirtió que la detección de conexión no existía todavía.
- La implementó con `@capacitor/network` (`NetworkService`): barra naranja "Sin conexión" en toda la app y aviso "Conexión restablecida".
- Creó `mensajeError()`, que distingue sin internet, servidor apagado, tiempo agotado y error 500, y la aplicó en las 8 pantallas.
- Probó la app en el emulador con modo avión y con Apache apagado, sacó las capturas y armó el documento Word.

---

## Sesión 9 — Versión 1.0

**Prompt enviado:**
> "Entregarán una versión 1.0 de su aplicación con: Proyecto Ionic funcional, Navegación, Modelo de datos, CRUD, Persistencia, Manejo de errores, Operación offline básica, Repositorio Git, APK o ejecución demostrable, Video demostrativo de máximo 5 minutos, README.md, Bitácora de desarrollo asistido por IA. Ver si tengo todo eso, y hacer lo que nos falta"

**Qué hizo la IA:**
- Revisó cada punto contra el código y me dio una tabla de lo que había y lo que faltaba.
- **Encontró un error de diseño:** los productos no estaban separados por tienda, así que todas las tiendas compartían el mismo inventario. Me preguntó antes de cambiar la base de datos; le dije que sí. Hizo lo siguiente:
  - respaldó la base y creó `migracion_v1_tiendas.sql` (agrega `tienda_id` y asigna los productos existentes a la primera tienda);
  - filtró por tienda `productos.php`, `movimientos.php`, `venta.php` y `dashboard.php`, y validó que no se pueda editar, borrar o vender un producto de otra tienda;
  - probó 10 casos con `curl` (sin tienda → 400, producto de otra tienda → 404/409, etc.).
- Centralizó el modelo de datos en `src/app/models/` (antes `Producto` estaba definido dos veces y era distinto en cada página).
- Creó `database.sql` con el esquema completo para instalaciones nuevas y lo probó en una base temporal.
- Reescribió el README, actualizó esta bitácora, compiló el APK v1.0.0 e hizo los commits.

---

## Sesión 10 — Arquitectura cliente → API → base de datos

**Prompt enviado:** la descripción de la entrega ("Convertir la aplicación de la Unidad I en un cliente móvil conectado a un servicio web": diagrama, endpoints, métodos HTTP, modelo JSON, servicio Angular, arquitectura y evidencia de IA), pidiendo el documento en Word.

**Qué hizo la IA:**
- Revisó cómo se comunicaba la app con la API y encontró **23 llamadas a `axios` repartidas en 9 páginas**. Cada página armaba su propia URL, repetía el tiempo límite y convertía a mano los números que PHP devuelve como texto. No existía un servicio Angular para la API.
- Creó `ApiService` (`shared/api.service.ts`): un método tipado por operación (20 en total), con la URL base y el tiempo límite configurados en un solo lugar, que entrega los datos ya convertidos al modelo.
- Creó `models/api.model.ts` con la forma del JSON de cada petición y respuesta.
- Migró las 9 páginas al servicio. Ahora `axios` solo se importa en `api.service.ts`.
- Cambió el prefijo de la caché offline (`cache_v2_`), porque las copias guardadas por la versión anterior tenían los números como texto.
- Probó el servicio contra la API real con 12 casos: login, CRUD completo de productos, entrada, venta, dashboard, miembros, usuarios y el rechazo de un producto de otra tienda. Los 12 pasaron.
- Analizó la arquitectura e hizo una lista de mejoras pendientes (ver el documento de la entrega). La más importante: la API no valida el token en cada petición.

---

## Código aceptado, modificado o descartado

### Aceptado sin cambios

- **Diseño visual del login y registro:** los estilos con glassmorphism, la paleta cian/violeta, la animación de aparición y la disposición del formulario se usaron tal cual.
- **Estructura de los endpoints PHP:** PDO con consultas preparadas, validación de entradas, códigos HTTP correctos (400, 404, 409, 201) y headers CORS.
- **Configuración del router:** redirección inicial a `/login` y rutas con *lazy loading*.
- **Estrategia de caché "red primero"** (sesión 6) y **detección de red** (sesión 8).

### Modificado

- **Campo `estado` en el CRUD de usuarios:** la IA asumió que MySQL devolvería `estado` como número, pero PDO lo devuelve como string `"1"`/`"0"`, y todos los usuarios aparecían como "Inactivo". Se convirtió explícitamente con `Number(u.estado)`. Lo detecté revisando la respuesta de la API con `curl`.
- **Refresco de la vista:** el spinner se quedaba pegado después de guardar. Se agregó `ChangeDetectorRef.detectChanges()` al final de cada operación asíncrona. *(Después entendimos la causa: la app es "zoneless", ver el problema 1 de la tabla de abajo.)*
- **Timeout en Axios:** sin límite, un error de red dejaba el botón cargando para siempre. Se agregó `{ timeout: 10000 }` a todas las llamadas.
- **Estilos compartidos:** había mucho SCSS duplicado. Se movió a dos partials, `_auth-form.scss` y `_admin-panel.scss`.
- **Inventario por tienda** (sesión 9): el diseño original de la sesión 4 no contemplaba varias tiendas; se corrigió con una migración.

### Descartado

- **Login con Google/Apple:** los botones quedaron como elementos visuales, pero no se implementó OAuth porque no era necesario para el alcance del proyecto.
- **JWT completo:** la IA sugirió JWT con firma, expiración y *refresh tokens*. Se simplificó a un token aleatorio (`bin2hex(random_bytes(32))`). Queda como limitación conocida: la API todavía no valida el token en cada petición.
- **SQLite para ventas sin conexión:** se evaluó una cola de ventas offline, pero se descartó para la v1.0 porque requiere resolver conflictos de stock entre varios dispositivos.
- *(Retomado)* **Escáner de códigos de barras:** en la sesión 4 se dejó fuera, pero en la sesión 5 se implementó.

---

## Problemas encontrados y cómo se resolvieron

| # | Problema | Causa | Solución | ¿Con IA? |
|---|---|---|---|---|
| 1 | La barra "Sin conexión" no aparecía aunque el plugin detectaba el cambio | Angular 22 en modo *zoneless*: los cambios fuera de Angular no actualizan la vista, y `NgZone.run()` no hace nada sin zone.js | Usar un `signal()` para el estado de conexión | Sí |
| 2 | Al reabrir la app sin conexión siempre pedía login | La ruta inicial es `/login` y esa pantalla no revisaba la sesión guardada | `LoginPage.ngOnInit()` redirige a `/home` si hay token | Sí |
| 3 | Pantalla en blanco unos 5 s al abrir | Las claves de Preferences se leían una por una | Leerlas en paralelo con `Promise.all()` | Sí |
| 4 | Con Wi-Fi pero el servidor apagado, decía "Sin conexión" | El mensaje de caché era fijo | `mensajeCache()` revisa el estado de la red | Sí |
| 5 | El emulador no llegaba a la API | `localhost` en el emulador es el propio emulador, Android bloquea HTTP y faltaba `apiUrl` en producción | `10.0.2.2`, `usesCleartextTraffic`, `allowMixedContent` | Sí |
| 6 | La compilación de producción fallaba | Límite de tamaño de estilos de 4 kB por componente | Subir el límite en `angular.json` | Sí |
| 7 | Riesgo de que la sesión "reviviera" tras cerrar sesión | La migración copiaba de `localStorage` en cada arranque | Borrar de `localStorage` después de migrar | Sí (la IA lo detectó revisando su propio código) |
| 8 | Todas las tiendas compartían el inventario | `productos` no tenía `tienda_id` | Migración SQL + filtro por tienda en la API y en la app | Sí |
| 9 | El emulador se trababa ("System UI isn't responding") | La PC tenía menos de 1 GB de RAM libre | Cerrar procesos (Gradle, Android Studio) y usar una imagen más ligera | Sí (diagnóstico) |
| 10 | `estado` de los usuarios siempre "Inactivo" | PDO devuelve números como string | `Number()` al mapear | No: lo detecté con `curl` |

---

## Reflexión

- La IA aceleró mucho el trabajo repetitivo (endpoints, formularios, estilos), pero **no siempre conoce el contexto real del proyecto**. Por ejemplo, asumió zone.js en un proyecto *zoneless* y asumió números donde PDO devuelve strings. Probar en el dispositivo real fue lo que encontró esos errores.
- Pedirle que **revisara el proyecto contra los requisitos** antes de escribir código fue útil: así salieron cosas que yo no había notado, como que faltaba la detección de red o que el inventario no estaba separado por tienda.
- Para cambios de riesgo, como modificar la base de datos, la IA pidió confirmación e hizo un respaldo antes. Ese flujo de "proponer → confirmar → probar" es el que voy a seguir usando.
