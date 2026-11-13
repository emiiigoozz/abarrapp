-- Ubicación de las tiendas (geolocalización). Úsala si ya tenías la base de la v2.0;
-- database.sql ya trae estas columnas.
USE login_app;

ALTER TABLE tiendas
  ADD COLUMN latitud DECIMAL(10,7) NULL AFTER dueno_id,
  ADD COLUMN longitud DECIMAL(10,7) NULL AFTER latitud;
