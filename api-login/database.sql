-- AbarrApp v1.0 — esquema completo de la base de datos.
-- Instalación nueva: importa este archivo en phpMyAdmin (pestaña "Importar").
-- Si ya tenías la base de una versión anterior, usa migracion_v1_tiendas.sql en su lugar.

CREATE DATABASE IF NOT EXISTS login_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE login_app;

-- Cuentas de usuario. La contraseña se guarda con hash bcrypt.
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(30) NOT NULL DEFAULT 'usuario',
  estado TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tiendas. Cada una tiene un código para invitar a otros usuarios.
CREATE TABLE IF NOT EXISTS tiendas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo_invitacion VARCHAR(10) NOT NULL UNIQUE,
  dueno_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dueno_id) REFERENCES usuarios(id)
);

-- Quién pertenece a cada tienda y con qué rol.
CREATE TABLE IF NOT EXISTS tienda_miembros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id INT NOT NULL,
  usuario_id INT NOT NULL,
  rol ENUM('admin', 'trabajador', 'lector') NOT NULL DEFAULT 'lector',
  estado ENUM('pendiente', 'aceptado') NOT NULL DEFAULT 'pendiente',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unico_miembro (tienda_id, usuario_id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Inventario: cada producto pertenece a una tienda.
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(50) NULL,
  categoria VARCHAR(100) NULL,
  -- Ruta de la foto del producto (p. ej. uploads/productos/3_12_1729890000.jpg)
  foto VARCHAR(255) NULL,
  costo DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_productos_tienda FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE
);

-- Entradas (recepción de mercancía) y salidas (ventas). Guardan el costo y el precio
-- del momento para que las ganancias históricas no cambien si se edita el producto.
CREATE TABLE IF NOT EXISTS movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  tipo ENUM('entrada', 'salida') NOT NULL,
  cantidad INT NOT NULL,
  costo_unitario DECIMAL(10,2) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- Datos de demostración: usuario demo@abarrapp.com / demo1234, con su tienda y productos.
INSERT INTO usuarios (id, nombre, usuario, email, password, rol, estado) VALUES
(1, 'Demo AbarrApp', 'demo', 'demo@abarrapp.com', '$2y$10$HodIYd4WxRHhMsU/BibUEOLz3gl9tNcCIZ7fAYX/R2UQYsXBkrxx2', 'admin', 1);

INSERT INTO tiendas (id, nombre, codigo_invitacion, dueno_id) VALUES
(1, 'Abarrotes Demo', 'DEMO01', 1);

INSERT INTO tienda_miembros (tienda_id, usuario_id, rol, estado) VALUES
(1, 1, 'admin', 'aceptado');

INSERT INTO productos (tienda_id, nombre, codigo, categoria, costo, precio_venta, stock) VALUES
(1, 'Coca Cola 600ml', '7501055300210', 'Bebidas', 12.00, 18.00, 24),
(1, 'Sabritas Original 45g', '7501011130018', 'Botanas', 9.50, 15.00, 3),
(1, 'Leche Lala 1L', '7501020514038', 'Lácteos', 21.00, 26.00, 15),
(1, 'Pan Bimbo Blanco', '7501000112211', 'Panadería', 28.00, 32.00, 8);
