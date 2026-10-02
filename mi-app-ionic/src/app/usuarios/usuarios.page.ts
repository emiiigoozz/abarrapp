import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { StorageService } from '../shared/storage.service';
import { mensajeError } from '../shared/network.service';
import { Usuario } from '../models';

@Component({
  selector: 'app-usuarios',
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
  standalone: false,
})
export class UsuariosPage implements OnInit {

  private apiUrl = `${environment.apiUrl}/usuarios.php`;

  usuarios: Usuario[] = [];
  cargando = false;
  guardando = false;
  errorMsg = '';

  editandoId: number | null = null;
  nombre = '';
  usuario = '';
  email = '';
  password = '';
  rol = 'usuario';
  estado = 1;

  constructor(
    private router: Router,
    private storage: StorageService,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    if (!this.storage.get('token')) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.cargarUsuarios();
  }

  get modoEdicion(): boolean {
    return this.editandoId !== null;
  }

  async cargarUsuarios() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const { data } = await axios.get(this.apiUrl, { timeout: 10000 });
      // MySQL/PDO devuelve id y estado como strings; los normalizamos a número.
      this.usuarios = (data.data as any[]).map(u => ({
        ...u,
        id: Number(u.id),
        estado: Number(u.estado),
      }));
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      this.errorMsg = mensajeError(err, 'No se pudo cargar la lista de usuarios');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  editar(u: Usuario) {
    this.editandoId = u.id;
    this.nombre = u.nombre;
    this.usuario = u.usuario || '';
    this.email = u.email;
    this.password = '';
    this.rol = u.rol;
    this.estado = u.estado;
  }

  cancelarEdicion() {
    this.editandoId = null;
    this.nombre = '';
    this.usuario = '';
    this.email = '';
    this.password = '';
    this.rol = 'usuario';
    this.estado = 1;
  }

  async guardar() {
    this.errorMsg = '';

    if (!this.nombre || !this.usuario || !this.email) {
      this.errorMsg = 'Nombre, usuario y email son obligatorios';
      return;
    }

    if (!this.modoEdicion && !this.password) {
      this.errorMsg = 'La contraseña es obligatoria para crear un usuario';
      return;
    }

    this.guardando = true;

    const payload: any = {
      nombre: this.nombre,
      usuario: this.usuario,
      email: this.email,
      rol: this.rol,
      estado: this.estado,
    };
    if (this.password) {
      payload.password = this.password;
    }

    try {
      if (this.modoEdicion) {
        await axios.put(`${this.apiUrl}?id=${this.editandoId}`, payload, { timeout: 10000 });
      } else {
        await axios.post(this.apiUrl, payload, { timeout: 10000 });
      }
      this.cancelarEdicion();
      await this.cargarUsuarios();
    } catch (err: any) {
      console.error('Error al guardar usuario:', err);
      this.errorMsg = mensajeError(err, 'No se pudo guardar el usuario');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  async eliminar(u: Usuario) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar usuario',
      message: `¿Seguro que querés eliminar a "${u.nombre}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.confirmarEliminar(u.id),
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
      await this.cargarUsuarios();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      this.errorMsg = mensajeError(err, 'No se pudo eliminar el usuario');
    } finally {
      this.cdr.detectChanges();
    }
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
