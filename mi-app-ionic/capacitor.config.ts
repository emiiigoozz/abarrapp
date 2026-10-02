import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.abarrapp.app',
  appName: 'AbarrApp',
  webDir: 'www',
  android: {
    // La API local corre en http (sin https); permite llamarla desde la app.
    allowMixedContent: true,
  },
};

export default config;
