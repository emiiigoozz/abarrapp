import { Injectable } from '@angular/core';
import { Geolocation, PermissionStatus } from '@capacitor/geolocation';

export interface Ubicacion {
  latitud: number;
  longitud: number;
  /** Radio de error en metros que reporta el GPS. */
  precision: number;
  fecha: number;
}

export type TipoErrorUbicacion = 'denegado' | 'desactivado' | 'tiempo' | 'otro';

/** Error de ubicación ya traducido a un mensaje para el usuario. */
export class ErrorUbicacion extends Error {
  constructor(readonly tipo: TipoErrorUbicacion, message: string) {
    super(message);
  }
}

const MENSAJES: Record<TipoErrorUbicacion, string> = {
  denegado: 'La app no tiene permiso para usar tu ubicación. Actívalo en Ajustes › Apps › AbarrApp › Permisos › Ubicación.',
  desactivado: 'La ubicación del teléfono está apagada. Actívala desde los ajustes rápidos e inténtalo de nuevo.',
  tiempo: 'No se pudo obtener la ubicación a tiempo. Intenta de nuevo, de preferencia cerca de una ventana o al aire libre.',
  otro: 'No se pudo obtener la ubicación.',
};

/** Distancia (en metros) dentro de la cual se considera que el usuario está en la tienda. */
export const RADIO_TIENDA_M = 100;

/**
 * Geolocalización con Capacitor Geolocation (GPS en Android).
 * Pide el permiso solo cuando hace falta y traduce cada error a un mensaje claro.
 */
@Injectable({ providedIn: 'root' })
export class GeoService {

  /**
   * Estado actual del permiso sin pedirlo: 'granted', 'denied', 'prompt' o
   * 'prompt-with-rationale' (Android: el usuario ya lo rechazó una vez; conviene explicar por qué se necesita).
   */
  async estadoPermiso(): Promise<PermissionStatus['location']> {
    try {
      return (await Geolocation.checkPermissions()).location;
    } catch (err) {
      throw this.traducir(err);
    }
  }

  /** Pide el permiso si hace falta y devuelve la ubicación actual. */
  async obtener(): Promise<Ubicacion> {
    try {
      let estado = (await Geolocation.checkPermissions()).location;
      if (estado !== 'granted') {
        estado = (await Geolocation.requestPermissions({ permissions: ['location'] })).location;
      }
      if (estado !== 'granted') {
        throw new ErrorUbicacion('denegado', MENSAJES.denegado);
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      return {
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude,
        precision: pos.coords.accuracy,
        fecha: pos.timestamp,
      };
    } catch (err) {
      throw this.traducir(err);
    }
  }

  /** Distancia en metros entre dos puntos (fórmula de Haversine). */
  distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const rad = (g: number) => g * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  formatoDistancia(metros: number): string {
    return metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1)} km`;
  }

  urlMapa(latitud: number, longitud: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
  }

  /** Convierte los errores del plugin (códigos OS-PLUG-GLOC-xxxx) o del navegador en ErrorUbicacion. */
  private traducir(err: any): ErrorUbicacion {
    if (err instanceof ErrorUbicacion) return err;
    const codigo = String(err?.code ?? '');
    const texto = String(err?.message ?? '');
    let tipo: TipoErrorUbicacion = 'otro';
    if (codigo.endsWith('0003') || codigo === '1' || /denied|permission/i.test(texto)) tipo = 'denegado';
    else if (['0007', '0009', '0017'].some(c => codigo.endsWith(c)) || /not enabled|turned off/i.test(texto)) tipo = 'desactivado';
    else if (codigo.endsWith('0010') || codigo === '3' || /time/i.test(texto)) tipo = 'tiempo';
    console.error('Error de ubicación:', codigo, texto);
    return new ErrorUbicacion(tipo, MENSAJES[tipo]);
  }
}
