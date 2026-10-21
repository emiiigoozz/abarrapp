import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import Chart from 'chart.js/auto';
import { Subscription } from 'rxjs';
import { StorageService } from '../shared/storage.service';
import { ApiService } from '../shared/api.service';
import { SyncService } from '../shared/sync.service';
import { mensajeError } from '../shared/network.service';
import { AlertaPerdida, AlertaStock, GananciaDia, Resumen, TopProducto } from '../models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {

  private syncSub?: Subscription;
  private yaEntro = false;

  private tiendaId = 0;
  private chart: Chart | null = null;
  private chartDataPendiente: GananciaDia[] | null = null;

  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  cargando = false;
  errorMsg = '';

  resumen: Resumen = { ingresos: 0, costos: 0, ganancia: 0, unidades: 0 };
  topProductos: TopProducto[] = [];
  stockBajo: AlertaStock[] = [];
  productosConPerdida: AlertaPerdida[] = [];

  constructor(
    private router: Router,
    private storage: StorageService,
    private api: ApiService,
    private sync: SyncService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    if (!this.storage.get('token')) {
      this.router.navigateByUrl('/login');
      return;
    }
    // El inventario es por tienda: sin tienda activa no hay nada que mostrar.
    this.tiendaId = Number(this.storage.get('tienda_id'));
    if (!this.tiendaId) {
      this.router.navigateByUrl('/tiendas');
      return;
    }
    this.cargarDashboard();
    // Las ventas hechas sin conexión cambian las ganancias: al sincronizar se recalcula.
    this.syncSub = this.sync.sincronizado$.subscribe(() => this.cargarDashboard());
  }

  /**
   * Ionic reutiliza la pantalla al volver a ella (p. ej. desde las pestañas), así que ngOnInit no
   * se repite. Se recarga al reingresar para mostrar lo que cambió en otras pantallas.
   */
  ionViewWillEnter() {
    if (this.yaEntro) {
      this.cargarDashboard();
    }
    this.yaEntro = true;
  }

  ngOnDestroy() {
    this.syncSub?.unsubscribe();
  }

  ngAfterViewInit() {
    if (this.chartDataPendiente) {
      this.pintarChart(this.chartDataPendiente);
      this.chartDataPendiente = null;
    }
  }

  async cargarDashboard() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const { datos: d, desdeCache } = await this.storage.obtenerConCache('dashboard',
        () => this.api.obtenerDashboard(this.tiendaId));
      if (desdeCache) {
        this.errorMsg = this.storage.mensajeCache();
      }

      this.resumen = d.resumen;
      this.topProductos = d.top_productos;
      this.stockBajo = d.stock_bajo;
      this.productosConPerdida = d.productos_con_perdida;
      const porDia = d.ganancias_por_dia;

      if (this.chartCanvas) {
        this.pintarChart(porDia);
      } else {
        this.chartDataPendiente = porDia;
      }
    } catch (err) {
      console.error('Error al cargar dashboard:', err);
      this.errorMsg = mensajeError(err, 'No se pudo cargar el dashboard');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private pintarChart(porDia: GananciaDia[]) {
    if (!this.chartCanvas) {
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0.02)');

    const labels = porDia.map(g => g.dia.slice(5));
    const valores = porDia.map(g => g.ganancia);

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = valores;
      this.chart.update();
      return;
    }

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ganancia',
          data: valores,
          borderColor: '#00e5ff',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#00e5ff',
          pointBorderColor: '#05060c',
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0b0d17',
            titleColor: '#eef1ff',
            bodyColor: '#eef1ff',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            callbacks: {
              label: (item) => `Ganancia: $${Number(item.raw).toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(238,241,255,0.55)', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(238,241,255,0.55)', font: { size: 11 } },
          },
        },
      },
    });
  }

  logout() {
    this.storage.cerrarSesion();
    this.router.navigateByUrl('/login');
  }

}
