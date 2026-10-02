import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular/lazy';

import { ProductosPageRoutingModule } from './productos-routing.module';
import { BarcodeScannerComponent } from '../shared/barcode-scanner/barcode-scanner.component';

import { ProductosPage } from './productos.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule,
    BarcodeScannerComponent,
    ProductosPageRoutingModule
  ],
  declarations: [ProductosPage]
})
export class ProductosPageModule {}
