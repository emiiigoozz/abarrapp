import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { mensajeError, NetworkService } from '../shared/network.service';
import { ErrorUbicacion, GeoService, RADIO_TIENDA_M, TipoErrorUbicacion, Ubicacion } from '../shared/geo.service';
import { Tienda } from '../models';
import { ContextoService } from '../shared/contexto.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {

  tiendaNombre = '';
  tiendaRol = '';
  private tiendaId = 0;
  private usuarioId = 0;

  // ---- Geolocalización ----
  /** Tienda activa con su ubicación registrada (si la tiene). */
  tienda: Tienda | null = null;
  ubicacion: Ubicacion | null = null;
  buscandoUbicacion = false;
  guardandoUbicacion = false;
  errorUbicacion = '';
  tipoErrorUbicacion: TipoErrorUbicacion | null = null;
  okUbicacion = '';
  readonly radioTienda = RADIO_TIENDA_M;

  constructor(
    private router: Router,
    private storage: StorageService,
    private api: ApiService,
    private geo: GeoService,
    private network: NetworkService,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
    private contexto: ContextoService,
  ) { }

  ngOnInit() { }

  /**
   * Ionic reutiliza esta pantalla al volver a /home (por ejemplo, después de cerrar sesión y entrar
   * con otro usuario, o de cambiar de tienda), así que la sesión se lee cada vez que se entra y no
   * solo la primera (si no, el menú mostraba los botones del rol anterior).
   */
  ionViewWillEnter() {
    const tiendaId = this.storage.get('tienda_id');
    if (!tiendaId) {
      this.router.navigateByUrl('/tiendas');
      return;
    }
    if (Number(tiendaId) !== this.tiendaId) {
      // Otra tienda: la ubicación y los mensajes de la anterior ya no aplican.
      this.tienda = null;
      this.ubicacion = null;
      this.errorUbicacion = '';
      this.okUbicacion = '';
    }
    this.tiendaId = Number(tiendaId);
    this.usuarioId = this.storage.getJSON<{ id: number }>('user')?.id ?? 0;
    this.tiendaNombre = this.storage.get('tienda_nombre') || '';
    this.tiendaRol = this.storage.get('tienda_rol') || '';
    this.contexto.refrescarSesion();
    this.cdr.detectChanges();
    this.cargarTienda();
  }

  get esAdmin(): boolean {
    return this.tiendaRol === 'admin';
  }

  get esTrabajadorOAdmin(): boolean {
    return this.tiendaRol === 'admin' || this.tiendaRol === 'trabajador';
  }

  // ==================== GEOLOCALIZACIÓN ====================

  get tieneUbicacionTienda(): boolean {
    return this.tienda?.latitud != null && this.tienda?.longitud != null;
  }

  /** Distancia en metros entre el usuario y la tienda, o null si falta alguna de las dos ubicaciones. */
  get distancia(): number | null {
    if (!this.ubicacion || !this.tieneUbicacionTienda) return null;
    return this.geo.distanciaMetros(this.ubicacion.latitud, this.ubicacion.longitud, this.tienda!.latitud!, this.tienda!.longitud!);
  }

  get distanciaTexto(): string {
    return this.distancia === null ? '' : this.geo.formatoDistancia(this.distancia);
  }

  get enTienda(): boolean {
    return this.distancia !== null && this.distancia <= RADIO_TIENDA_M;
  }

  /** Trae la ubicación registrada de la tienda (de la API o de la copia guardada). */
  private async cargarTienda() {
    try {
      const { datos } = await this.storage.obtenerConCache('tiendas', () => this.api.listarTiendas(this.usuarioId));
      this.tienda = datos.find(t => t.id === this.tiendaId) ?? null;
    } catch (err) {
      console.error('No se pudo cargar la ubicación de la tienda:', err);
    }
    this.cdr.detectChanges();
  }

  async obtenerUbicacion() {
    this.errorUbicacion = '';
    this.tipoErrorUbicacion = null;
    this.okUbicacion = '';

    // Si el usuario ya rechazó el permiso una vez, Android recomienda explicar para qué se usa antes de volver a pedirlo.
    try {
      if (await this.geo.estadoPermiso() === 'prompt-with-rationale' && !(await this.explicarPermiso())) {
        return;
      }
    } catch { /* si no se puede consultar el estado, obtener() mostrará el error */ }

    this.buscandoUbicacion = true;
    this.cdr.detectChanges();
    try {
      this.ubicacion = await this.geo.obtener();
      this.contexto.registrarUbicacion(this.ubicacion, this.tienda);
    } catch (err) {
      const e = err as ErrorUbicacion;
      this.errorUbicacion = e.message;
      this.tipoErrorUbicacion = e.tipo ?? 'otro';
    } finally {
      this.buscandoUbicacion = false;
      this.cdr.detectChanges();
    }
  }

  /** Aviso previo a pedir otra vez el permiso; devuelve true si el usuario acepta continuar. */
  private async explicarPermiso(): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Permiso de ubicación',
      message: 'AbarrApp usa tu ubicación solo para calcular a qué distancia estás de la tienda y, si eres administrador, para registrar dónde está. No se guarda tu ubicación personal.',
      buttons: [{ text: 'Ahora no', role: 'cancel' }, { text: 'Continuar', role: 'confirm' }],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  /** El admin guarda su ubicación actual como la ubicación de la tienda. */
  async guardarComoUbicacionTienda() {
    if (!this.ubicacion) return;
    this.errorUbicacion = '';
    this.okUbicacion = '';
    if (!this.network.online) {
      this.errorUbicacion = 'Sin conexión: la ubicación de la tienda se guarda en el servidor.';
      return;
    }
    this.guardandoUbicacion = true;
    this.cdr.detectChanges();
    try {
      await this.api.guardarUbicacionTienda(this.usuarioId, this.tiendaId, this.ubicacion.latitud, this.ubicacion.longitud);
      this.okUbicacion = 'Ubicación de la tienda guardada';
      await this.cargarTienda();
      this.contexto.registrarUbicacion(this.ubicacion, this.tienda);
    } catch (err) {
      this.errorUbicacion = mensajeError(err, 'No se pudo guardar la ubicación de la tienda');
    } finally {
      this.guardandoUbicacion = false;
      this.cdr.detectChanges();
    }
  }

  abrirMapa() {
    if (!this.tieneUbicacionTienda) return;
    window.open(this.geo.urlMapa(this.tienda!.latitud!, this.tienda!.longitud!), '_blank');
  }

  cambiarTienda() {
    this.storage.salirDeTienda();
    this.router.navigateByUrl('/tiendas');
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
