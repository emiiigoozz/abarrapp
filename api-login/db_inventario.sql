USE login_app;

CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(50) NULL,
  categoria VARCHAR(100) NULL,
  costo DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Datos de ejemplo para probar el dashboard
INSERT INTO productos (nombre, codigo, categoria, costo, precio_venta, stock) VALUES
('Coca Cola 600ml', '7501055300210', 'Bebidas', 12.00, 18.00, 24),
('Sabritas Original 45g', '7501011130018', 'Botanas', 9.50, 15.00, 3),
('Leche Lala 1L', '7501020514038', 'Lácteos', 21.00, 26.00, 15),
('Pan Bimbo Blanco', '7501000112211', 'Panadería', 28.00, 32.00, 8);
