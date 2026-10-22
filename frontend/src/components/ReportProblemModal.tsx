import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Appliance, CreateRepairCaseData } from '../types';
import { api } from '../api/client';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  appliances: Appliance[];
  defaultAppliance?: Appliance | null;
  onSuccess: () => void;
}

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  appliances,
  defaultAppliance,
  onSuccess,
}) => {
  const [applianceId, setApplianceId] = useState<string>(defaultAppliance?.id || (appliances[0]?.id ?? ''));
  const [issueDescription, setIssueDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync default appliance if passed
  React.useEffect(() => {
    if (defaultAppliance) {
      setApplianceId(defaultAppliance.id);
    } else if (appliances.length > 0) {
      setApplianceId((prev) => prev || appliances[0].id);
    }
  }, [defaultAppliance, appliances]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission
    if (!applianceId) {
      setError('Please select an appliance.');
      return;
    }
    if (issueDescription.trim().length < 10) {
      setError('Please provide a detailed fault description (minimum 10 characters).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: CreateRepairCaseData = {
        appliance_id: applianceId,
        issue_description: issueDescription.trim(),
        priority,
        appointment_date: appointmentDate || undefined,
        appointment_notes: appointmentNotes.trim() || undefined,
      };

      await api.createRepair(payload);
      setIssueDescription('');
      setAppointmentDate('');
      setAppointmentNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create repair case', err);
      setError(err.message || 'Failed to submit repair case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#E6E4DA] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6E4DA] flex items-center justify-between bg-[#F6F4EE]/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#183B32] text-base">Report a Problem</h3>
              <p className="text-xs text-[#687871]">Create a new diagnosis and repair ticket</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A9A92] hover:text-[#24342F] hover:bg-[#E6E4DA]/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Select Appliance */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select Appliance *
            </label>
            <select
              value={applianceId}
              onChange={(e) => setApplianceId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              {appliances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.brand} {a.model}) {a.location ? `- ${a.location}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Issue Description */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Fault / Issue Description *
              </label>
              <span className="text-[11px] text-slate-400">min 10 characters</span>
            </div>
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe symptoms, strange sounds, error codes, leaks, or performance issues in natural language..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Urgency / Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 text-xs font-semibold rounded-lg capitalize border transition-all ${
                    priority === p
                      ? p === 'urgent'
                        ? 'bg-red-600 text-white border-red-600'
                        : p === 'high'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Appointment Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Requested Visit Date (Optional)
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Technician Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Call 1 hour ahead"
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E6E4DA] flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-[#687871] hover:text-[#24342F] hover:bg-[#F6F4EE] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#183B32] hover:bg-[#102D27] rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Create Repair Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
