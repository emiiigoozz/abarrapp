/** Totales de ventas que muestra el dashboard. */
export interface Resumen {
  ingresos: number;
  costos: number;
  ganancia: number;
  unidades: number;
}

export interface GananciaDia {
  /** Fecha en formato YYYY-MM-DD. */
  dia: string;
  ganancia: number;
}

export interface TopProducto {
  id: number;
  nombre: string;
  unidades_vendidas: number;
  ganancia: number;
}

/** Producto con pocas unidades en stock. */
export interface AlertaStock {
  id: number;
  nombre: string;
  stock: number;
}

/** Producto cuyo precio de venta es menor que su costo. */
export interface AlertaPerdida {
  id: number;
  nombre: string;
  costo: number;
  precio_venta: number;
}

/** Respuesta completa de dashboard.php. */
export interface Dashboard {
  resumen: Resumen;
  ganancias_por_dia: GananciaDia[];
  top_productos: TopProducto[];
  stock_bajo: AlertaStock[];
  productos_con_perdida: AlertaPerdida[];
}
