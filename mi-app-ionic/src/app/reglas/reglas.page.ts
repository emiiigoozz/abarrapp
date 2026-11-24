import { Component, computed } from '@angular/core';
import { ContextoService } from '../shared/contexto.service';
import { SensoresService } from '../shared/sensores.service';
import { BATERIA_AHORRO, EstadoUbicacion, REGLAS } from '../shared/reglas';

const TEXTO_UBICACION: Record<EstadoUbicacion, string> = {
  en_tienda: 'En la tienda',
  fuera: 'Fuera de la tienda',
  sin_verificar: 'Sin verificar',
  sin_registro: 'La tienda no tiene ubicación registrada',
};

@Component({
  selector: 'app-reglas',
  templateUrl: './reglas.page.html',
  styleUrls: ['./reglas.page.scss'],
  standalone: false,
})
export class ReglasPage {

  readonly reglas = REGLAS;
  readonly bateriaAhorro = BATERIA_AHORRO;

  readonly ubicacionTexto = computed(() => TEXTO_UBICACION[this.c.contexto().ubicacion]);
  readonly distanciaTexto = computed(() => {
    const d = this.c.contexto().distanciaM;
    if (d === null) return '';
    return d < 1000 ? `a ${Math.round(d)} m` : `a ${(d / 1000).toFixed(1)} km`;
  });

  constructor(readonly c: ContextoService, private sensores: SensoresService) { }

  ionViewWillEnter() {
    this.c.refrescarSesion();
    this.sensores.leerBateria();
  }

  activa(id: string): boolean {
    return this.c.decision().reglasActivas.includes(id as any);
  }
}
