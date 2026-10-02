import { NgModule, inject, provideAppInitializer } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { NetworkService } from './shared/network.service';
import { StorageService } from './shared/storage.service';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Carga los datos guardados en el dispositivo antes de mostrar cualquier página.
    provideAppInitializer(() => inject(StorageService).init()),
    // Detecta el estado de la red desde el arranque y escucha sus cambios.
    provideAppInitializer(() => inject(NetworkService).init()),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
