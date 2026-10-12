import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { HidScannerService } from '../shared/hid-scanner.service';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { mensajeError } from '../shared/network.service';
import { ItemCarrito, Movimiento, ProductoVenta } from '../models';

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

  constructor(
    private router: Router,
    private storage: StorageService,
    private api: ApiService,
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

    this.hidSub = this.hidScanner.scan$.subscribe(codigo => {
      this.onCodigoEscaneado(codigo);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.hidSub?.unsubscribe();
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
      const [productosRes, movimientosRes] = await Promise.all([
        this.storage.obtenerConCache('productos', () => this.api.listarProductos(this.tiendaId)),
        this.storage.obtenerConCache('movimientos', () => this.api.listarMovimientos(this.tiendaId)),
      ]);
      if (productosRes.desdeCache || movimientosRes.desdeCache) {
        this.errorMsg = this.storage.mensajeCache();
      }

      this.productos = productosRes.datos;
      this.movimientos = movimientosRes.datos;
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
      this.errorMsg = mensajeError(err, 'No se pudo cargar la información');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
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
      const venta = await this.api.registrarVenta(this.tiendaId,
        this.carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })));

      this.okMsg = `Venta registrada: $${venta.total.toFixed(2)}`;
      this.carrito = [];
      this.guardarCarrito();
      await this.cargarTodo();
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
      await this.api.registrarEntrada(this.tiendaId, this.producto_id, this.cantidad);

      this.okMsg = 'Entrada registrada';
      this.cantidad = null;
      await this.cargarTodo();
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
      const nuevoId = await this.api.crearProducto(this.tiendaId, {
        nombre: this.nuevoNombre,
        codigo: this.nuevoCodigo,
        costo: this.nuevoCosto ?? 0,
        precio_venta: this.nuevoPrecio,
        stock: this.nuevoStock,
      });

      this.mostrarAltaRapida = false;
      await this.cargarTodo();

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
