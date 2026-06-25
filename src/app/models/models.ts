// Modelos de dominio de VVG (MVP local).
// Diseñados para mapear 1:1 con tablas de Supabase cuando se conecte.

export type ActivityType = 'viaje' | 'salida';
export type ExpenseSplitMethod = 'equal' | 'exact' | 'percentage' | 'weighted';

export interface User {
  id: string;
  email: string;
  password: string; // MVP local: texto plano. Reemplazar por Supabase Auth.
  nombre: string;
  alias: string;
  descripcion?: string;
  avatarColor: string; // color generado para el avatar de iniciales
  friendIds: string[];
}

export interface Trip {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: ActivityType;
  fechaInicio: string; // ISO
  fechaFin?: string; // ISO
  ownerId: string;
  memberIds: string[];
  finalizado: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  tripId: string;
  titulo: string;
  monto: number;
  pagadoPor: string; // userId
  participantes: string[]; // userIds que comparten el gasto
  metodoReparto: ExpenseSplitMethod;
  participantShares: ExpenseParticipantShare[];
  fecha: string; // ISO (fecha del gasto)
  createdAt: string;
}

export interface ExpenseParticipantShare {
  userId: string;
  weight: number;
  shareAmount?: number;
  sharePercentage?: number;
}

export interface Photo {
  id: string;
  tripId: string;
  dataUrl: string; // base64
  uploadedBy: string;
  fecha: string; // ISO
}

export type PaymentStatus = 'pending' | 'paid' | 'cancelled';

export interface Payment {
  id: string;
  tripId: string;
  fromUserId: string;
  toUserId: string;
  monto: number;
  status: PaymentStatus;
  createdBy: string;
  paidAt?: string;
  createdAt: string;
}

export type ChatType = 'dm' | 'grupo';

export interface Chat {
  id: string;
  tipo: ChatType;
  nombre?: string; // para grupos
  memberIds: string[];
  memberLastReadAt: Record<string, string | null>;
  tripId?: string; // si es chat de un viaje/salida
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  texto: string;
  fecha: string; // ISO
}

// ---- Tipos derivados (no se persisten) ----

// Balance neto de un usuario dentro de un viaje:
//   positivo  => le deben dinero
//   negativo  => debe dinero
export interface UserBalance {
  userId: string;
  pagado: number; // total que pagó
  parte: number; // total que le corresponde (su consumo)
  neto: number; // pagado - parte
}

// Una transferencia sugerida para saldar cuentas.
export interface Settlement {
  fromUserId: string; // quien debe pagar
  toUserId: string; // quien debe recibir
  monto: number;
}

export type SettlementState = 'pendiente' | 'parcial' | 'saldada';

// Liquidación "bruta" (según los gastos) con su cobertura por pagos confirmados.
// Permite mostrar cuentas saldadas/parciales sin que desaparezcan del historial.
export interface SettlementStatus {
  fromUserId: string;
  toUserId: string;
  monto: number; // deuda original por los gastos
  pagado: number; // confirmado de fromUser -> toUser
  pendiente: number; // monto - pagado (>= 0)
  estado: SettlementState;
}
