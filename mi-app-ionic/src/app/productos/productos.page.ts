import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { HidScannerService } from '../shared/hid-scanner.service';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { SyncService } from '../shared/sync.service';
import { mensajeError, NetworkService } from '../shared/network.service';
import { FotoService, OrigenFoto } from '../shared/foto.service';
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

  // ---- Foto del formulario ----
  /** Foto que ya tenía el producto que se está editando (URL). */
  private fotoActual: string | null = null;
  /** Foto nueva tomada o elegida, en base64; se sube al guardar. */
  private fotoNueva: string | null = null;
  private quitarFotoAlGuardar = false;

  // ---- Visor de fotos ----
  visor: Producto | null = null;
  zoom = false;
  subiendoFoto = false;

  mostrarScanner = false;
  private hidSub?: Subscription;
  private syncSub?: Subscription;
  private redSub?: Subscription;
  private yaEntro = false;

  constructor(
    private router: Router,
    private storage: StorageService,
    private api: ApiService,
    private sync: SyncService,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private fotos: FotoService,
    private network: NetworkService,
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
    // Los botones de foto dependen de la conexión: se redibuja al cambiar (la app es zoneless).
    this.redSub = this.network.online$.subscribe(() => this.cdr.detectChanges());

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
    this.redSub?.unsubscribe();
  }

  get modoEdicion(): boolean {
    return this.editandoId !== null;
  }

  /** Las fotos se guardan en el servidor, así que necesitan conexión. */
  get online(): boolean {
    return this.network.online;
  }

  /** Lo que se ve en el formulario: la foto nueva, o la que ya tenía (si no se pidió quitarla). */
  get vistaPrevia(): string | null {
    if (this.fotoNueva) return `data:image/jpeg;base64,${this.fotoNueva}`;
    return this.quitarFotoAlGuardar ? null : this.fotoActual;
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
    this.fotoActual = p.foto ?? null;
    this.fotoNueva = null;
    this.quitarFotoAlGuardar = false;
  }

  cancelarEdicion() {
    this.editandoId = null;
    this.nombre = '';
    this.codigo = '';
    this.categoria = '';
    this.costo = null;
    this.precio_venta = null;
    this.stock = null;
    this.fotoActual = null;
    this.fotoNueva = null;
    this.quitarFotoAlGuardar = false;
  }

  // ==================== FOTOS ====================

  /** Abre la cámara o la galería; devuelve la imagen en base64 o null si se canceló. */
  private async obtenerFoto(origen: OrigenFoto): Promise<string | null> {
    try {
      return await this.fotos.obtener(origen);
    } catch (err) {
      console.error('Error al obtener la foto:', err);
      this.errorMsg = this.fotos.mensajeError(err);
      this.cdr.detectChanges();
      return null;
    }
  }

  async fotoFormulario(origen: OrigenFoto) {
    this.errorMsg = '';
    const base64 = await this.obtenerFoto(origen);
    if (base64) {
      this.fotoNueva = base64;
      this.quitarFotoAlGuardar = false;
    }
    this.cdr.detectChanges();
  }

  quitarFotoFormulario() {
    this.fotoNueva = null;
    this.quitarFotoAlGuardar = true;
  }

  abrirVisor(p: Producto) {
    this.visor = p;
    this.zoom = false;
  }

  cerrarVisor() {
    this.visor = null;
  }

  /** Desde el visor: elegir cómo obtener la foto nueva y subirla al instante. */
  async cambiarFotoVisor() {
    const hoja = await this.actionSheetCtrl.create({
      header: 'Foto del producto',
      buttons: [
        { text: 'Tomar foto', icon: 'camera-outline', data: 'camara' },
        { text: 'Elegir de la galería', icon: 'images-outline', data: 'galeria' },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await hoja.present();
    const { data } = await hoja.onDidDismiss<OrigenFoto>();
    if (!data || !this.visor) return;

    const base64 = await this.obtenerFoto(data);
    if (!base64) return;
    const producto = this.visor;
    this.subiendoFoto = true;
    this.cdr.detectChanges();
    try {
      producto.foto = await this.api.subirFoto(this.tiendaId, producto.id, base64);
      this.okMsg = `Foto de "${producto.nombre}" guardada`;
      await this.cargarProductos();
      this.visor = this.productos.find(p => p.id === producto.id) ?? producto;
    } catch (err) {
      console.error('Error al subir la foto:', err);
      this.errorMsg = mensajeError(err, 'No se pudo subir la foto');
    } finally {
      this.subiendoFoto = false;
      this.cdr.detectChanges();
    }
  }

  async quitarFotoVisor() {
    const producto = this.visor;
    if (!producto) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitar foto',
      message: `¿Quitar la foto de "${producto.nombre}"?`,
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Quitar', role: 'destructive' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'destructive') return;

    this.subiendoFoto = true;
    this.cdr.detectChanges();
    try {
      await this.api.quitarFoto(this.tiendaId, producto.id);
      producto.foto = null;
      await this.cargarProductos();
      this.visor = this.productos.find(p => p.id === producto.id) ?? producto;
    } catch (err) {
      console.error('Error al quitar la foto:', err);
      this.errorMsg = mensajeError(err, 'No se pudo quitar la foto');
    } finally {
      this.subiendoFoto = false;
      this.cdr.detectChanges();
    }
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

    const editandoId = this.editandoId;
    const fotoNueva = this.fotoNueva;
    const quitarFoto = this.quitarFotoAlGuardar && !!this.fotoActual;

    try {
      const { encolado, resultado } = await this.sync.enviarOEncolar<number>(editandoId !== null
        ? { tipo: 'actualizarProducto', tiendaId: this.tiendaId, productoId: editandoId, producto: payload, descripcion: `Editar "${payload.nombre}"` }
        : { tipo: 'crearProducto', tiendaId: this.tiendaId, productoId: this.sync.idTemporal(), producto: payload, descripcion: `Crear "${payload.nombre}"` });
      this.cancelarEdicion();
      if (encolado) {
        this.okMsg = GUARDADO_LOCAL + (fotoNueva || quitarFoto ? ' La foto no se guardó: necesita conexión.' : '');
        this.refrescarLocal();
        return;
      }
      // La foto se sube después de guardar el producto (al crear, hasta entonces no hay id).
      const productoId = editandoId ?? resultado!;
      try {
        if (fotoNueva) {
          await this.api.subirFoto(this.tiendaId, productoId, fotoNueva);
        } else if (quitarFoto) {
          await this.api.quitarFoto(this.tiendaId, productoId);
        }
      } catch (err) {
        console.error('Error al guardar la foto:', err);
        this.errorMsg = mensajeError(err, 'El producto se guardó, pero la foto no se pudo subir');
      }
      await this.cargarProductos();
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
