/** Usuario del sistema (tabla `usuarios`). */
export interface Usuario {
  id: number;
  nombre: string;
  usuario: string | null;
  email: string;
  rol: string;
  /** 1 = activo, 0 = inactivo. */
  estado: number;
  creado_en: string;
}
