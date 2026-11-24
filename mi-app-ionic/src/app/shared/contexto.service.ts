import { computed, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ErrorUbicacion, GeoService, RADIO_TIENDA_M, Ubicacion } from './geo.service';
import { NetworkService } from './network.service';
import { SensoresService } from './sensores.service';
import { StorageService } from './storage.service';
import { Contexto, Decision, EstadoUbicacion, evaluarReglas, Rol } from './reglas';
import { Tienda } from '../models';

/** Una ubicación verificada deja de valer después de este tiempo (el usuario pudo haberse ido). */
export const VIGENCIA_UBICACION_MS = 10 * 60 * 1000;
const LECTURA_BATERIA_MS = 60 * 1000;

interface UbicacionVerificada {
  tiendaId: number;
  estado: EstadoUbicacion;
  distanciaM: number | null;
  fecha: number;
}

/**
 * Junta las variables de contexto de toda la app (ubicación respecto a la tienda, conexión,
 * batería y rol) y las pasa por el motor de reglas (reglas.ts). Las pantallas leen `decision()`
 * y se adaptan solas cuando cambia alguna variable, porque todo son signals.
 */
@Injectable({ providedIn: 'root' })
export class ContextoService {

  private readonly online = signal(true);
  private readonly rol = signal<Rol>('lector');
  private readonly tiendaId = signal(0);
  private readonly ubicacionVerificada = signal<UbicacionVerificada | null>(null);
  /** Avanza cada 30 s para que la vigencia de la ubicación se revise sola. */
  private readonly reloj = signal(Date.now());

  readonly verificando = signal(false);
  /** Mensaje del último intento fallido de verificar la ubicación. */
  readonly errorUbicacion = signal('');

  readonly contexto = computed<Contexto>(() => {
    const ahora = this.reloj();
    const u = this.ubicacionVerificada();
    const vigente = u !== null && u.tiendaId === this.tiendaId() && ahora - u.fecha < VIGENCIA_UBICACION_MS;
    const b = this.sensores.bateria();
    return {
      ubicacion: vigente ? u!.estado : 'sin_verificar',
      distanciaM: vigente ? u!.distanciaM : null,
      online: this.online(),
      bateria: b?.nivel ?? null,
      cargando: b?.cargando ?? null,
      rol: this.rol(),
    };
  });

  readonly decision = computed<Decision>(() => evaluarReglas(this.contexto()));

  /** Hora en que se verificó la ubicación (si sigue vigente). */
  readonly ubicacionFecha = computed(() => {
    const c = this.contexto();
    return c.ubicacion === 'sin_verificar' ? null : new Date(this.ubicacionVerificada()!.fecha);
  });

  constructor(
    private network: NetworkService,
    private sensores: SensoresService,
    private geo: GeoService,
    private api: ApiService,
    private storage: StorageService,
  ) { }

  /** Se llama al iniciar la app. */
  init() {
    this.network.online$.subscribe(v => this.online.set(v));
    this.refrescarSesion();
    this.sensores.leerBateria();
    setInterval(() => this.sensores.leerBateria(), LECTURA_BATERIA_MS);
    setInterval(() => this.reloj.set(Date.now()), 30_000);
  }

  /** Vuelve a leer el rol y la tienda activa (cambian al entrar a otra tienda). */
  refrescarSesion() {
    this.tiendaId.set(Number(this.storage.get('tienda_id')) || 0);
    const rol = this.storage.get('tienda_rol');
    this.rol.set(rol === 'admin' || rol === 'trabajador' ? rol : 'lector');
    this.reloj.set(Date.now());
  }

  /**
   * Obtiene la ubicación del GPS y la compara con la de la tienda.
   * `pedirPermiso = false` solo la obtiene si el permiso ya estaba concedido (para hacerlo en
   * segundo plano al abrir el punto de venta, sin mostrar el diálogo del sistema).
   */
  async verificarUbicacion(pedirPermiso = true): Promise<void> {
    this.refrescarSesion();
    const tiendaId = this.tiendaId();
    if (!tiendaId || this.verificando()) return;
    this.verificando.set(true);
    this.errorUbicacion.set('');
    try {
      const tienda = await this.tiendaActiva(tiendaId);
      if (tienda?.latitud == null || tienda?.longitud == null) {
        // Sin ubicación registrada no hay contra qué comparar.
        this.guardar(tiendaId, 'sin_registro', null);
        return;
      }
      if (!pedirPermiso && (await this.geo.estadoPermiso()) !== 'granted') return;
      const u = await this.geo.obtener();
      this.registrarUbicacion(u, tienda);
    } catch (err) {
      this.errorUbicacion.set(err instanceof ErrorUbicacion ? err.message : 'No se pudo obtener la ubicación.');
    } finally {
      this.verificando.set(false);
    }
  }

  /** La pantalla de inicio ya obtiene la ubicación por su cuenta: la comparte aquí. */
  registrarUbicacion(u: Ubicacion, tienda: Tienda | null) {
    const tiendaId = this.tiendaId() || tienda?.id || 0;
    if (tienda?.latitud == null || tienda?.longitud == null) {
      this.guardar(tiendaId, 'sin_registro', null);
      return;
    }
    const distancia = this.geo.distanciaMetros(u.latitud, u.longitud, tienda.latitud, tienda.longitud);
    this.guardar(tiendaId, distancia <= RADIO_TIENDA_M ? 'en_tienda' : 'fuera', distancia);
  }

  private guardar(tiendaId: number, estado: EstadoUbicacion, distanciaM: number | null) {
    this.ubicacionVerificada.set({ tiendaId, estado, distanciaM, fecha: Date.now() });
    this.reloj.set(Date.now());
  }

  private async tiendaActiva(tiendaId: number): Promise<Tienda | null> {
    const usuarioId = this.storage.getJSON<{ id: number }>('user')?.id ?? 0;
    const { datos } = await this.storage.obtenerConCache('tiendas', () => this.api.listarTiendas(usuarioId));
    return datos.find(t => t.id === tiendaId) ?? null;
  }
}
