import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import axios from 'axios';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { HidScannerService } from '../shared/hid-scanner.service';
import { StorageService } from '../shared/storage.service';
import { mensajeError } from '../shared/network.service';
import { ItemCarrito, Movimiento, ProductoVenta } from '../models';

@Component({
  selector: 'app-movimientos',
  templateUrl: './movimientos.page.html',
  styleUrls: ['./movimientos.page.scss'],
  standalone: false,
})
export class MovimientosPage implements OnInit, OnDestroy {

  private productosUrl = `${environment.apiUrl}/productos.php`;
  private movimientosUrl = `${environment.apiUrl}/movimientos.php`;
  private ventaUrl = `${environment.apiUrl}/venta.php`;
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
        this.storage.obtenerConCache('productos',
          () => axios.get(this.productosUrl, { params: { tienda_id: this.tiendaId }, timeout: 10000 }).then(r => r.data.data as any[])),
        this.storage.obtenerConCache('movimientos',
          () => axios.get(this.movimientosUrl, { params: { tienda_id: this.tiendaId }, timeout: 10000 }).then(r => r.data.data as any[])),
      ]);
      if (productosRes.desdeCache || movimientosRes.desdeCache) {
        this.errorMsg = this.storage.mensajeCache();
      }

      this.productos = productosRes.datos.map(p => ({
        id: Number(p.id),
        nombre: p.nombre,
        codigo: p.codigo,
        costo: Number(p.costo),
        precio_venta: Number(p.precio_venta),
        stock: Number(p.stock),
      }));

      this.movimientos = movimientosRes.datos.map(m => ({
        ...m,
        id: Number(m.id),
        producto_id: Number(m.producto_id),
        cantidad: Number(m.cantidad),
        costo_unitario: Number(m.costo_unitario),
        precio_unitario: Number(m.precio_unitario),
      }));
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
      const { data } = await axios.post(this.ventaUrl, {
        tienda_id: this.tiendaId,
        items: this.carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
      }, { timeout: 10000 });

      this.okMsg = `Venta registrada: $${Number(data.total).toFixed(2)}`;
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
      await axios.post(this.movimientosUrl, {
        tienda_id: this.tiendaId,
        producto_id: this.producto_id,
        tipo: 'entrada',
        cantidad: this.cantidad,
      }, { timeout: 10000 });

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
      const { data } = await axios.post(this.productosUrl, {
        tienda_id: this.tiendaId,
        nombre: this.nuevoNombre,
        codigo: this.nuevoCodigo,
        costo: this.nuevoCosto ?? 0,
        precio_venta: this.nuevoPrecio,
        stock: this.nuevoStock,
      }, { timeout: 10000 });

      this.mostrarAltaRapida = false;
      await this.cargarTodo();

      const nuevo = this.productos.find(p => p.id === Number(data.id));
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
