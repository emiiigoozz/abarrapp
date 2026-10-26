import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import {
  CambiosMiembro, Dashboard, ItemVenta, Miembro, Movimiento, Producto, ProductoForm,
  RespuestaApi, RespuestaSesion, RespuestaVenta, Tienda, Usuario, UsuarioForm,
} from '../models';

/**
 * Único punto de acceso a la API REST en PHP.
 *
 * - La URL base y el tiempo límite se configuran aquí, no en cada página.
 * - Cada método corresponde a un endpoint y devuelve datos ya tipados.
 * - PDO devuelve los números como texto ("12.00"); aquí se convierten a number
 *   para que las páginas trabajen con el modelo de datos tal cual.
 * - Los errores de red o HTTP se propagan como errores de axios; las páginas
 *   los traducen a un mensaje con mensajeError().
 */
@Injectable({ providedIn: 'root' })
export class ApiService {

  private readonly http = axios.create({
    baseURL: environment.apiUrl,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  // ==================== Autenticación ====================

  async login(email: string, password: string): Promise<RespuestaSesion> {
    const { data } = await this.http.post<RespuestaSesion>('/login.php', { email, password });
    return data;
  }

  async registrar(nombre: string, email: string, password: string): Promise<RespuestaSesion> {
    const { data } = await this.http.post<RespuestaSesion>('/register.php', { nombre, email, password });
    return data;
  }

  // ==================== Tiendas y miembros ====================

  async listarTiendas(usuarioId: number): Promise<Tienda[]> {
    const { data } = await this.http.get<RespuestaApi<any[]>>('/tiendas.php', { params: { usuario_id: usuarioId } });
    return (data.data ?? []).map(t => ({ ...t, id: Number(t.id), dueno_id: Number(t.dueno_id) }));
  }

  async crearTienda(usuarioId: number, nombre: string): Promise<RespuestaApi> {
    const { data } = await this.http.post<RespuestaApi>('/tiendas.php', { accion: 'crear', usuario_id: usuarioId, nombre });
    return data;
  }

  async unirseATienda(usuarioId: number, codigoInvitacion: string): Promise<RespuestaApi> {
    const { data } = await this.http.post<RespuestaApi>('/tiendas.php', {
      accion: 'unirse', usuario_id: usuarioId, codigo_invitacion: codigoInvitacion,
    });
    return data;
  }

  async listarMiembros(tiendaId: number, usuarioId: number): Promise<Miembro[]> {
    const { data } = await this.http.get<RespuestaApi<any[]>>('/miembros.php', {
      params: { tienda_id: tiendaId, usuario_id: usuarioId },
    });
    return (data.data ?? []).map(m => ({ ...m, id: Number(m.id), usuario_id: Number(m.usuario_id) }));
  }

  async actualizarMiembro(id: number, usuarioId: number, cambios: CambiosMiembro): Promise<void> {
    await this.http.put('/miembros.php', { usuario_id: usuarioId, ...cambios }, { params: { id } });
  }

  async eliminarMiembro(id: number, usuarioId: number): Promise<void> {
    await this.http.delete('/miembros.php', { params: { id, usuario_id: usuarioId } });
  }

  // ==================== Productos (por tienda) ====================

  async listarProductos(tiendaId: number): Promise<Producto[]> {
    const { data } = await this.http.get<RespuestaApi<any[]>>('/productos.php', { params: { tienda_id: tiendaId } });
    return (data.data ?? []).map(p => ({
      ...p,
      id: Number(p.id),
      tienda_id: Number(p.tienda_id),
      foto: this.urlFoto(p.foto),
      costo: Number(p.costo),
      precio_venta: Number(p.precio_venta),
      stock: Number(p.stock),
    }));
  }

  /** Crea un producto y devuelve su id. */
  async crearProducto(tiendaId: number, producto: ProductoForm): Promise<number> {
    const { data } = await this.http.post<RespuestaApi & { id: number }>('/productos.php', { tienda_id: tiendaId, ...producto });
    return Number(data.id);
  }

  async actualizarProducto(tiendaId: number, id: number, producto: ProductoForm): Promise<void> {
    await this.http.put('/productos.php', { tienda_id: tiendaId, ...producto }, { params: { id } });
  }

  async eliminarProducto(tiendaId: number, id: number): Promise<void> {
    await this.http.delete('/productos.php', { params: { id, tienda_id: tiendaId } });
  }

  // ==================== Fotos de productos ====================

  /** Sube (o reemplaza) la foto de un producto. Recibe la imagen en base64 y devuelve su URL. */
  async subirFoto(tiendaId: number, productoId: number, base64: string): Promise<string> {
    const { data } = await this.http.post<RespuestaApi & { foto: string }>('/foto.php',
      { tienda_id: tiendaId, producto_id: productoId, imagen: base64 }, { timeout: 30000 });
    return this.urlFoto(data.foto)!;
  }

  async quitarFoto(tiendaId: number, productoId: number): Promise<void> {
    await this.http.delete('/foto.php', { params: { producto_id: productoId, tienda_id: tiendaId } });
  }

  /** La API guarda la ruta relativa (uploads/productos/…); la app usa la URL completa. */
  private urlFoto(ruta: string | null | undefined): string | null {
    return ruta ? `${environment.apiUrl}/${ruta}` : null;
  }

  // ==================== Movimientos y ventas ====================

  async listarMovimientos(tiendaId: number): Promise<Movimiento[]> {
    const { data } = await this.http.get<RespuestaApi<any[]>>('/movimientos.php', { params: { tienda_id: tiendaId } });
    return (data.data ?? []).map(m => ({
      ...m,
      id: Number(m.id),
      producto_id: Number(m.producto_id),
      cantidad: Number(m.cantidad),
      costo_unitario: Number(m.costo_unitario),
      precio_unitario: Number(m.precio_unitario),
    }));
  }

  /** Recepción de mercancía: suma stock a un producto. */
  async registrarEntrada(tiendaId: number, productoId: number, cantidad: number): Promise<void> {
    await this.http.post('/movimientos.php', { tienda_id: tiendaId, producto_id: productoId, tipo: 'entrada', cantidad });
  }

  /** Registra todas las líneas del carrito en una sola transacción. */
  async registrarVenta(tiendaId: number, items: ItemVenta[]): Promise<RespuestaVenta> {
    const { data } = await this.http.post<RespuestaVenta>('/venta.php', { tienda_id: tiendaId, items });
    return { ...data, total: Number(data.total), ganancia: Number(data.ganancia) };
  }

  // ==================== Dashboard ====================

  async obtenerDashboard(tiendaId: number): Promise<Dashboard> {
    const { data } = await this.http.get<RespuestaApi<any>>('/dashboard.php', { params: { tienda_id: tiendaId } });
    const d = data.data;
    return {
      resumen: {
        ingresos: Number(d.resumen.ingresos),
        costos: Number(d.resumen.costos),
        ganancia: Number(d.resumen.ganancia),
        unidades: Number(d.resumen.unidades),
      },
      ganancias_por_dia: (d.ganancias_por_dia as any[]).map(g => ({ dia: g.dia, ganancia: Number(g.ganancia) })),
      top_productos: (d.top_productos as any[]).map(p => ({
        id: Number(p.id), nombre: p.nombre, unidades_vendidas: Number(p.unidades_vendidas), ganancia: Number(p.ganancia),
      })),
      stock_bajo: (d.stock_bajo as any[]).map(s => ({ id: Number(s.id), nombre: s.nombre, stock: Number(s.stock) })),
      productos_con_perdida: (d.productos_con_perdida as any[]).map(p => ({
        id: Number(p.id), nombre: p.nombre, costo: Number(p.costo), precio_venta: Number(p.precio_venta),
      })),
    };
  }

  // ==================== Usuarios del sistema ====================

  async listarUsuarios(): Promise<Usuario[]> {
    const { data } = await this.http.get<RespuestaApi<any[]>>('/usuarios.php');
    return (data.data ?? []).map(u => ({ ...u, id: Number(u.id), estado: Number(u.estado) }));
  }

  async crearUsuario(usuario: UsuarioForm): Promise<void> {
    await this.http.post('/usuarios.php', usuario);
  }

  async actualizarUsuario(id: number, usuario: UsuarioForm): Promise<void> {
    await this.http.put('/usuarios.php', usuario, { params: { id } });
  }

  async eliminarUsuario(id: number): Promise<void> {
    await this.http.delete('/usuarios.php', { params: { id } });
  }
}
