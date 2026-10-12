// Forma del JSON que se intercambia con la API en PHP.
// Todas las respuestas tienen `success`; las de consulta traen `data` y las de error, `message`.

/** Envoltura común de todas las respuestas de la API. */
export interface RespuestaApi<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/** Usuario que devuelve el login/registro y que se guarda en la sesión. */
export interface UsuarioSesion {
  id: number;
  nombre: string;
  email: string;
}

/** Respuesta de login.php y register.php. */
export interface RespuestaSesion extends RespuestaApi {
  token: string;
  user: UsuarioSesion;
}

/** Cuerpo para crear o editar un producto (POST/PUT productos.php). */
export interface ProductoForm {
  nombre: string;
  codigo?: string | null;
  categoria?: string | null;
  costo: number;
  precio_venta: number;
  stock: number;
}

/** Línea de una venta (POST venta.php). */
export interface ItemVenta {
  producto_id: number;
  cantidad: number;
}

/** Respuesta de venta.php. */
export interface RespuestaVenta extends RespuestaApi {
  total: number;
  ganancia: number;
}

/** Cuerpo para crear o editar un usuario del sistema (POST/PUT usuarios.php). */
export interface UsuarioForm {
  nombre: string;
  usuario: string;
  email: string;
  /** Obligatoria al crear; al editar, si va vacía se conserva la anterior. */
  password?: string;
  rol: string;
  estado: number;
}

/** Cambios permitidos sobre un miembro de tienda (PUT miembros.php). */
export interface CambiosMiembro {
  rol?: 'admin' | 'trabajador' | 'lector';
  estado?: 'pendiente' | 'aceptado';
}
