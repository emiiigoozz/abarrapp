import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { StorageService } from '../shared/storage.service';
import { mensajeError } from '../shared/network.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {

  email = '';
  password = '';
  showPassword = false;
  loading = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private storage: StorageService,
  ) { }

  ngOnInit() {
    // Si quedó una sesión guardada en el dispositivo, se entra directo sin pedir login.
    if (this.storage.get('token')) {
      this.router.navigateByUrl(this.storage.get('tienda_id') ? '/home' : '/tiendas', { replaceUrl: true });
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async login() {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Completá email y contraseña';
      return;
    }

    this.loading = true;

    try {
      const { data } = await axios.post(`${environment.apiUrl}/login.php`, {
        email: this.email,
        password: this.password,
      }, { timeout: 10000 });

      if (data.success) {
        this.storage.set('token', data.token);
        this.storage.set('user', JSON.stringify(data.user));
        this.router.navigateByUrl('/tiendas');
      } else {
        this.errorMsg = data.message || 'No se pudo iniciar sesión';
      }
    } catch (err: any) {
      console.error('Login error:', err);
      this.errorMsg = mensajeError(err, 'Error al conectar con el servidor');
    } finally {
      this.loading = false;
    }
  }

}
