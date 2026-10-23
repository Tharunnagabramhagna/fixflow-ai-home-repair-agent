import React from 'react';
import { SummaryCards } from '../components/SummaryCards';
import { ApplianceCard } from '../components/ApplianceCard';
import { AssistantPanel } from '../components/AssistantPanel';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { Plus, AlertCircle, ArrowRight } from 'lucide-react';
import type { Appliance, DashboardSummary, RepairCase } from '../types';

interface OverviewViewProps {
  summary: DashboardSummary | null;
  appliances: Appliance[];
  repairCases: RepairCase[];
  loading: boolean;
  onNavigateTab: (tab: string) => void;
  onViewPassport: (appliance: Appliance) => void;
  onReportIssue: (appliance?: Appliance | string) => void;
  onRegisterAppliance?: () => void;
  onRefreshData?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  appliances,
  repairCases,
  loading,
  onNavigateTab,
  onViewPassport,
  onReportIssue,
  onRegisterAppliance,
  onRefreshData,
}) => {
  // Map open cases count per appliance
  const openCasesByAppliance = repairCases.reduce((acc, c) => {
    if (['open', 'diagnosed', 'scheduled', 'in_progress'].includes(c.status)) {
      acc[c.appliance_id] = (acc[c.appliance_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Prioritize featured appliances: Refrigerator, Espresso Coffee Machine, Smart Wine Cooler, Smart Microwave Oven
  const featuredAppliances = [...appliances].sort((a, b) => {
    const priority = (app: Appliance) => {
      const name = app.name.toLowerCase();
      if (name.includes('refriger')) return 1;
      if (name.includes('espresso') || name.includes('coffee')) return 2;
      if (name.includes('wine')) return 3;
      if (name.includes('micro')) return 4;
      if (name.includes('dish')) return 5;
      if (name.includes('wash')) return 6;
      return 10;
    };
    return priority(a) - priority(b);
  }).slice(0, 4);

  return (
    <div className="space-y-7">
      {/* Greeting Header & Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#183B32] tracking-tight">
            Good evening, Alex
          </h1>
          <p className="text-sm text-[#687871] mt-1">
            Your home, appliances, and repairs at a glance.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onRegisterAppliance && (
            <button
              onClick={onRegisterAppliance}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#24342F] bg-white border border-[#E6E4DA] rounded-xl hover:bg-[#F6F4EE] hover:border-[#183B32]/30 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#183B32]" />
              <span>Register Appliance</span>
            </button>
          )}

          <button
            onClick={() => onReportIssue()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#183B32] hover:bg-[#102D27] rounded-xl transition-all shadow-xs active:scale-[0.98]"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Report a Problem</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <SummaryCards
        summary={summary}
        loading={loading}
        onCardClick={onNavigateTab}
      />

      {/* Main Grid: Left 2 Columns for Appliances & Timeline, Right 1 Column for Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Your Appliances Section */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#183B32] tracking-tight">
                Your Appliances
              </h2>
              <button
                onClick={() => onNavigateTab('appliances')}
                className="text-xs font-semibold text-[#183B32] hover:text-[#102D27] hover:underline flex items-center gap-1 transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading && appliances.length === 0 ? (
              <div className="p-8 text-center text-[#687871] text-xs bg-white rounded-2xl border border-[#E6E4DA]">
                Loading appliances from SQLite database...
              </div>
            ) : appliances.length === 0 ? (
              <div className="p-8 text-center text-[#687871] text-xs bg-white rounded-2xl border border-dashed border-[#E6E4DA]">
                No appliances registered yet. Click "+ Register Appliance" to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {featuredAppliances.map((appliance) => (
                  <ApplianceCard
                    key={appliance.id}
                    appliance={appliance}
                    openCasesCount={openCasesByAppliance[appliance.id] || 0}
                    onViewPassport={onViewPassport}
                    onReportIssue={(a) => onReportIssue(a)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent Repair Activity Timeline */}
          <ActivityTimeline
            events={summary?.recent_events || []}
            loading={loading}
            onViewHistory={() => onNavigateTab('history')}
          />
        </div>

        {/* Right Column (Span 1): FixFlow Assistant */}
        <div className="lg:col-span-1">
          <AssistantPanel
            appliances={appliances}
            onOpenReportModal={(text) => onReportIssue(text)}
            onNavigateTab={onNavigateTab}
            onViewPassport={onViewPassport}
            onRefreshData={onRefreshData}
          />
        </div>
      </div>
    </div>
  );
};
