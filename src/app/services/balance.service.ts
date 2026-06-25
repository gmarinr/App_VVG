import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { Expense, Settlement, SettlementStatus, Trip, UserBalance } from '../models/models';

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

  // Balance neto de cada miembro dentro de un viaje (incluye los pagos confirmados).
  tripBalances(tripId: string): UserBalance[] {
    return this.computeTripBalances(tripId, true);
  }

  // Balance "bruto" solo por los gastos (sin descontar pagos). Base para las
  // liquidaciones con estado, que muestran la deuda original y su cobertura.
  private tripBalancesGross(tripId: string): UserBalance[] {
    return this.computeTripBalances(tripId, false);
  }

  private computeTripBalances(tripId: string, includePayments: boolean): UserBalance[] {
    const trip = this.data.getTrip(tripId);
    if (!trip) return [];
    const expenses = this.data.tripExpenses(tripId);
    const paymentAdjustments = new Map<string, number>();

    if (includePayments) {
      for (const payment of this.data.tripPayments(tripId)) {
        paymentAdjustments.set(payment.fromUserId, (paymentAdjustments.get(payment.fromUserId) ?? 0) + payment.monto);
        paymentAdjustments.set(payment.toUserId, (paymentAdjustments.get(payment.toUserId) ?? 0) - payment.monto);
      }
    }

    return trip.memberIds.map((userId) => {
      let pagado = 0;
      let parte = 0;
      for (const e of expenses) {
        if (e.pagadoPor === userId) pagado += e.monto;
        parte += this.userShareInExpense(e, userId);
      }
      pagado = this.round(pagado);
      parte = this.round(parte);
      return { userId, pagado, parte, neto: this.round(pagado - parte + (paymentAdjustments.get(userId) ?? 0)) };
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
    return this.settlementsFromBalances(this.tripBalances(tripId));
  }

  // Algoritmo voraz: empareja deudores con acreedores minimizando transferencias.
  private settlementsFromBalances(balances: UserBalance[]): Settlement[] {
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

  // Liquidaciones según los gastos (deuda original) con su cobertura por pagos confirmados.
  // No desaparecen al saldarse: cada una lleva su estado (pendiente/parcial/saldada).
  tripSettlementStatuses(tripId: string): SettlementStatus[] {
    const gross = this.settlementsFromBalances(this.tripBalancesGross(tripId));
    const confirmados = this.data.tripPayments(tripId);

    return gross.map((s) => {
      const pagado = this.round(
        confirmados
          .filter((p) => p.fromUserId === s.fromUserId && p.toUserId === s.toUserId)
          .reduce((sum, p) => sum + p.monto, 0)
      );
      const pendiente = Math.max(0, this.round(s.monto - pagado));
      const estado: SettlementStatus['estado'] =
        pendiente <= 0.01 ? 'saldada' : pagado > 0.01 ? 'parcial' : 'pendiente';
      return { fromUserId: s.fromUserId, toUserId: s.toUserId, monto: s.monto, pagado, pendiente, estado };
    });
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

  // ---------- Reparto de pagos (saldar deudas) ----------

  // Liquidaciones por viaje donde `meId` le debe a `otherId`, con lo que aún falta por reportar
  // (deuda del viaje menos los pagos pendientes ya reportados), ordenadas del viaje más antiguo al más nuevo.
  personReportableTrips(meId: string, otherId: string): { tripId: string; monto: number }[] {
    const result: { trip: Trip; monto: number }[] = [];
    for (const trip of this.data.tripsForUser(meId)) {
      const settlement = this.tripSettlements(trip.id).find(
        (s) => s.fromUserId === meId && s.toUserId === otherId
      );
      if (!settlement) continue;
      const yaReportado = this.data
        .tripPendingPayments(trip.id)
        .filter((p) => p.fromUserId === meId && p.toUserId === otherId)
        .reduce((sum, p) => sum + p.monto, 0);
      const restante = this.round(settlement.monto - yaReportado);
      if (restante > 0.01) result.push({ trip, monto: restante });
    }
    return result
      .sort((a, b) => +new Date(a.trip.fechaInicio) - +new Date(b.trip.fechaInicio))
      .map((x) => ({ tripId: x.trip.id, monto: x.monto }));
  }

  // Reparte `monto` sobre las deudas de `meId` con `otherId`, del viaje más antiguo al más nuevo.
  // Devuelve cuánto aplicar a cada viaje (para crear una fila de pago por viaje).
  allocateOldestFirst(meId: string, otherId: string, monto: number): { tripId: string; monto: number }[] {
    let restante = this.round(monto);
    const out: { tripId: string; monto: number }[] = [];
    for (const deuda of this.personReportableTrips(meId, otherId)) {
      if (restante <= 0.01) break;
      const aplicar = Math.min(deuda.monto, restante);
      if (aplicar > 0.01) {
        out.push({ tripId: deuda.tripId, monto: this.round(aplicar) });
        restante = this.round(restante - aplicar);
      }
    }
    return out;
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
