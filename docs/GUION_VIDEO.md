# Guion del video demostrativo — AbarrApp v1.0 (máx. 5 min)

**Antes de grabar:**
- Prende Apache y MySQL en XAMPP.
- Abre el emulador con la app instalada y cierra todo lo demás (el emulador va mejor con RAM libre).
- Cuenta de prueba: `demo@abarrapp.com` / `demo1234`, tienda "Abarrotes Demo".
- **Para grabar:** la grabadora de Windows (`Win + Alt + R`, Xbox Game Bar) o la de la barra lateral del emulador (`⋯` → *Record and playback*).

| Tiempo | Qué mostrar | Qué decir (idea) | Requisito |
|---|---|---|---|
| 0:00 – 0:20 | Tu cara o la pantalla de inicio de la app | "AbarrApp es una app en Ionic para controlar el inventario y las ventas de una tienda de abarrotes." | Presentación |
| 0:20 – 0:45 | Iniciar sesión → lista de tiendas → entrar a "Abarrotes Demo" | "Cada usuario puede tener varias tiendas y cada tienda tiene su propio inventario y sus roles." | Proyecto funcional, navegación |
| 0:45 – 1:45 | **Productos:** crear uno (por ejemplo "Atún Dolores", costo 18, precio 25, stock 10), editarle el precio y borrarlo | "Este es el CRUD de productos. Se ve el margen de ganancia de cada uno." | CRUD, modelo de datos |
| 1:45 – 2:35 | **Movimientos:** agregar 2 o 3 productos al carrito → Terminar venta → aparece el total. Luego "Recibir mercancía" de un producto. | "El punto de venta registra la venta en una sola transacción y descuenta el stock." | CRUD, manejo de errores (intenta vender más de lo que hay en stock) |
| 2:35 – 3:05 | **Dashboard:** ingresos, ganancia, curva, alertas | "El dashboard muestra cuánto se gana de verdad y avisa de stock bajo." | — |
| 3:05 – 3:35 | Cerrar la app por completo y volver a abrirla | "La sesión y los datos se guardan en el teléfono con Capacitor Preferences, así que no hay que volver a iniciar sesión." | Persistencia |
| 3:35 – 4:30 | Activar **modo avión** → aparece la barra naranja → navegar a Productos y Dashboard (se ven los datos guardados) → intentar registrar un producto (sale el mensaje de error) → quitar el modo avión → "Conexión restablecida" | "Sin conexión, la app lo detecta, muestra los últimos datos guardados y explica por qué no se puede guardar." | Offline, manejo de errores |
| 4:30 – 4:50 | El repositorio en GitHub (README y BITACORA_IA.md) | "El código está en GitHub, con el README y la bitácora de lo que hice con ayuda de IA." | Repositorio, README, bitácora |
| 4:50 – 5:00 | Cierre | "Gracias." | — |

**Consejos:**
- Si el emulador va lento, graba cada parte por separado y únelas después (por ejemplo con Clipchamp, que viene en Windows).
- Para activar el modo avión rápido: desliza desde arriba en el emulador, o usa `adb shell cmd connectivity airplane-mode enable` (y `disable` para quitarlo).
- Cuando lo subas (YouTube como "no listado" o Google Drive), pega el enlace en la tabla del inicio del `README.md`.
