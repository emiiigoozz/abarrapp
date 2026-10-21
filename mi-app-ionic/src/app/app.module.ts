import { NgModule, inject, provideAppInitializer } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { NetworkService } from './shared/network.service';
import { StorageService } from './shared/storage.service';
import { SyncService } from './shared/sync.service';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Antes de mostrar cualquier página: carga los datos guardados en el dispositivo, detecta
    // el estado de la red y arranca la sincronización (que necesita a los dos anteriores).
    provideAppInitializer(() => {
      const storage = inject(StorageService);
      const network = inject(NetworkService);
      const sync = inject(SyncService);
      return (async () => {
        await storage.init();
        await network.init();
        sync.init();
      })();
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
