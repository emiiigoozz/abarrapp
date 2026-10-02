import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../shared/storage.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {

  tiendaNombre = '';
  tiendaRol = '';

  constructor(
    private router: Router,
    private storage: StorageService,
  ) { }

  ngOnInit() {
    const tiendaId = this.storage.get('tienda_id');
    if (!tiendaId) {
      this.router.navigateByUrl('/tiendas');
      return;
    }
    this.tiendaNombre = this.storage.get('tienda_nombre') || '';
    this.tiendaRol = this.storage.get('tienda_rol') || '';
  }

  get esAdmin(): boolean {
    return this.tiendaRol === 'admin';
  }

  get esTrabajadorOAdmin(): boolean {
    return this.tiendaRol === 'admin' || this.tiendaRol === 'trabajador';
  }

  cambiarTienda() {
    this.storage.salirDeTienda();
    this.router.navigateByUrl('/tiendas');
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
