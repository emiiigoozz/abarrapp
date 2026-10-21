import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { HidScannerService } from '../shared/hid-scanner.service';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { SyncService } from '../shared/sync.service';
import { mensajeError } from '../shared/network.service';
import { Producto, ProductoForm } from '../models';

const GUARDADO_LOCAL = 'Guardado en el teléfono: se enviará al servidor cuando vuelva la conexión.';

@Component({
  selector: 'app-productos',
  templateUrl: './productos.page.html',
  styleUrls: ['./productos.page.scss'],
  standalone: false,
})
export class ProductosPage implements OnInit, OnDestroy {

  private tiendaId = 0;

  productos: Producto[] = [];
  /** Lo último que respondió el servidor (o la caché); en pantalla se le suman los cambios pendientes. */
  private base: Producto[] = [];
  cargando = false;
  guardando = false;
  errorMsg = '';
  okMsg = '';

  editandoId: number | null = null;
  nombre = '';
  codigo = '';
  categoria = '';
  costo: number | null = null;
  precio_venta: number | null = null;
  stock: number | null = null;

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
    this.cargarProductos();
    // Al terminar una sincronización se recargan los datos reales del servidor.
    this.syncSub = this.sync.sincronizado$.subscribe(() => this.cargarProductos());

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
      this.cargarProductos();
    }
    this.yaEntro = true;
  }

  ngOnDestroy() {
    this.hidSub?.unsubscribe();
    this.syncSub?.unsubscribe();
  }

  get modoEdicion(): boolean {
    return this.editandoId !== null;
  }

  margen(p: Producto): number {
    return p.precio_venta - p.costo;
  }

  onCodigoEscaneado(codigo: string) {
    this.codigo = codigo;
    this.mostrarScanner = false;
  }

  async cargarProductos() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const { datos, desdeCache } = await this.storage.obtenerConCache('productos',
        () => this.api.listarProductos(this.tiendaId));
      if (desdeCache) {
        this.errorMsg = this.storage.mensajeCache();
      }
      this.base = datos;
      this.refrescarLocal();
    } catch (err) {
      console.error('Error al cargar productos:', err);
      this.errorMsg = mensajeError(err, 'No se pudo cargar la lista de productos');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  editar(p: Producto) {
    this.editandoId = p.id;
    this.nombre = p.nombre;
    this.codigo = p.codigo || '';
    this.categoria = p.categoria || '';
    this.costo = p.costo;
    this.precio_venta = p.precio_venta;
    this.stock = p.stock;
  }

  cancelarEdicion() {
    this.editandoId = null;
    this.nombre = '';
    this.codigo = '';
    this.categoria = '';
    this.costo = null;
    this.precio_venta = null;
    this.stock = null;
  }

  /** Vista local: datos del servidor + cambios hechos sin conexión que aún no se envían. */
  private refrescarLocal() {
    this.productos = this.sync.aplicarAProductos(this.tiendaId, this.base);
  }

  async guardar() {
    this.errorMsg = '';
    this.okMsg = '';

    if (!this.nombre || this.costo === null || this.precio_venta === null || this.stock === null) {
      this.errorMsg = 'Nombre, costo, precio de venta y stock son obligatorios';
      return;
    }

    this.guardando = true;

    const payload: ProductoForm = {
      nombre: this.nombre,
      codigo: this.codigo,
      categoria: this.categoria,
      costo: this.costo,
      precio_venta: this.precio_venta,
      stock: this.stock,
    };

    try {
      const { encolado } = await this.sync.enviarOEncolar(this.modoEdicion
        ? { tipo: 'actualizarProducto', tiendaId: this.tiendaId, productoId: this.editandoId!, producto: payload, descripcion: `Editar "${payload.nombre}"` }
        : { tipo: 'crearProducto', tiendaId: this.tiendaId, productoId: this.sync.idTemporal(), producto: payload, descripcion: `Crear "${payload.nombre}"` });
      this.cancelarEdicion();
      if (encolado) {
        this.okMsg = GUARDADO_LOCAL;
        this.refrescarLocal();
      } else {
        await this.cargarProductos();
      }
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      this.errorMsg = mensajeError(err, 'No se pudo guardar el producto');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  async eliminar(p: Producto) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar producto',
      message: `¿Seguro que querés eliminar "${p.nombre}"? También se borrará su historial de movimientos.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.confirmarEliminar(p.id),
        },
      ],
    });
    await alert.present();
  }

  private async confirmarEliminar(id: number) {
    this.cargando = true;
    this.okMsg = '';
    this.cdr.detectChanges();
    try {
      const nombre = this.productos.find(p => p.id === id)?.nombre ?? '';
      const { encolado } = await this.sync.enviarOEncolar(
        { tipo: 'eliminarProducto', tiendaId: this.tiendaId, productoId: id, descripcion: `Eliminar "${nombre}"` });
      if (this.editandoId === id) {
        this.cancelarEdicion();
      }
      if (encolado) {
        this.okMsg = GUARDADO_LOCAL;
        this.refrescarLocal();
      } else {
        await this.cargarProductos();
      }
    } catch (err) {
      console.error('Error al eliminar producto:', err);
      this.errorMsg = mensajeError(err, 'No se pudo eliminar el producto');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
