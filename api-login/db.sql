-- Base de datos para el login + CRUD de usuarios de la app Ionic
CREATE DATABASE IF NOT EXISTS login_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE login_app;

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

-- Usuario de prueba: email "demo@ejemplo.com", contraseña "123456"
-- (hash bcrypt real, verificado - compatible con password_verify() de PHP)
INSERT INTO usuarios (nombre, usuario, email, password, rol, estado) VALUES
('Usuario Demo', 'demo', 'demo@ejemplo.com', '$2b$10$sNn5VxBrrOOgHTep6sovvu1E8XfTowTb92EkejtStL4gQ2wrh8uwa', 'admin', 1);
