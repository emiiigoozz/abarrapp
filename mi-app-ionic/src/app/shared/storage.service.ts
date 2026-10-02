import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { NetworkService } from './network.service';

// Claves de la sesión (usuario y tienda activa).
const SESION_KEYS = ['token', 'user', 'tienda_id', 'tienda_nombre', 'tienda_rol'];
const TIENDA_KEYS = ['tienda_id', 'tienda_nombre', 'tienda_rol'];
// Prefijo de los datos traídos de la API que se guardan para verlos sin conexión.
const CACHE_PREFIX = 'cache_';


/**
 * Persistencia local con Capacitor Preferences (SharedPreferences en Android,
 * UserDefaults en iOS, localStorage en web). Al arrancar la app se cargan todos
 * los valores a memoria para que las páginas puedan leerlos de forma síncrona;
 * cada escritura se refleja en memoria y se guarda en el dispositivo.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {

  private datos = new Map<string, string>();

  constructor(private network: NetworkService) { }

  /** Se ejecuta una sola vez al iniciar la app (ver app.module.ts). */
  async init(): Promise<void> {
    const { keys } = await Preferences.keys();
    // Se leen todas las claves en paralelo: una por una tardaba varios segundos al abrir la app.
    const valores = await Promise.all(keys.map(key => Preferences.get({ key })));
    keys.forEach((key, i) => {
      const value = valores[i].value;
      if (value !== null) {
        this.datos.set(key, value);
      }
    });
    await this.migrarDesdeLocalStorage();
  }

  get(key: string): string | null {
    return this.datos.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.datos.set(key, value);
    Preferences.set({ key, value }).catch(err => console.error(`Error al guardar "${key}":`, err));
  }

  remove(key: string): void {
    this.datos.delete(key);
    Preferences.remove({ key }).catch(err => console.error(`Error al borrar "${key}":`, err));
  }

  getJSON<T>(key: string): T | null {
    const raw = this.get(key);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }

  /** Guarda una respuesta de la API para mostrarla si luego no hay conexión. */
  guardarCache(nombre: string, value: unknown): void {
    this.setJSON(CACHE_PREFIX + nombre, value);
  }

  leerCache<T>(nombre: string): T | null {
    return this.getJSON<T>(CACHE_PREFIX + nombre);
  }

  /**
   * Pide los datos a la API y los guarda. Si la petición falla (sin conexión,
   * servidor caído) devuelve la última copia guardada; si no hay ninguna,
   * relanza el error original. Sin conexión ni siquiera intenta la petición.
   */
  async obtenerConCache<T>(nombre: string, pedir: () => Promise<T>): Promise<{ datos: T; desdeCache: boolean }> {
    try {
      if (!this.network.online) {
        throw new Error('Sin conexión');
      }
      const datos = await pedir();
      this.guardarCache(nombre, datos);
      return { datos, desdeCache: false };
    } catch (err) {
      const datos = this.leerCache<T>(nombre);
      if (datos === null) {
        throw err;
      }
      console.warn(`Sin conexión, usando datos guardados de "${nombre}":`, err);
      return { datos, desdeCache: true };
    }
  }

  /** Aviso para cuando se muestran datos guardados: distingue sin internet de servidor caído. */
  mensajeCache(): string {
    return this.network.online
      ? 'No se pudo conectar con el servidor: mostrando los últimos datos guardados'
      : 'Sin conexión: mostrando los últimos datos guardados';
  }

  /** Olvida la tienda activa (al cambiar de tienda), sus datos guardados y el carrito. */
  salirDeTienda(): void {
    TIENDA_KEYS.forEach(k => this.remove(k));
    this.limpiarCache();
    this.remove('carrito');
  }

  /** Cierra sesión: borra la sesión y todos los datos guardados. */
  cerrarSesion(): void {
    SESION_KEYS.forEach(k => this.remove(k));
    this.limpiarCache();
    this.remove('carrito');
  }

  private limpiarCache(): void {
    [...this.datos.keys()]
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => this.remove(k));
  }

  /** Versiones anteriores guardaban la sesión en localStorage; se pasa a Preferences. */
  private async migrarDesdeLocalStorage(): Promise<void> {
    for (const key of SESION_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null && !this.datos.has(key)) {
        this.datos.set(key, value);
        await Preferences.set({ key, value });
      }
      localStorage.removeItem(key);
    }
  }
}
