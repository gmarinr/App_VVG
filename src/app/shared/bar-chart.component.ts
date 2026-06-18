import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BarDatum {
  label: string;
  value: number;
}

// Gráfico de barras minimalista en SVG, sin dependencias externas.
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart" *ngIf="data.length; else empty">
      <div class="bar-col" *ngFor="let d of data">
        <div class="bar-val">{{ short(d.value) }}</div>
        <div class="bar" [style.height.%]="heightPct(d.value)"></div>
        <div class="bar-label">{{ d.label }}</div>
      </div>
    </div>
    <ng-template #empty>
      <p class="vvg-muted" style="text-align:center; padding:24px 0;">Sin datos todavía.</p>
    </ng-template>
  `,
  styles: [
    `
      .chart {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        height: 160px;
        padding-top: 18px;
      }
      .bar-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        height: 100%;
        min-width: 0;
      }
      .bar {
        width: 70%;
        max-width: 34px;
        background: linear-gradient(180deg, var(--ion-color-primary), var(--ion-color-secondary));
        border-radius: 8px 8px 4px 4px;
        min-height: 4px;
        transition: height 0.3s ease;
      }
      .bar-val { font-size: 0.62rem; color: var(--vvg-muted); margin-bottom: 4px; white-space: nowrap; }
      .bar-label { font-size: 0.62rem; color: var(--vvg-muted); margin-top: 6px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    `,
  ],
})
export class BarChartComponent {
  @Input() data: BarDatum[] = [];

  get max(): number {
    return Math.max(1, ...this.data.map((d) => d.value));
  }

  heightPct(v: number): number {
    return Math.max(4, (v / this.max) * 100);
  }

  short(v: number): string {
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return '$' + Math.round(v / 1000) + 'k';
    return '$' + Math.round(v);
  }
}
