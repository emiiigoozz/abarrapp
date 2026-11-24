import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ReglasPage } from './reglas.page';

const routes: Routes = [
  {
    path: '',
    component: ReglasPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReglasPageRoutingModule {}
