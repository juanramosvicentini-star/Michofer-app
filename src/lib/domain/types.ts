export type UserRole = "ADMIN" | "OWNER" | "ADMIN_STAFF" | "DRIVER";

export type PaymentMethod =
  | "CASH_MI_CHOFER"
  | "CASH_UBER"
  | "MERCADO_PAGO"
  | "POSNET"
  | "BANCO_GALICIA_PAUL"
  | "TRANSFER"
  | "DOLLARS"
  | "USDT"
  | "ADVANCE"
  | "PENDING"
  | "BONIFICADO";

export type ChargeType = "COBRADO_EN_EL_MOMENTO" | "PENDIENTE" | "ADELANTADO";
export type TripStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type ClientType = "MI_CHOFER" | "COLEGIO" | "HOTEL" | "UBER" | "CABIFY" | "PERSONAL";
export type MovementDirection = "IN" | "OUT";
export type AccountMovementType = "DEBT" | "PAYMENT" | "CREDIT" | "CONSUMPTION" | "COMMISSION" | "ADJUSTMENT";

export type Driver = {
  id: string;
  name: string;
  commissionRate: number;
  active: boolean;
};

export type CorporateClient = {
  id: string;
  name: string;
  type: ClientType;
  commissionRate: number;
  allowsAdvanceBalance: boolean;
};

export type FareTier = {
  id: string;
  fromKm: number;
  toKm: number | null;
  pricePerKm: number;
};

export type PaymentRule = {
  method: PaymentMethod;
  label: string;
  cashBoxId: string | null;
  feeRate: number;
  posnetNetFactor?: number;
  posnetSettlementDivisor?: number;
};

export type AppSettings = {
  minimumFare: number;
  peakMultiplier: number;
  cardSurcharge: number;
  hotelSurcharge: number;
  defaultTolls: number;
  fareTiers: FareTier[];
  drivers: Driver[];
  corporateClients: CorporateClient[];
  paymentRules: PaymentRule[];
  expenseCategories: string[];
  incomeCategories: string[];
};

export type Trip = {
  id: string;
  date: string;
  time: string;
  driverId: string;
  corporateClientId: string;
  passenger: string;
  origin: string;
  destination: string;
  kilometers: number;
  waitValue: number;
  totalAmount: number;
  dollarAmount?: number;
  chargeType: ChargeType;
  paymentMethod: PaymentMethod;
  sharedTrip: boolean;
  secondPassenger?: string;
  status: TripStatus;
  paidAt?: string;
  paidMethod?: PaymentMethod;
  observations?: string;
};

export type ManualIncome = {
  id: string;
  date: string;
  paymentMethod: PaymentMethod;
  category: string;
  currency: "ARS" | "USD" | "USDT";
  description: string;
  amount: number;
};

export type Expense = {
  id: string;
  date: string;
  paymentMethod: PaymentMethod;
  category: string;
  description: string;
  amount: number;
  currency: "ARS" | "USD" | "USDT";
  driverId?: string;
};

export type CashBox = {
  id: string;
  name: string;
  currency: "ARS" | "USD" | "USDT";
};

export type CashMovement = {
  id: string;
  date: string;
  boxId: string;
  direction: MovementDirection;
  amount: number;
  concept: string;
  sourceType: "TRIP" | "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  sourceId: string;
};

export type CurrentAccountMovement = {
  id: string;
  date: string;
  clientId: string;
  type: AccountMovementType;
  amount: number;
  concept: string;
  tripId?: string;
};

export type DriverSettlementLine = {
  tripId: string;
  date: string;
  driverId: string;
  grossAmount: number;
  netAfterCollectionFee: number;
  driverRate: number;
  driverAmount: number;
  companyAmount: number;
  paymentMethod: PaymentMethod;
};

export type DashboardMetrics = {
  referenceDate: string;
  dayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  completedTrips: number;
  pendingTrips: number;
  totalCash: number;
  clientDebt: number;
  clientCredit: number;
  driverDebt: number;
  operatingResult: number;
};
