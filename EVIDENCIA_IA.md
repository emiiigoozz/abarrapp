# Evidencia de uso de Inteligencia Artificial — AbarrApp

## Prompts utilizados con IA

---

### Prompt 1 — Diseño de interfaz de login

**Prompt enviado:**
> "Ayúdame a diseñar un login o una interfaz de inicio, por favor, con diseño minimalista y futurista"

**Resultado:** Claude generó el HTML, SCSS y TypeScript completos para la pantalla de login con estética oscura (fondo #05060c), efecto glassmorphism en la tarjeta, manchas de luz difuminadas (glow cian y violeta), tipografía Orbitron/Space Grotesk desde Google Fonts, inputs con íconos y resaltado neón al foco, y botón con gradiente cian→violeta. También configuró el modo oscuro forzado en global.scss y actualizó el app-routing.module.ts para que la app arranque directo en /login.

---

### Prompt 2 — API REST de autenticación en PHP

**Prompt enviado:**
> "Ocupo una API de login, esta será consumida por Ionic desde Axios. Genérame el archivo PHP y el SQL de la tabla que ocupe"

**Resultado:** Claude generó `login.php` con verificación de credenciales usando `password_verify()` y retorno de token aleatorio, `register.php` con validación de email, longitud mínima de contraseña, detección de duplicados y hash bcrypt, `config.php` con la conexión PDO a MySQL, y el archivo `db.sql` con la tabla `usuarios` y un usuario de prueba precargado con contraseña hasheada. También configuró los headers CORS para permitir peticiones desde el servidor de desarrollo de Ionic (localhost:8100).

---

### Prompt 3 — CRUD de usuarios con formulario

**Prompt enviado:**
> "Ahora quiero un formulario con CRUD, para después del login, que conecte a la base de datos con API, con nombre, usuario, correo, contraseña, rol, estado, y botón de registrar. Recuerda que es CRUD: create, read, update, delete."

**Resultado:** Claude generó `usuarios.php` (endpoint REST que responde a GET, POST, PUT y DELETE), `usuarios.page.html` (formulario + lista de tarjetas con botones de editar y eliminar), `usuarios.page.ts` (lógica completa con manejo de modo creación/edición, carga con Axios, y confirmación antes de eliminar) y los estilos con la misma paleta futurista del login.

---

### Prompt 4 — Módulo de inventario completo (productos, movimientos, dashboard)

**Prompt enviado:**
> "Quiero que mi app sea para inventariar rápido una tienda de abarrotes, saber todo lo que tenemos, y poder hacer una curva de ganancias. Mi problema es que estoy vendiendo lo de mi tienda pero no sé cuánto estoy sacando o si estoy perdiendo."

**Resultado:** Claude propuso la arquitectura del módulo (productos, movimientos, dashboard), generó las tablas SQL `productos` y `movimientos`, los tres endpoints PHP (`productos.php`, `movimientos.php`, `dashboard.php`), y las tres pantallas Ionic correspondientes con CRUD de productos, formulario de registro de ventas/entradas, y dashboard con curva de ganancias usando Chart.js, alertas de stock bajo y ranking de los productos más vendidos.

---

## Explicación del código generado por IA: aceptado, modificado o descartado

### Código aceptado sin cambios

- **Diseño visual del login y registro:** Los estilos con glassmorphism, la paleta de colores (cian/violeta), la animación de aparición y la disposición del formulario se usaron tal cual. El resultado visual cumplió exactamente con el objetivo de estética "minimalista y futurista".

- **Estructura de los endpoints PHP:** Los archivos `login.php`, `register.php`, `productos.php`, `movimientos.php` y `dashboard.php` se adoptaron sin cambios de lógica. La validación de inputs, el uso de PDO con consultas preparadas, el manejo de errores con códigos HTTP correctos (400, 404, 409, 201) y la configuración de headers CORS son buenas prácticas que se aceptaron directamente.

- **Configuración del router Angular:** La redirección inicial a `/login` y las rutas lazy-loaded generadas con `ionic generate page` se aceptaron tal como las propuso la IA.

### Código modificado

- **Campo `estado` en el CRUD de usuarios:** La IA generó el código asumiendo que MySQL devolvería el campo `estado` como número. En la práctica, PDO lo devuelve como string `"1"` o `"0"`, lo que hacía que todos los usuarios aparecieran como "Inactivo" aunque estuvieran activos. Se modificó el mapeo de datos para convertir explícitamente `id` y `estado` a número con `Number()`: `estado: Number(u.estado)`. Este bug se detectó revisando la respuesta real de la API con `curl`.

- **Refresco de vista tras operaciones CRUD:** La IA no incluyó `ChangeDetectorRef` inicialmente en el CRUD de usuarios, lo que causaba que el spinner se quedara pegado después de crear o editar un registro (aunque los datos sí se guardaban en la base de datos). Se añadió `ChangeDetectorRef.detectChanges()` al final de cada operación asíncrona para forzar la actualización de la vista.

- **Timeout en peticiones Axios:** La IA generó las peticiones Axios sin timeout, lo que provocaba que un error de red dejara el botón en estado de carga indefinidamente. Se agregó `{ timeout: 10000 }` a todas las llamadas para limitar la espera a 10 segundos y mostrar el mensaje de error al usuario.

- **Estilos compartidos:** La IA generó los estilos del login y del CRUD de usuarios como archivos SCSS independientes con mucho código duplicado. Se refactorizaron en dos partials compartidos (`_auth-form.scss` para login/register y `_admin-panel.scss` para las pantallas del sistema) que las páginas importan con `@import`. Esto reduce el código duplicado y facilita cambios de diseño globales.

### Código descartado

- **Botones de login social (Google/Apple):** La IA incluyó botones visuales de "Continuar con Google" y "Continuar con Apple" en el diseño del login. Se dejaron en el HTML como elementos visuales, pero la lógica de autenticación con terceros fue descartada porque no era necesaria para el alcance del proyecto y habría requerido configurar OAuth con credenciales de producción.

- **Sugerencia de autenticación con JWT real:** La IA sugirió implementar JWT completo (con firma, expiración y refresh tokens). Para este proyecto se descartó y se simplificó a un token aleatorio generado con `bin2hex(random_bytes(32))` almacenado en `localStorage`, que es suficiente para el propósito académico del sistema.

- **Escaneo de código de barras con cámara:** Se discutió la posibilidad de integrar la cámara para escanear códigos de barras usando `@zxing/browser` o `html5-qrcode`. La funcionalidad fue descartada del alcance inicial para enfocarse en el núcleo funcional del sistema, aunque el campo `codigo` en la tabla `productos` ya está preparado para recibirlo manualmente.
