import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { IonicModule } from '@ionic/angular/lazy';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.QR_CODE,
  ]],
]);

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './barcode-scanner.component.html',
  styleUrls: ['./barcode-scanner.component.scss'],
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {

  @Output() scanned = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  private reader = new BrowserMultiFormatReader(HINTS, { delayBetweenScanAttempts: 100 });
  private controls: IScannerControls | null = null;
  errorMsg = '';
  listo = false;

  async ngAfterViewInit() {
    if (!this.videoRef) {
      return;
    }

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (devices.length === 0) {
        this.errorMsg = 'No se encontró ninguna cámara disponible';
        return;
      }

      const camaraTrasera = devices.find(d => /back|trasera|environment/i.test(d.label));
      const deviceId = (camaraTrasera || devices[devices.length - 1]).deviceId;

      this.listo = true;

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // @ts-ignore: soportado por la mayoría de navegadores aunque no esté en el tipo estándar
          focusMode: 'continuous',
        },
      };

      this.controls = await this.reader.decodeFromConstraints(constraints, this.videoRef.nativeElement, (result) => {
        if (result) {
          this.scanned.emit(result.getText());
          this.cerrar();
        }
      });
    } catch (err: any) {
      console.error('Error al iniciar la cámara:', err);
      this.errorMsg = err?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Habilitalo en el navegador e intentá de nuevo.'
        : 'No se pudo acceder a la cámara';
    }
  }

  cerrar() {
    this.closed.emit();
  }

  ngOnDestroy() {
    this.controls?.stop();
  }

}
