import { useEffect, useState } from "react";

type Registration = { registration: { displayName: string } | null };
type Module = { id: string; displayName: string; runtimeAttributes: Record<string, unknown> };
type Summary = { activePowerDrawKw: number; solarGenerationKw: number; netPowerKw: number; solarIrradianceWPerM2: number; solarCondition: string; batteryEnergyStoredKwh: number; batteryCapacityKwh: number };
type View = "home" | "modules" | "power";
const base = (import.meta.env.VITE_HABITAT_API_BASE_URL || "/api").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const raw = await response.text();
  let body: any;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { throw new Error(`${path} returned invalid JSON: ${raw.slice(0, 120)}`); }
  if (!response.ok) throw new Error(body?.error?.message || `Habitat API error (${response.status})`);
  return body as T;
}

function withBatteryFallback(summary: Summary, modules: Module[]): Summary {
  if (Number.isFinite(summary.batteryEnergyStoredKwh) && Number.isFinite(summary.batteryCapacityKwh)) return summary;
  const stored = modules.reduce((total, module) => total + (typeof module.runtimeAttributes.energyStoredKwh === "number" ? module.runtimeAttributes.energyStoredKwh : typeof module.runtimeAttributes.currentEnergyKwh === "number" ? module.runtimeAttributes.currentEnergyKwh : 0), 0);
  const capacity = modules.reduce((total, module) => total + (typeof module.runtimeAttributes.energyCapacityKwh === "number" ? module.runtimeAttributes.energyCapacityKwh : typeof module.runtimeAttributes.energyStorageKwh === "number" ? module.runtimeAttributes.energyStorageKwh : 0), 0);
  return { ...summary, batteryEnergyStoredKwh: stored, batteryCapacityKwh: capacity };
}

export function Dashboard() {
  const [view, setView] = useState<View>("home");
  const [registration, setRegistration] = useState<Registration["registration"]>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(true);
  const [customTicks, setCustomTicks] = useState("");
  const [habitatName, setHabitatName] = useState("");
  const [confirmUnregister, setConfirmUnregister] = useState(false);

  const refresh = async () => {
    setError("");
    const results = await Promise.allSettled([request<Registration>("/registration"), request<{ modules: Module[] }>("/modules"), request<{ summary: Summary }>("/power")]);
    const [r, m, p] = results;
    if (r.status === "fulfilled") setRegistration(r.value.registration);
    if (m.status === "fulfilled") setModules(m.value.modules);
    if (p.status === "fulfilled") setSummary(withBatteryFallback(p.value.summary, m.status === "fulfilled" ? m.value.modules : []));
    const failed = results.find(x => x.status === "rejected");
    if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : "Unable to load Habitat state.");
  };
  useEffect(() => { void refresh(); }, []);

  const advance = async (tickCount: number) => {
    setBusy(true);
    try { const result = await request<{ modules: Module[]; summary: Summary }>("/ticks", { method: "POST", body: JSON.stringify({ tickCount }) }); setModules(result.modules); setSummary(result.summary); }
    catch (e) { setError(e instanceof Error ? e.message : "Tick failed."); }
    finally { setBusy(false); }
  };
  const toggleModule = async (module: Module) => {
    setBusy(true);
    try { const status = module.runtimeAttributes.status === "online" ? "offline" : "online"; await request(`/modules/${encodeURIComponent(module.id)}`, { method: "PATCH", body: JSON.stringify({ runtimeAttributes: { ...module.runtimeAttributes, status } }) }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Module update failed."); }
    finally { setBusy(false); }
  };
  const registerHabitat = async () => {
    setBusy(true);
    try { await request("/registration", { method: "POST", body: JSON.stringify({ displayName: habitatName }) }); setHabitatName(""); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Registration failed."); }
    finally { setBusy(false); }
  };
  const unregisterHabitat = async () => {
    setBusy(true);
    try { await request("/registration", { method: "DELETE" }); setConfirmUnregister(false); setView("home"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unregister failed."); }
    finally { setBusy(false); }
  };

  return <main data-theme={dark ? "dark" : "light"}>
    <aside className="sidebar"><div className="brand"><span className="eyebrow">HABITAT / OPS</span><strong>Control</strong></div><nav aria-label="Dashboard sections">{([["home", "Home dashboard"], ["modules", "Modules & construction"], ["power", "Power overview"]] as [View, string][]).map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</nav><button className="theme" onClick={() => setDark(!dark)}>{dark ? "Light" : "Dark"} mode</button></aside>
    <section className="content"><header><div><span className="eyebrow">{view === "home" ? "HOME DASHBOARD" : view === "modules" ? "MODULES & CONSTRUCTION" : "POWER OVERVIEW"}</span><h1>{registration?.displayName || "Habitat control"}</h1></div><span className={registration ? "online badge" : "offline badge"}>{registration ? "REGISTERED" : "NOT REGISTERED"}</span></header>
      {error && <aside className="error">{error} <button onClick={() => void refresh()}>Retry</button></aside>}
      <section className="panel registration-panel"><span className="eyebrow">REGISTRATION</span>{registration ? <>{confirmUnregister ? <div><p className="warning">Unregistering is destructive. The next registration returns this Habitat to its starter state.</p><button disabled={busy} onClick={() => void unregisterHabitat()}>Confirm unregister</button><button disabled={busy} onClick={() => setConfirmUnregister(false)}>Cancel</button></div> : <button disabled={busy} onClick={() => setConfirmUnregister(true)}>Unregister Habitat</button>}</> : <div className="register-form"><input aria-label="Habitat name" value={habitatName} onChange={e => setHabitatName(e.target.value)} placeholder="Habitat name" /><button disabled={busy || !habitatName.trim()} onClick={() => void registerHabitat()}>Register Habitat</button></div>}</section>
      {view === "home" && <><section className="grid">{summary && [["Generation", summary.solarGenerationKw, "kW"], ["Consumption", summary.activePowerDrawKw, "kW"], ["Net power", summary.netPowerKw, "kW"], ["Battery", `${summary.batteryEnergyStoredKwh} / ${summary.batteryCapacityKwh}`, "kWh"], ["Solar", summary.solarIrradianceWPerM2, "W/m²"]].map(([label, value, unit]) => <article key={label as string}><span>{label}</span><b>{typeof value === "string" ? value : Number(value).toFixed(2)} <small>{unit}</small></b></article>)}</section><section className="panel"><span className="eyebrow">SYSTEM STATUS</span><p className="lead">{summary ? `Solar conditions: ${summary.solarCondition}.` : "Loading Habitat telemetry..."}</p></section></>}
      {view === "modules" && <section className="panel"><div className="panel-title"><span className="eyebrow">MODULES</span><span>{modules.length} records</span></div>{modules.length === 0 ? <p className="muted">No modules available.</p> : modules.map(module => <div className="module" key={module.id}><div><b>{module.displayName}</b><span>{module.id}</span></div><span className={module.runtimeAttributes.status === "online" ? "online" : "offline"}>{String(module.runtimeAttributes.status || "unknown")} · {typeof module.runtimeAttributes.powerDrawKw === "number" ? `${module.runtimeAttributes.powerDrawKw} kW` : "power --"}</span><button disabled={busy} onClick={() => void toggleModule(module)}>{module.runtimeAttributes.status === "online" ? "Set offline" : "Set online"}</button></div>)}<p className="muted construction-note">Construction jobs are managed through the REST construction resources.</p></section>}
      {view === "power" && <><section className="grid">{summary && [["Generation", summary.solarGenerationKw, "kW"], ["Consumption", summary.activePowerDrawKw, "kW"], ["Net power", summary.netPowerKw, "kW"], ["Battery", `${summary.batteryEnergyStoredKwh} / ${summary.batteryCapacityKwh}`, "kWh"], ["Solar irradiance", summary.solarIrradianceWPerM2, "W/m²"]].map(([label, value, unit]) => <article key={label as string}><span>{label}</span><b>{typeof value === "string" ? value : Number(value).toFixed(2)} <small>{unit}</small></b></article>)}</section><section className="panel"><span className="eyebrow">ADVANCE SIMULATION</span><div className="ticks">{[1, 60, 600, 3600].map(n => <button disabled={busy} onClick={() => void advance(n)} key={n}>Advance {n === 3600 ? "1 hour" : n === 600 ? "10 min" : n === 60 ? "1 min" : "1 tick"}</button>)}<input aria-label="Custom ticks" value={customTicks} onChange={e => setCustomTicks(e.target.value.replace(/\D/g, ""))} placeholder="ticks" /><button disabled={busy || !customTicks} onClick={() => void advance(Number(customTicks))}>Advance custom</button></div></section></>}
    </section>
  </main>;
}
