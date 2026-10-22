import React, { useState } from 'react';
import { ShieldCheck, FileText, ExternalLink, Clock } from 'lucide-react';
import type { Appliance } from '../../types';

interface LandingPassportPreviewProps {
  appliances: Appliance[];
  onOpenPassport: (appliance: Appliance) => void;
  onLaunchDashboard: () => void;
}

export const LandingPassportPreview: React.FC<LandingPassportPreviewProps> = ({
  appliances,
  onOpenPassport,
  onLaunchDashboard,
}) => {
  // Use first 3 appliances from DB if available, or fallbacks
  const demoAppliances: Appliance[] = appliances.length > 0 ? appliances.slice(0, 3) : [
    {
      id: 'demo-app-001',
      name: 'Kitchen Refrigerator',
      brand: 'Samsung',
      model: 'RF28R7551SR',
      serial_number: 'SN-RF28-20230415',
      category: 'Kitchen',
      location: 'Kitchen',
      purchase_date: '2023-04-15',
      warranty_expiration: '2027-03-31',
      notes: 'French door, stainless steel finish',
      created_at: '2026-10-22',
      updated_at: '2026-10-22',
    },
    {
      id: 'demo-app-002',
      name: 'Front Load Washer',
      brand: 'LG',
      model: 'WM4500HBA',
      serial_number: 'SN-LG-982341',
      category: 'Laundry',
      location: 'Laundry Room',
      purchase_date: '2023-08-10',
      warranty_expiration: '2026-08-10',
      notes: 'High efficiency front-load washer',
      created_at: '2026-10-22',
      updated_at: '2026-10-22',
    },
    {
      id: 'demo-app-004',
      name: 'Dishwasher',
      brand: 'Bosch',
      model: 'SHPM88Z75N',
      serial_number: 'SN-BSH-44129',
      category: 'Kitchen',
      location: 'Kitchen',
      purchase_date: '2022-11-20',
      warranty_expiration: '2024-11-20',
      notes: 'Built-in 800 series dishwasher',
      created_at: '2026-10-22',
      updated_at: '2026-10-22',
    },
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeAppliance = demoAppliances[selectedIndex] || demoAppliances[0];

  const isWarrantyActive = (dateStr?: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) > new Date();
  };

  const activeWarranty = isWarrantyActive(activeAppliance.warranty_expiration);

  return (
    <section id="repair-passport" className="py-20 sm:py-28 bg-[#F6F4EE] border-t border-[#E6E4DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-14 sm:mb-18">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[#B49A68]">
            SIGNATURE PRODUCT FEATURE
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl text-[#183B32] mt-3 font-normal tracking-tight">
            The Digital Repair Passport.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#687871] leading-relaxed">
            Every appliance in your home has a distinct history. The Repair Passport acts as its permanent digital birth-to-recycle ledger, unifying specifications, purchase dates, warranty coverage, and every service event.
          </p>
        </div>

        {/* Appliance Selection Tabs */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-8" role="tablist" aria-label="Select Appliance Preview">
          {demoAppliances.map((app, index) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={app.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedIndex(index)}
                className={`px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] ${
                  isSelected
                    ? 'bg-[#183B32] text-white shadow-xs'
                    : 'bg-white text-[#24342F] hover:bg-[#EAE5D9] border border-[#E6E4DA]'
                }`}
              >
                {app.name} ({app.brand})
              </button>
            );
          })}
        </div>

        {/* Passport Showcase Card */}
        <div className="bg-white rounded-3xl border border-[#E6E4DA] p-6 sm:p-8 lg:p-10 shadow-lg shadow-[#183B32]/5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            
            {/* Left Col: Device Details, Purchase & Warranty */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-[#EFECE3]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#687871]">
                      DIGITAL PASSPORT RECORD
                    </span>
                    <span className="text-xs text-[#B49A68] font-mono">#{activeAppliance.id.slice(0, 12)}</span>
                  </div>
                  <h3 className="font-editorial text-2xl sm:text-3xl text-[#183B32] mt-1 font-normal">
                    {activeAppliance.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#687871] mt-0.5">
                    {activeAppliance.brand} · Model {activeAppliance.model}
                  </p>
                </div>

                {/* Warranty Pill */}
                <div>
                  {activeWarranty ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#DDE7DD] text-[#183B32] border border-[#CCDCCD]">
                      <span className="w-2 h-2 rounded-full bg-[#183B32]" />
                      Warranty Active · Exp {activeAppliance.warranty_expiration}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#F5EBE7] text-[#9E3E28] border border-[#ECD3CB]">
                      <span className="w-2 h-2 rounded-full bg-[#9E3E28]" />
                      Warranty Expired · Ended {activeAppliance.warranty_expiration}
                    </span>
                  )}
                </div>
              </div>

              {/* 4 Facet Grid: Specs, Purchase, Location, Category */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-1 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F6F4EE]/80 border border-[#E6E4DA]">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#687871] block mb-1">
                    Serial Number
                  </span>
                  <span className="font-mono font-medium text-[#183B32] block truncate">
                    {activeAppliance.serial_number || 'SN-RECORDED'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F6F4EE]/80 border border-[#E6E4DA]">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#687871] block mb-1">
                    Room / Location
                  </span>
                  <span className="font-medium text-[#183B32] block truncate">
                    {activeAppliance.location || 'Household'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F6F4EE]/80 border border-[#E6E4DA] col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#687871] block mb-1">
                    Purchase Date
                  </span>
                  <span className="font-medium text-[#183B32] block truncate">
                    {activeAppliance.purchase_date || 'Logged at install'}
                  </span>
                </div>
              </div>

              {/* Household Appliance Notes */}
              {activeAppliance.notes && (
                <div className="text-xs text-[#24342F]/85 bg-[#F6F4EE]/50 p-3.5 rounded-xl border border-[#EFECE3]">
                  <span className="font-semibold text-[#183B32]">Household Notes: </span>
                  {activeAppliance.notes}
                </div>
              )}
            </div>

            {/* Right Col: Document Metadata & Chronological Case History */}
            <div className="lg:col-span-5 bg-[#F6F4EE] rounded-2xl p-5 sm:p-6 border border-[#E6E4DA] space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold tracking-[0.16em] uppercase text-[#183B32]">
                  ATTACHED RECORDS & TIMELINE
                </h4>
                <ShieldCheck className="w-4 h-4 text-[#B49A68]" />
              </div>

              {/* Document Metadata Row */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-[#E6E4DA] flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-[#183B32] shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-[#183B32] truncate">Warranty Certificate / Guide</p>
                      <p className="text-[10px] text-[#687871]">Manufacturer PDF · Verified Record</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#DDE7DD] text-[#183B32] shrink-0">
                    Attached
                  </span>
                </div>

                {/* Case / Timeline Row */}
                <div className="p-3 bg-white rounded-xl border border-[#E6E4DA] flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="w-4 h-4 text-[#B49A68] shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-[#183B32] truncate">Diagnostic & Service Log</p>
                      <p className="text-[10px] text-[#687871]">Immutable SQLite Event Audit Trail</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F6F4EE] text-[#24342F] shrink-0">
                    Audited
                  </span>
                </div>
              </div>

              {/* Action Button: Opens actual real modal */}
              <div className="pt-2">
                <button
                  onClick={() => onOpenPassport(activeAppliance)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-[#183B32] hover:bg-[#122C25] rounded-xl shadow-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
                >
                  <span>Open Full Digital Passport</span>
                  <ExternalLink className="w-4 h-4 text-[#B49A68]" />
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={onLaunchDashboard}
                  className="text-xs text-[#687871] hover:text-[#183B32] transition-colors underline underline-offset-4 focus:outline-none"
                >
                  Manage all {appliances.length} appliances in dashboard →
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
