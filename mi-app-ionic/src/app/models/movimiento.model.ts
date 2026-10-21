export type TipoMovimiento = 'entrada' | 'salida';

/**
 * Entrada (compra/recepción) o salida (venta) de un producto (tabla `movimientos`).
 * Guarda el costo y el precio del momento para que las ganancias históricas no cambien
 * si después se edita el producto.
 */
export interface Movimiento {
  id: number;
  producto_id: number;
  producto_nombre: string;
  tipo: TipoMovimiento;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  fecha: string;
  /** true si se registró sin conexión y aún no llega al servidor. */
  pendiente?: boolean;
}

/** Línea del carrito en el punto de venta; se persiste en el dispositivo. */
export interface ItemCarrito {
  producto_id: number;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  stockDisponible: number;
}
