import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ShieldAlert, ShieldCheck, IndianRupee, Search,
  SlidersHorizontal, FileCheck2, MessageSquare, ChevronRight,
  Loader2, AlertTriangle, Gauge, ListTree, Wallet, TrendingDown,
  TrendingUp, Info, Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Contract + helpers — UNCHANGED behavior, endpoints, and shapes     */
/* ------------------------------------------------------------------ */

const API_BASE = "http://localhost:8000/api";

async function apiCall(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Malformed response from ${path}`);
  }
  if (data && data.error) {
    throw new Error(data.message || `${path} failed (${data.code || "ERROR"})`);
  }
  return data;
}

function formatINR(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(n);
}

function riskBand(score) {
  if (score === null || score === undefined) return { label: "unknown", color: "var(--c-mid)" };
  if (score < 34) return { label: "contained", color: "var(--c-low)" };
  if (score < 67) return { label: "elevated", color: "var(--c-mid)" };
  return { label: "critical", color: "var(--c-high)" };
}

/* ---- presentational-only classifiers (no data/logic impact) -------- */
/* These only decide *how a value already in the API response is styled*,
   never what is fetched, computed, sent, or displayed as raw content. */

function cvssBand(score) {
  if (score === null || score === undefined) return { label: "n/a", color: "var(--text-faint)", soft: "var(--bg-panel-alt)" };
  if (score >= 9) return { label: "critical", color: "var(--c-high)", soft: "var(--c-high-soft)" };
  if (score >= 7) return { label: "high", color: "var(--c-high)", soft: "var(--c-high-soft)" };
  if (score >= 4) return { label: "medium", color: "var(--c-mid)", soft: "var(--c-mid-soft)" };
  return { label: "low", color: "var(--c-low)", soft: "var(--c-low-soft)" };
}

function epssBand(pct) {
  if (pct === null || pct === undefined) return { label: "n/a", color: "var(--text-faint)", soft: "var(--bg-panel-alt)" };
  if (pct >= 0.5) return { label: "high", color: "var(--c-high)", soft: "var(--c-high-soft)" };
  if (pct >= 0.1) return { label: "medium", color: "var(--c-mid)", soft: "var(--c-mid-soft)" };
  return { label: "low", color: "var(--c-low)", soft: "var(--c-low-soft)" };
}

const FRAMEWORK_PALETTE = [
  { color: "#4C7FEF", soft: "rgba(76,127,239,0.14)" },
  { color: "#33B584", soft: "rgba(51,181,132,0.14)" },
  { color: "#E0A23B", soft: "rgba(224,162,59,0.14)" },
  { color: "#C084E8", soft: "rgba(192,132,232,0.14)" },
  { color: "#4FC1E9", soft: "rgba(79,193,233,0.14)" },
  { color: "#E5584F", soft: "rgba(229,88,79,0.14)" },
];

function frameworkStyle(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FRAMEWORK_PALETTE[hash % FRAMEWORK_PALETTE.length];
}

/* ------------------------------------------------------------------ */
/*  Generic resource hook — mirrors the fixed error shape everywhere   */
/* ------------------------------------------------------------------ */

function useResource(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    apiCall(path)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Panel({ title, eyebrow, right, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          {eyebrow && <div className="panel-eyebrow">{eyebrow}</div>}
          <h2 className="panel-title">{title}</h2>
        </div>
        {right}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function InlineStatus({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div className="status-block status-loading">
        <Loader2 size={16} className="spin" />
        <span>reading ledger…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="status-block status-error">
        <AlertTriangle size={16} />
        <div className="status-copy">
          <div className="status-title">couldn&rsquo;t load this data</div>
          <div className="status-desc">{error}</div>
        </div>
        {onRetry && (
          <button className="btn-ghost" onClick={onRetry}>retry</button>
        )}
      </div>
    );
  }
  return children;
}

function EmptyState({ icon: Icon = Info, title, desc }) {
  return (
    <div className="empty-state">
      <Icon size={18} />
      <div>
        <div className="status-title">{title}</div>
        {desc && <div className="status-desc">{desc}</div>}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="kpi-skeleton">
      <div className="skeleton-bar w-70" />
      <div className="skeleton-bar w-40" />
    </div>
  );
}

function RiskScale({ score }) {
  const band = riskBand(score);
  const pos = Math.max(2, Math.min(98, score ?? 0));
  return (
    <div className="risk-scale">
      <div className="risk-scale-track">
        <div className="risk-scale-seg" style={{ background: "var(--c-low)", width: "34%" }} />
        <div className="risk-scale-seg" style={{ background: "var(--c-mid)", width: "33%" }} />
        <div className="risk-scale-seg" style={{ background: "var(--c-high)", width: "33%" }} />
        <div className="risk-scale-marker" style={{ left: `${pos}%`, borderColor: band.color }} />
      </div>
      <div className="risk-scale-ticks">
        <span>0</span><span>contained</span><span>elevated</span><span>critical</span><span>100</span>
      </div>
    </div>
  );
}

function Badge({ children, color, soft, style, className = "" }) {
  return (
    <span
      className={`badge-pill ${className}`}
      style={{ color: color ?? "var(--accent)", background: soft ?? "var(--accent-soft)", ...style }}
    >
      {children}
    </span>
  );
}

function StatChip({ icon: Icon, label, value, tone = "neutral" }) {
  return (
    <div className={`stat-chip tone-${tone}`}>
      {Icon && <Icon size={14} className="stat-chip-icon" />}
      <div>
        <div className="stat-chip-label">{label}</div>
        <div className="stat-chip-value">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                                */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "assets", label: "Assets & vulnerabilities", icon: ListTree },
  { id: "simulator", label: "Scenario simulator", icon: SlidersHorizontal },
  { id: "optimizer", label: "Investment optimizer", icon: IndianRupee },
  { id: "compliance", label: "Compliance mapping", icon: FileCheck2 },
  { id: "ask", label: "Ask AegisQ", icon: MessageSquare },
];

/* ------------------------------------------------------------------ */
/*  Main app                                                           */
/* ------------------------------------------------------------------ */

export default function AegisQDashboard() {
  const [tab, setTab] = useState("overview");

  const health = useResource("/health");
  const summary = useResource("/risk/summary");
  const assets = useResource("/assets");
  const controls = useResource("/controls");
  const compliance = useResource("/compliance/mapping");

  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const assetDetail = useResource(
    selectedAssetId ? `/risk/assets/${selectedAssetId}` : null,
    [selectedAssetId]
  );
  useEffect(() => {
    if (!selectedAssetId && assets.data && assets.data.length) {
      setSelectedAssetId(assets.data[0].id);
    }
  }, [assets.data, selectedAssetId]);

  /* ---- scenario simulator ---- */
  const [pickedControls, setPickedControls] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState(null);
  const [simResult, setSimResult] = useState(null);

  function toggleControl(id) {
    setPickedControls((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    setSimResult(null);
  }

  async function runSimulation() {
    setSimLoading(true);
    setSimError(null);
    try {
      const data = await apiCall("/scenario/simulate", {
        method: "POST",
        body: JSON.stringify({ control_ids: pickedControls }),
      });
      setSimResult(data);
    } catch (e) {
      setSimError(e.message);
    } finally {
      setSimLoading(false);
    }
  }

  /* ---- optimizer ---- */
  const [budget, setBudget] = useState(2500000);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState(null);
  const [optResult, setOptResult] = useState(null);

  async function runOptimize() {
    setOptLoading(true);
    setOptError(null);
    try {
      const data = await apiCall("/optimize", {
        method: "POST",
        body: JSON.stringify({ budget_inr: Number(budget) }),
      });
      setOptResult(data);
    } catch (e) {
      setOptError(e.message);
    } finally {
      setOptLoading(false);
    }
  }

  /* ---- natural-language query ---- */
  const [question, setQuestion] = useState("");
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState(null);
  const [qResult, setQResult] = useState(null);

  async function askQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setQLoading(true);
    setQError(null);
    try {
      const data = await apiCall("/query", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setQResult(data);
    } catch (e) {
      setQError(e.message);
    } finally {
      setQLoading(false);
    }
  }

  const assetById = useMemo(() => {
    const m = {};
    (assets.data || []).forEach((a) => { m[a.id] = a; });
    return m;
  }, [assets.data]);

  /* ---- presentational-only derived values (no new data sources) ---- */
  const healthState = health.loading ? "loading" : health.error ? "error" : health.data?.db_connected ? "ok" : "warn";
  const healthLabel = { loading: "connecting…", error: "offline", ok: "live", warn: "degraded" }[healthState];

  const remainingBudget = optResult && budget != null
    ? Number(budget) - (optResult.total_cost_inr ?? 0)
    : null;

  return (
    <div className="aq-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .aq-root {
          --bg: #0A0E17;
          --bg-raised: #10182A;
          --bg-panel: #131B2C;
          --bg-panel-alt: #1B2439;
          --bg-input: #0D1420;
          --border: #232C40;
          --border-soft: #1A2233;
          --border-strong: #34405C;
          --text: #EDF0F6;
          --text-soft: #99A3BC;
          --text-faint: #616C87;
          --accent: #4C7FEF;
          --accent-strong: #6E97F5;
          --accent-soft: rgba(76,127,239,0.14);
          --c-low: #33B584;
          --c-low-soft: rgba(51,181,132,0.14);
          --c-mid: #E0A23B;
          --c-mid-soft: rgba(224,162,59,0.14);
          --c-high: #E5584F;
          --c-high-soft: rgba(229,88,79,0.14);
          --c-primary: var(--accent);
          --radius: 10px;
          --radius-sm: 6px;
          --shadow-panel: 0 1px 2px rgba(0,0,0,0.35), 0 10px 28px -16px rgba(0,0,0,0.6);
          font-family: 'IBM Plex Sans', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        .aq-root .serif { font-family: 'Source Serif 4', serif; }
        .aq-root .mono { font-family: 'IBM Plex Mono', monospace; }
        .aq-root *, .aq-root *::before, .aq-root *::after { box-sizing: border-box; }
        .aq-root button, .aq-root input { font-family: inherit; color: inherit; }
        .aq-root :focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 2px; }

        /* ---------------- Header ---------------- */
        .aq-header {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 18px 28px; border-bottom: 1px solid var(--border-soft);
          background: var(--bg-raised); flex-wrap: wrap;
        }
        .aq-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .aq-brand-mark-wrap {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          background: var(--accent-soft); color: var(--accent-strong); flex: none;
        }
        .aq-brand-text { min-width: 0; }
        .aq-brand-row { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
        .aq-brand-mark { font-family: 'Source Serif 4', serif; font-size: 21px; font-weight: 600; letter-spacing: 0.005em; color: var(--text); }
        .aq-brand-project { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--text-faint); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; }
        .aq-brand-sub { font-size: 12.5px; color: var(--text-soft); margin-top: 2px; }

        .health-pill {
          display: flex; align-items: center; gap: 8px;
          border: 1px solid var(--border); border-radius: 999px; padding: 6px 12px 6px 10px;
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-soft);
          background: var(--bg-panel); flex: none;
        }
        .health-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; box-shadow: 0 0 0 3px currentColor; opacity: 0.9; }
        .health-dot.ok { background: var(--c-low); color: rgba(51,181,132,0.18); }
        .health-dot.warn { background: var(--c-mid); color: rgba(224,162,59,0.18); }
        .health-dot.error { background: var(--c-high); color: rgba(229,88,79,0.18); }
        .health-dot.loading { background: var(--text-faint); color: rgba(97,108,135,0.18); }
        .health-status { color: var(--text); text-transform: capitalize; font-weight: 500; }
        .health-detail { color: var(--text-faint); }

        /* ---------------- KPI strip ---------------- */
        .kpi-strip {
          display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 14px;
          padding: 18px 28px; border-bottom: 1px solid var(--border-soft); background: var(--bg);
        }
        .kpi-card {
          background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 18px 20px; box-shadow: var(--shadow-panel); min-width: 0;
        }
        .kpi-card.kpi-primary {
          background: linear-gradient(180deg, rgba(76,127,239,0.10), rgba(76,127,239,0.02) 60%), var(--bg-panel);
          border-color: rgba(76,127,239,0.35);
        }
        .kpi-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .kpi-icon-wrap {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 7px; flex: none;
          background: var(--bg-panel-alt); color: var(--text-soft);
        }
        .kpi-icon-wrap.primary { background: var(--accent-soft); color: var(--accent-strong); }
        .kpi-icon-wrap.warn { background: var(--c-high-soft); color: var(--c-high); }
        .kpi-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-faint); letter-spacing: 0.01em; }
        .kpi-value { font-family: 'Source Serif 4', serif; font-size: 30px; font-weight: 600; line-height: 1.05; font-variant-numeric: tabular-nums; color: var(--text); }
        .kpi-value-xl { font-size: 38px; }
        .kpi-value.small { font-size: 19px; }
        .kpi-sub { font-size: 12px; color: var(--text-faint); margin-top: 6px; }
        .kpi-skeleton { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
        .skeleton-bar { height: 14px; border-radius: 4px; background: linear-gradient(90deg, var(--bg-panel-alt) 25%, var(--border) 37%, var(--bg-panel-alt) 63%); background-size: 400% 100%; animation: aq-shimmer 1.6s ease-in-out infinite; }
        .skeleton-bar.w-70 { width: 70%; height: 26px; }
        .skeleton-bar.w-40 { width: 40%; }
        @keyframes aq-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

        .risk-scale { margin-top: 12px; }
        .risk-scale-track { position: relative; height: 6px; display: flex; border-radius: 3px; overflow: visible; }
        .risk-scale-seg:first-child { border-radius: 3px 0 0 3px; }
        .risk-scale-seg:last-child { border-radius: 0 3px 3px 0; }
        .risk-scale-marker {
          position: absolute; top: -4px; width: 2px; height: 14px;
          background: var(--text); border-left: 3px solid; transform: translateX(-1.5px);
        }
        .risk-scale-ticks {
          display: flex; justify-content: space-between; margin-top: 7px;
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--text-faint);
        }

        /* ---------------- Tabs ---------------- */
        .aq-tabs { display: flex; gap: 4px; padding: 10px 24px; background: var(--bg-raised); overflow-x: auto; border-bottom: 1px solid var(--border-soft); scrollbar-width: thin; }
        .aq-tab {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 14px; font-size: 13px; color: var(--text-soft); font-weight: 500;
          border-radius: var(--radius-sm); white-space: nowrap; cursor: pointer;
          background: none; border: 1px solid transparent; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .aq-tab.active { color: var(--text); background: var(--accent-soft); border-color: rgba(76,127,239,0.3); }
        .aq-tab.active svg { color: var(--accent-strong); }
        .aq-tab:hover:not(.active) { color: var(--text); background: var(--bg-panel-alt); }

        .aq-content { padding: 24px 28px 64px; background: var(--bg); color: var(--text); min-height: 60vh; }

        /* ---------------- Panels ---------------- */
        .panel { border: 1px solid var(--border); background: var(--bg-panel); border-radius: var(--radius); margin-bottom: 18px; box-shadow: var(--shadow-panel); }
        .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border-soft); }
        .panel-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-faint); margin-bottom: 4px; }
        .panel-title { font-family: 'Source Serif 4', serif; font-size: 17px; font-weight: 600; color: var(--text); }
        .panel-body { padding: 20px; }

        .grid-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; align-items: start; }
        @media (max-width: 980px) {
          .grid-2 { grid-template-columns: 1fr; }
          .kpi-strip { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .aq-header { padding: 14px 16px; }
          .kpi-strip { padding: 14px 16px; }
          .aq-tabs { padding: 8px 12px; }
          .aq-content { padding: 18px 16px 48px; }
          .panel-body { padding: 16px; }
          .panel-head { padding: 14px 16px; }
        }

        /* ---------------- Status / empty states ---------------- */
        .status-block { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; padding: 12px 14px; border-radius: var(--radius-sm); }
        .status-loading { color: var(--text-soft); background: var(--bg-panel-alt); align-items: center; }
        .status-error { color: var(--c-high); background: var(--c-high-soft); border: 1px solid rgba(229,88,79,0.3); align-items: center; }
        .status-copy { flex: 1; }
        .status-title { font-weight: 600; color: var(--text); font-size: 13px; }
        .status-error .status-title { color: var(--c-high); }
        .status-desc { color: var(--text-faint); font-size: 12.5px; margin-top: 2px; }
        .empty-state { display: flex; align-items: center; gap: 10px; color: var(--text-faint); padding: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); font-size: 13px; }
        .spin { animation: aq-spin 0.9s linear infinite; }
        @keyframes aq-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } .skeleton-bar { animation: none; } }

        /* ---------------- Tables ---------------- */
        table.led { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.led th { text-align: left; font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 10.5px; letter-spacing: 0.02em; color: var(--text-faint); padding: 8px 10px; border-bottom: 1px solid var(--border); }
        table.led td { padding: 10px 10px; border-bottom: 1px solid var(--border-soft); vertical-align: middle; color: var(--text); }
        table.led tr.clickable { cursor: pointer; transition: background 0.12s ease; }
        table.led tr.clickable:hover { background: var(--bg-panel-alt); }
        table.led tr.selected { background: var(--accent-soft); }
        table.led tr.selected td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
        .table-scroll { overflow-x: auto; }

        .criticality-dots { display: inline-flex; gap: 3px; align-items: center; }
        .crit-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--border-strong); }
        .crit-dot.filled { background: var(--dot-color, var(--accent)); }

        .badge-pill { display: inline-flex; align-items: center; gap: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 500; padding: 3px 8px; border-radius: 999px; }
        .tag { display: inline-flex; align-items: center; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 999px; margin: 0 5px 5px 0; color: var(--text-soft); background: var(--bg-panel-alt); }
        .tag.tag-click { cursor: pointer; transition: border-color 0.12s ease, color 0.12s ease; }
        .tag.tag-click:hover { border-color: var(--accent); color: var(--accent-strong); }

        /* ---------------- Scenario simulator ---------------- */
        .control-card {
          display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px;
          border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 10px;
          cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease; background: var(--bg-panel-alt);
        }
        .control-card:last-child { margin-bottom: 0; }
        .control-card:hover { border-color: var(--border-strong); }
        .control-card.picked { border-color: rgba(76,127,239,0.5); background: var(--accent-soft); }
        .control-checkbox {
          width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border-strong);
          display: flex; align-items: center; justify-content: center; flex: none; margin-top: 2px;
          background: var(--bg-input); transition: background 0.12s ease, border-color 0.12s ease;
        }
        .control-card.picked .control-checkbox { background: var(--accent); border-color: var(--accent); color: #fff; }
        .control-card input[type="checkbox"] { position: absolute; opacity: 0; width: 0; height: 0; }
        .control-name { font-size: 14px; font-weight: 500; color: var(--text); }
        .control-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--text-soft); margin-top: 4px; }
        .control-meta-item { display: inline-flex; align-items: center; gap: 4px; }
        .control-tags { margin-top: 8px; }

        .sim-flow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .stat-chip { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--bg-panel-alt); border: 1px solid var(--border); }
        .stat-chip-icon { color: var(--text-soft); flex: none; }
        .stat-chip-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--text-faint); }
        .stat-chip-value { font-size: 15px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
        .stat-chip.tone-good { border-color: rgba(51,181,132,0.4); background: var(--c-low-soft); }
        .stat-chip.tone-good .stat-chip-icon { color: var(--c-low); }
        .stat-chip.tone-bad { border-color: rgba(229,88,79,0.4); background: var(--c-high-soft); }
        .stat-chip.tone-bad .stat-chip-icon { color: var(--c-high); }
        .flow-arrow { color: var(--text-faint); flex: none; }

        .delta-banner { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; margin-top: 4px; }
        .delta-good { color: var(--c-low); background: var(--c-low-soft); border: 1px solid rgba(51,181,132,0.35); }
        .delta-bad { color: var(--c-high); background: var(--c-high-soft); border: 1px solid rgba(229,88,79,0.35); }

        /* ---------------- Buttons / inputs ---------------- */
        .btn-primary {
          background: var(--accent); color: #fff; border: none; padding: 10px 18px; border-radius: var(--radius-sm);
          font-size: 13.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
          transition: background 0.15s ease, transform 0.05s ease;
        }
        .btn-primary:disabled { opacity: 0.45; cursor: default; }
        .btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
        .btn-primary:active:not(:disabled) { transform: translateY(1px); }
        .btn-ghost {
          border: 1px solid var(--border-strong); background: transparent; color: var(--text);
          padding: 5px 12px; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 500;
        }
        .btn-ghost:hover { border-color: var(--accent); color: var(--accent-strong); }

        .field-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 6px; }
        .field-input {
          width: 100%; border: 1px solid var(--border); background: var(--bg-input); color: var(--text); border-radius: var(--radius-sm);
          padding: 10px 12px; font-size: 14px; font-family: 'IBM Plex Sans', sans-serif; transition: border-color 0.12s ease;
        }
        .field-input:focus { border-color: var(--accent); outline: none; }
        .field-input::placeholder { color: var(--text-faint); }

        .ask-answer { border-left: 3px solid var(--accent); padding: 6px 0 6px 16px; margin-top: 16px; font-size: 14.5px; line-height: 1.6; color: var(--text); }

        /* ---------------- Optimizer specifics ---------------- */
        .budget-bar-wrap { margin-top: 16px; }
        .budget-bar-track { position: relative; height: 8px; background: var(--bg-panel-alt); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); }
        .budget-bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.4s ease; }
        .budget-bar-fill.over { background: var(--c-high); }
        .budget-bar-labels { display: flex; justify-content: space-between; margin-top: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-faint); }
      `}</style>

      {/* Header */}
      <header className="aq-header">
        <div className="aq-brand">
          <span className="aq-brand-mark-wrap"><ShieldCheck size={19} /></span>
          <div className="aq-brand-text">
            <div className="aq-brand-row">
              <span className="aq-brand-mark">AegisQ</span>
              <span className="aq-brand-project">SIH26105</span>
            </div>
            <div className="aq-brand-sub">Cyber risk, quantified in rupees</div>
          </div>
        </div>
        <div className="health-pill">
          <span className={`health-dot ${healthState}`} />
          <span className="health-status">{healthLabel}</span>
          {health.data && !health.error && (
            <span className="health-detail">
              · assets {health.data.row_counts?.assets ?? "–"} · vulns {health.data.row_counts?.vulnerabilities ?? "–"} · controls {health.data.row_counts?.controls ?? "–"}
            </span>
          )}
          {health.error && <span className="health-detail">backend unreachable</span>}
        </div>
      </header>

      {/* KPI strip */}
      <div className="kpi-strip">
        <div className="kpi-card kpi-primary">
          <div className="kpi-card-head">
            <span className="kpi-icon-wrap primary"><IndianRupee size={14} /></span>
            <span className="kpi-label">total financial exposure</span>
          </div>
          {summary.loading ? (
            <KpiSkeleton />
          ) : summary.error ? (
            <div className="kpi-value small" style={{ color: "var(--c-high)" }}>unavailable</div>
          ) : (
            <>
              <div className="kpi-value kpi-value-xl">{formatINR(summary.data.total_financial_exposure_inr)}</div>
              <div className="kpi-sub">expected annual loss across {assets.data?.length ?? "—"} tracked assets</div>
            </>
          )}
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon-wrap"><Gauge size={14} /></span>
            <span className="kpi-label">enterprise risk score</span>
          </div>
          {summary.loading ? (
            <KpiSkeleton />
          ) : summary.error ? (
            <div className="kpi-value small" style={{ color: "var(--c-high)" }}>unavailable</div>
          ) : (
            <>
              <div className="kpi-value">{summary.data.enterprise_risk_score?.toFixed(1) ?? "—"}</div>
              <RiskScale score={summary.data.enterprise_risk_score} />
            </>
          )}
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon-wrap warn"><ShieldAlert size={14} /></span>
            <span className="kpi-label">top risk contributor</span>
          </div>
          {summary.loading ? (
            <KpiSkeleton />
          ) : summary.error ? (
            <div className="kpi-value small" style={{ color: "var(--c-high)" }}>unavailable</div>
          ) : (
            <div>
              <div className="kpi-value small serif">
                {summary.data.top_risk_contributors?.[0]?.asset_name ?? "—"}
              </div>
              <div className="kpi-sub">
                {formatINR(summary.data.top_risk_contributors?.[0]?.expected_annual_loss_inr)} expected annual loss
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav className="aq-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`aq-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main className="aq-content">
        {tab === "overview" && (
          <div className="grid-2">
            <Panel eyebrow="90-day trend" title="Expected annual loss">
              <InlineStatus loading={summary.loading} error={summary.error} onRetry={summary.reload}>
                {summary.data && (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={summary.data.risk_trend}>
                      <CartesianGrid stroke="var(--border-soft)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-faint)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--text-faint)" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                        width={54}
                      />
                      <Tooltip
                        formatter={(v) => formatINR(v)}
                        labelStyle={{ fontSize: 12, color: "#0A0E17" }}
                        contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Mono, monospace", background: "#F5F6F8", border: "1px solid #C7CBD6", borderRadius: 6, color: "#0A0E17" }}
                      />
                      <Line type="monotone" dataKey="expected_annual_loss_inr" stroke="var(--accent-strong)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </InlineStatus>
            </Panel>

            <Panel eyebrow="ranked by exposure" title="Top risk contributors">
              <InlineStatus loading={summary.loading} error={summary.error} onRetry={summary.reload}>
                {summary.data && (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary.data.top_risk_contributors} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid stroke="var(--border-soft)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-faint)" }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                      <YAxis type="category" dataKey="asset_name" width={110} tick={{ fontSize: 11.5, fill: "var(--text)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v) => formatINR(v)}
                        contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Mono, monospace", background: "#F5F6F8", border: "1px solid #C7CBD6", borderRadius: 6, color: "#0A0E17" }}
                      />
                      <Bar dataKey="expected_annual_loss_inr" radius={[0, 3, 3, 0]}>
                        {summary.data.top_risk_contributors?.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#E5584F" : "#E0A23B"} cursor="pointer" onClick={() => {
                            setSelectedAssetId(summary.data.top_risk_contributors[i].asset_id);
                            setTab("assets");
                          }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </InlineStatus>
            </Panel>
          </div>
        )}

        {tab === "assets" && (
          <div className="grid-2">
            <Panel eyebrow={`${assets.data?.length ?? 0} assets under coverage`} title="Asset register">
              <InlineStatus loading={assets.loading} error={assets.error} onRetry={assets.reload}>
                <div className="table-scroll">
                  <table className="led">
                    <thead>
                      <tr><th>name</th><th>category</th><th>criticality</th><th>unit</th></tr>
                    </thead>
                    <tbody>
                      {assets.data?.map((a) => (
                        <tr
                          key={a.id}
                          className={`clickable ${a.id === selectedAssetId ? "selected" : ""}`}
                          onClick={() => setSelectedAssetId(a.id)}
                        >
                          <td>{a.name}</td>
                          <td className="mono">{a.category}</td>
                          <td>
                            <span className="criticality-dots" title={`criticality ${a.criticality}/5`}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span
                                  key={i}
                                  className={`crit-dot ${i < a.criticality ? "filled" : ""}`}
                                  style={i < a.criticality ? { "--dot-color": a.criticality >= 4 ? "var(--c-high)" : a.criticality === 3 ? "var(--c-mid)" : "var(--c-low)" } : undefined}
                                />
                              ))}
                            </span>
                          </td>
                          <td className="mono">{a.business_unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InlineStatus>
            </Panel>

            <Panel
              eyebrow="drill-down"
              title={selectedAssetId ? (assetById[selectedAssetId]?.name ?? selectedAssetId) : "select an asset"}
            >
              <InlineStatus loading={assetDetail.loading} error={assetDetail.error} onRetry={assetDetail.reload}>
                {assetDetail.data && (
                  <div>
                    <div style={{ display: "flex", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
                      <div>
                        <div className="kpi-label">risk score</div>
                        <div className="kpi-value small serif">{assetDetail.data.risk_score?.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="kpi-label">expected annual loss</div>
                        <div className="kpi-value small serif">{formatINR(assetDetail.data.expected_annual_loss_inr)}</div>
                      </div>
                    </div>
                    <div className="panel-eyebrow" style={{ marginBottom: 8 }}>vulnerabilities</div>
                    <div className="table-scroll">
                      <table className="led">
                        <thead><tr><th>CVE</th><th>CVSS</th><th>EPSS</th></tr></thead>
                        <tbody>
                          {assetDetail.data.vulnerabilities?.map((v) => {
                            const cvss = cvssBand(v.cvss_score);
                            const epssPct = v.epss_score ?? null;
                            const epss = epssBand(epssPct);
                            return (
                              <tr key={v.id}>
                                <td className="mono">{v.cve_id}</td>
                                <td>
                                  <Badge color={cvss.color} soft={cvss.soft}>
                                    {v.cvss_score?.toFixed(1) ?? "—"} · {cvss.label}
                                  </Badge>
                                </td>
                                <td>
                                  {epssPct != null ? (
                                    <Badge color={epss.color} soft={epss.soft}>
                                      {(epssPct * 100).toFixed(1)}% · {epss.label}
                                    </Badge>
                                  ) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                          {assetDetail.data.vulnerabilities?.length === 0 && (
                            <tr><td colSpan={3}><EmptyState icon={ShieldCheck} title="no open vulnerabilities recorded" /></td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </InlineStatus>
            </Panel>
          </div>
        )}

        {tab === "simulator" && (
          <div className="grid-2">
            <Panel eyebrow="choose controls to model" title="Scenario builder">
              <InlineStatus loading={controls.loading} error={controls.error} onRetry={controls.reload}>
                {controls.data?.map((c) => {
                  const picked = pickedControls.includes(c.id);
                  return (
                    <label className={`control-card ${picked ? "picked" : ""}`} key={c.id}>
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() => toggleControl(c.id)}
                      />
                      <span className="control-checkbox">{picked && <Check size={12} />}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="control-name">{c.name}</div>
                        <div className="control-meta">
                          <span className="control-meta-item mono"><Wallet size={12} /> {formatINR(c.cost_inr)}</span>
                          <span className="control-meta-item mono"><TrendingDown size={12} /> −{c.risk_reduction_pct}% risk</span>
                        </div>
                        {c.framework_tags && (
                          <div className="control-tags">
                            {c.framework_tags.split(",").map((tag) => (
                              <span key={tag} className="tag">{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
                {controls.data?.length === 0 && (
                  <EmptyState title="no controls available" desc="the control catalog is empty." />
                )}
              </InlineStatus>
              <button className="btn-primary" style={{ marginTop: 6, width: "100%", justifyContent: "center" }} disabled={simLoading || !pickedControls.length} onClick={runSimulation}>
                {simLoading ? <Loader2 size={14} className="spin" /> : <ChevronRight size={14} />}
                run simulation {pickedControls.length > 0 && `(${pickedControls.length} selected)`}
              </button>
            </Panel>

            <Panel eyebrow="modeled outcome" title="Simulation result">
              {simError && (
                <div className="status-block status-error">
                  <AlertTriangle size={16} />
                  <div className="status-copy">
                    <div className="status-title">simulation failed</div>
                    <div className="status-desc">{simError}</div>
                  </div>
                </div>
              )}
              {!simResult && !simError && (
                <EmptyState
                  icon={SlidersHorizontal}
                  title="no simulation run yet"
                  desc="select one or more controls and run the simulation to see the projected shift in enterprise risk."
                />
              )}
              {simResult && (
                <div>
                  <div className="sim-flow">
                    <StatChip icon={Gauge} label="new risk score" value={simResult.new_enterprise_risk_score?.toFixed(1) ?? "—"} />
                    <ChevronRight size={16} className="flow-arrow" />
                    <StatChip
                      icon={IndianRupee}
                      label="new exposure"
                      value={formatINR(simResult.new_total_financial_exposure_inr)}
                      tone={simResult.delta_inr < 0 ? "good" : simResult.delta_inr > 0 ? "bad" : "neutral"}
                    />
                  </div>
                  <div className={`delta-banner ${simResult.delta_inr < 0 ? "delta-good" : "delta-bad"}`}>
                    {simResult.delta_inr < 0 ? <TrendingDown size={17} /> : <TrendingUp size={17} />}
                    <span>
                      {simResult.delta_inr < 0 ? "Exposure improves by " : "Exposure increases by "}
                      <span className="mono">{formatINR(Math.abs(simResult.delta_inr))}</span>
                      {simResult.delta_inr < 0 ? " with the selected controls." : " — reconsider this combination."}
                    </span>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        )}

        {tab === "optimizer" && (
          <div className="grid-2">
            <Panel eyebrow="constrained by budget" title="Investment optimizer">
              <div className="sim-flow" style={{ marginBottom: 18 }}>
                <StatChip icon={Wallet} label="money" value="budget" />
                <ChevronRight size={14} className="flow-arrow" />
                <StatChip icon={ShieldCheck} label="controls" value="picked" />
                <ChevronRight size={14} className="flow-arrow" />
                <StatChip icon={TrendingDown} label="risk" value="reduced" />
                <ChevronRight size={14} className="flow-arrow" />
                <StatChip icon={IndianRupee} label="money" value="saved (ROSI)" />
              </div>

              <label className="field-label">annual security budget (₹)</label>
              <input
                type="number"
                className="field-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <button className="btn-primary" disabled={optLoading} onClick={runOptimize}>
                {optLoading ? <Loader2 size={14} className="spin" /> : <ChevronRight size={14} />}
                optimize allocation
              </button>

              {optError && (
                <div className="status-block status-error" style={{ marginTop: 14 }}>
                  <AlertTriangle size={16} />
                  <div className="status-copy">
                    <div className="status-title">optimization failed</div>
                    <div className="status-desc">{optError}</div>
                  </div>
                </div>
              )}

              {optResult && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                    <div>
                      <div className="kpi-label">total cost</div>
                      <div className="kpi-value small serif">{formatINR(optResult.total_cost_inr)}</div>
                    </div>
                    <div>
                      <div className="kpi-label">risk reduction</div>
                      <div className="kpi-value small serif" style={{ color: "var(--c-low)" }}>{formatINR(optResult.total_risk_reduction_inr)}</div>
                    </div>
                    <div>
                      <div className="kpi-label">ROSI</div>
                      <div className="kpi-value small serif" style={{ color: "var(--accent-strong)" }}>{optResult.rosi_pct?.toFixed(1)}%</div>
                    </div>
                  </div>

                  {budget != null && (
                    <div className="budget-bar-wrap">
                      <div className="budget-bar-track">
                        <div
                          className={`budget-bar-fill ${optResult.total_cost_inr > Number(budget) ? "over" : ""}`}
                          style={{ width: `${Math.min(100, ((optResult.total_cost_inr ?? 0) / Math.max(1, Number(budget))) * 100)}%` }}
                        />
                      </div>
                      <div className="budget-bar-labels">
                        <span>spent {formatINR(optResult.total_cost_inr)}</span>
                        <span>{remainingBudget >= 0 ? `${formatINR(remainingBudget)} remaining` : `${formatINR(Math.abs(remainingBudget))} over budget`}</span>
                      </div>
                    </div>
                  )}

                  <div className="panel-eyebrow" style={{ margin: "18px 0 8px" }}>selected controls</div>
                  <div className="table-scroll">
                    <table className="led">
                      <thead><tr><th>control</th><th>cost</th></tr></thead>
                      <tbody>
                        {optResult.selected_controls?.map((c) => (
                          <tr key={c.control_id}><td>{c.name}</td><td className="mono">{formatINR(c.cost_inr)}</td></tr>
                        ))}
                        {optResult.selected_controls?.length === 0 && (
                          <tr><td colSpan={2}><EmptyState title="no controls selected within this budget" /></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Panel>

            <Panel eyebrow="marginal return per rupee spent" title="Investment curve">
              {optResult?.investment_curve ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={optResult.investment_curve}>
                    <CartesianGrid stroke="var(--border-soft)" vertical={false} />
                    <XAxis dataKey="spend_inr" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={54} />
                    <Tooltip
                      formatter={(v) => formatINR(v)}
                      contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Mono, monospace", background: "#F5F6F8", border: "1px solid #C7CBD6", borderRadius: 6, color: "#0A0E17" }}
                    />
                    <Area type="monotone" dataKey="risk_reduction_inr" stroke="var(--c-low)" fill="var(--c-low)" fillOpacity={0.18} strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={IndianRupee} title="no optimization run yet" desc="run the optimizer to see how risk reduction scales with spend." />
              )}
            </Panel>
          </div>
        )}

        {tab === "compliance" && (
          <Panel eyebrow={`${compliance.data?.length ?? 0} mapped clauses`} title="Framework coverage">
            <InlineStatus loading={compliance.loading} error={compliance.error} onRetry={compliance.reload}>
              <div className="table-scroll">
                <table className="led">
                  <thead><tr><th>framework</th><th>clause</th><th>related controls</th></tr></thead>
                  <tbody>
                    {compliance.data?.map((row, i) => {
                      const fw = frameworkStyle(row.framework);
                      return (
                        <tr key={i}>
                          <td><Badge color={fw.color} soft={fw.soft} style={{ border: `1px solid ${fw.color}55` }}>{row.framework}</Badge></td>
                          <td className="mono">{row.clause}</td>
                          <td>
                            {row.related_control_ids?.map((id) => (
                              <span key={id} className="tag">{id}</span>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                    {compliance.data?.length === 0 && (
                      <tr><td colSpan={3}><EmptyState title="no compliance mappings recorded" /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </InlineStatus>
          </Panel>
        )}

        {tab === "ask" && (
          <Panel eyebrow="natural-language, cited to assets" title="Ask AegisQ">
            <form onSubmit={askQuestion} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="field-input"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="e.g. Which business unit carries the most exposure?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button className="btn-primary" disabled={qLoading} type="submit">
                {qLoading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                ask
              </button>
            </form>
            {qError && (
              <div className="status-block status-error" style={{ marginTop: 14 }}>
                <AlertTriangle size={16} />
                <div className="status-copy">
                  <div className="status-title">couldn&rsquo;t answer that</div>
                  <div className="status-desc">{qError}</div>
                </div>
              </div>
            )}
            {qResult && (
              <div className="ask-answer">
                {qResult.answer}
                {qResult.cited_asset_ids?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {qResult.cited_asset_ids.map((id) => (
                      <span key={id} className="tag tag-click" onClick={() => { setSelectedAssetId(id); setTab("assets"); }}>
                        {assetById[id]?.name ?? id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
        )}
      </main>
    </div>
  );
}
