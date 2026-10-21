import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ItemVenta, Movimiento, Producto, ProductoForm } from '../models';
import { ApiService } from './api.service';
import { mensajeError, NetworkService } from './network.service';
import { StorageService } from './storage.service';

export type TipoOperacion = 'crearProducto' | 'actualizarProducto' | 'eliminarProducto' | 'venta' | 'entrada';

/** Cambio hecho en el teléfono que todavía no llega al servidor. */
export interface OperacionPendiente {
  id: string;
  tipo: TipoOperacion;
  tiendaId: number;
  creadaEn: string;
  /** Texto para mostrarle al usuario, p. ej. "Venta de 3 productos". */
  descripcion: string;
  /** Producto afectado. Si se creó sin conexión es un id temporal negativo. */
  productoId?: number;
  producto?: ProductoForm;
  items?: ItemVenta[];
  cantidad?: number;
}

/** Cambio que el servidor rechazó (p. ej. ya no había stock); el usuario decide qué hacer. */
export interface OperacionFallida extends OperacionPendiente {
  error: string;
}

const CLAVE_COLA = 'sync_cola';
const CLAVE_FALLIDAS = 'sync_fallidas';
const REINTENTO_MS = 15000;

/** Un error sin respuesta HTTP significa que no se llegó al servidor (sin red o servidor apagado). */
export const esErrorDeConexion = (err: any): boolean => !err?.response;

/**
 * Sincronización local ↔ remota.
 *
 * - Si no hay conexión, los cambios (ventas, entradas y altas/ediciones/bajas de productos)
 *   se guardan en una cola persistente en el teléfono y se reflejan de inmediato en pantalla.
 * - Al recuperar la conexión, la cola se envía al servidor en el mismo orden en que se hizo.
 *   Si el servidor rechaza un cambio (400/404/409), pasa a "fallidas" para no bloquear al resto.
 * - Al terminar, avisa con `sincronizado$` para que las pantallas recarguen los datos reales.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {

  readonly pendientes = signal<OperacionPendiente[]>([]);
  readonly fallidas = signal<OperacionFallida[]>([]);
  readonly sincronizando = signal(false);
  /** Emite cuántos cambios se enviaron al terminar una sincronización. */
  readonly sincronizado$ = new Subject<number>();

  constructor(
    private storage: StorageService,
    private api: ApiService,
    private network: NetworkService,
  ) { }

  /** Se ejecuta al iniciar la app, después de cargar el almacenamiento local. */
  init(): void {
    this.pendientes.set(this.storage.getJSON<OperacionPendiente[]>(CLAVE_COLA) ?? []);
    this.fallidas.set(this.storage.getJSON<OperacionFallida[]>(CLAVE_FALLIDAS) ?? []);
    // Recuperación de conexión: en cuanto vuelve la red se envía la cola.
    this.network.online$.subscribe(online => { if (online) this.sincronizar(); });
    // Si hay red pero el servidor estaba caído, se reintenta cada cierto tiempo.
    setInterval(() => this.sincronizar(), REINTENTO_MS);
  }

  /**
   * Intenta enviar el cambio al servidor. Si no hay conexión (o ya hay cambios esperando,
   * para respetar el orden), lo guarda en la cola. Los errores del servidor (400, 409…)
   * se lanzan para que la pantalla los muestre.
   */
  async enviarOEncolar<T>(op: Omit<OperacionPendiente, 'id' | 'creadaEn'>): Promise<{ encolado: boolean; resultado?: T }> {
    const completa: OperacionPendiente = {
      ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, creadaEn: new Date().toISOString(),
    };
    if (!this.network.online || this.pendientes().length > 0) {
      this.encolar(completa);
      return { encolado: true };
    }
    try {
      return { encolado: false, resultado: await this.ejecutar(completa) as T };
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      this.encolar(completa);
      return { encolado: true };
    }
  }

  /** Id temporal para un producto creado sin conexión (se reemplaza al sincronizar). */
  idTemporal(): number {
    return -Date.now();
  }

  async sincronizar(): Promise<void> {
    if (this.sincronizando() || !this.network.online || this.pendientes().length === 0) {
      return;
    }
    this.sincronizando.set(true);
    let enviadas = 0;
    try {
      while (this.pendientes().length > 0) {
        const op = this.pendientes()[0];
        try {
          const resultado = await this.ejecutar(op);
          if (op.tipo === 'crearProducto' && op.productoId! < 0) {
            this.reemplazarIdTemporal(op.productoId!, resultado as number);
          }
          this.quitarPrimera();
          enviadas++;
        } catch (err) {
          if (esErrorDeConexion(err)) {
            break; // el servidor no responde: se queda en la cola y se reintenta después
          }
          this.quitarPrimera();
          this.fallidas.set([...this.fallidas(), { ...op, error: mensajeError(err, 'El servidor rechazó el cambio') }]);
          this.storage.setJSON(CLAVE_FALLIDAS, this.fallidas());
        }
      }
    } finally {
      this.sincronizando.set(false);
    }
    if (enviadas > 0 || this.fallidas().length > 0) {
      this.sincronizado$.next(enviadas);
    }
  }

  descartarFallidas(): void {
    this.fallidas.set([]);
    this.storage.remove(CLAVE_FALLIDAS);
  }

  /** Aplica los cambios pendientes de la tienda sobre la lista de productos (vista local). */
  aplicarAProductos<P extends Partial<Producto> & { id: number; stock: number }>(tiendaId: number, base: P[]): (P & { pendiente?: boolean })[] {
    let lista: (P & { pendiente?: boolean })[] = base.map(p => ({ ...p }));
    for (const op of this.pendientes().filter(o => o.tiendaId === tiendaId)) {
      switch (op.tipo) {
        case 'crearProducto':
          lista.push({ id: op.productoId!, tienda_id: tiendaId, codigo: null, categoria: null, creado_en: op.creadaEn,
            ...op.producto!, pendiente: true } as unknown as P & { pendiente: boolean });
          break;
        case 'actualizarProducto':
          lista = lista.map(p => p.id === op.productoId ? { ...p, ...op.producto, pendiente: true } : p);
          break;
        case 'eliminarProducto':
          lista = lista.filter(p => p.id !== op.productoId);
          break;
        case 'venta':
          for (const item of op.items!) {
            lista = lista.map(p => p.id === item.producto_id ? { ...p, stock: p.stock - item.cantidad, pendiente: true } : p);
          }
          break;
        case 'entrada':
          lista = lista.map(p => p.id === op.productoId ? { ...p, stock: p.stock + op.cantidad!, pendiente: true } : p);
          break;
      }
    }
    return lista;
  }

  /** Ventas y entradas hechas sin conexión, para mostrarlas en el historial. */
  movimientosPendientes(tiendaId: number, productos: { id: number; nombre: string; costo: number; precio_venta: number }[]): (Movimiento & { pendiente: boolean })[] {
    const nombre = (id: number) => productos.find(p => p.id === id);
    const fecha = (iso: string) => new Date(iso).toLocaleString('sv-SE').slice(0, 19);
    const resultado: (Movimiento & { pendiente: boolean })[] = [];
    for (const op of this.pendientes().filter(o => o.tiendaId === tiendaId)) {
      const lineas = op.tipo === 'venta' ? op.items!.map(i => ({ id: i.producto_id, cantidad: i.cantidad, tipo: 'salida' as const }))
        : op.tipo === 'entrada' ? [{ id: op.productoId!, cantidad: op.cantidad!, tipo: 'entrada' as const }] : [];
      for (const l of lineas) {
        const p = nombre(l.id);
        resultado.push({
          id: -resultado.length - 1, producto_id: l.id, producto_nombre: p?.nombre ?? 'Producto', tipo: l.tipo,
          cantidad: l.cantidad, costo_unitario: p?.costo ?? 0, precio_unitario: p?.precio_venta ?? 0,
          fecha: fecha(op.creadaEn), pendiente: true,
        });
      }
    }
    return resultado.reverse();
  }

  // ---------------------------------------------------------------

  private encolar(op: OperacionPendiente): void {
    this.pendientes.set([...this.pendientes(), op]);
    this.storage.setJSON(CLAVE_COLA, this.pendientes());
  }

  private quitarPrimera(): void {
    this.pendientes.set(this.pendientes().slice(1));
    this.storage.setJSON(CLAVE_COLA, this.pendientes());
  }

  /** Cuando un producto creado sin conexión ya existe en el servidor, los cambios siguientes usan su id real. */
  private reemplazarIdTemporal(temporal: number, real: number): void {
    this.pendientes.set(this.pendientes().map(op => ({
      ...op,
      productoId: op.productoId === temporal ? real : op.productoId,
      items: op.items?.map(i => i.producto_id === temporal ? { ...i, producto_id: real } : i),
    })));
    this.storage.setJSON(CLAVE_COLA, this.pendientes());
  }

  private ejecutar(op: OperacionPendiente): Promise<unknown> {
    switch (op.tipo) {
      case 'crearProducto': return this.api.crearProducto(op.tiendaId, op.producto!);
      case 'actualizarProducto': return this.api.actualizarProducto(op.tiendaId, op.productoId!, op.producto!);
      case 'eliminarProducto': return this.api.eliminarProducto(op.tiendaId, op.productoId!);
      case 'venta': return this.api.registrarVenta(op.tiendaId, op.items!);
      case 'entrada': return this.api.registrarEntrada(op.tiendaId, op.productoId!, op.cantidad!);
    }
  }
}
