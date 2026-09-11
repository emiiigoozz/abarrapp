import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../environments/environment';

interface Producto {
  id: number;
  nombre: string;
  stock: number;
}

interface Movimiento {
  id: number;
  producto_id: number;
  producto_nombre: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  fecha: string;
}

@Component({
  selector: 'app-movimientos',
  templateUrl: './movimientos.page.html',
  styleUrls: ['./movimientos.page.scss'],
  standalone: false,
})
export class MovimientosPage implements OnInit {

  private productosUrl = `${environment.apiUrl}/productos.php`;
  private movimientosUrl = `${environment.apiUrl}/movimientos.php`;

  productos: Producto[] = [];
  movimientos: Movimiento[] = [];
  cargando = false;
  guardando = false;
  errorMsg = '';
  okMsg = '';

  producto_id: number | null = null;
  tipo: 'entrada' | 'salida' = 'salida';
  cantidad: number | null = null;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    if (!localStorage.getItem('token')) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.cargarTodo();
  }

  ganancia(m: Movimiento): number {
    return m.tipo === 'salida' ? m.cantidad * (m.precio_unitario - m.costo_unitario) : 0;
  }

  async cargarTodo() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const [productosRes, movimientosRes] = await Promise.all([
        axios.get(this.productosUrl, { timeout: 10000 }),
        axios.get(this.movimientosUrl, { timeout: 10000 }),
      ]);

      this.productos = (productosRes.data.data as any[]).map(p => ({
        id: Number(p.id),
        nombre: p.nombre,
        stock: Number(p.stock),
      }));

      this.movimientos = (movimientosRes.data.data as any[]).map(m => ({
        ...m,
        id: Number(m.id),
        producto_id: Number(m.producto_id),
        cantidad: Number(m.cantidad),
        costo_unitario: Number(m.costo_unitario),
        precio_unitario: Number(m.precio_unitario),
      }));
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
      this.errorMsg = 'No se pudo cargar la información';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async registrar() {
    this.errorMsg = '';
    this.okMsg = '';

    if (!this.producto_id || !this.cantidad || this.cantidad <= 0) {
      this.errorMsg = 'Elegí un producto y una cantidad válida';
      return;
    }

    this.guardando = true;

    try {
      await axios.post(this.movimientosUrl, {
        producto_id: this.producto_id,
        tipo: this.tipo,
        cantidad: this.cantidad,
      }, { timeout: 10000 });

      this.okMsg = this.tipo === 'salida' ? 'Venta registrada' : 'Entrada registrada';
      this.cantidad = null;
      await this.cargarTodo();
    } catch (err: any) {
      console.error('Error al registrar movimiento:', err);
      this.errorMsg = err?.response?.data?.message || 'No se pudo registrar el movimiento';
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigateByUrl('/login');
  }

}
