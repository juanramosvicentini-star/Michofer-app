"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Car, Clock, Landmark, MapPinned, Route, Save, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  calculatePassengerQuote,
  calculateTieredDistancePrice,
  calculateTripBreakdown,
  getPaymentLabel
} from "@/lib/domain/calculations";
import type { AppSettings, ChargeType, PaymentMethod, Trip } from "@/lib/domain/types";
import { cn, formatMoney, formatPercent, makeId, toInputDate } from "@/lib/utils";

type RouteSummary = {
  distanceKm: number;
  durationSeconds: number;
  includesTolls: boolean;
};

type DirectionsLeg = {
  distance?: { value?: number };
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
};

type DirectionsResponse = {
  routes?: Array<{
    legs?: DirectionsLeg[];
    warnings?: string[];
  }>;
};

type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
  DirectionsService: new () => {
    route: (
      request: Record<string, unknown>,
      callback: (response: DirectionsResponse | null, status: string) => void
    ) => void;
  };
  DirectionsRenderer: new (options: Record<string, unknown>) => {
    setDirections: (response: DirectionsResponse) => void;
  };
  TravelMode: { DRIVING: string };
  TrafficModel: { BEST_GUESS: string };
  places?: {
    Autocomplete: new (input: HTMLInputElement, options: Record<string, unknown>) => unknown;
  };
};

declare global {
  interface Window {
    google?: { maps: GoogleMapsApi };
    initMiChoferMaps?: () => void;
  }
}

type CalculatorForm = {
  origin: string;
  stop1: string;
  stop2: string;
  destination: string;
  manualKm: number;
  waitValue: number;
  manualTolls: number;
  includeTolls: boolean;
  hotelTrip: boolean;
  timeMode: "normal" | "peak";
  driverId: string;
  corporateClientId: string;
  paymentMethod: PaymentMethod;
  chargeType: ChargeType;
};

const defaultForm: CalculatorForm = {
  origin: "",
  stop1: "",
  stop2: "",
  destination: "",
  manualKm: 0,
  waitValue: 0,
  manualTolls: 0,
  includeTolls: true,
  hotelTrip: false,
  timeMode: "normal",
  driverId: "paul",
  corporateClientId: "mi-chofer",
  paymentMethod: "CASH_MI_CHOFER",
  chargeType: "COBRADO_EN_EL_MOMENTO"
};

export function GoogleMapsCalculator({
  settings,
  onSaveTrip
}: {
  settings: AppSettings;
  onSaveTrip: (trip: Trip) => void;
}) {
  const [form, setForm] = useState<CalculatorForm>(defaultForm);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [message, setMessage] = useState("Completá origen y destino para calcular con Google Maps, o cargá km manuales.");
  const [messageType, setMessageType] = useState<"default" | "success" | "error">("default");
  const [mapsReady, setMapsReady] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const originRef = useRef<HTMLInputElement | null>(null);
  const stop1Ref = useRef<HTMLInputElement | null>(null);
  const stop2Ref = useRef<HTMLInputElement | null>(null);
  const destinationRef = useRef<HTMLInputElement | null>(null);
  const directionsServiceRef = useRef<InstanceType<GoogleMapsApi["DirectionsService"]> | null>(null);
  const directionsRendererRef = useRef<InstanceType<GoogleMapsApi["DirectionsRenderer"]> | null>(null);

  const distanceKm = routeSummary?.distanceKm ?? Number(form.manualKm) ?? 0;
  const quote = useMemo(
    () =>
      calculatePassengerQuote({
        kilometers: distanceKm,
        waitValue: Number(form.waitValue) || 0,
        timeMode: form.timeMode,
        hotelTrip: form.hotelTrip,
        includeTolls: form.includeTolls,
        manualTolls: Number(form.manualTolls) || 0,
        settings
      }),
    [distanceKm, form.hotelTrip, form.includeTolls, form.manualTolls, form.timeMode, form.waitValue, settings]
  );
  const selectedTotal = form.paymentMethod === "POSNET" ? quote.cardTotal : quote.cashTransferTotal;
  const breakdown = calculateTripBreakdown({
    kilometers: distanceKm,
    waitValue: Number(form.waitValue) || 0,
    manualAmount: selectedTotal,
    driverId: form.driverId,
    corporateClientId: form.corporateClientId,
    paymentMethod: form.paymentMethod,
    sharedTrip: false,
    settings
  });

  useEffect(() => {
    const storedApiKey = window.localStorage.getItem("miChoferGoogleMapsApiKey") ?? "";
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || storedApiKey;

    if (!apiKey) {
      setNeedsApiKey(true);
      setMessage("Google Maps está en modo manual. Podés cargar la API key o ingresar kilómetros manuales.");
      return;
    }

    setApiKeyInput(apiKey);
    loadGoogleMaps(apiKey);
  }, []);

  function loadGoogleMaps(apiKey: string) {
    const initMaps = () => {
      if (!window.google?.maps || !mapRef.current) return;

      const maps = window.google.maps;
      const map = new maps.Map(mapRef.current, {
        center: { lat: -34.6037, lng: -58.3816 },
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false
      });

      directionsServiceRef.current = new maps.DirectionsService();
      directionsRendererRef.current = new maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#071033",
          strokeOpacity: 0.95,
          strokeWeight: 6
        }
      });

      [originRef.current, stop1Ref.current, stop2Ref.current, destinationRef.current]
        .filter((input): input is HTMLInputElement => Boolean(input))
        .forEach((input) => {
          if (maps.places?.Autocomplete) {
            new maps.places.Autocomplete(input, {
              fields: ["formatted_address", "geometry", "name"],
              componentRestrictions: { country: "ar" }
            });
          }
        });

      setMapsReady(true);
      setNeedsApiKey(false);
      setMessage("Google Maps listo. Ya podés calcular rutas reales.");
      setMessageType("success");
    };

    if (window.google?.maps) {
      initMaps();
      return;
    }

    window.initMiChoferMaps = initMaps;

    document.querySelector("#mi-chofer-google-maps")?.remove();

    const script = document.createElement("script");
    script.id = "mi-chofer-google-maps";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=initMiChoferMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setNeedsApiKey(true);
      setMessage("No se pudo cargar Google Maps. Revisá la API key y que estén habilitadas Maps JavaScript, Places y Directions.");
      setMessageType("error");
    };
    document.head.appendChild(script);
  }

  function activateApiKey() {
    const trimmed = apiKeyInput.trim();

    if (!trimmed) {
      setMessage("Pegá una API key de Google Maps para activar rutas reales.");
      setMessageType("error");
      return;
    }

    window.localStorage.setItem("miChoferGoogleMapsApiKey", trimmed);
    setNeedsApiKey(false);
    setMessage("Cargando Google Maps...");
    setMessageType("default");
    loadGoogleMaps(trimmed);
  }

  function updateField<Key extends keyof CalculatorForm>(key: Key, value: CalculatorForm[Key]) {
    if (key === "manualKm") setRouteSummary(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function syncAddressFields() {
    setForm((current) => ({
      ...current,
      origin: originRef.current?.value ?? current.origin,
      stop1: stop1Ref.current?.value ?? current.stop1,
      stop2: stop2Ref.current?.value ?? current.stop2,
      destination: destinationRef.current?.value ?? current.destination
    }));
  }

  async function calculateRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    syncAddressFields();

    if (!mapsReady) {
      if (Number(form.manualKm) > 0) {
        setRouteSummary(null);
        setMessage("Cotización calculada con kilómetros manuales.");
        setMessageType("success");
        return;
      }

      setMessage("Para calcular sin Google Maps, cargá los kilómetros manualmente.");
      setMessageType("error");
      return;
    }

    const origin = originRef.current?.value.trim() ?? "";
    const destination = destinationRef.current?.value.trim() ?? "";

    if (origin.length < 4 || destination.length < 4) {
      setMessage("Completá origen y destino con direcciones más específicas.");
      setMessageType("error");
      return;
    }

    setLoadingRoute(true);
    setMessage("Calculando ruta real...");
    setMessageType("default");

    try {
      const summary = await requestRoute(origin, destination);
      setRouteSummary(summary);
      setForm((current) => ({ ...current, manualKm: Number(summary.distanceKm.toFixed(1)) }));
      setMessage("Ruta y tarifa calculadas correctamente.");
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo calcular la ruta.");
      setMessageType("error");
    } finally {
      setLoadingRoute(false);
    }
  }

  function requestRoute(origin: string, destination: string) {
    const maps = window.google?.maps;
    const directionsService = directionsServiceRef.current;
    const directionsRenderer = directionsRendererRef.current;

    if (!maps || !directionsService || !directionsRenderer) {
      return Promise.reject(new Error("Google Maps todavía no está listo."));
    }

    const waypoints = [stop1Ref.current?.value.trim(), stop2Ref.current?.value.trim()]
      .filter((location): location is string => Boolean(location))
      .map((location) => ({ location, stopover: true }));

    return new Promise<RouteSummary>((resolve, reject) => {
      directionsService.route(
        {
          origin,
          destination,
          waypoints,
          travelMode: maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: maps.TrafficModel.BEST_GUESS
          }
        },
        (response, status) => {
          if (status !== "OK" || !response?.routes?.length) {
            reject(new Error(getRouteError(status)));
            return;
          }

          const route = response.routes[0];
          const totals = (route.legs ?? []).reduce(
            (accumulator, leg) => ({
              distanceMeters: accumulator.distanceMeters + (leg.distance?.value ?? 0),
              durationSeconds: accumulator.durationSeconds + (leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0)
            }),
            { distanceMeters: 0, durationSeconds: 0 }
          );

          directionsRenderer.setDirections(response);

          resolve({
            distanceKm: totals.distanceMeters / 1000,
            durationSeconds: totals.durationSeconds,
            includesTolls: route.warnings?.some((warning) => /peaje|toll/i.test(warning)) ?? false
          });
        }
      );
    });
  }

  function saveTrip() {
    const totalAmount = selectedTotal || calculateTieredDistancePrice(distanceKm, settings);
    const paymentMethod = form.chargeType === "PENDIENTE" ? "PENDING" : form.paymentMethod;

    const trip: Trip = {
      id: makeId("trip"),
      date: toInputDate(new Date()),
      time: new Date().toTimeString().slice(0, 5),
      driverId: form.driverId,
      corporateClientId: form.corporateClientId,
      passenger: "Cotización desde calculadora",
      origin: originRef.current?.value.trim() || form.origin || "Origen pendiente",
      destination: destinationRef.current?.value.trim() || form.destination || "Destino pendiente",
      kilometers: Number(distanceKm.toFixed(2)),
      waitValue: Number(form.waitValue) || 0,
      totalAmount,
      chargeType: form.chargeType,
      paymentMethod,
      sharedTrip: false,
      status: "PENDING",
      observations: `Duración estimada: ${routeSummary ? formatDuration(routeSummary.durationSeconds) : "manual"}`
    };

    onSaveTrip(trip);
    setMessage("Cotización guardada como viaje pendiente.");
    setMessageType("success");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Calculadora de viajes</CardTitle>
            <Badge variant={mapsReady ? "success" : "warning"}>{mapsReady ? "Google Maps activo" : "Modo manual"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={calculateRoute}>
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Dirección de partida">
                <Input ref={originRef} defaultValue={form.origin} placeholder="Ej: Nordelta, Tigre" autoComplete="off" />
              </Field>
              <Field label="Dirección de destino">
                <Input ref={destinationRef} defaultValue={form.destination} placeholder="Ej: Aeropuerto Ezeiza" autoComplete="off" />
              </Field>
              <Field label="Parada opcional 1">
                <Input ref={stop1Ref} defaultValue={form.stop1} placeholder="Agregar parada" autoComplete="off" />
              </Field>
              <Field label="Parada opcional 2">
                <Input ref={stop2Ref} defaultValue={form.stop2} placeholder="Agregar parada" autoComplete="off" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Km manuales">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.manualKm}
                  onChange={(event) => updateField("manualKm", Number(event.target.value))}
                />
              </Field>
              <Field label="Espera">
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={form.waitValue}
                  onChange={(event) => updateField("waitValue", Number(event.target.value))}
                />
              </Field>
              <Field label="Peajes">
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={form.manualTolls}
                  onChange={(event) => updateField("manualTolls", Number(event.target.value))}
                />
              </Field>
              <Field label="Horario">
                <Select value={form.timeMode} onChange={(event) => updateField("timeMode", event.target.value as "normal" | "peak")}>
                  <option value="normal">Normal</option>
                  <option value="peak">Hora pico</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <Field label="Chofer">
                <Select value={form.driverId} onChange={(event) => updateField("driverId", event.target.value)}>
                  {settings.drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cliente">
                <Select value={form.corporateClientId} onChange={(event) => updateField("corporateClientId", event.target.value)}>
                  {settings.corporateClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cobro">
                <Select value={form.chargeType} onChange={(event) => updateField("chargeType", event.target.value as ChargeType)}>
                  <option value="COBRADO_EN_EL_MOMENTO">Cobrado en el momento</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="ADELANTADO">Adelantado</option>
                </Select>
              </Field>
              <Field label="Método">
                <Select value={form.paymentMethod} onChange={(event) => updateField("paymentMethod", event.target.value as PaymentMethod)}>
                  {settings.paymentRules
                    .filter((rule) => !["ADVANCE", "PENDING", "BONIFICADO"].includes(rule.method))
                    .map((rule) => (
                      <option key={rule.method} value={rule.method}>
                        {rule.label}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.includeTolls}
                  onChange={(event) => updateField("includeTolls", event.target.checked)}
                />
                Sumar peajes al presupuesto
              </label>
              <label className="flex min-h-12 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
                <input type="checkbox" checked={form.hotelTrip} onChange={(event) => updateField("hotelTrip", event.target.checked)} />
                Viaje de hotel
              </label>
            </div>

            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                messageType === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                messageType === "error" && "border-red-200 bg-red-50 text-red-700",
                messageType === "default" && "bg-muted/40 text-muted-foreground"
              )}
            >
              {message}
            </div>

            {needsApiKey && (
              <div className="grid gap-2 rounded-md border bg-white p-3 sm:grid-cols-[1fr_auto]">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder="API key de Google Maps"
                />
                <Button type="button" variant="outline" onClick={activateApiKey}>
                  Activar Maps
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="flex-1" disabled={loadingRoute}>
                <Route className="size-4" />
                {loadingRoute ? "Calculando..." : "Calcular ruta y tarifa"}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={saveTrip}>
                <Save className="size-4" />
                Guardar como viaje
              </Button>
            </div>
          </form>

          <div className="mt-5 overflow-hidden rounded-md border">
            <div ref={mapRef} className="h-[320px] w-full bg-[#071033]" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumen de tarifa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-[#071033] p-5 text-white">
              <p className="text-sm text-white/70">Efectivo / transferencia</p>
              <p className="mt-2 text-3xl font-bold tabular">{formatMoney(quote.cashTransferTotal)}</p>
            </div>
            <div className="rounded-md border border-[#071033]/15 bg-white p-5">
              <p className="text-sm text-muted-foreground">Tarjeta / Posnet</p>
              <p className="mt-2 text-3xl font-bold tabular text-[#071033]">{formatMoney(quote.cardTotal)}</p>
            </div>
            <SummaryRow icon={MapPinned} label="Distancia" value={`${distanceKm.toFixed(1)} km`} />
            <SummaryRow icon={Clock} label="Tiempo estimado" value={routeSummary ? formatDuration(routeSummary.durationSeconds) : "manual"} />
            <SummaryRow icon={Calculator} label="Precio por km" value={formatMoney(quote.distancePrice)} />
            <SummaryRow icon={Landmark} label="Mínimo aplicado" value={formatMoney(quote.minimumApplied)} />
            <SummaryRow icon={WalletCards} label="Peajes" value={formatMoney(quote.tolls)} />
            <SummaryRow icon={Car} label="Recargo hotel" value={formatMoney(quote.hotelSurcharge)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impacto ERP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow icon={WalletCards} label="Caja destino" value={breakdown.cashBoxName} />
            <SummaryRow icon={Calculator} label="Método" value={getPaymentLabel(settings, form.paymentMethod)} />
            <SummaryRow icon={Landmark} label="Comisión cobro" value={formatMoney(breakdown.collectionFee)} />
            <SummaryRow icon={Car} label={`Chofer ${breakdown.driverName}`} value={`${formatMoney(breakdown.driverAmount)} (${formatPercent(breakdown.driverRate)})`} />
            <SummaryRow icon={Landmark} label="Empresa" value={formatMoney(breakdown.companyAmount)} />
            <SummaryRow icon={WalletCards} label="Comisión corporativa" value={formatMoney(breakdown.corporateCommission)} />
          </CardContent>
        </Card>
      </div>
    </div>
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

function SummaryRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <strong className="shrink-0 text-right tabular">{value}</strong>
    </div>
  );
}

function getRouteError(status: string) {
  const messages: Record<string, string> = {
    ZERO_RESULTS: "No encontramos una ruta manejable entre esas direcciones.",
    NOT_FOUND: "Alguna dirección no pudo reconocerse. Revisá el texto ingresado.",
    OVER_QUERY_LIMIT: "Se alcanzó el límite de consultas de Google Maps.",
    REQUEST_DENIED: "Google Maps rechazó la solicitud. Revisá la API key y las restricciones.",
    INVALID_REQUEST: "La solicitud de ruta está incompleta."
  };

  return messages[status] || "No pudimos calcular esa ruta en este momento.";
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${minutes} min`;
  if (!remainingMinutes) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}
