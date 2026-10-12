import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { mensajeError } from '../shared/network.service';
import { Tienda } from '../models';

@Component({
  selector: 'app-tiendas',
  templateUrl: './tiendas.page.html',
  styleUrls: ['./tiendas.page.scss'],
  standalone: false,
})
export class TiendasPage implements OnInit {

  private usuarioId!: number;

  tiendas: Tienda[] = [];
  cargando = false;
  procesando = false;
  errorMsg = '';
  okMsg = '';

  constructor(
    private router: Router,
    private storage: StorageService,
    private api: ApiService,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    const userRaw = this.storage.get('user');
    if (!this.storage.get('token') || !userRaw) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.usuarioId = JSON.parse(userRaw).id;
    this.cargarTiendas();
  }

  async cargarTiendas() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const { datos, desdeCache } = await this.storage.obtenerConCache('tiendas',
        () => this.api.listarTiendas(this.usuarioId));
      if (desdeCache) {
        this.errorMsg = this.storage.mensajeCache();
      }
      this.tiendas = datos;
    } catch (err) {
      console.error('Error al cargar tiendas:', err);
      this.errorMsg = mensajeError(err, 'No se pudieron cargar tus tiendas');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async crearTienda() {
    const alert = await this.alertCtrl.create({
      header: 'Nueva tienda',
      inputs: [{ name: 'nombre', type: 'text', placeholder: 'Ej. Abarrotes Don Jorge' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Crear', handler: (data) => this.confirmarCrear(data.nombre) },
      ],
    });
    await alert.present();
  }

  private async confirmarCrear(nombre: string) {
    if (!nombre || !nombre.trim()) {
      return;
    }

    this.procesando = true;
    this.errorMsg = '';
    try {
      await this.api.crearTienda(this.usuarioId, nombre.trim());

      this.okMsg = 'Tienda creada correctamente';
      await this.cargarTiendas();
    } catch (err: any) {
      console.error('Error al crear tienda:', err);
      this.errorMsg = mensajeError(err, 'No se pudo crear la tienda');
    } finally {
      this.procesando = false;
      this.cdr.detectChanges();
    }
  }

  async unirseConCodigo() {
    const alert = await this.alertCtrl.create({
      header: 'Unirme a una tienda',
      message: 'Pedile el código de invitación al administrador de la tienda',
      inputs: [{ name: 'codigo', type: 'text', placeholder: 'Ej. KJ32SH' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Unirme', handler: (data) => this.confirmarUnirse(data.codigo) },
      ],
    });
    await alert.present();
  }

  private async confirmarUnirse(codigo: string) {
    if (!codigo || !codigo.trim()) {
      return;
    }

    this.procesando = true;
    this.errorMsg = '';
    this.okMsg = '';
    try {
      const data = await this.api.unirseATienda(this.usuarioId, codigo.trim());

      this.okMsg = data.message ?? '';
      await this.cargarTiendas();
    } catch (err: any) {
      console.error('Error al unirse a tienda:', err);
      this.errorMsg = mensajeError(err, 'No se pudo procesar la solicitud');
    } finally {
      this.procesando = false;
      this.cdr.detectChanges();
    }
  }

  entrar(t: Tienda) {
    if (t.estado !== 'aceptado') {
      return;
    }
    this.storage.set('tienda_id', String(t.id));
    this.storage.set('tienda_nombre', t.nombre);
    this.storage.set('tienda_rol', t.rol);
    this.router.navigateByUrl('/home');
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
