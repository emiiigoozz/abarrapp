import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import axios from 'axios';
import { environment } from '../../environments/environment';

interface Producto {
  id: number;
  nombre: string;
  codigo: string | null;
  categoria: string | null;
  costo: number;
  precio_venta: number;
  stock: number;
  creado_en: string;
}

@Component({
  selector: 'app-productos',
  templateUrl: './productos.page.html',
  styleUrls: ['./productos.page.scss'],
  standalone: false,
})
export class ProductosPage implements OnInit {

  private apiUrl = `${environment.apiUrl}/productos.php`;

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

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    if (!localStorage.getItem('token')) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.cargarProductos();
  }

  get modoEdicion(): boolean {
    return this.editandoId !== null;
  }

  margen(p: Producto): number {
    return p.precio_venta - p.costo;
  }

  async cargarProductos() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const { data } = await axios.get(this.apiUrl, { timeout: 10000 });
      this.productos = (data.data as any[]).map(p => ({
        ...p,
        id: Number(p.id),
        costo: Number(p.costo),
        precio_venta: Number(p.precio_venta),
        stock: Number(p.stock),
      }));
    } catch (err) {
      console.error('Error al cargar productos:', err);
      this.errorMsg = 'No se pudo cargar la lista de productos';
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

    const payload = {
      nombre: this.nombre,
      codigo: this.codigo,
      categoria: this.categoria,
      costo: this.costo,
      precio_venta: this.precio_venta,
      stock: this.stock,
    };

    try {
      if (this.modoEdicion) {
        await axios.put(`${this.apiUrl}?id=${this.editandoId}`, payload, { timeout: 10000 });
      } else {
        await axios.post(this.apiUrl, payload, { timeout: 10000 });
      }
      this.cancelarEdicion();
      await this.cargarProductos();
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      this.errorMsg = err?.response?.data?.message || 'No se pudo guardar el producto';
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
    try {
      await axios.delete(`${this.apiUrl}?id=${id}`, { timeout: 10000 });
      if (this.editandoId === id) {
        this.cancelarEdicion();
      }
      await this.cargarProductos();
    } catch (err) {
      console.error('Error al eliminar producto:', err);
      this.errorMsg = 'No se pudo eliminar el producto';
    } finally {
      this.cdr.detectChanges();
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigateByUrl('/login');
  }

}
