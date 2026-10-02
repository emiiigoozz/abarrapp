import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { StorageService } from '../shared/storage.service';
import { mensajeError } from '../shared/network.service';
import { Miembro } from '../models';

@Component({
  selector: 'app-miembros',
  templateUrl: './miembros.page.html',
  styleUrls: ['./miembros.page.scss'],
  standalone: false,
})
export class MiembrosPage implements OnInit {

  private apiUrl = `${environment.apiUrl}/miembros.php`;
  private usuarioId!: number;
  private tiendaId!: number;

  tiendaNombre = '';
  miembros: Miembro[] = [];
  cargando = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private storage: StorageService,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    const userRaw = this.storage.get('user');
    const tiendaId = this.storage.get('tienda_id');
    const rol = this.storage.get('tienda_rol');

    if (!this.storage.get('token') || !userRaw || !tiendaId) {
      this.router.navigateByUrl('/login');
      return;
    }

    if (rol !== 'admin') {
      this.router.navigateByUrl('/home');
      return;
    }

    this.usuarioId = JSON.parse(userRaw).id;
    this.tiendaId = Number(tiendaId);
    this.tiendaNombre = this.storage.get('tienda_nombre') || '';
    this.cargarMiembros();
  }

  async cargarMiembros() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const { data } = await axios.get(this.apiUrl, {
        params: { tienda_id: this.tiendaId, usuario_id: this.usuarioId },
        timeout: 10000,
      });
      this.miembros = (data.data as any[]).map(m => ({
        ...m,
        id: Number(m.id),
        usuario_id: Number(m.usuario_id),
      }));
    } catch (err) {
      console.error('Error al cargar miembros:', err);
      this.errorMsg = mensajeError(err, 'No se pudieron cargar los miembros');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async aprobar(m: Miembro) {
    await this.actualizar(m.id, { estado: 'aceptado' });
  }

  async cambiarRol(m: Miembro, rol: string) {
    await this.actualizar(m.id, { rol });
  }

  private async actualizar(id: number, cambios: { rol?: string; estado?: string }) {
    this.errorMsg = '';
    try {
      await axios.put(`${this.apiUrl}?id=${id}`, {
        usuario_id: this.usuarioId,
        ...cambios,
      }, { timeout: 10000 });
      await this.cargarMiembros();
    } catch (err: any) {
      console.error('Error al actualizar miembro:', err);
      this.errorMsg = mensajeError(err, 'No se pudo actualizar el miembro');
      this.cdr.detectChanges();
    }
  }

  async eliminar(m: Miembro) {
    const alert = await this.alertCtrl.create({
      header: 'Quitar miembro',
      message: `¿Seguro que querés quitar a "${m.nombre}" de la tienda?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: async () => {
            try {
              await axios.delete(`${this.apiUrl}?id=${m.id}&usuario_id=${this.usuarioId}`, { timeout: 10000 });
              await this.cargarMiembros();
            } catch (err: any) {
              console.error('Error al eliminar miembro:', err);
              this.errorMsg = mensajeError(err, 'No se pudo quitar al miembro');
              this.cdr.detectChanges();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
