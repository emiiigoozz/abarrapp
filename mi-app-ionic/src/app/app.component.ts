import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { NetworkService } from './shared/network.service';
import { SyncService } from './shared/sync.service';

type Estado = 'online' | 'offline' | 'sincronizando' | 'pendientes' | 'fallidas';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {

  // Signals: la app es zoneless, así la barra se actualiza sola cuando cambia la red o la cola.
  readonly online = signal(true);

  readonly estado = computed<Estado>(() => {
    if (!this.online()) return 'offline';
    if (this.sync.sincronizando()) return 'sincronizando';
    if (this.sync.fallidas().length > 0) return 'fallidas';
    if (this.sync.pendientes().length > 0) return 'pendientes';
    return 'online';
  });

  readonly texto = computed(() => {
    const n = this.sync.pendientes().length;
    const cambios = (k: number) => `${k} ${k === 1 ? 'cambio' : 'cambios'}`;
    switch (this.estado()) {
      case 'offline': return n > 0 ? `Sin conexión · ${cambios(n)} por enviar` : 'Sin conexión · usando datos guardados';
      case 'sincronizando': return `Sincronizando ${cambios(n)}…`;
      case 'fallidas': return `${cambios(this.sync.fallidas().length)} no se pudieron enviar · toca para ver`;
      case 'pendientes': return `${cambios(n)} pendientes · reintentando`;
      default: return 'En línea · todo sincronizado';
    }
  });

  readonly icono = computed(() => ({
    online: 'cloud-done-outline', offline: 'cloud-offline-outline', sincronizando: 'sync-outline',
    pendientes: 'cloud-upload-outline', fallidas: 'alert-circle-outline',
  })[this.estado()]);

  private subs: Subscription[] = [];

  constructor(
    private network: NetworkService,
    readonly sync: SyncService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit() {
    this.online.set(this.network.online);
    this.subs.push(this.network.online$.subscribe(online => {
      const volvio = online && !this.online();
      this.online.set(online);
      if (volvio) {
        const n = this.sync.pendientes().length;
        this.avisar(n > 0 ? `Conexión restablecida · enviando ${n} ${n === 1 ? 'cambio' : 'cambios'}` : 'Conexión restablecida', 'success', 'wifi');
      }
    }));
    this.subs.push(this.sync.sincronizado$.subscribe(enviadas => {
      if (enviadas > 0) {
        this.avisar(`${enviadas} ${enviadas === 1 ? 'cambio sincronizado' : 'cambios sincronizados'} con el servidor`, 'success', 'cloud-done-outline');
      }
    }));
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  /** Al tocar la barra: ver los cambios por enviar, reintentar o revisar los que fallaron. */
  async tocarBarra() {
    const estado = this.estado();
    if (estado === 'fallidas') {
      const lista = this.sync.fallidas().map(f => `• ${f.descripcion}: ${f.error}`).join('\n');
      const alert = await this.alertCtrl.create({
        header: 'Cambios no sincronizados',
        message: `El servidor rechazó estos cambios hechos sin conexión:\n\n${lista}`,
        cssClass: 'alerta-lista',
        buttons: [{ text: 'Entendido', role: 'cancel' }, { text: 'Descartar', handler: () => this.sync.descartarFallidas() }],
      });
      await alert.present();
    } else if (this.sync.pendientes().length > 0) {
      const lista = this.sync.pendientes().map(p => `• ${p.descripcion}`).join('\n');
      const alert = await this.alertCtrl.create({
        header: 'Cambios por enviar',
        message: `Se guardaron en el teléfono y se enviarán al servidor en este orden:\n\n${lista}`,
        cssClass: 'alerta-lista',
        buttons: estado === 'offline' ? ['Cerrar'] : ['Cerrar', { text: 'Reintentar ahora', handler: () => { this.sync.sincronizar(); } }],
      });
      await alert.present();
    }
  }

  private async avisar(message: string, color: string, icon: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'top', icon });
    await toast.present();
  }
}
