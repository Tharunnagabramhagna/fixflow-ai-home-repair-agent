import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Clock,
  Phone,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronRight,
  Radio,
  RefreshCw,
  User,
  ShieldCheck,
} from 'lucide-react';
import type { DispatchDetail, DispatchStatus } from '../types';
import { api } from '../api/client';

interface DispatchTrackerProps {
  caseId: string;
  applianceName?: string;
  onStatusChange?: (updatedDispatch: DispatchDetail) => void;
}

const STEPS: { status: DispatchStatus; label: string; icon: any }[] = [
  { status: 'pending', label: 'Requested', icon: Clock },
  { status: 'dispatched', label: 'Dispatched', icon: Truck },
  { status: 'en_route', label: 'En Route', icon: Radio },
  { status: 'arrived', label: 'On Site', icon: CheckCircle },
  { status: 'completed', label: 'Completed', icon: ShieldCheck },
];

export const DispatchTracker: React.FC<DispatchTrackerProps> = ({
  caseId,
  applianceName,
  onStatusChange,
}) => {
  const [dispatch, setDispatch] = useState<DispatchDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'polling'>('connected');

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial state and start SSE stream
  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getDispatch(caseId);
        if (isMounted) {
          setDispatch(data);
          onStatusChange?.(data);
        }
      } catch (err: any) {
        if (isMounted) {
          if (err.message?.includes('No contractor dispatch found')) {
            setDispatch(null);
          } else {
            setError(err.message || 'Failed to load dispatch status');
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitial();

    // Setup Server-Sent Events (SSE)
    const streamUrl = `/api/repairs/${caseId}/dispatch/stream`;
    try {
      const es = new EventSource(streamUrl, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isMounted) setConnectionStatus('connected');
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.dispatch && isMounted) {
            setDispatch(payload.dispatch);
            onStatusChange?.(payload.dispatch);
          }
        } catch {}
      };

      es.onerror = () => {
        if (isMounted) {
          setConnectionStatus('reconnecting');
        }
      };
    } catch {
      setConnectionStatus('polling');
    }

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [caseId, onStatusChange]);

  const handleAdvance = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const updated = await api.advanceDispatch(caseId);
      setDispatch(updated);
      onStatusChange?.(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to advance dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this contractor dispatch?')) return;
    try {
      setActionLoading(true);
      setError(null);
      const updated = await api.cancelDispatch(caseId, 'Homeowner cancelled from web dashboard');
      setDispatch(updated);
      onStatusChange?.(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitiate = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const created = await api.initiateDispatch(caseId, 'Requested from dashboard dispatch tracker');
      setDispatch(created);
      onStatusChange?.(created);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex items-center justify-center space-x-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
        <span>Connecting to live contractor dispatch stream...</span>
      </div>
    );
  }

  if (!dispatch) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center">
        <Truck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h4 className="text-slate-200 font-semibold mb-1">No Contractor Dispatch Scheduled</h4>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
          This repair case has not been assigned a simulated technician dispatch yet. You can request a dispatch to track technician arrival in real time.
        </p>
        <button
          onClick={handleInitiate}
          disabled={actionLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2 mx-auto disabled:opacity-50"
        >
          {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
          <span>Initiate Simulated Dispatch</span>
        </button>
      </div>
    );
  }

  const isCancelled = dispatch.status === 'cancelled';
  const isCompleted = dispatch.status === 'completed';

  const currentStepIndex = STEPS.findIndex((s) => s.status === dispatch.status);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
      {/* Simulation Header Notice */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-amber-400 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>SIMULATION MODE — Technician locations, vehicle data, and arrival estimates are simulated for demonstration.</span>
        </div>
        <div className="flex items-center space-x-2">
          {connectionStatus === 'connected' && (
            <span className="flex items-center space-x-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SSE Live</span>
            </span>
          )}
          {connectionStatus === 'reconnecting' && (
            <span className="flex items-center space-x-1 text-amber-400 font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Reconnecting</span>
            </span>
          )}
          {connectionStatus === 'polling' && (
            <span className="text-slate-400">Polling</span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Main Status & ETA Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Dispatch ID: {dispatch.id}
            </span>
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <span>{applianceName || 'Appliance Service'}</span>
              <span className="text-slate-500">·</span>
              <span
                className={`text-sm px-2.5 py-0.5 rounded-full font-semibold uppercase ${
                  isCancelled
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                }`}
              >
                {dispatch.status.replace('_', ' ')}
              </span>
            </h3>
          </div>

          {!isCancelled && !isCompleted && dispatch.estimated_arrival_minutes !== null && (
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Estimated Arrival</span>
              <span className="text-2xl font-black text-blue-400 tracking-tight">
                ~{dispatch.estimated_arrival_minutes} min
              </span>
            </div>
          )}
        </div>

        {/* Step Progress Tracker */}
        {!isCancelled ? (
          <div className="relative py-2">
            <div className="hidden sm:block absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-slate-800" />
            <div
              className="hidden sm:block absolute top-1/2 left-6 -translate-y-1/2 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.max(0, (currentStepIndex / (STEPS.length - 1)) * 100)}%`,
              }}
            />

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
              {STEPS.map((step, idx) => {
                const isPassed = currentStepIndex > idx;
                const isCurrent = currentStepIndex === idx;
                const Icon = step.icon;

                return (
                  <div
                    key={step.status}
                    className={`flex flex-col items-center text-center p-3 rounded-xl transition-all ${
                      isCurrent
                        ? 'bg-blue-950/40 border border-blue-500/40 shadow-lg shadow-blue-500/10'
                        : isPassed
                        ? 'bg-slate-950/40 border border-emerald-500/20'
                        : 'bg-slate-950/20 border border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 font-semibold ${
                        isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 animate-pulse'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent ? 'text-blue-300' : isPassed ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-red-950/30 border border-red-900/40 rounded-xl flex items-center space-x-3 text-red-300">
            <XCircle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <p className="font-semibold">Dispatch Cancelled</p>
              <p className="text-xs text-red-400/80">
                This simulated contractor dispatch was cancelled. You may re-initiate a dispatch below if needed.
              </p>
            </div>
          </div>
        )}

        {/* Assigned Contractor Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-slate-200">{dispatch.contractor_name}</h5>
              <p className="text-xs text-blue-400 font-medium">{dispatch.company_name}</p>
              <div className="flex items-center space-x-1 text-xs text-slate-400 mt-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{dispatch.phone_number}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-slate-200">Vehicle & Logistics</h5>
              <p className="text-xs text-slate-400">{dispatch.vehicle_info || 'Standard Service Van'}</p>
              <p className="text-xs text-slate-500 mt-1">
                Updated: {new Date(dispatch.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Simulation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="text-xs text-slate-400">
            {error && <span className="text-red-400 font-medium">{error}</span>}
          </div>

          <div className="flex items-center space-x-2">
            {!isCancelled && !isCompleted && (
              <>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  Cancel Dispatch
                </button>
                <button
                  onClick={handleAdvance}
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span>Simulate Next Stage</span>
                </button>
              </>
            )}

            {(isCancelled || isCompleted) && (
              <button
                onClick={handleInitiate}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Restart Simulation Dispatch</span>
              </button>
            )}
          </div>
        </div>

        {/* Chronological Event History */}
        {dispatch.events && dispatch.events.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Live Dispatch Event History
            </h5>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {dispatch.events.map((evt) => (
                <div
                  key={evt.id}
                  className="text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50 flex items-start justify-between gap-2"
                >
                  <div className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <span className="text-slate-300">{evt.message}</span>
                  </div>
                  <span className="text-slate-500 text-[11px] shrink-0">
                    {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
