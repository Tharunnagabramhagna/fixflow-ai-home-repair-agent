import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { RepairCase, UpdateRepairStatusData } from '../types';
import { api } from '../api/client';

interface StatusUpdateModalProps {
  repairCase: RepairCase | null;
  onClose: () => void;
  onSuccess: () => void;
}

const NEXT_STATUS_OPTIONS: Record<string, { value: 'diagnosed' | 'scheduled' | 'in_progress' | 'resolved' | 'closed'; label: string; desc: string }[]> = {
  open: [
    { value: 'diagnosed', label: 'Mark as Diagnosed', desc: 'Identified root fault and recommended repair steps' },
    { value: 'scheduled', label: 'Schedule Technician', desc: 'Set date for service visit' },
    { value: 'in_progress', label: 'In Progress', desc: 'Technician on-site or parts ordered' },
    { value: 'closed', label: 'Cancel / Close Case', desc: 'Close without active repair' },
  ],
  diagnosed: [
    { value: 'scheduled', label: 'Schedule Technician Visit', desc: 'Book technician to implement diagnosis' },
    { value: 'in_progress', label: 'Begin Repair Work', desc: 'Work has begun on this case' },
    { value: 'closed', label: 'Close Case', desc: 'Close case without further action' },
  ],
  scheduled: [
    { value: 'in_progress', label: 'Mark Work In Progress', desc: 'Technician has arrived on-site' },
    { value: 'closed', label: 'Cancel Visit & Close', desc: 'Cancel appointment and close' },
  ],
  in_progress: [
    { value: 'resolved', label: 'Mark Case as Resolved', desc: 'Repair successfully tested and completed' },
    { value: 'closed', label: 'Close Ticket', desc: 'Conclude without full fix' },
  ],
  resolved: [
    { value: 'closed', label: 'Archive & Close', desc: 'Move to closed case archives' },
  ],
};

export const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
  repairCase,
  onClose,
  onSuccess,
}) => {
  const options = repairCase ? NEXT_STATUS_OPTIONS[repairCase.status] || [] : [];
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (repairCase) {
      const nextOpts = NEXT_STATUS_OPTIONS[repairCase.status] || [];
      setSelectedStatus(nextOpts[0]?.value || '');
      setResolutionNotes('');
      setAppointmentDate('');
      setAppointmentNotes('');
      setConfirmed(false);
      setError(null);
    }
  }, [repairCase]);

  if (!repairCase) return null;

  const isConsequential = selectedStatus === 'resolved' || selectedStatus === 'closed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) return;
    if (isConsequential && !confirmed) {
      setError('Please check the confirmation box before concluding or resolving this ticket.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: UpdateRepairStatusData = {
        status: selectedStatus as any,
        resolution_notes: resolutionNotes.trim() || undefined,
        appointment_date: appointmentDate || undefined,
        appointment_notes: appointmentNotes.trim() || undefined,
      };

      await api.updateRepairStatus(repairCase.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update repair status', err);
      setError(err.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Update Case Status</h3>
            <p className="text-xs text-slate-500">Case #{repairCase.id.substring(0, 8)} · {repairCase.appliance_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Pill */}
        <div className="px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Current Status:</span>
          <span className="font-bold uppercase tracking-wider text-blue-700 px-2 py-0.5 rounded bg-blue-100">
            {repairCase.status.replace('_', ' ')}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          {options.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              This case is in final status ({repairCase.status}) and cannot be transitioned further.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Select New Status *
                </label>
                <div className="space-y-2">
                  {options.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedStatus === opt.value
                          ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={opt.value}
                        checked={selectedStatus === opt.value}
                        onChange={() => {
                          setSelectedStatus(opt.value);
                          setConfirmed(false);
                        }}
                        className="mt-0.5 text-blue-600"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-xs text-slate-900 block">{opt.label}</span>
                        <span className="text-[11px] text-slate-500 block leading-snug">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Consequential action confirmation banner */}
              {isConsequential && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                  <div className="flex items-center space-x-1.5 text-amber-900 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Consequential Action Confirmation</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    {selectedStatus === 'resolved'
                      ? 'Transitioning to Resolved marks the repair as completed and records a verified fix in the appliance passport.'
                      : 'Closing this ticket archives the issue and concludes repair tracking.'}
                  </p>
                  <label className="flex items-start space-x-2 pt-1 border-t border-amber-200/60 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600"
                    />
                    <span className="text-[11px] font-medium text-slate-800">
                      I confirm this status change is intended and should be recorded in the audit history.
                    </span>
                  </label>
                </div>
              )}

              {/* Conditional Appointment Date if scheduled */}
              {selectedStatus === 'scheduled' && (
                <div className="space-y-2 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <label className="block text-xs font-semibold text-indigo-900">
                    Appointment Date & Time
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-indigo-200 rounded-lg bg-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Service provider or technician notes"
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-indigo-200 rounded-lg bg-white"
                  />
                </div>
              )}

              {/* Notes / Resolution info */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Status Notes / Resolution Summary
                </label>
                <textarea
                  rows={3}
                  placeholder="Record findings, parts used, technician diagnostics, or reason for status update..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedStatus || (isConsequential && !confirmed)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{loading ? 'Updating...' : 'Confirm Status Change'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
