"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import Image from "next/image";
import {
  AreaChart,
  BarChart3,
  CalendarClock,
  Car,
  CheckCircle2,
  CircleDollarSign,
  Calculator,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  LineChart,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserCheck,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { GoogleMapsCalculator } from "@/components/google-maps-calculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { buildDashboard, calculateTripPrice, getPaymentLabel } from "@/lib/domain/calculations";
import { demoExpenses, demoIncomes, demoTrips } from "@/lib/domain/seed-data";
import { defaultSettings } from "@/lib/domain/settings";
import type { AppSettings, ChargeType, Expense, ManualIncome, PaymentMethod, Trip } from "@/lib/domain/types";
import { cn, formatMoney, formatPercent, makeId, toInputDate } from "@/lib/utils";

type ViewId = "dashboard" | "calculadora" | "viajes" | "cuentas" | "liquidaciones" | "cajas" | "movimientos" | "config" | "auditoria";

const views: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calculadora", label: "Calculadora", icon: Calculator },
  { id: "viajes", label: "Viajes", icon: Car },
  { id: "cuentas", label: "Cuentas", icon: WalletCards },
  { id: "liquidaciones", label: "Liquidaciones", icon: UserCheck },
  { id: "cajas", label: "Cajas", icon: Landmark },
  { id: "movimientos", label: "Gastos e ingresos", icon: ReceiptText },
  { id: "config", label: "Configuracion", icon: Settings },
  { id: "auditoria", label: "Auditoria", icon: ShieldCheck }
];

const chartColors = ["#071033", "#b99a5f", "#3560a8", "#c47c3c", "#6b7280", "#0f766e"];

const defaultTripForm = {
  date: toInputDate(new Date()),
  time: "09:00",
  driverId: "paul",
  corporateClientId: "mi-chofer",
  passenger: "",
  origin: "",
  destination: "",
  kilometers: 10,
  waitValue: 0,
  totalAmount: 0,
  chargeType: "PENDIENTE" as ChargeType,
  paymentMethod: "PENDING" as PaymentMethod,
  sharedTrip: false,
  secondPassenger: ""
};

export function ErpWorkspace() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [trips, setTrips] = useState<Trip[]>(demoTrips);
  const [incomes, setIncomes] = useState<ManualIncome[]>(demoIncomes);
  const [expenses, setExpenses] = useState<Expense[]>(demoExpenses);
  const [tripForm, setTripForm] = useState(defaultTripForm);
  const [audit, setAudit] = useState<string[]>([
    "Se importaron reglas desde Viajes, Caja Diaria, C Corriente, Pagos choferes y Datos.",
    "Paul conserva comision 20%; Wyndham conserva comision corporativa 5%.",
    "Posnet usa divisor 1.15 y factor neto 0.8876 detectados en el Excel."
  ]);

  const dashboard = useMemo(() => buildDashboard(trips, incomes, expenses, settings), [trips, incomes, expenses, settings]);

  function registerAudit(message: string) {
    setAudit((items) => [`${new Date().toLocaleString("es-AR")} - ${message}`, ...items].slice(0, 20));
  }

  function updateTripForm<Key extends keyof typeof tripForm>(key: Key, value: (typeof tripForm)[Key]) {
    setTripForm((current) => ({ ...current, [key]: value }));
  }

  function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const calculated = calculateTripPrice(Number(tripForm.kilometers), Number(tripForm.waitValue), settings);
    const amount = Number(tripForm.totalAmount) > 0 ? Number(tripForm.totalAmount) : calculated;
    const method = tripForm.chargeType === "PENDIENTE" ? "PENDING" : tripForm.paymentMethod;

    const trip: Trip = {
      id: makeId("trip"),
      date: tripForm.date,
      time: tripForm.time,
      driverId: tripForm.driverId,
      corporateClientId: tripForm.corporateClientId,
      passenger: tripForm.passenger || "Pasajero sin nombre",
      origin: tripForm.origin || "Origen pendiente",
      destination: tripForm.destination || "Destino pendiente",
      kilometers: Number(tripForm.kilometers),
      waitValue: Number(tripForm.waitValue),
      totalAmount: amount,
      chargeType: tripForm.chargeType,
      paymentMethod: method,
      sharedTrip: tripForm.sharedTrip,
      secondPassenger: tripForm.sharedTrip ? tripForm.secondPassenger : undefined,
      status: "PENDING",
      observations: "Creado desde ERP"
    };

    setTrips((items) => [trip, ...items]);
    setTripForm(defaultTripForm);
    registerAudit(`Viaje creado en estado Pendiente para ${trip.passenger} por ${formatMoney(amount)}.`);
  }

  function completeTrip(id: string) {
    setTrips((items) =>
      items.map((trip) =>
        trip.id === id
          ? {
              ...trip,
              status: "COMPLETED"
            }
          : trip
      )
    );
    registerAudit(`Viaje ${id.slice(-8)} marcado como concretado. Se regeneraron caja, cuenta corriente y liquidacion.`);
  }

  function collectPendingTrip(id: string, method: PaymentMethod) {
    setTrips((items) =>
      items.map((trip) =>
        trip.id === id
          ? {
              ...trip,
              status: "COMPLETED",
              paidAt: toInputDate(new Date()),
              paidMethod: method
            }
          : trip
      )
    );
    registerAudit(`Viaje pendiente ${id.slice(-8)} cobrado por ${getPaymentLabel(settings, method)}.`);
  }

  function addIncome() {
    const income: ManualIncome = {
      id: makeId("income"),
      date: toInputDate(new Date()),
      paymentMethod: "MERCADO_PAGO",
      category: "Abona Pago Adelantado",
      currency: "ARS",
      description: "Carga rapida de adelanto colegio",
      amount: 162000
    };
    setIncomes((items) => [income, ...items]);
    registerAudit("Ingreso manual registrado e impactado en caja Mercado Pago.");
  }

  function addExpense() {
    const expense: Expense = {
      id: makeId("expense"),
      date: toInputDate(new Date()),
      paymentMethod: "CASH_MI_CHOFER",
      category: "Nafta",
      description: "Carga rapida de combustible",
      amount: 42000,
      currency: "ARS"
    };
    setExpenses((items) => [expense, ...items]);
    registerAudit("Gasto manual registrado e impactado en caja efectivo.");
  }

  function updateDriverRate(driverId: string, value: string) {
    const rate = Number(value) / 100;
    setSettings((current) => ({
      ...current,
      drivers: current.drivers.map((driver) => (driver.id === driverId ? { ...driver, commissionRate: rate } : driver))
    }));
    registerAudit(`Se actualizo porcentaje del chofer ${driverId} a ${value}%.`);
  }

  function updateFareTier(tierId: string, value: string) {
    setSettings((current) => ({
      ...current,
      fareTiers: current.fareTiers.map((tier) => (tier.id === tierId ? { ...tier, pricePerKm: Number(value) } : tier))
    }));
    registerAudit(`Se actualizo tarifa ${tierId} a ${formatMoney(Number(value))}/km.`);
  }

  function updateCalculatorSetting(key: "minimumFare" | "defaultTolls", value: string) {
    setSettings((current) => ({ ...current, [key]: Number(value) }));
    registerAudit(`Se actualizo ${key} a ${formatMoney(Number(value))}.`);
  }

  function updateCalculatorPercentSetting(key: "peakMultiplier" | "cardSurcharge" | "hotelSurcharge", value: string) {
    const numericValue = Number(value);
    const nextValue = key === "peakMultiplier" ? numericValue : numericValue / 100;
    setSettings((current) => ({ ...current, [key]: nextValue }));
    registerAudit(`Se actualizo ${key} a ${numericValue}${key === "peakMultiplier" ? "" : "%"}.`);
  }

  function addTripFromCalculator(trip: Trip) {
    setTrips((items) => [trip, ...items]);
    setActiveView("viajes");
    registerAudit(`Cotizacion guardada como viaje pendiente por ${formatMoney(trip.totalAmount)}.`);
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-3 sm:px-5 lg:flex-row lg:py-5">
        <aside className="lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-72">
          <div className="flex h-full flex-col rounded-lg border bg-white p-3 shadow-panel">
            <div className="flex items-center gap-3 rounded-md bg-[#071033] px-3 py-3 text-white">
              <Image src="/brand/mi-chofer-logo.jpeg" alt="Mi Chofer" width={48} height={48} className="size-12 rounded-md object-cover" />
              <div>
                <p className="text-sm font-semibold text-white/70">Viaja con confianza</p>
                <h1 className="text-xl font-bold tracking-normal">Mi Chofer</h1>
              </div>
            </div>

            <nav className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {views.map((view) => {
                const Icon = view.icon;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setActiveView(view.id)}
                    className={cn(
                      "flex h-11 items-center justify-start gap-2 rounded-md px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      activeView === view.id && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{view.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto hidden rounded-md border bg-muted/60 p-3 text-sm lg:block">
              <p className="font-semibold">Roles listos</p>
              <p className="mt-1 text-muted-foreground">Administrador, Dueña, Administracion y Choferes con permisos separados.</p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <TopBar referenceDate={dashboard.metrics.referenceDate} />
          {activeView === "dashboard" && <DashboardView dashboard={dashboard} />}
          {activeView === "calculadora" && <GoogleMapsCalculator settings={settings} onSaveTrip={addTripFromCalculator} />}
          {activeView === "viajes" && (
            <TripsView
              trips={trips}
              settings={settings}
              tripForm={tripForm}
              updateTripForm={updateTripForm}
              createTrip={createTrip}
              completeTrip={completeTrip}
              collectPendingTrip={collectPendingTrip}
            />
          )}
          {activeView === "cuentas" && <AccountsView accounts={dashboard.accounts} />}
          {activeView === "liquidaciones" && <SettlementsView settlements={dashboard.settlements} settings={settings} />}
          {activeView === "cajas" && <CashBoxesView cashBoxes={dashboard.cashBoxes} settings={settings} />}
          {activeView === "movimientos" && (
            <MovementsView incomes={incomes} expenses={expenses} addIncome={addIncome} addExpense={addExpense} settings={settings} />
          )}
          {activeView === "config" && (
            <ConfigView
              settings={settings}
              updateDriverRate={updateDriverRate}
              updateFareTier={updateFareTier}
              updateCalculatorSetting={updateCalculatorSetting}
              updateCalculatorPercentSetting={updateCalculatorPercentSetting}
            />
          )}
          {activeView === "auditoria" && <AuditView audit={audit} />}
        </section>
      </div>
    </main>
  );
}

function TopBar({ referenceDate }: { referenceDate: string }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border bg-white/90 px-4 py-3 shadow-panel backdrop-blur md:flex-row md:items-center">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Operacion y finanzas</p>
        <h2 className="text-xl font-bold tracking-normal md:text-2xl">Panel de control</h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">
          <CheckCircle2 className="mr-1 size-3" /> Demo operativo
        </Badge>
        <Badge variant="outline">
          <CalendarClock className="mr-1 size-3" /> Base Excel hasta {referenceDate}
        </Badge>
      </div>
    </div>
  );
}

function DashboardView({ dashboard }: { dashboard: ReturnType<typeof buildDashboard> }) {
  const metricCards = [
    { label: "Facturacion dia", value: formatMoney(dashboard.metrics.dayRevenue), icon: CircleDollarSign, tone: "text-emerald-700" },
    { label: "Facturacion semanal", value: formatMoney(dashboard.metrics.weekRevenue), icon: BarChart3, tone: "text-blue-700" },
    { label: "Facturacion mensual", value: formatMoney(dashboard.metrics.monthRevenue), icon: LineChart, tone: "text-amber-700" },
    { label: "Caja total", value: formatMoney(dashboard.metrics.totalCash), icon: Landmark, tone: "text-teal-700" },
    { label: "Deuda clientes", value: formatMoney(dashboard.metrics.clientDebt), icon: WalletCards, tone: "text-red-700" },
    { label: "Deuda choferes", value: formatMoney(dashboard.metrics.driverDebt), icon: UserCheck, tone: "text-violet-700" },
    { label: "Viajes realizados", value: dashboard.metrics.completedTrips.toString(), icon: Car, tone: "text-sky-700" },
    { label: "Resultado operativo", value: formatMoney(dashboard.metrics.operatingResult), icon: AreaChart, tone: "text-emerald-700" }
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-2xl font-bold tabular tracking-normal">{metric.value}</p>
                </div>
                <Icon className={cn("size-7 shrink-0", metric.tone)} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Evolucion mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Bar dataKey="ventas" fill="#071033" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" fill="#b99a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribucion por pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={dashboard.paymentDistribution} dataKey="value" nameKey="name" innerRadius={62} outerRadius={105} paddingAngle={2}>
                    {dashboard.paymentDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Ranking title="Top clientes" items={dashboard.topClients} />
        <Ranking title="Top choferes" items={dashboard.topDrivers} />
        <Card>
          <CardHeader>
            <CardTitle>Flujo de caja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={dashboard.monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Line type="monotone" dataKey="flujo" stroke="#3560a8" strokeWidth={3} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Ranking({ title, items }: { title: string; items: Array<{ name: string; value: number }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 6).map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.name}</span>
              <span className="shrink-0 tabular text-muted-foreground">{formatMoney(item.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(6, (item.value / total) * 100)}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TripsView({
  trips,
  settings,
  tripForm,
  updateTripForm,
  createTrip,
  completeTrip,
  collectPendingTrip
}: {
  trips: Trip[];
  settings: AppSettings;
  tripForm: typeof defaultTripForm;
  updateTripForm: <Key extends keyof typeof defaultTripForm>(key: Key, value: (typeof defaultTripForm)[Key]) => void;
  createTrip: (event: FormEvent<HTMLFormElement>) => void;
  completeTrip: (id: string) => void;
  collectPendingTrip: (id: string, method: PaymentMethod) => void;
}) {
  const pendingTrips = trips.filter((trip) => trip.status === "PENDING" || (trip.chargeType === "PENDIENTE" && !trip.paidAt));
  const completedTrips = trips.filter((trip) => trip.status === "COMPLETED");
  const calculatedAmount = calculateTripPrice(Number(tripForm.kilometers), Number(tripForm.waitValue), settings);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.25fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo viaje</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={createTrip}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha">
                <Input type="date" value={tripForm.date} onChange={(event) => updateTripForm("date", event.target.value)} />
              </Field>
              <Field label="Hora">
                <Input type="time" value={tripForm.time} onChange={(event) => updateTripForm("time", event.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Chofer">
                <Select value={tripForm.driverId} onChange={(event) => updateTripForm("driverId", event.target.value)}>
                  {settings.drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cliente">
                <Select value={tripForm.corporateClientId} onChange={(event) => updateTripForm("corporateClientId", event.target.value)}>
                  {settings.corporateClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Pasajero">
              <Input value={tripForm.passenger} onChange={(event) => updateTripForm("passenger", event.target.value)} placeholder="Nombre del pasajero" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Origen">
                <Input value={tripForm.origin} onChange={(event) => updateTripForm("origin", event.target.value)} />
              </Field>
              <Field label="Destino">
                <Input value={tripForm.destination} onChange={(event) => updateTripForm("destination", event.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Km">
                <Input
                  type="number"
                  min="0"
                  value={tripForm.kilometers}
                  onChange={(event) => updateTripForm("kilometers", Number(event.target.value))}
                />
              </Field>
              <Field label="Espera">
                <Input
                  type="number"
                  min="0"
                  value={tripForm.waitValue}
                  onChange={(event) => updateTripForm("waitValue", Number(event.target.value))}
                />
              </Field>
              <Field label="Importe">
                <Input
                  type="number"
                  min="0"
                  value={tripForm.totalAmount}
                  onChange={(event) => updateTripForm("totalAmount", Number(event.target.value))}
                  placeholder={String(calculatedAmount)}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de cobro">
                <Select value={tripForm.chargeType} onChange={(event) => updateTripForm("chargeType", event.target.value as ChargeType)}>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="COBRADO_EN_EL_MOMENTO">Cobrado en el momento</option>
                  <option value="ADELANTADO">Adelantado</option>
                </Select>
              </Field>
              <Field label="Metodo">
                <Select value={tripForm.paymentMethod} onChange={(event) => updateTripForm("paymentMethod", event.target.value as PaymentMethod)}>
                  {settings.paymentRules.map((rule) => (
                    <option key={rule.method} value={rule.method}>
                      {rule.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={tripForm.sharedTrip}
                onChange={(event) => updateTripForm("sharedTrip", event.target.checked)}
              />
              Viaje compartido de colegio
            </label>
            {tripForm.sharedTrip && (
              <Field label="Segundo pasajero">
                <Input
                  value={tripForm.secondPassenger}
                  onChange={(event) => updateTripForm("secondPassenger", event.target.value)}
                  placeholder="Se divide el consumo del adelanto"
                />
              </Field>
            )}
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Tarifa calculada:</span>{" "}
              <strong className="tabular">{formatMoney(calculatedAmount)}</strong>
            </div>
            <Button type="submit">
              <ClipboardList className="size-4" />
              Guardar viaje pendiente
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Viajes pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Fecha", "Chofer", "Cliente", "Pasajero", "Importe", "Accion"]}
              rows={pendingTrips.slice(0, 8).map((trip) => [
                trip.date,
                settings.drivers.find((driver) => driver.id === trip.driverId)?.name ?? trip.driverId,
                settings.corporateClients.find((client) => client.id === trip.corporateClientId)?.name ?? trip.corporateClientId,
                trip.passenger,
                formatMoney(trip.totalAmount),
                <div key={trip.id} className="flex flex-wrap gap-2">
                  {trip.status === "PENDING" && (
                    <Button size="sm" onClick={() => completeTrip(trip.id)}>
                      Viaje concretado
                    </Button>
                  )}
                  {trip.chargeType === "PENDIENTE" && !trip.paidAt && (
                    <Button size="sm" variant="outline" onClick={() => collectPendingTrip(trip.id, "MERCADO_PAGO")}>
                      Registrar cobro MP
                    </Button>
                  )}
                </div>
              ])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ultimos viajes realizados</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Fecha", "Chofer", "Pago", "Estado", "Importe"]}
              rows={completedTrips.slice(0, 8).map((trip) => [
                trip.date,
                settings.drivers.find((driver) => driver.id === trip.driverId)?.name ?? trip.driverId,
                getPaymentLabel(settings, trip.paidMethod ?? trip.paymentMethod),
                <Badge key={trip.id} variant={trip.paidAt || trip.chargeType !== "PENDIENTE" ? "success" : "warning"}>
                  {trip.paidAt || trip.chargeType !== "PENDIENTE" ? "cobrado" : "deuda"}
                </Badge>,
                formatMoney(trip.totalAmount)
              ])}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccountsView({ accounts }: { accounts: ReturnType<typeof buildDashboard>["accounts"] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {accounts.map((account) => (
        <Card key={account.client.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{account.client.name}</CardTitle>
              <Badge variant={account.balance > 0 ? "danger" : account.balance < 0 ? "success" : "secondary"}>
                {account.balance > 0 ? "deuda" : account.balance < 0 ? "a favor" : "en cero"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular">{formatMoney(Math.abs(account.balance))}</p>
            <DataTable
              className="mt-4"
              columns={["Fecha", "Tipo", "Concepto", "Importe"]}
              rows={account.movements.slice(0, 6).map((movement) => [
                movement.date,
                movement.type,
                movement.concept,
                formatMoney(movement.amount)
              ])}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettlementsView({
  settlements,
  settings
}: {
  settlements: ReturnType<typeof buildDashboard>["settlements"];
  settings: AppSettings;
}) {
  return (
    <div className="space-y-4">
      {settlements.map((settlement) => {
        const driver = settings.drivers.find((item) => item.id === settlement.driverId);
        return (
          <Card key={settlement.id}>
            <CardHeader>
              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <CardTitle>
                  {driver?.name ?? settlement.driverId} - {settlement.weekStart} a {settlement.weekEnd}
                </CardTitle>
                <Badge variant={settlement.pending > 0 ? "warning" : "success"}>{formatMoney(settlement.pending)} pendiente</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4">
                <MiniStat label="Facturacion" value={formatMoney(settlement.gross)} />
                <MiniStat label="Neto cobro" value={formatMoney(settlement.net)} />
                <MiniStat label="A pagar" value={formatMoney(settlement.driverAmount)} />
                <MiniStat label="Pagado" value={formatMoney(settlement.paid)} />
              </div>
              <DataTable
                className="mt-4"
                columns={["Fecha", "Viaje", "Metodo", "Neto", "%", "Chofer"]}
                rows={settlement.lines.map((line) => [
                  line.date,
                  line.tripId.slice(-8),
                  getPaymentLabel(settings, line.paymentMethod),
                  formatMoney(line.netAfterCollectionFee),
                  formatPercent(line.driverRate),
                  formatMoney(line.driverAmount)
                ])}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CashBoxesView({
  cashBoxes,
  settings
}: {
  cashBoxes: ReturnType<typeof buildDashboard>["cashBoxes"];
  settings: AppSettings;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {cashBoxes.map((box) => (
        <Card key={box.id}>
          <CardHeader>
            <CardTitle>{box.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Saldo" value={formatMoney(box.balance, box.currency === "ARS" ? "ARS" : "USD")} />
              <MiniStat label="Ingresos" value={formatMoney(box.income, box.currency === "ARS" ? "ARS" : "USD")} />
              <MiniStat label="Egresos" value={formatMoney(box.outcome, box.currency === "ARS" ? "ARS" : "USD")} />
            </div>
            <DataTable
              className="mt-4"
              columns={["Fecha", "Tipo", "Concepto", "Importe"]}
              rows={box.movements.slice(0, 7).map((movement) => [
                movement.date,
                movement.direction === "IN" ? "Ingreso" : "Egreso",
                movement.concept,
                formatMoney(movement.amount, box.currency === "ARS" ? "ARS" : "USD")
              ])}
            />
            <div className="mt-3 text-xs text-muted-foreground">
              Metodos vinculados:{" "}
              {settings.paymentRules
                .filter((rule) => rule.cashBoxId === box.id)
                .map((rule) => rule.label)
                .join(", ") || "sin vinculos"}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MovementsView({
  incomes,
  expenses,
  addIncome,
  addExpense,
  settings
}: {
  incomes: ManualIncome[];
  expenses: Expense[];
  addIncome: () => void;
  addExpense: () => void;
  settings: AppSettings;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Ingresos manuales</CardTitle>
            <Button size="sm" onClick={addIncome}>
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={["Fecha", "Caja", "Categoria", "Importe"]}
            rows={incomes.slice(0, 8).map((income) => [
              income.date,
              getPaymentLabel(settings, income.paymentMethod),
              income.category,
              formatMoney(income.amount)
            ])}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Gastos</CardTitle>
            <Button size="sm" variant="outline" onClick={addExpense}>
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={["Fecha", "Caja", "Categoria", "Importe"]}
            rows={expenses.slice(0, 8).map((expense) => [
              expense.date,
              getPaymentLabel(settings, expense.paymentMethod),
              expense.category,
              formatMoney(expense.amount)
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigView({
  settings,
  updateDriverRate,
  updateFareTier,
  updateCalculatorSetting,
  updateCalculatorPercentSetting
}: {
  settings: AppSettings;
  updateDriverRate: (driverId: string, value: string) => void;
  updateFareTier: (tierId: string, value: string) => void;
  updateCalculatorSetting: (key: "minimumFare" | "defaultTolls", value: string) => void;
  updateCalculatorPercentSetting: (key: "peakMultiplier" | "cardSurcharge" | "hotelSurcharge", value: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tarifas por kilometro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.fareTiers.map((tier) => (
            <Field
              key={tier.id}
              label={`${tier.fromKm} a ${tier.toKm ?? "+25"} km`}
            >
              <Input
                type="number"
                value={tier.pricePerKm}
                onChange={(event) => updateFareTier(tier.id, event.target.value)}
              />
            </Field>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Calculadora</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Precio mínimo">
            <Input
              type="number"
              value={settings.minimumFare}
              onChange={(event) => updateCalculatorSetting("minimumFare", event.target.value)}
            />
          </Field>
          <Field label="Peaje por defecto">
            <Input
              type="number"
              value={settings.defaultTolls}
              onChange={(event) => updateCalculatorSetting("defaultTolls", event.target.value)}
            />
          </Field>
          <Field label="Multiplicador hora pico">
            <Input
              type="number"
              min="1"
              step="0.01"
              value={settings.peakMultiplier}
              onChange={(event) => updateCalculatorPercentSetting("peakMultiplier", event.target.value)}
            />
          </Field>
          <Field label="Recargo tarjeta (%)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={Math.round(settings.cardSurcharge * 100)}
              onChange={(event) => updateCalculatorPercentSetting("cardSurcharge", event.target.value)}
            />
          </Field>
          <Field label="Recargo hotel (%)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={Math.round(settings.hotelSurcharge * 100)}
              onChange={(event) => updateCalculatorPercentSetting("hotelSurcharge", event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Porcentajes de choferes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {settings.drivers.map((driver) => (
              <Field key={driver.id} label={driver.name}>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(driver.commissionRate * 100)}
                  onChange={(event) => updateDriverRate(driver.id, event.target.value)}
                />
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Clientes corporativos y medios de cobro</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <DataTable
            columns={["Cliente", "Comision", "Saldo a favor"]}
            rows={settings.corporateClients.map((client) => [
              client.name,
              formatPercent(client.commissionRate),
              client.allowsAdvanceBalance ? "si" : "no"
            ])}
          />
          <DataTable
            columns={["Metodo", "Caja", "Comision"]}
            rows={settings.paymentRules.map((rule) => [
              rule.label,
              rule.cashBoxId ?? "cuenta corriente",
              formatPercent(rule.feeRate)
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AuditView({ audit }: { audit: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {audit.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-md border bg-muted/40 p-3 text-sm">
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular">{value}</p>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  className
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  className?: string;
}) {
  if (rows.length === 0) {
    return <div className={cn("rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground", className)}>Sin movimientos para mostrar.</div>;
  }

  return (
    <div className={cn("overflow-x-auto rounded-md border", className)}>
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead className="bg-muted/80 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t bg-white/60">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="max-w-[280px] px-3 py-3 align-top">
                  {typeof cell === "string" || typeof cell === "number" ? (
                    <span className="block truncate tabular">{cell}</span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
