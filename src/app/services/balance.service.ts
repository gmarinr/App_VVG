import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { Expense, Settlement, UserBalance } from '../models/models';

// Calcula balances y liquidaciones (quién le debe a quién).
@Injectable({ providedIn: 'root' })
export class BalanceService {
  constructor(private data: DataService) {}

  // Redondea a 2 decimales para evitar ruido de punto flotante.
  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // Para un gasto, divide el monto en partes iguales entre participantes.
  shareForExpense(e: Expense): number {
    if (!e.participantes.length) return 0;
    return this.round(e.monto / e.participantes.length);
  }

  // ¿Cuánto le toca pagar a `userId` de este gasto en concreto?
  userShareInExpense(e: Expense, userId: string): number {
    if (!e.participantes.includes(userId)) return 0;

    const share = e.participantShares?.find((x) => x.userId === userId);
    switch (e.metodoReparto ?? 'equal') {
      case 'exact':
        return this.round(share?.shareAmount ?? 0);
      case 'percentage':
        return this.round(e.monto * ((share?.sharePercentage ?? 0) / 100));
      case 'weighted': {
        const totalWeight = (e.participantShares ?? [])
          .filter((x) => e.participantes.includes(x.userId))
          .reduce((sum, x) => sum + (x.weight || 0), 0);
        if (totalWeight <= 0) return this.shareForExpense(e);
        return this.round(e.monto * ((share?.weight ?? 1) / totalWeight));
      }
      case 'equal':
      default:
        return this.shareForExpense(e);
    }
  }

  // Balance neto de cada miembro dentro de un viaje.
  tripBalances(tripId: string): UserBalance[] {
    const trip = this.data.getTrip(tripId);
    if (!trip) return [];
    const expenses = this.data.tripExpenses(tripId);

    return trip.memberIds.map((userId) => {
      let pagado = 0;
      let parte = 0;
      for (const e of expenses) {
        if (e.pagadoPor === userId) pagado += e.monto;
        parte += this.userShareInExpense(e, userId);
      }
      pagado = this.round(pagado);
      parte = this.round(parte);
      return { userId, pagado, parte, neto: this.round(pagado - parte) };
    });
  }

  // Gasto total del viaje.
  tripTotal(tripId: string): number {
    return this.round(this.data.tripExpenses(tripId).reduce((s, e) => s + e.monto, 0));
  }

  // Cuánto le corresponde pagar al usuario en todo el viaje ("tu parte").
  userTotalShare(tripId: string, userId: string): number {
    return this.round(this.data.tripExpenses(tripId).reduce((s, e) => s + this.userShareInExpense(e, userId), 0));
  }

  // Liquidaciones mínimas dentro de un viaje (algoritmo voraz acreedor↔deudor).
  tripSettlements(tripId: string): Settlement[] {
    const balances = this.tripBalances(tripId);
    const deudores = balances.filter((b) => b.neto < -0.01).map((b) => ({ id: b.userId, monto: -b.neto }));
    const acreedores = balances.filter((b) => b.neto > 0.01).map((b) => ({ id: b.userId, monto: b.neto }));

    const settlements: Settlement[] = [];
    let i = 0;
    let j = 0;
    while (i < deudores.length && j < acreedores.length) {
      const pago = Math.min(deudores[i].monto, acreedores[j].monto);
      settlements.push({ fromUserId: deudores[i].id, toUserId: acreedores[j].id, monto: this.round(pago) });
      deudores[i].monto = this.round(deudores[i].monto - pago);
      acreedores[j].monto = this.round(acreedores[j].monto - pago);
      if (deudores[i].monto <= 0.01) i++;
      if (acreedores[j].monto <= 0.01) j++;
    }
    return settlements;
  }

  // Neto del usuario en un viaje (positivo: le deben; negativo: debe).
  userNetInTrip(tripId: string, userId: string): number {
    return this.tripBalances(tripId).find((b) => b.userId === userId)?.neto ?? 0;
  }

  // ---------- Visión global (todos los viajes juntos) ----------

  // Deudas netas del usuario frente a cada otra persona, agregadas en todos los viajes.
  //   monto positivo => esa persona le debe al usuario
  //   monto negativo => el usuario le debe a esa persona
  globalPersonBalances(userId: string): { otherId: string; monto: number }[] {
    const map = new Map<string, number>();
    for (const trip of this.data.tripsForUser(userId)) {
      for (const s of this.tripSettlements(trip.id)) {
        if (s.fromUserId === userId) {
          map.set(s.toUserId, (map.get(s.toUserId) ?? 0) - s.monto); // yo le debo
        } else if (s.toUserId === userId) {
          map.set(s.fromUserId, (map.get(s.fromUserId) ?? 0) + s.monto); // me debe
        }
      }
    }
    return [...map.entries()]
      .map(([otherId, monto]) => ({ otherId, monto: this.round(monto) }))
      .filter((x) => Math.abs(x.monto) > 0.01);
  }

  // Gasto total por fecha (para el gráfico del menú principal), sumando todos los viajes.
  spendingByDate(userId: string): { fecha: string; total: number }[] {
    const map = new Map<string, number>();
    for (const trip of this.data.tripsForUser(userId)) {
      for (const e of this.data.tripExpenses(trip.id)) {
        const dia = e.fecha.slice(0, 10);
        map.set(dia, (map.get(dia) ?? 0) + e.monto);
      }
    }
    return [...map.entries()].map(([fecha, total]) => ({ fecha, total: this.round(total) })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
}
