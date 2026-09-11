# AbarrApp — Sistema de Inventario para Tiendas de Abarrotes

## Objetivo

AbarrApp es una aplicación móvil desarrollada con Ionic y Angular que permite a los dueños de tiendas de abarrotes llevar el control de su inventario, registrar ventas y entradas de productos, y visualizar la curva de ganancias en tiempo real.

El problema que resuelve: muchos comerciantes pequeños venden sus productos sin saber con exactitud cuánto están ganando, si están vendiendo a pérdida algún artículo, o cuándo se les va a acabar el stock de algo. AbarrApp centraliza toda esa información en un dashboard simple y claro.

## Tecnologías utilizadas

- **Frontend:** Ionic 7 + Angular 17 (TypeScript)
- **Backend:** PHP 8 (API REST)
- **Base de datos:** MySQL (via XAMPP)
- **HTTP Client:** Axios
- **Gráficas:** Chart.js
- **Servidor local:** Apache (XAMPP)

## Páginas y vistas

| Ruta | Descripción |
|------|-------------|
| `/login` | Autenticación con email y contraseña |
| `/register` | Registro de cuenta nueva |
| `/home` | Menú principal con acceso a todas las secciones |
| `/productos` | CRUD completo de productos (nombre, código de barras, categoría, costo, precio de venta, stock) |
| `/movimientos` | Registro rápido de ventas y entradas de stock |
| `/dashboard` | Curva de ganancias, alertas de stock bajo, ranking de productos más vendidos |
| `/usuarios` | Gestión de usuarios del sistema (admin) |

## Modelo inicial de datos

### Tabla `usuarios`
```sql
id           INT AUTO_INCREMENT PRIMARY KEY
nombre       VARCHAR(100)
usuario      VARCHAR(80) UNIQUE
email        VARCHAR(150) UNIQUE
password     VARCHAR(255)   -- hash bcrypt
rol          ENUM('admin','usuario')
estado       TINYINT(1)
creado_en    TIMESTAMP
```

### Tabla `productos`
```sql
id           INT AUTO_INCREMENT PRIMARY KEY
nombre       VARCHAR(150)
codigo       VARCHAR(50)    -- código de barras
categoria    VARCHAR(100)
costo        DECIMAL(10,2)
precio_venta DECIMAL(10,2)
stock        INT
creado_en    TIMESTAMP
```

### Tabla `movimientos`
```sql
id               INT AUTO_INCREMENT PRIMARY KEY
producto_id      INT  (FK → productos.id)
tipo             ENUM('entrada','salida')
cantidad         INT
costo_unitario   DECIMAL(10,2)   -- snapshot del costo al momento de la venta
precio_unitario  DECIMAL(10,2)   -- snapshot del precio al momento de la venta
fecha            TIMESTAMP
```

## Cómo ejecutar el proyecto

### Requisitos previos
- Node.js 18+
- Ionic CLI (`npm install -g @ionic/cli`)
- XAMPP con Apache y MySQL activos

### 1. Configurar la base de datos
1. Abrí XAMPP Control Panel y arrancá Apache y MySQL.
2. Entrá a `http://localhost:8080/phpmyadmin`.
3. Importá `api-login/db.sql` para crear la base `login_app` con la tabla `usuarios`.
4. Importá `api-login/db_inventario.sql` para crear las tablas `productos` y `movimientos`.

### 2. Copiar la API a XAMPP
Copiá toda la carpeta `api-login/` a `C:\xampp\htdocs\api-login\`.

### 3. Levantar la app Ionic
```bash
cd mi-app-ionic
npm install
ionic serve
```

La app queda disponible en `http://localhost:8100`.

### Credenciales de prueba
| Email | Contraseña | Rol |
|-------|-----------|-----|
| demo@ejemplo.com | 123456 | admin |

## Estructura del proyecto

```
App II/
├── api-login/           ← Backend PHP (copiar a htdocs de XAMPP)
│   ├── config.php
│   ├── login.php
│   ├── register.php
│   ├── usuarios.php
│   ├── productos.php
│   ├── movimientos.php
│   ├── dashboard.php
│   ├── db.sql
│   └── db_inventario.sql
└── mi-app-ionic/        ← App Ionic + Angular
    └── src/
        └── app/
            ├── login/
            ├── register/
            ├── home/
            ├── productos/
            ├── movimientos/
            ├── dashboard/
            └── usuarios/
```

## Autor

Jorge Emilio González Salinas — Universidad Politécnica de Durango, Materia: Aplicaciones para Dispositivos Móviles II
