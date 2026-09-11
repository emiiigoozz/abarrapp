import { Component } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {

  email = '';
  password = '';
  showPassword = false;
  loading = false;
  errorMsg = '';

  constructor(private router: Router) { }

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
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.router.navigateByUrl('/home');
      } else {
        this.errorMsg = data.message || 'No se pudo iniciar sesión';
      }
    } catch (err: any) {
      console.error('Login error:', err);
      this.errorMsg = err?.response?.data?.message || 'Error al conectar con el servidor';
    } finally {
      this.loading = false;
    }
  }

}
