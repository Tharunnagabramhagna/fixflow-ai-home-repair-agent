import React from 'react';
import { FileCheck, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export const LandingTrustOrganization: React.FC = () => {
  const benefits = [
    {
      icon: FileCheck,
      title: 'Accessible Proof of Coverage',
      description:
        'Physical receipts fade and paper warranty booklets get misplaced. FixFlow keeps serial numbers, purchase dates, and coverage terms accessible the moment an appliance needs attention.',
      tag: 'Warranty Continuity',
    },
    {
      icon: RefreshCw,
      title: 'Complete Technician Context',
      description:
        'Contractors and service technicians change over time. Having a clear record of past error codes, parts replaced, and prior service visits eliminates redundant troubleshooting.',
      tag: 'Service History',
    },
    {
      icon: Home,
      title: 'Verifiable Household Maintenance',
      description:
        'Just like a vehicle service book, a documented appliance history demonstrates proactive care, protecting household equipment longevity and building confidence if you ever sell your home.',
      tag: 'Asset Longevity',
    },
    {
      icon: ShieldAlert,
      title: 'No Out-of-Warranty Surprises',
      description:
        'Real-time status calculation gives you clear visibility into remaining warranty windows, ensuring issues are filed within manufacturer coverage periods before time runs out.',
      tag: 'Active Timelines',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-[#FFFFFF] border-t border-[#E6E4DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Section Header */}
        <div className="max-w-3xl mb-16 sm:mb-20">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[#B49A68]">
            TRUST & ORGANIZATION
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl text-[#183B32] mt-3 font-normal tracking-tight">
            Why organized home care matters.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#687871] leading-relaxed">
            Major household appliances represent significant investments. Managing them methodically transforms stressful emergencies into straightforward, documented service resolutions.
          </p>
        </div>

        {/* 2x2 Grid of Factual Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {benefits.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-7 sm:p-8 rounded-2xl bg-[#F6F4EE]/60 border border-[#E6E4DA] hover:border-[#183B32]/30 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E6E4DA] flex items-center justify-center text-[#183B32] shadow-2xs">
                    <Icon className="w-5 h-5 text-[#183B32]" />
                  </div>
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-[#B49A68] bg-white px-2.5 py-1 rounded-full border border-[#E6E4DA]">
                    {item.tag}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-[#183B32] tracking-tight mb-2.5">
                  {item.title}
                </h3>

                <p className="text-sm text-[#24342F]/80 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
