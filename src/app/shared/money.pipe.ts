import { Pipe, PipeTransform } from '@angular/core';

// Formatea montos como pesos (sin decimales). Ej: 150000 -> "$150.000".
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const n = Math.round(Math.abs(value ?? 0));
    const formatted = n.toLocaleString('es-CL');
    return `$${formatted}`;
  }
}
