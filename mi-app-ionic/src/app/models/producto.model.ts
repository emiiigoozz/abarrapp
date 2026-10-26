/** Producto del inventario (tabla `productos`). */
export interface Producto {
  id: number;
  /** Tienda dueña del producto: cada tienda tiene su propio inventario. */
  tienda_id: number;
  nombre: string;
  /** Código de barras (EAN/UPC); opcional. */
  codigo: string | null;
  categoria: string | null;
  /** URL completa de la foto del producto, o null si no tiene. */
  foto: string | null;
  /** Lo que le cuesta el producto a la tienda. */
  costo: number;
  /** Precio al que se vende al cliente. */
  precio_venta: number;
  stock: number;
  creado_en: string;
  /** true si tiene cambios hechos sin conexión que aún no llegan al servidor. */
  pendiente?: boolean;
}

/** Datos del producto que necesita el punto de venta. */
export type ProductoVenta = Omit<Producto, 'tienda_id' | 'categoria' | 'creado_en'>;
