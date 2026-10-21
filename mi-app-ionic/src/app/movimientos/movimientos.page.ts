import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { HidScannerService } from '../shared/hid-scanner.service';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { SyncService } from '../shared/sync.service';
import { mensajeError } from '../shared/network.service';
import { ItemCarrito, Movimiento, ProductoVenta, RespuestaVenta } from '../models';

const GUARDADO_LOCAL = 'se guardó en el teléfono y se enviará al servidor cuando vuelva la conexión.';

@Component({
  selector: 'app-movimientos',
  templateUrl: './movimientos.page.html',
  styleUrls: ['./movimientos.page.scss'],
  standalone: false,
})
export class MovimientosPage implements OnInit, OnDestroy {

  private tiendaId = 0;

  modo: 'vender' | 'recibir' = 'vender';

  productos: ProductoVenta[] = [];
  movimientos: Movimiento[] = [];
  // Lo último que respondió el servidor (o la caché); en pantalla se le suman los cambios pendientes.
  private productosBase: ProductoVenta[] = [];
  private movimientosBase: Movimiento[] = [];
  cargando = false;
  errorMsg = '';
  okMsg = '';

  // ---- Punto de venta (carrito) ----
  carrito: ItemCarrito[] = [];
  busqueda = '';
  procesandoVenta = false;

  // ---- Recibir mercancía (entrada simple) ----
  producto_id: number | null = null;
  cantidad: number | null = null;
  guardandoEntrada = false;

  // ---- Alta rápida de producto ----
  mostrarAltaRapida = false;
  nuevoNombre = '';
  nuevoCodigo = '';
  nuevoCosto: number | null = null;
  nuevoPrecio: number | null = null;
  nuevoStock: number | null = null;
  guardandoProducto = false;

  mostrarScanner = false;
  private hidSub?: Subscription;
  private syncSub?: Subscription;
  private yaEntro = false;

  constructor(
    private router: Router,
    private storage: StorageService,
    private api: ApiService,
    private sync: SyncService,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
    private hidScanner: HidScannerService,
  ) { }

  ngOnInit() {
    if (!this.storage.get('token')) {
      this.router.navigateByUrl('/login');
      return;
    }
    // El inventario es por tienda: sin tienda activa no hay nada que mostrar.
    this.tiendaId = Number(this.storage.get('tienda_id'));
    if (!this.tiendaId) {
      this.router.navigateByUrl('/tiendas');
      return;
    }
    // Recupera la venta que estaba en curso si se cerró la app.
    this.carrito = this.storage.getJSON<ItemCarrito[]>('carrito') || [];
    this.cargarTodo();
    // Al terminar una sincronización se recargan los datos reales del servidor.
    this.syncSub = this.sync.sincronizado$.subscribe(() => this.cargarTodo());

    this.hidSub = this.hidScanner.scan$.subscribe(codigo => {
      this.onCodigoEscaneado(codigo);
      this.cdr.detectChanges();
    });
  }

  /**
   * Ionic reutiliza la pantalla al volver a ella (p. ej. desde las pestañas), así que ngOnInit no
   * se repite. Se recarga al reingresar para mostrar lo que cambió en otras pantallas.
   */
  ionViewWillEnter() {
    if (this.yaEntro) {
      this.cargarTodo();
    }
    this.yaEntro = true;
  }

  ngOnDestroy() {
    this.hidSub?.unsubscribe();
    this.syncSub?.unsubscribe();
  }

  ganancia(m: Movimiento): number {
    return m.tipo === 'salida' ? m.cantidad * (m.precio_unitario - m.costo_unitario) : 0;
  }

  get productosFiltrados(): ProductoVenta[] {
    const termino = this.busqueda.trim().toLowerCase();
    if (!termino) {
      return this.productos;
    }
    return this.productos.filter(p =>
      p.nombre.toLowerCase().includes(termino) || (p.codigo || '').includes(termino)
    );
  }

  get totalCarrito(): number {
    return this.carrito.reduce((acc, item) => acc + item.precio_unitario * item.cantidad, 0);
  }

  get unidadesCarrito(): number {
    return this.carrito.reduce((acc, item) => acc + item.cantidad, 0);
  }

  async cargarTodo() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      // Cada lista se carga por separado: si no hay copia guardada de una (p. ej. es la primera
      // vez que se abre esta pantalla sin conexión), la otra igual se muestra.
      const [productosRes, movimientosRes] = await Promise.allSettled([
        this.storage.obtenerConCache('productos', () => this.api.listarProductos(this.tiendaId)),
        this.storage.obtenerConCache('movimientos', () => this.api.listarMovimientos(this.tiendaId)),
      ]);
      if (productosRes.status === 'fulfilled') {
        this.productosBase = productosRes.value.datos;
      }
      if (movimientosRes.status === 'fulfilled') {
        this.movimientosBase = movimientosRes.value.datos;
      }
      this.refrescarLocal();

      const fallo = [productosRes, movimientosRes].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      const usoCache = [productosRes, movimientosRes].some(r => r.status === 'fulfilled' && r.value.desdeCache);
      if (fallo && productosRes.status === 'rejected' && movimientosRes.status === 'rejected') {
        console.error('Error al cargar movimientos:', fallo.reason);
        this.errorMsg = mensajeError(fallo.reason, 'No se pudo cargar la información');
      } else if (fallo || usoCache) {
        this.errorMsg = this.storage.mensajeCache();
      }
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  /** Vista local: datos del servidor + ventas y entradas hechas sin conexión que aún no se envían. */
  private refrescarLocal() {
    this.productos = this.sync.aplicarAProductos(this.tiendaId, this.productosBase);
    this.movimientos = [...this.sync.movimientosPendientes(this.tiendaId, this.productos), ...this.movimientosBase];
  }

  // ==================== CARRITO / VENTA ====================

  agregarAlCarrito(p: ProductoVenta) {
    this.errorMsg = '';
    const linea = this.carrito.find(i => i.producto_id === p.id);
    const enCarrito = linea?.cantidad || 0;

    if (enCarrito + 1 > p.stock) {
      this.errorMsg = `No hay más stock de "${p.nombre}" (disponible: ${p.stock})`;
      return;
    }

    if (linea) {
      linea.cantidad++;
    } else {
      this.carrito.push({
        producto_id: p.id,
        nombre: p.nombre,
        precio_unitario: p.precio_venta,
        cantidad: 1,
        stockDisponible: p.stock,
      });
    }
    this.guardarCarrito();
  }

  cambiarCantidad(item: ItemCarrito, delta: number) {
    const nueva = item.cantidad + delta;
    if (nueva <= 0) {
      this.quitarDelCarrito(item);
      return;
    }
    if (nueva > item.stockDisponible) {
      this.errorMsg = `No hay más stock de "${item.nombre}" (disponible: ${item.stockDisponible})`;
      return;
    }
    item.cantidad = nueva;
    this.guardarCarrito();
  }

  quitarDelCarrito(item: ItemCarrito) {
    this.carrito = this.carrito.filter(i => i !== item);
    this.guardarCarrito();
  }

  cancelarVenta() {
    this.carrito = [];
    this.guardarCarrito();
    this.errorMsg = '';
    this.okMsg = '';
  }

  async terminarVenta() {
    if (this.carrito.length === 0) {
      this.errorMsg = 'El carrito está vacío';
      return;
    }

    this.procesandoVenta = true;
    this.errorMsg = '';
    this.okMsg = '';

    try {
      const total = this.totalCarrito;
      const { encolado, resultado } = await this.sync.enviarOEncolar<RespuestaVenta>({
        tipo: 'venta', tiendaId: this.tiendaId,
        items: this.carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        descripcion: `Venta de ${this.unidadesCarrito} unidades ($${total.toFixed(2)})`,
      });

      this.okMsg = encolado
        ? `Venta de $${total.toFixed(2)}: ${GUARDADO_LOCAL}`
        : `Venta registrada: $${resultado!.total.toFixed(2)}`;
      this.carrito = [];
      this.guardarCarrito();
      if (encolado) {
        this.refrescarLocal();
      } else {
        await this.cargarTodo();
      }
    } catch (err: any) {
      console.error('Error al registrar la venta:', err);
      this.errorMsg = mensajeError(err, 'No se pudo registrar la venta');
    } finally {
      this.procesandoVenta = false;
      this.cdr.detectChanges();
    }
  }

  private guardarCarrito() {
    if (this.carrito.length === 0) {
      this.storage.remove('carrito');
    } else {
      this.storage.setJSON('carrito', this.carrito);
    }
  }

  // ==================== ESCANEO ====================

  onCodigoEscaneado(codigo: string) {
    this.mostrarScanner = false;
    const producto = this.productos.find(p => p.codigo === codigo);

    if (!producto) {
      this.abrirAltaRapida(codigo);
      return;
    }

    this.errorMsg = '';

    if (this.modo === 'vender') {
      this.agregarAlCarrito(producto);
    } else {
      this.producto_id = producto.id;
    }
  }

  // ==================== RECIBIR MERCANCÍA ====================

  async registrarEntrada() {
    this.errorMsg = '';
    this.okMsg = '';

    if (!this.producto_id || !this.cantidad || this.cantidad <= 0) {
      this.errorMsg = 'Elegí un producto y una cantidad válida';
      return;
    }

    this.guardandoEntrada = true;

    try {
      const producto = this.productos.find(p => p.id === this.producto_id);
      const { encolado } = await this.sync.enviarOEncolar({
        tipo: 'entrada', tiendaId: this.tiendaId, productoId: this.producto_id, cantidad: this.cantidad,
        descripcion: `Entrada de ${this.cantidad} × ${producto?.nombre ?? 'producto'}`,
      });

      this.okMsg = encolado ? `Entrada: ${GUARDADO_LOCAL}` : 'Entrada registrada';
      this.cantidad = null;
      if (encolado) {
        this.refrescarLocal();
      } else {
        await this.cargarTodo();
      }
    } catch (err: any) {
      console.error('Error al registrar entrada:', err);
      this.errorMsg = mensajeError(err, 'No se pudo registrar la entrada');
    } finally {
      this.guardandoEntrada = false;
      this.cdr.detectChanges();
    }
  }

  // ==================== ALTA RÁPIDA DE PRODUCTO ====================

  abrirAltaRapida(codigoPrefill = '') {
    this.errorMsg = '';
    this.nuevoNombre = '';
    this.nuevoCodigo = codigoPrefill;
    this.nuevoCosto = null;
    this.nuevoPrecio = null;
    this.nuevoStock = null;
    this.mostrarAltaRapida = true;
  }

  cerrarAltaRapida() {
    this.mostrarAltaRapida = false;
  }

  async guardarProductoRapido() {
    if (!this.nuevoNombre || this.nuevoPrecio === null || this.nuevoStock === null) {
      this.errorMsg = 'Nombre, precio de venta y stock son obligatorios';
      return;
    }

    this.guardandoProducto = true;
    this.errorMsg = '';

    try {
      const idTemporal = this.sync.idTemporal();
      const { encolado, resultado } = await this.sync.enviarOEncolar<number>({
        tipo: 'crearProducto', tiendaId: this.tiendaId, productoId: idTemporal, descripcion: `Crear "${this.nuevoNombre}"`,
        producto: {
          nombre: this.nuevoNombre,
          codigo: this.nuevoCodigo,
          costo: this.nuevoCosto ?? 0,
          precio_venta: this.nuevoPrecio,
          stock: this.nuevoStock,
        },
      });

      this.mostrarAltaRapida = false;
      if (encolado) {
        this.okMsg = `Producto nuevo: ${GUARDADO_LOCAL}`;
        this.refrescarLocal();
      } else {
        await this.cargarTodo();
      }
      const nuevoId = encolado ? idTemporal : resultado!;

      const nuevo = this.productos.find(p => p.id === nuevoId);
      if (nuevo && this.modo === 'vender') {
        this.agregarAlCarrito(nuevo);
      } else if (nuevo) {
        this.producto_id = nuevo.id;
      }
    } catch (err: any) {
      console.error('Error al registrar producto:', err);
      this.errorMsg = mensajeError(err, 'No se pudo registrar el producto');
    } finally {
      this.guardandoProducto = false;
      this.cdr.detectChanges();
    }
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
