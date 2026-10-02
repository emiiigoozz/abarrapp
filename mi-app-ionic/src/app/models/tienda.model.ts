export type RolTienda = 'admin' | 'trabajador' | 'lector';
export type EstadoMiembro = 'pendiente' | 'aceptado';

/** Tienda a la que pertenece el usuario, con su rol en ella (tablas `tiendas` + `tienda_miembros`). */
export interface Tienda {
  id: number;
  nombre: string;
  /** Código que se comparte para que otros usuarios pidan unirse. */
  codigo_invitacion: string;
  dueno_id: number;
  rol: RolTienda;
  estado: EstadoMiembro;
}

/** Usuario que pertenece (o pidió unirse) a una tienda (tabla `tienda_miembros`). */
export interface Miembro {
  id: number;
  usuario_id: number;
  nombre: string;
  email: string;
  rol: RolTienda;
  estado: EstadoMiembro;
  creado_en: string;
}
