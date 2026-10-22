import React, { useState } from 'react';
import {
  Bot,
  Calendar,
  Wrench,
  Clock,
  Send,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { Appliance } from '../types';

interface AssistantPanelProps {
  appliances: Appliance[];
  onOpenReportModal: (suggestedText?: string) => void;
  onNavigateTab?: (tab: string) => void;
  onViewPassport?: (appliance: Appliance) => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  appliances,
  onOpenReportModal,
  onNavigateTab,
  onViewPassport,
}) => {
  const [input, setInput] = useState('');
  const [triageResponse, setTriageResponse] = useState<{
    query: string;
    matchedAppliance?: Appliance;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const query = input.trim();
    // Honest local matching of appliances based on registered items
    const matched = appliances.find((a) => {
      const q = query.toLowerCase();
      return (
        q.includes(a.category.toLowerCase()) ||
        q.includes(a.name.toLowerCase()) ||
        q.includes(a.brand.toLowerCase()) ||
        q.includes(a.model.toLowerCase())
      );
    });

    setTriageResponse({
      query,
      matchedAppliance: matched,
    });
    setInput('');
  };

  const handleActionWarranty = () => {
    if (appliances.length > 0 && onViewPassport) {
      onViewPassport(appliances[0]);
    } else if (onNavigateTab) {
      onNavigateTab('appliances');
    }
  };

  const handleActionReport = () => {
    onOpenReportModal();
  };

  const handleActionOpenCases = () => {
    if (onNavigateTab) {
      onNavigateTab('repairs');
    }
  };

  return (
    <div className="bg-[#EEF4EE] rounded-3xl border border-[#DDE7DD] p-5 sm:p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
      {/* Decorative subtle node lines in background */}
      <svg
        className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-40 text-[#9EBA9E]"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <path d="M100 15 C 80 15, 70 35, 95 60 C 105 70, 75 90, 60 100" />
        <circle cx="70" cy="35" r="2.5" fill="currentColor" />
        <circle cx="95" cy="60" r="2" fill="currentColor" />
      </svg>

      <div className="relative z-10 space-y-4">
        {/* Assistant Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DDE7DD] flex items-center justify-center text-[#183B32] shrink-0 shadow-2xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#183B32] tracking-tight">
                FixFlow Assistant
              </h3>
            </div>
            <p className="text-xs text-[#687871]">Your home repair companion.</p>
          </div>
        </div>

        {/* Speech Card / Greeting */}
        <div className="bg-white rounded-2xl p-4 border border-[#E6E4DA] shadow-xs space-y-1.5">
          <p className="text-sm font-semibold text-[#24342F] leading-snug">
            Hi! What's happening with an appliance today?
          </p>
          <p className="text-xs text-[#687871] leading-relaxed">
            Describe any symptoms, strange noises, leaks, or issues, and I'll help you prepare a repair case.
          </p>
        </div>

        {/* Honest Interactive Triage Result if submitted */}
        {triageResponse && (
          <div className="bg-white rounded-2xl p-3.5 border border-[#183B32]/20 shadow-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#183B32] uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-[#B49A68]" /> Triage Preview
              </span>
              <button
                onClick={() => setTriageResponse(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            </div>
            <p className="text-xs text-[#24342F]">
              Recorded symptom: <span className="font-semibold italic">"{triageResponse.query}"</span>
            </p>
            {triageResponse.matchedAppliance ? (
              <p className="text-xs text-[#687871]">
                Matches your registered <span className="font-medium text-[#183B32]">{triageResponse.matchedAppliance.name}</span> ({triageResponse.matchedAppliance.brand} {triageResponse.matchedAppliance.model}).
              </p>
            ) : (
              <p className="text-xs text-[#687871]">
                Ready to link with an appliance from your inventory.
              </p>
            )}
            <button
              onClick={() => {
                onOpenReportModal(triageResponse.query);
                setTriageResponse(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#183B32] hover:bg-[#102D27] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <span>Prepare Repair Case</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Try asking Section */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-[#687871] block">
            Try asking
          </span>

          <div className="space-y-1.5">
            {/* Option 1: Check warranty */}
            <button
              type="button"
              onClick={handleActionWarranty}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6E4DA] text-left hover:border-[#183B32]/30 hover:shadow-xs transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className="w-4 h-4 text-[#687871] group-hover:text-[#183B32] shrink-0" />
                <span className="text-xs font-medium text-[#24342F] truncate">
                  Check an appliance warranty
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A3B2AA] group-hover:text-[#183B32] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Option 2: Help me report a problem */}
            <button
              type="button"
              onClick={handleActionReport}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6E4DA] text-left hover:border-[#183B32]/30 hover:shadow-xs transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Wrench className="w-4 h-4 text-[#687871] group-hover:text-[#183B32] shrink-0" />
                <span className="text-xs font-medium text-[#24342F] truncate">
                  Help me report a problem
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A3B2AA] group-hover:text-[#183B32] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Option 3: Show open repair cases */}
            <button
              type="button"
              onClick={handleActionOpenCases}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-[#E6E4DA] text-left hover:border-[#183B32]/30 hover:shadow-xs transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="w-4 h-4 text-[#687871] group-hover:text-[#183B32] shrink-0" />
                <span className="text-xs font-medium text-[#24342F] truncate">
                  Show my open repair cases
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A3B2AA] group-hover:text-[#183B32] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Input Field */}
      <form onSubmit={handleSubmit} className="relative z-10 mt-4 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the issue..."
          className="flex-1 bg-white border border-[#E6E4DA] rounded-xl px-3.5 py-2.5 text-xs text-[#24342F] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] shadow-xs"
        />
        <button
          type="submit"
          aria-label="Send issue description"
          className="bg-[#183B32] hover:bg-[#102D27] text-white p-2.5 rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
