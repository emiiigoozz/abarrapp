import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular/lazy';

import { MovimientosPageRoutingModule } from './movimientos-routing.module';

import { MovimientosPage } from './movimientos.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    MovimientosPageRoutingModule
  ],
  declarations: [MovimientosPage]
})
export class MovimientosPageModule {}
