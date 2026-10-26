import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.abarrapp.app',
  appName: 'AbarrApp',
  webDir: 'www',
  server: {
    // La API local corre en http (sin https). Si la app se sirviera en https://localhost, el WebView
    // bloquearía las imágenes http (fotos de productos) por "contenido mixto". http://localhost sigue
    // siendo un origen seguro, así que la cámara y el escáner funcionan igual.
    // Al publicar la API con https, esto puede volver al valor por defecto.
    androidScheme: 'http',
  },
};

export default config;
