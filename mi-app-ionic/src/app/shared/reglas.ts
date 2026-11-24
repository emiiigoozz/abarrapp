/**
 * Motor de reglas de contexto.
 *
 * Funciones puras: reciben el contexto (dónde está el usuario, si hay Internet, la batería y el rol)
 * y devuelven qué puede hacer la app. No dependen de Angular, así que se prueban con pruebas
 * unitarias sin emulador (reglas.spec.ts).
 */

// ==================== VARIABLES DE CONTEXTO ====================

/**
 * Dónde está el usuario respecto a la tienda:
 * - en_tienda: a RADIO_TIENDA_M o menos de la ubicación registrada.
 * - fuera: más lejos.
 * - sin_verificar: todavía no se obtiene su ubicación (o el GPS falló / no dio permiso).
 * - sin_registro: la tienda no tiene ubicación registrada, así que no se puede comparar.
 */
export type EstadoUbicacion = 'en_tienda' | 'fuera' | 'sin_verificar' | 'sin_registro';

export type Rol = 'admin' | 'trabajador' | 'lector';

export interface Contexto {
  ubicacion: EstadoUbicacion;
  /** Distancia a la tienda en metros (solo informativa). */
  distanciaM: number | null;
  online: boolean;
  /** 0–100, o null si el dispositivo no informa la batería. */
  bateria: number | null;
  cargando: boolean | null;
  rol: Rol;
}

// ==================== DECISIÓN ====================

export type ModoVenta = 'servidor' | 'cola' | 'bloqueado';

export interface Decision {
  /** Si el botón "Terminar venta" está habilitado. */
  puedeVender: boolean;
  /** Cómo se registra la venta: directo al servidor, en la cola del teléfono, o no se permite. */
  modoVenta: ModoVenta;
  /** Título del aviso en el punto de venta. */
  tituloVenta: string;
  /** Mensaje para el punto de venta (null si no hay nada que avisar). */
  avisoVenta: string | null;
  /** Modo ahorro: sin fotos, sin "agitar para actualizar" y sincronización automática más espaciada. */
  ahorroBateria: boolean;
  /** Cada cuánto se reintenta enviar la cola al servidor. */
  intervaloSyncMs: number;
  /** Ids de las reglas que se cumplieron, en orden. */
  reglasActivas: ReglaId[];
}

// ==================== PARÁMETROS ====================

/** Batería igual o menor a esto, sin cargador, activa el modo ahorro. */
export const BATERIA_AHORRO = 20;
export const SYNC_NORMAL_MS = 15_000;
export const SYNC_AHORRO_MS = 60_000;

// ==================== REGLAS ====================

export type ReglaId = 'R1' | 'R2' | 'R3' | 'R4';

export interface Regla {
  id: ReglaId;
  nombre: string;
  /** La condición en palabras (se muestra en la pantalla de reglas y en el diagrama). */
  si: string;
  /** El efecto en palabras. */
  entonces: string;
  cumple: (c: Contexto) => boolean;
  aplicar: (d: Decision, c: Contexto) => void;
}

/** Se puede atender el mostrador: está en la tienda, o la tienda aún no tiene ubicación para comparar. */
const enMostrador = (c: Contexto) => c.ubicacion === 'en_tienda' || c.ubicacion === 'sin_registro';

export const REGLAS: Regla[] = [
  {
    id: 'R1',
    nombre: 'Venta en mostrador',
    si: 'Está en la tienda Y hay conexión',
    entonces: 'Vender habilitado; la venta se registra directo en el servidor',
    cumple: c => enMostrador(c) && c.online,
    aplicar: d => { d.puedeVender = true; d.modoVenta = 'servidor'; d.tituloVenta = 'Venta en mostrador'; },
  },
  {
    id: 'R2',
    nombre: 'Venta sin conexión',
    si: 'Está en la tienda Y no hay conexión',
    entonces: 'Vender habilitado; la venta se guarda en el teléfono y se envía al volver Internet',
    cumple: c => enMostrador(c) && !c.online,
    aplicar: d => {
      d.puedeVender = true;
      d.modoVenta = 'cola';
      d.tituloVenta = 'Venta sin conexión';
      d.avisoVenta = 'Sin conexión: las ventas se guardan en el teléfono y se envían al volver Internet.';
    },
  },
  {
    id: 'R3',
    nombre: 'Fuera de la tienda',
    si: 'Está fuera de la tienda O su ubicación no está verificada',
    entonces: 'Trabajador: vender bloqueado (solo consulta). Admin: puede vender, con aviso',
    cumple: c => c.ubicacion === 'fuera' || c.ubicacion === 'sin_verificar',
    aplicar: (d, c) => {
      const donde = c.ubicacion === 'fuera'
        ? `Estás fuera de la tienda${c.distanciaM !== null ? ` (a ${formatoMetros(c.distanciaM)})` : ''}`
        : 'No se ha verificado que estés en la tienda';
      if (c.rol === 'admin') {
        d.puedeVender = true;
        d.modoVenta = c.online ? 'servidor' : 'cola';
        d.tituloVenta = 'Venta fuera de la tienda (admin)';
        d.avisoVenta = `${donde}. Como administrador puedes vender de todos modos.`;
      } else {
        d.puedeVender = false;
        d.modoVenta = 'bloqueado';
        d.tituloVenta = 'Venta bloqueada';
        d.avisoVenta = `${donde}. Para vender tienes que estar en la tienda.`;
      }
    },
  },
  {
    id: 'R4',
    nombre: 'Ahorro de batería',
    si: `Batería ≤ ${BATERIA_AHORRO} % Y no está cargando`,
    entonces: 'Fotos desactivadas, "agitar para actualizar" apagado y sincronización automática cada 60 s (en vez de 15 s)',
    cumple: c => c.bateria !== null && c.bateria <= BATERIA_AHORRO && c.cargando === false,
    aplicar: d => { d.ahorroBateria = true; d.intervaloSyncMs = SYNC_AHORRO_MS; },
  },
];

/** Evalúa todas las reglas sobre el contexto y combina sus efectos. */
export function evaluarReglas(c: Contexto): Decision {
  const d: Decision = {
    puedeVender: false,
    modoVenta: 'bloqueado',
    tituloVenta: 'Venta bloqueada',
    avisoVenta: null,
    ahorroBateria: false,
    intervaloSyncMs: SYNC_NORMAL_MS,
    reglasActivas: [],
  };
  // El lector solo consulta: nunca vende, sin importar el contexto.
  if (c.rol === 'lector') {
    d.tituloVenta = 'Solo lectura';
    d.avisoVenta = 'Tu rol es de solo lectura.';
  }
  for (const r of REGLAS) {
    if (!r.cumple(c)) continue;
    d.reglasActivas.push(r.id);
    if (c.rol === 'lector' && r.id !== 'R4') continue;
    r.aplicar(d, c);
  }
  return d;
}

function formatoMetros(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
