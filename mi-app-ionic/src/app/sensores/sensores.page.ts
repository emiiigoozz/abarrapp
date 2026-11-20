import { Component, computed, signal } from '@angular/core';
import { GRAVEDAD, SensoresService, UMBRAL_SACUDIDA, Vector3 } from '../shared/sensores.service';

/** Rango que se dibuja en las barras de cada eje (m/s²). */
const RANGO_BARRA = 20;
/** Inclinación máxima que representa la burbuja del nivel (grados). */
const RANGO_NIVEL = 30;
/** Grados de tolerancia para decir que la superficie está nivelada. */
const TOLERANCIA_NIVEL = 2;
const BATERIA_BAJA = 20;

@Component({
  selector: 'app-sensores',
  templateUrl: './sensores.page.html',
  styleUrls: ['./sensores.page.scss'],
  standalone: false,
})
export class SensoresPage {

  readonly gravedad = GRAVEDAD;
  readonly umbral = UMBRAL_SACUDIDA;
  readonly ejes: (keyof Vector3)[] = ['x', 'y', 'z'];
  readonly bateriaBaja = BATERIA_BAJA;

  readonly sinPermiso = signal(false);
  agitarActivo = true;
  private bateriaTimer?: ReturnType<typeof setInterval>;

  /** Fuerza total medida (√(x²+y²+z²)); en reposo es ≈ 9.81 m/s², la gravedad. */
  readonly magnitud = computed(() => {
    const a = this.s.aceleracion();
    return a ? Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) : null;
  });

  /** Posición de la burbuja del nivel según la inclinación (beta = adelante/atrás, gamma = lados). */
  readonly burbuja = computed(() => {
    const o = this.s.orientacion();
    if (!o) return { x: 0, y: 0, nivelado: false };
    const limitar = (v: number) => Math.max(-RANGO_NIVEL, Math.min(RANGO_NIVEL, v)) / RANGO_NIVEL;
    return {
      // La burbuja se va al lado más alto, igual que en un nivel de burbuja real.
      x: -limitar(o.gamma) * 50,
      y: -limitar(o.beta) * 50,
      nivelado: Math.abs(o.beta) <= TOLERANCIA_NIVEL && Math.abs(o.gamma) <= TOLERANCIA_NIVEL,
    };
  });

  constructor(readonly s: SensoresService) { }

  async ionViewWillEnter() {
    this.agitarActivo = this.s.agitarActivo;
    this.sinPermiso.set(!(await this.s.iniciar()));
    this.s.leerBateria();
    // La batería cambia despacio: basta con leerla cada 5 s mientras la pantalla está abierta.
    this.bateriaTimer = setInterval(() => this.s.leerBateria(), 5000);
  }

  ionViewWillLeave() {
    clearInterval(this.bateriaTimer);
    this.s.detener();
  }

  cambiarAgitar(activo: boolean) {
    this.agitarActivo = activo;
    this.s.agitarActivo = activo;
  }

  /** Ancho (%) y lado de la barra de un eje: crece hacia la derecha si es positivo y a la izquierda si es negativo. */
  barra(valor: number) {
    const ancho = Math.min(Math.abs(valor), RANGO_BARRA) / RANGO_BARRA * 50;
    return valor >= 0 ? { left: '50%', width: ancho + '%' } : { left: (50 - ancho) + '%', width: ancho + '%' };
  }

  async reintentar() {
    await this.s.detener();
    this.sinPermiso.set(!(await this.s.iniciar()));
  }
}
