import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MiembrosPage } from './miembros.page';

describe('MiembrosPage', () => {
  let component: MiembrosPage;
  let fixture: ComponentFixture<MiembrosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MiembrosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
