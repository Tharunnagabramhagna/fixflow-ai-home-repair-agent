import React from 'react';
import { Refrigerator, Wrench, Calendar, CheckCircle2, ChevronRight } from 'lucide-react';
import type { DashboardSummary } from '../types';

interface SummaryCardsProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onCardClick?: (tab: string) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  loading,
  onCardClick,
}) => {
  const counts = summary?.counts || {
    total_appliances: 0,
    active_repairs: 0,
    open_repairs: 0,
    scheduled_visits: 0,
    resolved_cases: 0,
  };

  const activeRepairsCount = counts.active_repairs !== undefined
    ? counts.active_repairs
    : (counts.open_repairs + counts.scheduled_visits);

  const cards = [
    {
      id: 'appliances',
      title: 'REGISTERED APPLIANCES',
      value: counts.total_appliances,
      subtitle: 'Household inventory',
      icon: Refrigerator,
      iconColor: 'text-[#183B32]',
      iconBg: 'bg-[#EAF3EA]',
    },
    {
      id: 'repairs',
      title: 'ACTIVE REPAIRS',
      value: activeRepairsCount,
      subtitle: `${counts.open_repairs} open · ${counts.scheduled_visits} scheduled`,
      icon: Wrench,
      iconColor: 'text-[#D97706]',
      iconBg: 'bg-[#FDF6E9]',
    },
    {
      id: 'repairs',
      title: 'SCHEDULED VISITS',
      value: counts.scheduled_visits,
      subtitle: 'Technician booked',
      icon: Calendar,
      iconColor: 'text-[#4F46E5]',
      iconBg: 'bg-[#EEF1FD]',
    },
    {
      id: 'history',
      title: 'RESOLVED CASES',
      value: counts.resolved_cases,
      subtitle: 'Completed repairs',
      icon: CheckCircle2,
      iconColor: 'text-[#0D9488]',
      iconBg: 'bg-[#E8F6F1]',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            onClick={() => onCardClick && onCardClick(card.id)}
            className="bg-white rounded-2xl p-5 border border-[#E6E4DA] shadow-xs hover:shadow-md hover:border-[#183B32]/30 transition-all cursor-pointer group flex items-start gap-4"
          >
            {/* Left Icon in Soft Pastel Rounded Box */}
            <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0 ${card.iconColor} group-hover:scale-105 transition-transform`}>
              <Icon className="w-5 h-5" />
            </div>

            {/* Right Stat Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-[#687871] tracking-wider uppercase leading-tight line-clamp-1 block">
                  {card.title}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#A3B2AA] group-hover:text-[#183B32] group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>

              <div className="mt-1">
                <span className="text-2xl sm:text-3xl font-bold text-[#183B32] tracking-tight block">
                  {loading ? '—' : card.value}
                </span>
                <span className="text-xs text-[#687871] font-normal block mt-0.5 truncate">
                  {card.subtitle}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
