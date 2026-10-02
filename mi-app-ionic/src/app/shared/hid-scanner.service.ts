import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Detecta pistolas de código de barras USB/Bluetooth que actúan como teclado
 * (modo "keyboard wedge"): escriben cada carácter en milisegundos y terminan con Enter.
 * Un humano tipeando nunca llega a esa velocidad, así que medimos el tiempo entre
 * teclas para distinguir un escaneo real de tipeo manual.
 */
@Injectable({ providedIn: 'root' })
export class HidScannerService implements OnDestroy {

  private static readonly MAX_MS_ENTRE_TECLAS = 40;
  private static readonly LARGO_MINIMO = 4;

  private buffer = '';
  private ultimaTecla = 0;
  private readonly listener = (e: KeyboardEvent) => this.onKeyDown(e);

  scan$ = new Subject<string>();

  constructor() {
    document.addEventListener('keydown', this.listener, true);
  }

  private onKeyDown(e: KeyboardEvent) {
    const ahora = Date.now();
    const tiempoDesdeUltima = ahora - this.ultimaTecla;
    this.ultimaTecla = ahora;

    if (e.key === 'Enter') {
      if (this.buffer.length >= HidScannerService.LARGO_MINIMO && tiempoDesdeUltima <= HidScannerService.MAX_MS_ENTRE_TECLAS) {
        this.scan$.next(this.buffer);
        e.preventDefault();
      }
      this.buffer = '';
      return;
    }

    if (e.key.length !== 1) {
      // Teclas de control (Shift, Tab, flechas, etc.) no forman parte del código
      return;
    }

    const esVelocidadDeEscaneo = tiempoDesdeUltima <= HidScannerService.MAX_MS_ENTRE_TECLAS;

    if (!esVelocidadDeEscaneo) {
      // Pausa larga: esto es tipeo humano, reiniciamos el buffer y lo dejamos escribir normal
      this.buffer = e.key;
      return;
    }

    this.buffer += e.key;

    if (this.buffer.length >= HidScannerService.LARGO_MINIMO) {
      // Ya confirmamos que es un escaneo: evitamos que los dígitos se escriban
      // en el campo con foco, para no mezclarlos con lo que el usuario esté tipeando.
      e.preventDefault();
    }
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.listener, true);
  }

}
