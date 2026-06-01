import type { AppSettings, CashBox, CorporateClient, Driver, PaymentRule } from "./types";

export const cashBoxes: CashBox[] = [
  { id: "cash-mi-chofer", name: "Caja Efectivo Mi Chofer", currency: "ARS" },
  { id: "cash-uber", name: "Caja Efectivo Uber", currency: "ARS" },
  { id: "mercado-pago", name: "Caja Mercado Pago", currency: "ARS" },
  { id: "galicia-paul", name: "Banco Galicia Paul", currency: "ARS" },
  { id: "dollars", name: "Caja Dolares", currency: "USD" },
  { id: "usdt", name: "Caja USDT", currency: "USDT" }
];

export const driversFromExcel: Driver[] = [
  { id: "paul", name: "Paul", commissionRate: 0.2, active: true },
  { id: "gaston", name: "Gaston", commissionRate: 0.7, active: true },
  { id: "kevin", name: "Kevin", commissionRate: 0.6, active: true },
  { id: "christian", name: "Christian", commissionRate: 0.6, active: true },
  { id: "ale", name: "Ale", commissionRate: 0.3, active: true },
  { id: "juan", name: "Juan", commissionRate: 0.3, active: true },
  { id: "fabio", name: "Fabio", commissionRate: 0.6, active: true },
  { id: "sam", name: "Sam", commissionRate: 0.6, active: true },
  { id: "mario", name: "Mario", commissionRate: 0.6, active: true },
  { id: "robinson", name: "Robinson", commissionRate: 0.6, active: true },
  { id: "adriana", name: "Adriana", commissionRate: 0.3, active: true },
  { id: "ivan", name: "Ivan", commissionRate: 0.8, active: true },
  { id: "lucas-cabrera", name: "Lucas Cabrera", commissionRate: 0.6, active: true },
  { id: "adrian-acosta", name: "Adrian Acosta", commissionRate: 0.6, active: true },
  { id: "mike", name: "Mike", commissionRate: 0.6, active: true }
];

export const corporateClientsFromExcel: CorporateClient[] = [
  { id: "mi-chofer", name: "MI CHOFER", type: "MI_CHOFER", commissionRate: 0, allowsAdvanceBalance: true },
  { id: "colegio", name: "COLEGIO", type: "COLEGIO", commissionRate: 0, allowsAdvanceBalance: true },
  { id: "uber", name: "UBER", type: "UBER", commissionRate: 0, allowsAdvanceBalance: false },
  { id: "hotel-wyndham", name: "HOTEL WYNDHAM", type: "HOTEL", commissionRate: 0.05, allowsAdvanceBalance: false },
  { id: "cabify", name: "CABIFY", type: "CABIFY", commissionRate: 0, allowsAdvanceBalance: false }
];

export const paymentRulesFromExcel: PaymentRule[] = [
  { method: "CASH_MI_CHOFER", label: "Efectivo Mi Chofer", cashBoxId: "cash-mi-chofer", feeRate: 0 },
  { method: "CASH_UBER", label: "Efectivo Uber", cashBoxId: "cash-uber", feeRate: 0 },
  { method: "MERCADO_PAGO", label: "Transferencia Mercado Pago", cashBoxId: "mercado-pago", feeRate: 0.15 },
  {
    method: "POSNET",
    label: "Posnet Mercado Pago",
    cashBoxId: "mercado-pago",
    feeRate: 0.15,
    posnetNetFactor: 0.8876,
    posnetSettlementDivisor: 1.15
  },
  { method: "BANCO_GALICIA_PAUL", label: "Banco Galicia Paul", cashBoxId: "galicia-paul", feeRate: 0 },
  { method: "TRANSFER", label: "Transferencia", cashBoxId: "mercado-pago", feeRate: 0 },
  { method: "DOLLARS", label: "Dolares Efectivo", cashBoxId: "dollars", feeRate: 0 },
  { method: "USDT", label: "USDT", cashBoxId: "usdt", feeRate: 0 },
  { method: "ADVANCE", label: "Pago adelantado", cashBoxId: null, feeRate: 0 },
  { method: "PENDING", label: "Pendiente", cashBoxId: null, feeRate: 0 },
  { method: "BONIFICADO", label: "Bonificado", cashBoxId: null, feeRate: 0 }
];

export const defaultSettings: AppSettings = {
  minimumFare: 15000,
  peakMultiplier: 1.15,
  cardSurcharge: 0.15,
  hotelSurcharge: 0.05,
  defaultTolls: 0,
  fareTiers: [
    { id: "tier-0-10", fromKm: 0, toKm: 10, pricePerKm: 1850 },
    { id: "tier-10-25", fromKm: 10, toKm: 25, pricePerKm: 1700 },
    { id: "tier-25-plus", fromKm: 25, toKm: null, pricePerKm: 1600 }
  ],
  drivers: driversFromExcel,
  corporateClients: corporateClientsFromExcel,
  paymentRules: paymentRulesFromExcel,
  expenseCategories: [
    "Nafta",
    "Peajes",
    "Comisiones Choferes",
    "Service Auto",
    "Repuestos auto",
    "Estacionamientos",
    "Sueldos",
    "Servicios",
    "Impuestos",
    "Mantenimiento",
    "Otros"
  ],
  incomeCategories: [
    "Abona Saldo Pendiente",
    "Abona Pago Adelantado",
    "Rendimientos MP",
    "Traspaso de saldo",
    "Inyeccion Capital",
    "Comisiones",
    "Conciliacion"
  ]
};
