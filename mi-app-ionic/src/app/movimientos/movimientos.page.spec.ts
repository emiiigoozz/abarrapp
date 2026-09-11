import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovimientosPage } from './movimientos.page';

describe('MovimientosPage', () => {
  let component: MovimientosPage;
  let fixture: ComponentFixture<MovimientosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MovimientosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
