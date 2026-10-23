import React, { useState } from 'react';
import {
  Wrench,
  Calendar,
  CheckCircle2,
  Plus,
  FileText,
  Truck,
} from 'lucide-react';
import type { RepairCase, Appliance } from '../types';
import { DispatchTracker } from '../components/DispatchTracker';

interface RepairCasesViewProps {
  repairCases: RepairCase[];
  appliances: Appliance[];
  loading: boolean;
  onOpenReportModal: () => void;
  onUpdateStatus: (repairCase: RepairCase) => void;
  onViewPassport: (appliance: Appliance) => void;
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All Cases' },
  { id: 'active', label: 'Active' },
  { id: 'open', label: 'Open' },
  { id: 'diagnosed', label: 'Diagnosed' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

export const RepairCasesView: React.FC<RepairCasesViewProps> = ({
  repairCases,
  appliances,
  loading,
  onOpenReportModal,
  onUpdateStatus,
  onViewPassport,
}) => {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedDispatchCaseId, setExpandedDispatchCaseId] = useState<string | null>(null);

  const countByFilter = (filterId: string) => {
    if (filterId === 'all') return repairCases.length;
    if (filterId === 'active') {
      return repairCases.filter((c) =>
        ['open', 'diagnosed', 'scheduled', 'in_progress'].includes(c.status)
      ).length;
    }
    return repairCases.filter((c) => c.status === filterId).length;
  };

  const filtered = repairCases.filter((c) => {
    if (selectedStatus === 'all') return true;
    if (selectedStatus === 'active') {
      return ['open', 'diagnosed', 'scheduled', 'in_progress'].includes(c.status);
    }
    return c.status === selectedStatus;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'high':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]';
      case 'diagnosed':
        return 'bg-[#EEF1FD] text-[#4F46E5] border-[#E0E7FF]';
      case 'scheduled':
        return 'bg-[#FDF4FF] text-[#9333EA] border-[#F5D0FE]';
      case 'in_progress':
        return 'bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]';
      case 'resolved':
        return 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]';
      case 'closed':
        return 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]';
      default:
        return 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs & Action */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-4 sm:p-5 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
          {STATUS_FILTERS.map((f) => {
            const count = countByFilter(f.id);
            return (
              <button
                key={f.id}
                onClick={() => setSelectedStatus(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedStatus === f.id
                    ? 'bg-[#183B32] text-white shadow-xs'
                    : 'bg-white border border-[#E6E4DA] text-[#687871] hover:bg-[#F6F4EE] hover:text-[#183B32]'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedStatus === f.id
                      ? 'bg-white/20 text-white'
                      : 'bg-[#F6F4EE] text-[#4A5D54]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenReportModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#183B32] text-white text-xs font-semibold hover:bg-[#102D27] transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Report New Fault</span>
        </button>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E6E4DA] p-12 text-center text-[#687871] text-xs">
          Loading repair tickets...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#E6E4DA] p-12 text-center space-y-3">
          <Wrench className="w-8 h-8 text-[#A3B2AA] mx-auto" />
          <h3 className="text-sm font-semibold text-[#24342F]">No repair tickets in this view</h3>
          <p className="text-xs text-[#687871] max-w-sm mx-auto">
            {selectedStatus !== 'all'
              ? `No repair cases currently have the status "${selectedStatus}".`
              : 'All household appliances are operating smoothly. No active fault reports.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const appliance = appliances.find((a) => a.id === c.appliance_id);
            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-[#E6E4DA] p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#183B32]/30 transition-all space-y-3.5"
              >
                {/* Top Row: Appliance Name, Case ID, Status, Priority */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#183B32] text-base">
                        {c.appliance_name || 'Appliance'}
                      </span>
                      <span className="text-[11px] font-mono text-[#8A9A92]">
                        #{c.id.substring(0, 8)}
                      </span>
                    </div>
                    {appliance && (
                      <p className="text-xs text-[#687871]">
                        {appliance.brand} {appliance.model} {appliance.location ? `· ${appliance.location}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${getPriorityBadge(
                        c.priority
                      )}`}
                    >
                      Priority: {c.priority}
                    </span>
                    <span
                      className={`text-xs font-bold px-3 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadge(
                        c.status
                      )}`}
                    >
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Issue Description */}
                <p className="text-xs sm:text-sm text-[#24342F] bg-[#F6F4EE]/60 p-3.5 rounded-xl border border-[#E6E4DA]/60 leading-relaxed">
                  {c.issue_description}
                </p>

                {/* Metadata Pills: Scheduled date, resolution */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {c.appointment_date && (
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#FDF4FF] text-[#9333EA] border border-[#F5D0FE]">
                      <Calendar className="w-3.5 h-3.5 text-[#9333EA]" />
                      <span>
                        Service Scheduled: <strong className="font-semibold">{c.appointment_date}</strong>
                        {c.appointment_notes ? ` (${c.appointment_notes})` : ''}
                      </span>
                    </div>
                  )}

                  {c.resolution_notes && (
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span>
                        Resolution: <strong className="font-semibold">{c.resolution_notes}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-[#E6E4DA]/70 flex items-center justify-between text-xs text-[#687871]">
                  <span className="text-[11px] font-mono">Created: {c.created_at}</span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setExpandedDispatchCaseId(expandedDispatchCaseId === c.id ? null : c.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                        expandedDispatchCaseId === c.id
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                          : 'border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50/50'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{expandedDispatchCaseId === c.id ? 'Hide Dispatch' : 'Track Dispatch'}</span>
                    </button>

                    {appliance && (
                      <button
                        onClick={() => onViewPassport(appliance)}
                        className="px-3 py-1.5 rounded-xl border border-[#E6E4DA] text-[#24342F] hover:bg-[#F6F4EE] font-medium flex items-center space-x-1 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#8A9A92]" />
                        <span>Repair Passport</span>
                      </button>
                    )}

                    {c.status !== 'closed' && (
                      <button
                        onClick={() => onUpdateStatus(c)}
                        className="px-4 py-1.5 rounded-xl bg-[#183B32] hover:bg-[#102D27] text-white font-semibold transition-colors shadow-xs"
                      >
                        Update Status &rarr;
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Dispatch Tracker Accordion */}
                {expandedDispatchCaseId === c.id && (
                  <div className="pt-3 animate-fadeIn">
                    <DispatchTracker
                      caseId={c.id}
                      applianceName={c.appliance_name}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
