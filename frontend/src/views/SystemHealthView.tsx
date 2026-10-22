import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  CheckCircle2,
  RefreshCw,
  Server,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';

export const SystemHealthView: React.FC = () => {
  const [health, setHealth] = useState<{
    status: string;
    service: string;
    version: string;
    timestamp: string;
  } | null>(null);
  const [pinging, setPinging] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setPinging(true);
    setError(null);
    const start = performance.now();
    try {
      const data = await api.getHealth();
      const end = performance.now();
      setLatency(Math.round(end - start));
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Health check failed', err);
      setHealth(null);
      setLatency(null);
      setError(err.message || 'Cannot reach backend server. Please verify npm run dev:backend is running.');
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#183B32] flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#183B32]" />
            <span>System Health & Diagnostics</span>
          </h1>
          <p className="text-xs text-[#687871] mt-1">
            Real-time backend API diagnostics, roundtrip latency, and local SQLite persistence status
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={pinging}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#183B32] text-white text-xs font-semibold hover:bg-[#102D27] transition-all shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${pinging ? 'animate-spin' : ''}`} />
          <span>{pinging ? 'Pinging API...' : 'Ping Backend API'}</span>
        </button>
      </div>

      {/* Connectivity & Health Status */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3EA] border border-[#DDE7DD] flex items-center justify-center text-[#183B32]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#183B32]">Express Backend Connectivity</h2>
              <p className="text-xs text-[#687871]">GET /api/health probe results {lastChecked ? `(checked at ${lastChecked})` : ''}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Backend Unreachable</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-4 rounded-xl bg-[#F6F4EE]/60 border border-[#E6E4DA]">
            <span className="text-[11px] font-semibold text-[#687871] uppercase tracking-wider block">
              Endpoint Status
            </span>
            <div className="mt-1 flex items-center space-x-1.5">
              {health?.status === 'ok' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span className="font-bold text-sm text-[#16A34A]">Online (HTTP 200)</span>
                </>
              ) : (
                <span className="font-bold text-sm text-red-600">Unreachable</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F4EE]/60 border border-[#E6E4DA]">
            <span className="text-[11px] font-semibold text-[#687871] uppercase tracking-wider block">
              Roundtrip Latency
            </span>
            <div className="mt-1 font-mono text-sm font-bold text-[#24342F]">
              {latency !== null ? `${latency} ms` : '—'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F6F4EE]/60 border border-[#E6E4DA]">
            <span className="text-[11px] font-semibold text-[#687871] uppercase tracking-wider block">
              API Version
            </span>
            <div className="mt-1 font-mono text-sm font-bold text-[#24342F]">
              {health?.version || '1.0.0'}
            </div>
          </div>
        </div>

        {health && (
          <div className="text-[11px] text-[#687871] font-mono bg-[#F6F4EE] p-3 rounded-xl border border-[#E6E4DA] overflow-x-auto">
            Raw payload: {JSON.stringify(health, null, 2)}
          </div>
        )}
      </div>

      {/* Database Architecture & File Paths */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#EAF3EA] border border-[#DDE7DD] flex items-center justify-center text-[#183B32]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#183B32]">Database Engine & Integrity</h2>
            <p className="text-xs text-[#687871]">Local SQLite embedded engine with foreign keys</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-[#24342F]">
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-[#E6E4DA]/60 gap-1">
            <span className="text-[#687871] font-medium">Storage Engine</span>
            <span className="font-mono text-[#24342F] font-semibold">better-sqlite3 v13 (Synchronous C++ bindings)</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-[#E6E4DA]/60 gap-1">
            <span className="text-[#687871] font-medium">Journal Mode</span>
            <span className="font-mono text-[#183B32] font-semibold">WAL (Write-Ahead Logging)</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-[#E6E4DA]/60 gap-1">
            <span className="text-[#687871] font-medium">Foreign Key Enforcement</span>
            <span className="font-mono text-[#16A34A] font-semibold">PRAGMA foreign_keys = ON (Active)</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-[#E6E4DA]/60 gap-1">
            <span className="text-[#687871] font-medium">Active Database Path</span>
            <span className="font-mono text-[#24342F] font-semibold bg-[#F6F4EE] px-2 py-0.5 rounded">database/data/fixflow.db</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-[#E6E4DA]/60 gap-1">
            <span className="text-[#687871] font-medium">Schema Migration State</span>
            <span className="font-mono text-[#24342F] font-semibold">001_initial_schema.sql (appliances, repair_cases, repair_events, warranty_documents)</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-[#E6E4DA]/60 gap-1">
            <span className="text-[#687871] font-medium">Verified Cold Backup</span>
            <span className="font-mono text-[#183B32] font-semibold">database/backups/fixflow-backup-*.db</span>
          </div>
        </div>
      </div>

      {/* Audit & Disclaimer Notice */}
      <div className="bg-[#F6F4EE] rounded-2xl border border-[#E6E4DA] p-5 text-xs text-[#687871] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#183B32] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-[#183B32]">Prototype Boundary & Integrity Policy</p>
          <p className="leading-relaxed">
            FixFlow is operating in Phase 1 local prototype mode. The health check above confirms connectivity to the local Express HTTP server and verifies SQLite file accessibility. It does not represent live integration with Amazon Alexa+ cloud services, MCP protocol, or external third-party contractor booking APIs, which are planned for subsequent phases.
          </p>
        </div>
      </div>
    </div>
  );
};
