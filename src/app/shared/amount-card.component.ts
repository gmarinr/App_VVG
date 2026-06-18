import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoneyPipe } from './money.pipe';

// "Cuadro" reutilizable: un recuadro con un monto (verde si te deben, rojo si
// debes) y un título debajo. Se usa en Balance y Pagos pendientes del menú.
@Component({
  selector: 'app-amount-card',
  standalone: true,
  imports: [CommonModule, MoneyPipe],
  template: `
    <div class="ac">
      <div class="box" [class.pos]="value >= 0" [class.neg]="value < 0">
        <span class="amount">{{ value >= 0 ? '+' : '-' }}{{ value | money }}</span>
        <span class="dir" *ngIf="sub">{{ sub }}</span>
      </div>
      <span class="caption">{{ caption }}</span>
    </div>
  `,
  styles: [
    `
      .ac {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        min-width: 104px;
        cursor: pointer;
      }
      .box {
        width: 100%;
        min-height: 78px;
        border-radius: 16px;
        background: var(--vvg-card-bg);
        box-shadow: var(--vvg-shadow);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 10px 14px;
        border: 2px solid transparent;
      }
      .box.pos { border-color: rgba(46, 196, 182, 0.35); }
      .box.neg { border-color: rgba(232, 80, 91, 0.3); }
      .amount { font-size: 1.15rem; font-weight: 700; white-space: nowrap; }
      .box.pos .amount { color: var(--ion-color-success); }
      .box.neg .amount { color: var(--ion-color-danger); }
      .dir { font-size: 0.66rem; color: var(--vvg-muted); }
      .caption { font-size: 0.82rem; font-weight: 600; color: #2b2d3a; text-align: center; }
    `,
  ],
})
export class AmountCardComponent {
  @Input() value = 0;
  @Input() caption = '';
  @Input() sub?: string; // texto pequeño dentro del cuadro (ej: "te deben")
}
