import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Wrench,
  CheckCircle2,
  FileText,
  Tag,
  MapPin,
  Plus,
} from 'lucide-react';
import type { Appliance, RepairCase, RepairEvent, WarrantyDocument } from '../types';
import { api } from '../api/client';

interface AppliancePassportModalProps {
  appliance: Appliance | null;
  onClose: () => void;
  onReportIssue: (appliance: Appliance) => void;
}

export const AppliancePassportModal: React.FC<AppliancePassportModalProps> = ({
  appliance,
  onClose,
  onReportIssue,
}) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{
    cases: RepairCase[];
    events: RepairEvent[];
    documents: WarrantyDocument[];
  }>({ cases: [], events: [], documents: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appliance) return;
    setLoading(true);
    setError(null);

    api
      .getApplianceHistory(appliance.id)
      .then((data: any) => {
        setHistory({
          cases: data.cases || [],
          events: data.events || [],
          documents: data.documents || [],
        });
      })
      .catch((err) => {
        console.error('Failed to load appliance history', err);
        setError(err.message || 'Failed to load repair history');
      })
      .finally(() => setLoading(false));
  }, [appliance]);

  if (!appliance) return null;

  const isWarrantyValid = appliance.warranty_expiration
    ? new Date(appliance.warranty_expiration) > new Date()
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Passport Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-blue-300 text-xs font-semibold uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>Digital Repair Passport</span>
          </div>

          <h2 className="text-2xl font-bold mt-1 text-white">{appliance.name}</h2>
          <p className="text-slate-300 text-sm mt-0.5">
            {appliance.brand} · Model {appliance.model}
          </p>

          {/* Quick Meta Pills */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {appliance.serial_number && (
              <span className="px-2.5 py-1 rounded-md bg-white/10 font-mono text-slate-200 border border-white/10">
                SN: {appliance.serial_number}
              </span>
            )}
            {appliance.location && (
              <span className="px-2.5 py-1 rounded-md bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {appliance.location}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/20">
              Category: {appliance.category}
            </span>
          </div>
        </div>

        {/* Passport Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Warranty & Purchase Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Warranty Coverage
              </span>
              <div className="mt-2 flex items-center space-x-2">
                {isWarrantyValid ? (
                  <>
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <div>
                      <span className="text-sm font-bold text-emerald-700">Active Manufacturer Warranty</span>
                      <p className="text-xs text-slate-500 mt-0.5">Expires: {appliance.warranty_expiration}</p>
                    </div>
                  </>
                ) : appliance.warranty_expiration ? (
                  <>
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <div>
                      <span className="text-sm font-bold text-slate-700">Warranty Expired</span>
                      <p className="text-xs text-slate-500 mt-0.5">Ended on {appliance.warranty_expiration}</p>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">No warranty documented</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Purchase & Installation
              </span>
              <div className="mt-2 text-xs space-y-1 text-slate-600">
                <p>
                  <span className="text-slate-400">Purchase Date:</span>{' '}
                  <span className="font-medium text-slate-800">{appliance.purchase_date || 'Unknown'}</span>
                </p>
                <p>
                  <span className="text-slate-400">Device ID:</span>{' '}
                  <span className="font-mono text-slate-600">{appliance.id}</span>
                </p>
                {appliance.notes && (
                  <p className="italic text-slate-500 mt-1">"{appliance.notes}"</p>
                )}
              </div>
            </div>
          </div>

          {/* Warranty & Service Documents */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Warranty & Compliance Documents ({history.documents.length})
              </span>
            </div>

            {history.documents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No warranty documents or digital receipts attached to this passport.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {history.documents.map((doc) => (
                  <div key={doc.id} className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 block truncate">{doc.original_name}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {(doc.file_size / (1024 * 1024)).toFixed(1)} MB · {doc.mime_type}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      Safe Ref
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cases & Fault History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Repair & Fault History ({history.cases.length})
                </h3>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onReportIssue(appliance);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Service Ticket</span>
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Loading passport history...</div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-red-50 text-red-700 text-xs">{error}</div>
            ) : history.cases.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                No past repair cases or reported faults for this appliance. Clean maintenance record.
              </div>
            ) : (
              <div className="space-y-3">
                {history.cases.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        Case #{c.id.substring(0, 8)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          c.status === 'resolved' || c.status === 'closed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'scheduled'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">{c.issue_description}</p>

                    {c.appointment_date && (
                      <div className="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-lg flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Visit: {c.appointment_date} {c.appointment_notes ? `(${c.appointment_notes})` : ''}</span>
                      </div>
                    )}

                    {c.resolution_notes && (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span>Resolution: {c.resolution_notes}</span>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1 flex justify-between border-t border-slate-100">
                      <span>Priority: <span className="capitalize font-medium text-slate-600">{c.priority}</span></span>
                      <span>Created: {c.created_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500">FixFlow Verified Device Record</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
          >
            Close Passport
          </button>
        </div>
      </div>
    </div>
  );
};
