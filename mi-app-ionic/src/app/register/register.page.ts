import { Component } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { StorageService } from '../shared/storage.service';
import { mensajeError } from '../shared/network.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage {

  nombre = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  loading = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private storage: StorageService,
  ) { }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async register() {
    this.errorMsg = '';

    if (!this.nombre || !this.email || !this.password || !this.confirmPassword) {
      this.errorMsg = 'Completá todos los campos';
      return;
    }

    if (this.password.length < 6) {
      this.errorMsg = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMsg = 'Las contraseñas no coinciden';
      return;
    }

    this.loading = true;

    try {
      const { data } = await axios.post(`${environment.apiUrl}/register.php`, {
        nombre: this.nombre,
        email: this.email,
        password: this.password,
      }, { timeout: 10000 });

      if (data.success) {
        this.storage.set('token', data.token);
        this.storage.set('user', JSON.stringify(data.user));
        this.router.navigateByUrl('/tiendas');
      } else {
        this.errorMsg = data.message || 'No se pudo crear la cuenta';
      }
    } catch (err: any) {
      console.error('Register error:', err);
      this.errorMsg = mensajeError(err, 'Error al conectar con el servidor');
    } finally {
      this.loading = false;
    }
  }

}
