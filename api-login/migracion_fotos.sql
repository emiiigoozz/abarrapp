-- Fotos de productos: ruta del archivo de imagen (relativa a la carpeta de la API).
-- Úsala si ya tenías la base de la v1.0; database.sql ya trae esta columna.
USE login_app;

ALTER TABLE productos ADD COLUMN foto VARCHAR(255) NULL AFTER categoria;
