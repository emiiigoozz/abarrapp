import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { HidScannerService } from '../shared/hid-scanner.service';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { mensajeError } from '../shared/network.service';
import { Producto, ProductoForm } from '../models';

@Component({
  selector: 'app-productos',
  templateUrl: './productos.page.html',
  styleUrls: ['./productos.page.scss'],
  standalone: false,
})
export class ProductosPage implements OnInit, OnDestroy {

  private tiendaId = 0;

  productos: Producto[] = [];
  cargando = false;
  guardando = false;
  errorMsg = '';

  editandoId: number | null = null;
  nombre = '';
  codigo = '';
  categoria = '';
  costo: number | null = null;
  precio_venta: number | null = null;
  stock: number | null = null;

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
    this.cargarProductos();

    this.hidSub = this.hidScanner.scan$.subscribe(codigo => {
      this.onCodigoEscaneado(codigo);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.hidSub?.unsubscribe();
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
      this.productos = datos;
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

  async guardar() {
    this.errorMsg = '';

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
      if (this.modoEdicion) {
        await this.api.actualizarProducto(this.tiendaId, this.editandoId!, payload);
      } else {
        await this.api.crearProducto(this.tiendaId, payload);
      }
      this.cancelarEdicion();
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
    this.cdr.detectChanges();
    try {
      await this.api.eliminarProducto(this.tiendaId, id);
      if (this.editandoId === id) {
        this.cancelarEdicion();
      }
      await this.cargarProductos();
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
