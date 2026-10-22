import React, { useState } from 'react';
import {
  FileText,
  AlertCircle,
  MoreVertical,
  Refrigerator,
  WashingMachine,
  Wind,
  Flame,
  UtensilsCrossed,
  Cpu,
  Coffee,
  Microwave,
} from 'lucide-react';
import type { Appliance } from '../types';

interface ApplianceCardProps {
  appliance: Appliance;
  openCasesCount?: number;
  onViewPassport: (appliance: Appliance) => void;
  onReportIssue: (appliance: Appliance) => void;
}

function getApplianceImage(category: string, name: string, model: string): string | null {
  const text = `${category} ${name} ${model}`.toLowerCase();
  if (text.includes('fridge') || text.includes('refrigerator')) return '/appliances/refrigerator.jpg';
  if (text.includes('dish')) return '/appliances/dishwasher.jpg';
  if (text.includes('espresso') || text.includes('coffee')) return '/appliances/espresso.jpg';
  if (text.includes('wash') || text.includes('laundry')) return '/appliances/washer.jpg';
  if (text.includes('micro') || text.includes('sn966')) return '/appliances/microwave.jpg';
  return null;
}

function getApplianceFallbackIcon(category: string, name: string) {
  const text = `${category} ${name}`.toLowerCase();
  if (text.includes('fridge') || text.includes('refrigerator')) return Refrigerator;
  if (text.includes('dish')) return UtensilsCrossed;
  if (text.includes('coffee') || text.includes('espresso')) return Coffee;
  if (text.includes('wash') || text.includes('laundry')) return WashingMachine;
  if (text.includes('micro')) return Microwave;
  if (text.includes('ac') || text.includes('air') || text.includes('hvac')) return Wind;
  if (text.includes('heat') || text.includes('water')) return Flame;
  return Cpu;
}

export const ApplianceCard: React.FC<ApplianceCardProps> = ({
  appliance,
  openCasesCount = 0,
  onViewPassport,
  onReportIssue,
}) => {
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const imageSrc = getApplianceImage(appliance.category, appliance.name, appliance.model);
  const FallbackIcon = getApplianceFallbackIcon(appliance.category, appliance.name);

  // Warranty status calculation
  const isWarrantyValid = appliance.warranty_expiration
    ? new Date(appliance.warranty_expiration) > new Date()
    : false;

  const formattedWarrantyDate = appliance.warranty_expiration
    ? new Date(appliance.warranty_expiration).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="bg-white rounded-2xl border border-[#E6E4DA] p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-[#183B32]/30 transition-all flex flex-col justify-between group relative">
      {/* Top Main Section: Product Image + Details Side-by-Side */}
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Product Photo Container */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#F6F4EE] border border-[#E6E4DA]/70 overflow-hidden shrink-0 flex items-center justify-center p-1">
          {imageSrc && !imgError ? (
            <img
              src={imageSrc}
              alt={appliance.name}
              className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#183B32]/70 bg-[#DDE7DD]/30 rounded-lg p-1 text-center">
              <FallbackIcon className="w-7 h-7" />
              <span className="text-[9px] font-semibold text-[#4A5D54] tracking-tight mt-0.5 uppercase line-clamp-1">
                {appliance.category}
              </span>
            </div>
          )}
        </div>

        {/* Right Details */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Category, Location & Overflow Menu */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F2F4F2] text-[#4A5D54] tracking-wide uppercase">
                {appliance.category}
              </span>
              {appliance.location && (
                <span className="text-[10px] text-[#687871] font-medium truncate max-w-[110px]" title={appliance.location}>
                  • {appliance.location}
                </span>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 text-[#8C9C94] hover:text-[#183B32] rounded-lg hover:bg-[#F6F4EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
                aria-label="Appliance options"
                aria-expanded={menuOpen}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-6 z-20 w-44 bg-white border border-[#E6E4DA] rounded-xl shadow-lg py-1 text-xs text-[#24342F] animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onViewPassport(appliance);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F6F4EE] transition-colors font-medium flex items-center justify-between"
                  >
                    <span>View Passport</span>
                    <span className="text-[10px] text-[#183B32]">↵</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onReportIssue(appliance);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F6F4EE] text-[#D97706] transition-colors font-medium flex items-center justify-between"
                  >
                    <span>Report Problem</span>
                    <span className="text-[10px]">!</span>
                  </button>
                  <div className="border-t border-[#E6E4DA] my-1" />
                  <div
                    className="w-full text-left px-3 py-1.5 text-[#A3B2AA] cursor-not-allowed text-[11px]"
                    title="User manuals and cloud MCP integration planned for Phase 2"
                  >
                    Manuals (Phase 2)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Title: 2 lines allowed, prevents awkward truncation like Mac... */}
          <h3 className="font-bold text-sm text-[#183B32] leading-snug tracking-tight line-clamp-2" title={appliance.name}>
            {appliance.name}
          </h3>

          {/* Brand, Model & Serial Numbers */}
          <div className="mt-1 space-y-0.5">
            <p className="text-[11px] text-[#687871] leading-tight truncate">
              <span className="font-semibold text-[#24342F]">{appliance.brand}</span> · {appliance.model}
            </p>
            {appliance.serial_number && (
              <p className="text-[10px] text-[#8C9C94] font-mono truncate" title={`Serial Number: ${appliance.serial_number}`}>
                SN: {appliance.serial_number}
              </p>
            )}
          </div>

          {/* Warranty Status Pill */}
          <div className="mt-2">
            {isWarrantyValid ? (
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#DDE7DD] text-[#183B32]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#183B32]" />
                  Warranty Active
                </span>
                {formattedWarrantyDate && (
                  <span className="block text-[10px] text-[#687871] mt-0.5">
                    Valid until {formattedWarrantyDate}
                  </span>
                )}
              </div>
            ) : (
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F3F2] text-[#687871]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8C9C94]" />
                  Warranty Expired
                </span>
                {formattedWarrantyDate && (
                  <span className="block text-[10px] text-[#8C9C94] mt-0.5">
                    Expired {formattedWarrantyDate}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Active Repair Warning Badge (if any) */}
          {openCasesCount > 0 && (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDF6E9] text-[#D97706] border border-[#FDE68A]">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{openCasesCount} active {openCasesCount === 1 ? 'case' : 'cases'}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Links: View Repair Passport & Report Fault */}
      <div className="mt-4 pt-3 border-t border-[#EFECE3] flex items-center justify-between gap-2">
        <button
          onClick={() => onViewPassport(appliance)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#183B32] hover:text-[#102D27] hover:underline transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] rounded"
        >
          <FileText className="w-3.5 h-3.5 text-[#183B32]" />
          <span>View Repair Passport →</span>
        </button>

        <button
          onClick={() => onReportIssue(appliance)}
          className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold text-[#B45309] bg-[#FEF3C7]/60 hover:bg-[#FEF3C7] border border-[#FDE68A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
        >
          Report Fault
        </button>
      </div>
    </div>
  );
};
