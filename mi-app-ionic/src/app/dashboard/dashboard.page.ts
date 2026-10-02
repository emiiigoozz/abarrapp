import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import Chart from 'chart.js/auto';
import { environment } from '../../environments/environment';
import { StorageService } from '../shared/storage.service';
import { mensajeError } from '../shared/network.service';
import { AlertaPerdida, AlertaStock, GananciaDia, Resumen, TopProducto } from '../models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit, AfterViewInit {

  private apiUrl = `${environment.apiUrl}/dashboard.php`;
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
        () => axios.get(this.apiUrl, { params: { tienda_id: this.tiendaId }, timeout: 10000 }).then(r => r.data.data));
      if (desdeCache) {
        this.errorMsg = this.storage.mensajeCache();
      }

      this.resumen = {
        ingresos: Number(d.resumen.ingresos),
        costos: Number(d.resumen.costos),
        ganancia: Number(d.resumen.ganancia),
        unidades: Number(d.resumen.unidades),
      };

      this.topProductos = (d.top_productos as any[]).map(p => ({
        id: Number(p.id),
        nombre: p.nombre,
        unidades_vendidas: Number(p.unidades_vendidas),
        ganancia: Number(p.ganancia),
      }));

      this.stockBajo = (d.stock_bajo as any[]).map(s => ({
        id: Number(s.id),
        nombre: s.nombre,
        stock: Number(s.stock),
      }));

      this.productosConPerdida = (d.productos_con_perdida as any[]).map(p => ({
        id: Number(p.id),
        nombre: p.nombre,
        costo: Number(p.costo),
        precio_venta: Number(p.precio_venta),
      }));

      const porDia: GananciaDia[] = (d.ganancias_por_dia as any[]).map(g => ({
        dia: g.dia,
        ganancia: Number(g.ganancia),
      }));

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
