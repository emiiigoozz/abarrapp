import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export type OrigenFoto = 'camara' | 'galeria';

/**
 * Obtiene una foto con la cámara o desde la galería del teléfono (Capacitor Camera).
 * La imagen se reduce a 900 px y calidad 70 % para que suba rápido y pese poco.
 */
@Injectable({ providedIn: 'root' })
export class FotoService {

  /** Devuelve la imagen en base64 (JPEG), o null si el usuario canceló. */
  async obtener(origen: OrigenFoto): Promise<string | null> {
    try {
      const foto = await Camera.getPhoto({
        source: origen === 'camara' ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.Base64,
        quality: 70,
        width: 900,
        correctOrientation: true,
        saveToGallery: false,
      });
      return foto.base64String ?? null;
    } catch (err: any) {
      // Cerrar la cámara o la galería sin elegir nada no es un error para el usuario.
      if (/cancel/i.test(err?.message ?? '')) {
        return null;
      }
      throw err;
    }
  }

  /** Mensaje entendible si la cámara o la galería fallan (p. ej. permiso denegado). */
  mensajeError(err: any): string {
    return /denied|permission/i.test(err?.message ?? '')
      ? 'La app no tiene permiso para usar la cámara o las fotos. Actívalo en Ajustes del teléfono.'
      : 'No se pudo obtener la foto.';
  }
}
