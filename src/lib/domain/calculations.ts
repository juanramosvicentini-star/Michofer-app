import { addDays, endOfISOWeek, format, isSameDay, isSameMonth, isSameWeek, isSameYear, parseISO, startOfISOWeek } from "date-fns";
import type {
  AppSettings,
  CashMovement,
  CurrentAccountMovement,
  DashboardMetrics,
  DriverSettlementLine,
  Expense,
  ManualIncome,
  PaymentMethod,
  Trip
} from "./types";
import { cashBoxes } from "./settings";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getDriver(settings: AppSettings, driverId: string) {
  return settings.drivers.find((driver) => driver.id === driverId);
}

export function getCorporateClient(settings: AppSettings, corporateClientId: string) {
  return settings.corporateClients.find((client) => client.id === corporateClientId);
}

export function getPaymentRule(settings: AppSettings, method: PaymentMethod) {
  return settings.paymentRules.find((rule) => rule.method === method);
}

export function getPaymentLabel(settings: AppSettings, method: PaymentMethod) {
  return getPaymentRule(settings, method)?.label ?? method;
}

export function calculateTripPrice(kilometers: number, waitValue: number, settings: AppSettings) {
  const distancePrice = calculateTieredDistancePrice(kilometers, settings);
  return roundMoney(Math.max(settings.minimumFare, distancePrice) + waitValue);
}

export function calculateTieredDistancePrice(kilometers: number, settings: AppSettings) {
  const tiers = [...settings.fareTiers].sort((a, b) => a.fromKm - b.fromKm);

  return roundMoney(
    tiers.reduce((total, tier) => {
      const tierEnd = tier.toKm ?? kilometers;
      const kmInTier = Math.max(0, Math.min(kilometers, tierEnd) - tier.fromKm);
      return total + kmInTier * tier.pricePerKm;
    }, 0)
  );
}

export function calculatePassengerQuote(input: {
  kilometers: number;
  waitValue: number;
  timeMode: "normal" | "peak";
  hotelTrip: boolean;
  includeTolls: boolean;
  manualTolls: number;
  settings: AppSettings;
}) {
  const distancePrice = calculateTieredDistancePrice(input.kilometers, input.settings);
  const minimumApplied = Math.max(0, input.settings.minimumFare - distancePrice);
  const subtotal = Math.max(input.settings.minimumFare, distancePrice) + input.waitValue;
  const peakSurcharge = input.timeMode === "peak" ? subtotal * (input.settings.peakMultiplier - 1) : 0;
  const afterPeak = subtotal + peakSurcharge;
  const hotelSurcharge = input.hotelTrip ? afterPeak * input.settings.hotelSurcharge : 0;
  const tolls = input.includeTolls ? input.manualTolls + input.settings.defaultTolls : 0;
  const cashTransferTotal = afterPeak + hotelSurcharge + tolls;
  const cardSurcharge = cashTransferTotal * input.settings.cardSurcharge;
  const cardTotal = cashTransferTotal + cardSurcharge;

  return {
    distancePrice: roundMoney(distancePrice),
    minimumApplied: roundMoney(minimumApplied),
    waitValue: roundMoney(input.waitValue),
    subtotal: roundMoney(subtotal),
    peakSurcharge: roundMoney(peakSurcharge),
    hotelSurcharge: roundMoney(hotelSurcharge),
    tolls: roundMoney(tolls),
    cashTransferTotal: roundMoney(cashTransferTotal),
    cardSurcharge: roundMoney(cardSurcharge),
    cardTotal: roundMoney(cardTotal)
  };
}

export function posnetNetAmount(grossAmount: number, settings: AppSettings) {
  const rule = getPaymentRule(settings, "POSNET");
  const divisor = rule?.posnetSettlementDivisor ?? 1.15;
  return Math.ceil(grossAmount / divisor / 100) * 100;
}

export function calculateNetAfterCollectionFee(grossAmount: number, method: PaymentMethod, settings: AppSettings) {
  const rule = getPaymentRule(settings, method);

  if (!rule) return grossAmount;
  if (method === "POSNET") return posnetNetAmount(grossAmount, settings);
  if (rule.feeRate > 0) return roundMoney(grossAmount * (1 - rule.feeRate));
  return grossAmount;
}

export function calculateCorporateCommission(trip: Trip, settings: AppSettings) {
  const client = getCorporateClient(settings, trip.corporateClientId);
  const commissionRate = client?.commissionRate ?? 0;
  return roundMoney(trip.totalAmount * commissionRate);
}

export function calculateTripBreakdown(input: {
  kilometers: number;
  waitValue: number;
  manualAmount?: number;
  driverId: string;
  corporateClientId: string;
  paymentMethod: PaymentMethod;
  sharedTrip?: boolean;
  settings: AppSettings;
}) {
  const baseAmount = calculateTripPrice(input.kilometers, input.waitValue, input.settings);
  const grossAmount = input.manualAmount && input.manualAmount > 0 ? input.manualAmount : baseAmount;
  const driver = getDriver(input.settings, input.driverId);
  const client = getCorporateClient(input.settings, input.corporateClientId);
  const paymentRule = getPaymentRule(input.settings, input.paymentMethod);
  const collectionFee =
    input.paymentMethod === "POSNET"
      ? roundMoney(grossAmount - posnetNetAmount(grossAmount, input.settings))
      : roundMoney(grossAmount * (paymentRule?.feeRate ?? 0));
  const netAfterCollectionFee = calculateNetAfterCollectionFee(grossAmount, input.paymentMethod, input.settings);
  const driverRate = driver?.commissionRate ?? 0;
  const driverAmount = roundMoney(netAfterCollectionFee * driverRate);
  const companyAmount = roundMoney(netAfterCollectionFee - driverAmount);
  const corporateCommission = roundMoney(grossAmount * (client?.commissionRate ?? 0));
  const accountConsumption = input.sharedTrip ? roundMoney(grossAmount / 2) : grossAmount;

  return {
    baseAmount,
    grossAmount,
    collectionFee,
    netAfterCollectionFee,
    driverRate,
    driverAmount,
    companyAmount,
    corporateCommission,
    accountConsumption,
    cashBoxId: paymentRule?.cashBoxId ?? null,
    cashBoxName: cashBoxes.find((box) => box.id === paymentRule?.cashBoxId)?.name ?? "Cuenta corriente",
    paymentLabel: paymentRule?.label ?? input.paymentMethod,
    driverName: driver?.name ?? input.driverId,
    clientName: client?.name ?? input.corporateClientId
  };
}

export function calculateDriverSettlementLine(trip: Trip, settings: AppSettings): DriverSettlementLine {
  const driver = getDriver(settings, trip.driverId);
  const driverRate = driver?.commissionRate ?? 0;
  const paidMethod = trip.paidMethod ?? trip.paymentMethod;
  const netAfterCollectionFee = calculateNetAfterCollectionFee(trip.totalAmount, paidMethod, settings);
  const driverAmount = roundMoney(netAfterCollectionFee * driverRate);

  return {
    tripId: trip.id,
    date: trip.date,
    driverId: trip.driverId,
    grossAmount: trip.totalAmount,
    netAfterCollectionFee,
    driverRate,
    driverAmount,
    companyAmount: roundMoney(netAfterCollectionFee - driverAmount),
    paymentMethod: paidMethod
  };
}

export function createCashMovements(trips: Trip[], incomes: ManualIncome[], expenses: Expense[], settings: AppSettings): CashMovement[] {
  const movements: CashMovement[] = [];

  trips
    .filter((trip) => trip.status === "COMPLETED")
    .forEach((trip) => {
      const method = trip.paidMethod ?? trip.paymentMethod;
      const rule = getPaymentRule(settings, method);
      if (!rule?.cashBoxId) return;

      const amount = method === "DOLLARS" || method === "USDT" ? trip.dollarAmount ?? trip.totalAmount : trip.totalAmount;
      movements.push({
        id: `mov-trip-${trip.id}`,
        date: trip.paidAt ?? trip.date,
        boxId: rule.cashBoxId,
        direction: "IN",
        amount,
        concept: `Viaje ${trip.passenger}`,
        sourceType: "TRIP",
        sourceId: trip.id
      });
    });

  incomes.forEach((income) => {
    const rule = getPaymentRule(settings, income.paymentMethod);
    if (!rule?.cashBoxId) return;

    movements.push({
      id: `mov-income-${income.id}`,
      date: income.date,
      boxId: rule.cashBoxId,
      direction: "IN",
      amount: income.amount,
      concept: income.category,
      sourceType: "INCOME",
      sourceId: income.id
    });
  });

  expenses.forEach((expense) => {
    const rule = getPaymentRule(settings, expense.paymentMethod);
    if (!rule?.cashBoxId) return;

    movements.push({
      id: `mov-expense-${expense.id}`,
      date: expense.date,
      boxId: rule.cashBoxId,
      direction: "OUT",
      amount: expense.amount,
      concept: expense.category,
      sourceType: "EXPENSE",
      sourceId: expense.id
    });
  });

  return movements.sort((a, b) => a.date.localeCompare(b.date));
}

export function createCurrentAccountMovements(trips: Trip[], incomes: ManualIncome[], settings: AppSettings): CurrentAccountMovement[] {
  const movements: CurrentAccountMovement[] = [];

  trips.forEach((trip) => {
    const client = getCorporateClient(settings, trip.corporateClientId);
    const clientId = trip.corporateClientId;

    if (trip.chargeType === "PENDIENTE") {
      movements.push({
        id: `cc-debt-${trip.id}`,
        date: trip.date,
        clientId,
        type: "DEBT",
        amount: trip.totalAmount,
        concept: `Viaje pendiente - ${trip.passenger}`,
        tripId: trip.id
      });
    }

    if (trip.paidAt && trip.paidMethod && trip.chargeType === "PENDIENTE") {
      movements.push({
        id: `cc-payment-${trip.id}`,
        date: trip.paidAt,
        clientId,
        type: "PAYMENT",
        amount: -trip.totalAmount,
        concept: `Cobro de viaje - ${trip.passenger}`,
        tripId: trip.id
      });
    }

    if (trip.chargeType === "ADELANTADO" && client?.allowsAdvanceBalance) {
      const consumption = trip.sharedTrip && trip.secondPassenger ? trip.totalAmount / 2 : trip.totalAmount;
      movements.push({
        id: `cc-consumption-${trip.id}`,
        date: trip.date,
        clientId,
        type: "CONSUMPTION",
        amount: consumption,
        concept: `Consumo adelanto - ${trip.passenger}`,
        tripId: trip.id
      });

      if (trip.sharedTrip && trip.secondPassenger) {
        movements.push({
          id: `cc-consumption-second-${trip.id}`,
          date: trip.date,
          clientId,
          type: "CONSUMPTION",
          amount: consumption,
          concept: `Consumo adelanto compartido - ${trip.secondPassenger}`,
          tripId: trip.id
        });
      }
    }

    const corporateCommission = calculateCorporateCommission(trip, settings);
    if (corporateCommission > 0) {
      movements.push({
        id: `cc-commission-${trip.id}`,
        date: trip.date,
        clientId,
        type: "COMMISSION",
        amount: corporateCommission,
        concept: `Comision corporativa ${client?.name ?? ""}`.trim(),
        tripId: trip.id
      });
    }
  });

  incomes.forEach((income) => {
    if (income.category.toLowerCase().includes("adelantado")) {
      movements.push({
        id: `cc-credit-${income.id}`,
        date: income.date,
        clientId: "colegio",
        type: "CREDIT",
        amount: -income.amount,
        concept: income.description
      });
    }

    if (income.category.toLowerCase().includes("saldo pendiente")) {
      movements.push({
        id: `cc-income-payment-${income.id}`,
        date: income.date,
        clientId: "mi-chofer",
        type: "PAYMENT",
        amount: -income.amount,
        concept: income.description
      });
    }
  });

  return movements.sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizeCashBoxes(movements: CashMovement[]) {
  return cashBoxes.map((box) => {
    const boxMovements = movements.filter((movement) => movement.boxId === box.id);
    const income = boxMovements.filter((movement) => movement.direction === "IN").reduce((sum, movement) => sum + movement.amount, 0);
    const outcome = boxMovements.filter((movement) => movement.direction === "OUT").reduce((sum, movement) => sum + movement.amount, 0);
    return {
      ...box,
      income: roundMoney(income),
      outcome: roundMoney(outcome),
      balance: roundMoney(income - outcome),
      movements: boxMovements
    };
  });
}

export function summarizeCurrentAccounts(movements: CurrentAccountMovement[], settings: AppSettings) {
  return settings.corporateClients.map((client) => {
    const clientMovements = movements.filter((movement) => movement.clientId === client.id);
    const balance = roundMoney(clientMovements.reduce((sum, movement) => sum + movement.amount, 0));

    return {
      client,
      balance,
      debt: balance > 0 ? balance : 0,
      credit: balance < 0 ? Math.abs(balance) : 0,
      movements: clientMovements
    };
  });
}

export function buildDriverSettlements(trips: Trip[], expenses: Expense[], settings: AppSettings) {
  const completedLines = trips
    .filter((trip) => trip.status === "COMPLETED")
    .map((trip) => calculateDriverSettlementLine(trip, settings));

  const grouped = new Map<string, DriverSettlementLine[]>();

  completedLines.forEach((line) => {
    const date = parseISO(line.date);
    const weekKey = `${format(startOfISOWeek(date), "yyyy-MM-dd")}_${line.driverId}`;
    grouped.set(weekKey, [...(grouped.get(weekKey) ?? []), line]);
  });

  return Array.from(grouped.entries())
    .map(([key, lines]) => {
      const [weekStart, driverId] = key.split("_");
      const paid = expenses
        .filter((expense) => expense.category === "Comisiones Choferes" && expense.driverId === driverId)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const gross = lines.reduce((sum, line) => sum + line.grossAmount, 0);
      const net = lines.reduce((sum, line) => sum + line.netAfterCollectionFee, 0);
      const driverAmount = lines.reduce((sum, line) => sum + line.driverAmount, 0);

      return {
        id: key,
        driverId,
        weekStart,
        weekEnd: format(endOfISOWeek(parseISO(weekStart)), "yyyy-MM-dd"),
        gross: roundMoney(gross),
        net: roundMoney(net),
        driverAmount: roundMoney(driverAmount),
        paid: roundMoney(paid),
        pending: roundMoney(driverAmount - paid),
        lines
      };
    })
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export function buildDashboard(trips: Trip[], incomes: ManualIncome[], expenses: Expense[], settings: AppSettings) {
  const sortedTripDates = trips.map((trip) => trip.date).sort();
  const reference = sortedTripDates[sortedTripDates.length - 1] ?? format(new Date(), "yyyy-MM-dd");
  const referenceDate = parseISO(reference);
  const completedTrips = trips.filter((trip) => trip.status === "COMPLETED");
  const revenueTrips = completedTrips.filter((trip) => trip.chargeType !== "PENDIENTE" || trip.paidAt);
  const tripRevenue = (items: Trip[]) => items.reduce((sum, trip) => sum + trip.totalAmount, 0);
  const manualIncome = (predicate: (income: ManualIncome) => boolean) =>
    incomes.filter(predicate).reduce((sum, income) => sum + income.amount, 0);

  const metrics: DashboardMetrics = {
    referenceDate: reference,
    dayRevenue:
      tripRevenue(revenueTrips.filter((trip) => isSameDay(parseISO(trip.paidAt ?? trip.date), referenceDate))) +
      manualIncome((income) => isSameDay(parseISO(income.date), referenceDate)),
    weekRevenue:
      tripRevenue(revenueTrips.filter((trip) => isSameWeek(parseISO(trip.paidAt ?? trip.date), referenceDate, { weekStartsOn: 1 }))) +
      manualIncome((income) => isSameWeek(parseISO(income.date), referenceDate, { weekStartsOn: 1 })),
    monthRevenue:
      tripRevenue(revenueTrips.filter((trip) => isSameMonth(parseISO(trip.paidAt ?? trip.date), referenceDate))) +
      manualIncome((income) => isSameMonth(parseISO(income.date), referenceDate)),
    yearRevenue:
      tripRevenue(revenueTrips.filter((trip) => isSameYear(parseISO(trip.paidAt ?? trip.date), referenceDate))) +
      manualIncome((income) => isSameYear(parseISO(income.date), referenceDate)),
    completedTrips: completedTrips.length,
    pendingTrips: trips.filter((trip) => trip.status === "PENDING" || trip.chargeType === "PENDIENTE").length,
    totalCash: 0,
    clientDebt: 0,
    clientCredit: 0,
    driverDebt: 0,
    operatingResult: 0
  };

  const cashMovements = createCashMovements(trips, incomes, expenses, settings);
  const cashBoxesSummary = summarizeCashBoxes(cashMovements);
  const accountMovements = createCurrentAccountMovements(trips, incomes, settings);
  const accounts = summarizeCurrentAccounts(accountMovements, settings);
  const settlements = buildDriverSettlements(trips, expenses, settings);

  metrics.totalCash = roundMoney(cashBoxesSummary.reduce((sum, box) => sum + box.balance, 0));
  metrics.clientDebt = roundMoney(accounts.reduce((sum, account) => sum + account.debt, 0));
  metrics.clientCredit = roundMoney(accounts.reduce((sum, account) => sum + account.credit, 0));
  metrics.driverDebt = roundMoney(settlements.reduce((sum, settlement) => sum + Math.max(settlement.pending, 0), 0));
  metrics.operatingResult = roundMoney(
    metrics.yearRevenue -
      expenses.reduce((sum, expense) => sum + expense.amount, 0) -
      settlements.reduce((sum, settlement) => sum + settlement.driverAmount, 0)
  );

  const monthStarts = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(referenceDate);
    month.setMonth(referenceDate.getMonth() - (5 - index));
    month.setDate(1);
    return month;
  });

  const monthly = monthStarts.map((month) => {
    const label = format(month, "MMM yyyy");
    const sales =
      tripRevenue(revenueTrips.filter((trip) => isSameMonth(parseISO(trip.paidAt ?? trip.date), month))) +
      manualIncome((income) => isSameMonth(parseISO(income.date), month));
    const costs = expenses.filter((expense) => isSameMonth(parseISO(expense.date), month)).reduce((sum, expense) => sum + expense.amount, 0);
    return {
      month: label,
      ventas: roundMoney(sales),
      gastos: roundMoney(costs),
      flujo: roundMoney(sales - costs),
      rentabilidad: sales > 0 ? roundMoney((sales - costs) / sales) : 0
    };
  });

  const topClients = settings.corporateClients
    .map((client) => ({
      name: client.name,
      value: tripRevenue(completedTrips.filter((trip) => trip.corporateClientId === client.id))
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const topDrivers = settings.drivers
    .map((driver) => ({
      name: driver.name,
      value: tripRevenue(completedTrips.filter((trip) => trip.driverId === driver.id))
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const paymentDistribution = settings.paymentRules
    .map((rule) => ({
      name: rule.label,
      value: tripRevenue(completedTrips.filter((trip) => (trip.paidMethod ?? trip.paymentMethod) === rule.method))
    }))
    .filter((item) => item.value > 0);

  const nextSevenDays = Array.from({ length: 7 }, (_, index) => format(addDays(startOfISOWeek(referenceDate), index), "yyyy-MM-dd"));

  return {
    metrics,
    cashMovements,
    cashBoxes: cashBoxesSummary,
    accounts,
    settlements,
    monthly,
    topClients,
    topDrivers,
    paymentDistribution,
    weekDays: nextSevenDays
  };
}
