import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { NetworkService } from './shared/network.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {

  // Signal: la app es zoneless, así la vista se actualiza sola cuando cambia la red.
  readonly online = signal(true);
  private sub?: Subscription;

  constructor(
    private network: NetworkService,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    this.online.set(this.network.online);
    this.sub = this.network.online$.subscribe(async online => {
      const volvio = online && !this.online();
      this.online.set(online);
      if (volvio) {
        const toast = await this.toastCtrl.create({
          message: 'Conexión restablecida',
          duration: 2500,
          color: 'success',
          position: 'top',
          icon: 'wifi',
        });
        await toast.present();
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
