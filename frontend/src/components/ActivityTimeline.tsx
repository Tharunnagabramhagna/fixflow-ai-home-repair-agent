import React from 'react';
import type { RepairEvent } from '../types';

interface ActivityTimelineProps {
  events: RepairEvent[];
  loading?: boolean;
  onViewHistory?: () => void;
}

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return 'Recent';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(0, 10);
  }
}

function getEventStyle(type: string) {
  switch (type) {
    case 'created':
      return {
        pillLabel: 'New case',
        pillClass: 'bg-[#FEF3C7] text-[#D97706]',
        dotClass: 'bg-[#3B82F6]', // Blue
      };
    case 'status_change':
      return {
        pillLabel: 'Status updated',
        pillClass: 'bg-[#EEF1FD] text-[#4F46E5]',
        dotClass: 'bg-[#F59E0B]', // Amber
      };
    case 'appointment_set':
      return {
        pillLabel: 'Visit booked',
        pillClass: 'bg-[#FDF4FF] text-[#9333EA]',
        dotClass: 'bg-[#A855F7]',
      };
    case 'document_added':
      return {
        pillLabel: 'Document added',
        pillClass: 'bg-[#F1F5F9] text-[#64748B]',
        dotClass: 'bg-[#10B981]', // Green
      };
    case 'resolved':
      return {
        pillLabel: 'Case resolved',
        pillClass: 'bg-[#DCFCE7] text-[#16A34A]',
        dotClass: 'bg-[#10B981]', // Green
      };
    case 'closed':
      return {
        pillLabel: 'Case closed',
        pillClass: 'bg-[#F1F5F9] text-[#475569]',
        dotClass: 'bg-[#64748B]',
      };
    default:
      return {
        pillLabel: 'Audit event',
        pillClass: 'bg-[#F1F5F9] text-[#64748B]',
        dotClass: 'bg-[#94A3B8]',
      };
  }
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  events,
  loading = false,
  onViewHistory,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 text-center text-[#687871] text-xs">
        Loading recent repair activities...
      </div>
    );
  }

  const displayEvents = events.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-[#E6E4DA] p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-[#183B32] text-base tracking-tight">
          Recent Repair Activity
        </h3>
        {onViewHistory && (
          <button
            onClick={onViewHistory}
            className="text-xs font-semibold text-[#183B32] hover:text-[#102D27] hover:underline flex items-center gap-1 transition-colors"
          >
            <span>View History</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        )}
      </div>

      {displayEvents.length === 0 ? (
        <div className="p-6 text-center text-[#687871] text-xs">
          No repair activities recorded yet.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical connecting track */}
          <div
            className="absolute left-[70px] sm:left-[80px] top-3 bottom-5 w-[2px] bg-[#E2E8F0]"
            aria-hidden="true"
          />

          <div className="space-y-6">
            {displayEvents.map((evt) => {
              const dateText = formatEventDate(evt.created_at);
              const style = getEventStyle(evt.event_type);

              // Extract a clean title and description
              let title = evt.description;
              let details = '';

              if (evt.appliance_name && !evt.description.includes(evt.appliance_name)) {
                title = `${evt.appliance_name} ${evt.description}`;
              }

              if (evt.old_value && evt.new_value) {
                title = `${evt.appliance_name || 'Appliance'} status updated to ${evt.new_value.replace('_', ' ')}`;
                details = evt.description;
              }

              return (
                <div
                  key={evt.id}
                  className="flex items-start gap-4 sm:gap-6 relative text-xs group"
                >
                  {/* Left: Date */}
                  <div className="w-[58px] sm:w-[68px] text-right text-xs font-medium text-[#687871] shrink-0 pt-0.5">
                    {dateText}
                  </div>

                  {/* Middle: Node dot */}
                  <div className="relative z-10 shrink-0 pt-1">
                    <div
                      className={`w-3.5 h-3.5 rounded-full ${style.dotClass} border-2 border-white shadow-xs group-hover:scale-110 transition-transform`}
                    />
                  </div>

                  {/* Right: Content & Status Pill */}
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-1">
                    <div className="space-y-0.5 pr-2">
                      <h4 className="font-semibold text-sm text-[#24342F] leading-snug capitalize">
                        {title}
                      </h4>
                      {details && (
                        <p className="text-xs text-[#687871] line-clamp-2">
                          {details}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium tracking-tight ${style.pillClass}`}
                      >
                        {style.pillLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
