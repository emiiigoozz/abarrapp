import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';

// Último estado conocido; lo usa mensajeError(), que no es parte de ningún componente.
let conectado = true;

/**
 * Detecta si el dispositivo tiene conexión (Wi-Fi o datos) con Capacitor Network,
 * que en Android usa el ConnectivityManager del sistema y en web los eventos online/offline.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {

  /** true = hay conexión. Emite cada vez que cambia. */
  readonly online$ = new BehaviorSubject<boolean>(true);

  /** Se ejecuta una sola vez al iniciar la app (ver app.module.ts). */
  async init(): Promise<void> {
    const status = await Network.getStatus();
    this.actualizar(status.connected);

    Network.addListener('networkStatusChange', status => this.actualizar(status.connected));
  }

  get online(): boolean {
    return this.online$.value;
  }

  private actualizar(valor: boolean) {
    conectado = valor;
    if (valor !== this.online$.value) {
      this.online$.next(valor);
    }
  }
}

/**
 * Convierte un error de axios en un mensaje entendible para el usuario,
 * distinguiendo entre sin internet, servidor caído, tiempo agotado y errores del servidor.
 */
export function mensajeError(err: any, porDefecto: string): string {
  if (!conectado) {
    return 'Sin conexión a internet. Revisá tu Wi-Fi o datos e intentá de nuevo.';
  }
  if (err?.code === 'ECONNABORTED') {
    return 'El servidor tardó demasiado en responder. Intentá de nuevo.';
  }
  if (!err?.response) {
    return 'No se pudo conectar con el servidor. Verificá que esté encendido.';
  }
  if (err.response.status >= 500) {
    return 'Ocurrió un error en el servidor. Intentá más tarde.';
  }
  return err.response.data?.message || porDefecto;
}
