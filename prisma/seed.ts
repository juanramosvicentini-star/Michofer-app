import { PrismaClient } from "@prisma/client";
import { cashBoxes, defaultSettings } from "../src/lib/domain/settings";
import { demoExpenses, demoIncomes, demoTrips } from "../src/lib/domain/seed-data";

const prisma = new PrismaClient();

async function main() {
  for (const box of cashBoxes) {
    await prisma.cashBox.upsert({
      where: { id: box.id },
      update: {
        name: box.name,
        currency: box.currency
      },
      create: {
        id: box.id,
        name: box.name,
        currency: box.currency
      }
    });
  }

  for (const driver of defaultSettings.drivers) {
    await prisma.driver.upsert({
      where: { id: driver.id },
      update: {
        name: driver.name,
        commissionRate: driver.commissionRate,
        active: driver.active
      },
      create: {
        id: driver.id,
        name: driver.name,
        commissionRate: driver.commissionRate,
        active: driver.active
      }
    });
  }

  for (const client of defaultSettings.corporateClients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: {
        name: client.name,
        type: client.type,
        commissionRate: client.commissionRate,
        allowsAdvanceBalance: client.allowsAdvanceBalance
      },
      create: {
        id: client.id,
        name: client.name,
        type: client.type,
        commissionRate: client.commissionRate,
        allowsAdvanceBalance: client.allowsAdvanceBalance
      }
    });
  }

  for (const tier of defaultSettings.fareTiers) {
    await prisma.fareTier.upsert({
      where: { id: tier.id },
      update: {
        fromKm: tier.fromKm,
        toKm: tier.toKm,
        pricePerKm: tier.pricePerKm
      },
      create: {
        id: tier.id,
        fromKm: tier.fromKm,
        toKm: tier.toKm,
        pricePerKm: tier.pricePerKm
      }
    });
  }

  for (const rule of defaultSettings.paymentRules) {
    await prisma.paymentMethodConfig.upsert({
      where: { method: rule.method },
      update: {
        label: rule.label,
        cashBoxId: rule.cashBoxId,
        feeRate: rule.feeRate,
        posnetNetFactor: rule.posnetNetFactor,
        posnetSettlementDivisor: rule.posnetSettlementDivisor
      },
      create: {
        method: rule.method,
        label: rule.label,
        cashBoxId: rule.cashBoxId,
        feeRate: rule.feeRate,
        posnetNetFactor: rule.posnetNetFactor,
        posnetSettlementDivisor: rule.posnetSettlementDivisor
      }
    });
  }

  for (const name of defaultSettings.expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const name of defaultSettings.incomeCategories) {
    await prisma.incomeCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const trip of demoTrips) {
    await prisma.trip.upsert({
      where: { id: trip.id },
      update: {},
      create: {
        id: trip.id,
        date: new Date(trip.date),
        time: trip.time,
        driverId: trip.driverId,
        clientId: trip.corporateClientId,
        passenger: trip.passenger,
        origin: trip.origin,
        destination: trip.destination,
        kilometers: trip.kilometers,
        waitValue: trip.waitValue,
        totalAmount: trip.totalAmount,
        dollarAmount: trip.dollarAmount,
        chargeType: trip.chargeType,
        paymentMethod: trip.paymentMethod,
        paidMethod: trip.paidMethod,
        sharedTrip: trip.sharedTrip,
        secondPassenger: trip.secondPassenger,
        status: trip.status,
        paidAt: trip.paidAt ? new Date(trip.paidAt) : undefined,
        observations: trip.observations
      }
    });
  }

  for (const income of demoIncomes) {
    await prisma.income.upsert({
      where: { id: income.id },
      update: {},
      create: {
        id: income.id,
        date: new Date(income.date),
        paymentMethod: income.paymentMethod,
        categoryName: income.category,
        description: income.description,
        amount: income.amount,
        currency: income.currency
      }
    });
  }

  for (const expense of demoExpenses) {
    await prisma.expense.upsert({
      where: { id: expense.id },
      update: {},
      create: {
        id: expense.id,
        date: new Date(expense.date),
        paymentMethod: expense.paymentMethod,
        categoryName: expense.category,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        driverId: expense.driverId
      }
    });
  }

  await prisma.setting.upsert({
    where: { key: "excel_migration_notes" },
    update: {
      value: {
        workbook: "CAJA 2026 - FINANZAS MI CHOFER",
        sheets: ["Viajes", "Ingresos", "Gastos", "Caja Diaria", "Pendientes", "C Corriente", "Pagos choferes", "Datos"],
        posnetNetFactor: 0.8876,
        posnetSettlementDivisor: 1.15,
        schoolTripUnit: 16200
      }
    },
    create: {
      key: "excel_migration_notes",
      value: {
        workbook: "CAJA 2026 - FINANZAS MI CHOFER",
        sheets: ["Viajes", "Ingresos", "Gastos", "Caja Diaria", "Pendientes", "C Corriente", "Pagos choferes", "Datos"],
        posnetNetFactor: 0.8876,
        posnetSettlementDivisor: 1.15,
        schoolTripUnit: 16200
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
