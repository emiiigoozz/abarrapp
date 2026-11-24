import { Contexto, evaluarReglas, SYNC_AHORRO_MS, SYNC_NORMAL_MS } from './reglas';

/** Contexto base: trabajador en la tienda, con Internet y batería llena. */
const ctx = (cambios: Partial<Contexto> = {}): Contexto => ({
  ubicacion: 'en_tienda', distanciaM: 12, online: true, bateria: 90, cargando: false, rol: 'trabajador', ...cambios,
});

describe('Reglas de contexto', () => {

  it('R1: en la tienda y con conexión → vende directo al servidor', () => {
    const d = evaluarReglas(ctx());
    expect(d.reglasActivas).toEqual(['R1']);
    expect(d.puedeVender).toBe(true);
    expect(d.modoVenta).toBe('servidor');
    expect(d.tituloVenta).toBe('Venta en mostrador');
    expect(d.avisoVenta).toBeNull();
    expect(d.intervaloSyncMs).toBe(SYNC_NORMAL_MS);
  });

  it('R2: en la tienda sin conexión → vende y guarda en la cola', () => {
    const d = evaluarReglas(ctx({ online: false }));
    expect(d.reglasActivas).toEqual(['R2']);
    expect(d.puedeVender).toBe(true);
    expect(d.modoVenta).toBe('cola');
    expect(d.avisoVenta).toContain('Sin conexión');
  });

  it('R1 también aplica si la tienda no tiene ubicación registrada', () => {
    const d = evaluarReglas(ctx({ ubicacion: 'sin_registro', distanciaM: null }));
    expect(d.reglasActivas).toEqual(['R1']);
    expect(d.puedeVender).toBe(true);
  });

  it('R3: trabajador fuera de la tienda → vender bloqueado', () => {
    const d = evaluarReglas(ctx({ ubicacion: 'fuera', distanciaM: 1500 }));
    expect(d.reglasActivas).toEqual(['R3']);
    expect(d.puedeVender).toBe(false);
    expect(d.modoVenta).toBe('bloqueado');
    expect(d.tituloVenta).toBe('Venta bloqueada');
    expect(d.avisoVenta).toContain('a 1.5 km');
  });

  it('R3: trabajador sin ubicación verificada → vender bloqueado', () => {
    const d = evaluarReglas(ctx({ ubicacion: 'sin_verificar', distanciaM: null }));
    expect(d.puedeVender).toBe(false);
    expect(d.avisoVenta).toContain('No se ha verificado');
  });

  it('R3: admin fuera de la tienda → puede vender, con aviso', () => {
    const d = evaluarReglas(ctx({ ubicacion: 'fuera', rol: 'admin' }));
    expect(d.puedeVender).toBe(true);
    expect(d.modoVenta).toBe('servidor');
    expect(d.tituloVenta).toBe('Venta fuera de la tienda (admin)');
    expect(d.avisoVenta).toContain('administrador');
  });

  it('R3: admin fuera y sin conexión → vende a la cola', () => {
    const d = evaluarReglas(ctx({ ubicacion: 'fuera', rol: 'admin', online: false }));
    expect(d.modoVenta).toBe('cola');
  });

  it('R4: batería baja sin cargador → modo ahorro, se combina con R1', () => {
    const d = evaluarReglas(ctx({ bateria: 15 }));
    expect(d.reglasActivas).toEqual(['R1', 'R4']);
    expect(d.ahorroBateria).toBe(true);
    expect(d.intervaloSyncMs).toBe(SYNC_AHORRO_MS);
    expect(d.puedeVender).toBe(true);
  });

  it('R4: no aplica si está cargando, ni si la batería es desconocida', () => {
    expect(evaluarReglas(ctx({ bateria: 15, cargando: true })).ahorroBateria).toBe(false);
    expect(evaluarReglas(ctx({ bateria: null, cargando: null })).ahorroBateria).toBe(false);
  });

  it('R4: el límite es inclusivo (20 % sí, 21 % no)', () => {
    expect(evaluarReglas(ctx({ bateria: 20 })).ahorroBateria).toBe(true);
    expect(evaluarReglas(ctx({ bateria: 21 })).ahorroBateria).toBe(false);
  });

  it('Lector: nunca vende, aunque esté en la tienda', () => {
    const d = evaluarReglas(ctx({ rol: 'lector' }));
    expect(d.puedeVender).toBe(false);
    expect(d.avisoVenta).toContain('solo lectura');
  });

  it('Peor caso: trabajador fuera, sin conexión y batería baja → R3 + R4', () => {
    const d = evaluarReglas(ctx({ ubicacion: 'fuera', online: false, bateria: 10 }));
    expect(d.reglasActivas).toEqual(['R3', 'R4']);
    expect(d.puedeVender).toBe(false);
    expect(d.ahorroBateria).toBe(true);
  });
});
