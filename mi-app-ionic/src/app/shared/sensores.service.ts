import { Injectable, signal } from '@angular/core';
import { PluginListenerHandle } from '@capacitor/core';
import { Motion } from '@capacitor/motion';
import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Subject } from 'rxjs';
import { StorageService } from './storage.service';

/** Vector en los tres ejes del teléfono (m/s² o °/s según el dato). */
export interface Vector3 { x: number; y: number; z: number; }

/** Orientación absoluta del teléfono en grados (evento deviceorientation). */
export interface Orientacion {
  /** Giro sobre el eje Z (brújula), 0–360. Puede ser null si el equipo no lo calcula. */
  alpha: number | null;
  /** Inclinación adelante/atrás, −180–180. */
  beta: number;
  /** Inclinación izquierda/derecha, −90–90. */
  gamma: number;
}

export interface Bateria {
  /** 0–100, o null si el dispositivo no informa. */
  nivel: number | null;
  cargando: boolean | null;
}

/** Preferencia guardada: '0' si el usuario apagó "agitar para actualizar". */
export const CLAVE_AGITAR = 'agitar_actualizar';

/** Gravedad estándar (m/s²): lo que mide el acelerómetro con el teléfono quieto. */
export const GRAVEDAD = 9.81;
/** Cuánto debe alejarse la aceleración total de la gravedad para contar como sacudida (m/s²). */
export const UMBRAL_SACUDIDA = 12;
/** Picos necesarios dentro de la ventana para considerar que el teléfono se agitó. */
const PICOS_SACUDIDA = 3;
const VENTANA_SACUDIDA_MS = 1200;
/** Tiempo mínimo entre dos sacudidas, para no disparar la acción varias veces seguidas. */
const ESPERA_SACUDIDA_MS = 2000;
/** Cada cuánto se refresca la pantalla (los sensores mandan ~60 lecturas por segundo). */
const REFRESCO_UI_MS = 100;
/** Si en este tiempo no llega ninguna lectura, el dispositivo no tiene el sensor o no lo expone. */
const ESPERA_DATOS_MS = 3000;

/**
 * Sensores físicos del teléfono:
 * - Acelerómetro y giroscopio (Capacitor Motion → evento web `devicemotion`).
 * - Orientación / inclinación (Capacitor Motion → evento web `deviceorientation`).
 * - Batería (Capacitor Device → BatteryManager de Android).
 * - Vibración como respuesta (Capacitor Haptics).
 *
 * Las páginas llaman a iniciar()/detener(); los sensores solo están encendidos
 * mientras alguna página los usa, para no gastar batería.
 */
@Injectable({ providedIn: 'root' })
export class SensoresService {

  /** Aceleración con gravedad (lo que mide el sensor directamente). */
  readonly aceleracion = signal<Vector3 | null>(null);
  /** Aceleración sin gravedad (solo el movimiento); null si el equipo no la calcula. */
  readonly aceleracionLineal = signal<Vector3 | null>(null);
  /** Velocidad de giro (giroscopio) en °/s. */
  readonly rotacion = signal<Vector3 | null>(null);
  readonly orientacion = signal<Orientacion | null>(null);
  /** Lecturas por segundo que entrega el sensor. */
  readonly frecuenciaHz = signal<number | null>(null);
  readonly bateria = signal<Bateria | null>(null);
  readonly sinAcelerometro = signal(false);
  readonly sinOrientacion = signal(false);
  readonly sacudidas = signal(0);
  readonly ultimaSacudida = signal<Date | null>(null);

  /** Emite cada vez que el usuario agita el teléfono. */
  readonly agitado$ = new Subject<void>();

  private usuarios = 0;
  private handles: PluginListenerHandle[] = [];
  private temporizadores: ReturnType<typeof setTimeout>[] = [];
  private ultimoRefrescoAccel = 0;
  private ultimoRefrescoOrient = 0;
  private recibioAccel = false;
  private recibioOrient = false;
  private picos: number[] = [];
  private sobreUmbral = false;
  private ultimaSacudidaMs = 0;

  constructor(private storage: StorageService) { }

  get agitarActivo(): boolean {
    return this.storage.get(CLAVE_AGITAR) !== '0';
  }

  set agitarActivo(activo: boolean) {
    this.storage.set(CLAVE_AGITAR, activo ? '1' : '0');
  }

  /**
   * Para las pantallas que se actualizan al agitar el teléfono. Enciende el acelerómetro
   * (si el usuario no lo desactivó) y devuelve la función para dejar de escuchar.
   */
  async alAgitar(accion: () => void): Promise<() => void> {
    if (!this.agitarActivo || !(await this.iniciar())) return () => { };
    const sub = this.agitado$.subscribe(accion);
    return () => {
      sub.unsubscribe();
      this.detener();
    };
  }

  /** Enciende los sensores (si no lo estaban ya). Devuelve false si el usuario negó el permiso (iOS). */
  async iniciar(): Promise<boolean> {
    this.usuarios++;
    if (this.usuarios > 1) return true;

    if (!(await this.pedirPermisoIOS())) {
      this.usuarios = 0;
      return false;
    }

    this.recibioAccel = this.recibioOrient = false;
    this.sinAcelerometro.set(false);
    this.sinOrientacion.set(false);
    this.handles.push(
      await Motion.addListener('accel', e => this.alAcelerar(e.accelerationIncludingGravity, e.acceleration, e.rotationRate, e.interval)),
      await Motion.addListener('orientation', e => this.alOrientar(e)),
    );
    this.temporizadores.push(setTimeout(() => {
      if (!this.recibioAccel) this.sinAcelerometro.set(true);
      if (!this.recibioOrient) this.sinOrientacion.set(true);
    }, ESPERA_DATOS_MS));
    return true;
  }

  /** Apaga los sensores cuando ya ninguna página los usa. */
  async detener() {
    if (this.usuarios === 0) return;
    this.usuarios--;
    if (this.usuarios > 0) return;
    this.temporizadores.forEach(t => clearTimeout(t));
    this.temporizadores = [];
    await Promise.all(this.handles.map(h => h.remove()));
    this.handles = [];
  }

  /** Lee el nivel y el estado de carga de la batería. */
  async leerBateria(): Promise<Bateria> {
    let b: Bateria = { nivel: null, cargando: null };
    try {
      // En algunos navegadores la consulta nunca responde: se deja de esperar a los 3 s.
      const info = await Promise.race([
        Device.getBatteryInfo(),
        new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new Error('La batería no respondió')), ESPERA_DATOS_MS)),
      ]);
      b = {
        nivel: info.batteryLevel != null && info.batteryLevel >= 0 ? Math.round(info.batteryLevel * 100) : null,
        cargando: info.isCharging ?? null,
      };
    } catch (err) {
      console.warn('No se pudo leer la batería:', err);
    }
    this.bateria.set(b);
    return b;
  }

  /** Vibración corta para confirmar una acción hecha con el sensor. */
  async vibrar() {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch { /* sin motor de vibración */ }
  }

  // ---------------------------------------------------------------------------

  /** iOS 13+ exige pedir permiso para leer el movimiento; Android y el navegador no. */
  private async pedirPermisoIOS(): Promise<boolean> {
    const DME = (window as any).DeviceMotionEvent;
    if (typeof DME?.requestPermission !== 'function') return true;
    try {
      return (await DME.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }

  private alAcelerar(g: Vector3 | null, lineal: Vector3 | null, giro: { alpha: number; beta: number; gamma: number } | null, intervalo: number) {
    if (!g || g.x == null) return;
    this.recibioAccel = true;
    this.detectarSacudida(g);

    const ahora = Date.now();
    if (ahora - this.ultimoRefrescoAccel < REFRESCO_UI_MS) return;
    this.ultimoRefrescoAccel = ahora;
    this.sinAcelerometro.set(false);
    this.aceleracion.set({ x: g.x, y: g.y, z: g.z });
    this.aceleracionLineal.set(lineal && lineal.x != null ? { x: lineal.x, y: lineal.y, z: lineal.z } : null);
    this.rotacion.set(giro && giro.alpha != null ? { x: giro.beta, y: giro.gamma, z: giro.alpha } : null);
    // El intervalo llega en milisegundos (Chrome/Android WebView).
    if (intervalo > 0) this.frecuenciaHz.set(Math.round(1000 / intervalo));
  }

  private alOrientar(e: { alpha: number | null; beta: number | null; gamma: number | null }) {
    if (e.beta == null || e.gamma == null) return;
    this.recibioOrient = true;
    const ahora = Date.now();
    if (ahora - this.ultimoRefrescoOrient < REFRESCO_UI_MS) return;
    this.ultimoRefrescoOrient = ahora;
    this.sinOrientacion.set(false);
    this.orientacion.set({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
  }

  /**
   * Sacudida = varios picos de aceleración en poco tiempo.
   * Un pico es cada vez que la fuerza total pasa de estar por debajo a estar por encima del umbral,
   * así un golpe o un movimiento sostenido no cuentan como agitar.
   */
  private detectarSacudida(g: Vector3) {
    const fuerza = Math.abs(Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) - GRAVEDAD);
    const ahora = Date.now();
    const arriba = fuerza > UMBRAL_SACUDIDA;
    if (arriba && !this.sobreUmbral) {
      this.picos = this.picos.filter(t => ahora - t < VENTANA_SACUDIDA_MS);
      this.picos.push(ahora);
      if (this.picos.length >= PICOS_SACUDIDA && ahora - this.ultimaSacudidaMs > ESPERA_SACUDIDA_MS) {
        this.ultimaSacudidaMs = ahora;
        this.picos = [];
        this.sacudidas.update(n => n + 1);
        this.ultimaSacudida.set(new Date());
        this.vibrar();
        this.agitado$.next();
      }
    }
    this.sobreUmbral = arriba;
  }
}
