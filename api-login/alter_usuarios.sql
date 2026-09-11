-- Agrega los campos necesarios para el CRUD de usuarios a la tabla existente.
-- Corré esto en phpMyAdmin (pestaña SQL, con la base "login_app" seleccionada)
-- si ya habías creado la tabla "usuarios" con el db.sql anterior.

USE login_app;

ALTER TABLE usuarios
  ADD COLUMN usuario VARCHAR(50) NULL UNIQUE AFTER nombre,
  ADD COLUMN rol VARCHAR(30) NOT NULL DEFAULT 'usuario' AFTER password,
  ADD COLUMN estado TINYINT(1) NOT NULL DEFAULT 1 AFTER rol;
