import React, { useState } from 'react';
import { History, ArrowRight } from 'lucide-react';
import type { DashboardSummary } from '../types';

interface RepairHistoryViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
}

export const RepairHistoryView: React.FC<RepairHistoryViewProps> = ({
  summary,
  loading,
}) => {
  const [filterType, setFilterType] = useState('all');
  const events = summary?.recent_events || [];

  const eventTypes = [
    { id: 'all', label: 'All Events' },
    { id: 'created', label: 'Tickets Created' },
    { id: 'status_change', label: 'Status Updates' },
    { id: 'appointment_set', label: 'Appointments Booked' },
    { id: 'resolved', label: 'Resolved Cases' },
  ];

  const filtered = events.filter((e) => {
    if (filterType === 'all') return true;
    return e.event_type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#183B32] flex items-center space-x-2">
            <History className="w-5 h-5 text-[#183B32]" />
            <span>Household Repair Audit Trail</span>
          </h2>
          <p className="text-xs text-[#687871] mt-1">
            Chronological Repair History of diagnoses, technician visits, status transitions, and case resolutions
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
          {eventTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === t.id
                  ? 'bg-[#183B32] text-white shadow-xs'
                  : 'bg-white border border-[#E6E4DA] text-[#687871] hover:bg-[#F6F4EE] hover:text-[#183B32]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E6E4DA] p-12 text-center text-[#687871] text-xs">
          Loading audit trail...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#E6E4DA] p-12 text-center text-[#687871] text-xs">
          No events match the selected filter.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 shadow-xs space-y-4 relative before:absolute before:inset-0 before:left-8 before:w-0.5 before:bg-[#E6E4DA]">
          {filtered.map((evt) => (
            <div key={evt.id} className="relative flex items-start space-x-4 text-xs pl-4">
              <div className="w-4 h-4 rounded-full bg-white border-2 border-[#183B32] shrink-0 z-10 mt-1 shadow-xs" />
              <div className="flex-1 bg-[#F6F4EE]/60 p-4 rounded-xl border border-[#E6E4DA] space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#183B32] text-sm">
                      {evt.appliance_name || 'Appliance'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#DDE7DD] text-[#183B32] text-[10px] font-semibold uppercase tracking-wider">
                      {evt.event_type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="font-mono text-[#8A9A92] text-[11px]">{evt.created_at}</span>
                </div>

                <p className="text-[#24342F] leading-relaxed text-xs">{evt.description}</p>

                {evt.old_value && evt.new_value && (
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white border border-[#E6E4DA] text-[11px]">
                    <span className="text-[#687871]">Transition:</span>
                    <span className="font-medium capitalize text-[#24342F]">{evt.old_value}</span>
                    <ArrowRight className="w-3 h-3 text-[#8A9A92]" />
                    <span className="font-bold capitalize text-[#183B32]">{evt.new_value}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
