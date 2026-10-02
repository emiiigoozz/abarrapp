-- Migración a la v1.0: cada producto pertenece a una tienda.
-- Úsala solo si ya tenías la base creada con db.sql + db_inventario.sql + db_tiendas.sql.
-- En una instalación nueva usa database.sql, que ya trae este cambio.
--
-- Los productos que ya existían se asignan a la tienda más antigua (la de menor id).
-- Los movimientos no cambian: heredan la tienda a través de su producto.

USE login_app;

ALTER TABLE productos ADD COLUMN tienda_id INT NULL AFTER id;

UPDATE productos SET tienda_id = (SELECT MIN(id) FROM tiendas) WHERE tienda_id IS NULL;

-- Si no había ninguna tienda, los productos sin dueño no se pueden conservar.
DELETE FROM productos WHERE tienda_id IS NULL;

ALTER TABLE productos
  MODIFY tienda_id INT NOT NULL,
  ADD CONSTRAINT fk_productos_tienda FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE;
