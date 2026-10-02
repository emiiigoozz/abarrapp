USE login_app;

CREATE TABLE IF NOT EXISTS tiendas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo_invitacion VARCHAR(10) NOT NULL UNIQUE,
  dueno_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dueno_id) REFERENCES usuarios(id)
);

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
