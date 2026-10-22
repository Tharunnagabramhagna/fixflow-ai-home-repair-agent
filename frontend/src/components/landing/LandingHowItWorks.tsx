import React from 'react';
import { ArrowRight, PlusCircle, Wrench, Clock3, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface LandingHowItWorksProps {
  onRegisterClick: () => void;
  onReportClick: () => void;
}

export const LandingHowItWorks: React.FC<LandingHowItWorksProps> = ({
  onRegisterClick,
  onReportClick,
}) => {
  const steps = [
    {
      number: '01',
      title: 'Register your appliance.',
      description:
        'Catalog household devices with exact brand, model, serial numbers, and locations. FixFlow tracks purchase dates and warranty coverage timelines.',
      icon: PlusCircle,
      actionText: 'Register Appliance',
      onAction: onRegisterClick,
      preview: {
        label: 'Samsung RF28R7551SR',
        detail: 'SN-RF28-20230415 · Kitchen',
        badge: 'Warranty Active',
        badgeColor: 'bg-[#DDE7DD] text-[#183B32]',
        icon: Tag,
      },
    },
    {
      number: '02',
      title: 'Describe a fault and create a repair case.',
      description:
        'Report leaks, strange noises, or error codes in clear language. Triage categorizes issue priority and initiates an actionable service case.',
      icon: Wrench,
      actionText: 'Report a Problem',
      onAction: onReportClick,
      preview: {
        label: 'Ice maker jamming intermittently',
        detail: 'Priority: Medium · Diagnosed',
        badge: 'Case #demo-cas',
        badgeColor: 'bg-[#FBF4E6] text-[#8C6D2C]',
        icon: AlertTriangle,
      },
    },
    {
      number: '03',
      title: 'Track the repair and preserve its history.',
      description:
        'Follow technician appointments, diagnostic notes, and part replacements. Every status transition is immutably stored in the appliance’s Repair Passport.',
      icon: Clock3,
      actionText: 'Explore Timeline',
      onAction: onRegisterClick,
      preview: {
        label: 'Drain filter cleared & tested',
        detail: 'Status: Resolved · Audit logged',
        badge: 'Verified Fix',
        badgeColor: 'bg-[#DDE7DD] text-[#183B32]',
        icon: CheckCircle2,
      },
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-[#FFFFFF] border-t border-[#E6E4DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Section Header */}
        <div className="max-w-3xl mb-16 sm:mb-20">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[#B49A68]">
            HOW FIXFLOW WORKS
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl text-[#183B32] mt-3 font-normal tracking-tight">
            From first symptom to final resolution.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#687871] leading-relaxed">
            Home repair is notoriously fragmented between misplaced manuals, expired warranties, and forgotten service visits. FixFlow organizes everything into a structured lifecycle.
          </p>
        </div>

        {/* 3 Step Cards with Realistic Interface Previews */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {steps.map((step) => {
            const Icon = step.icon;
            const PreviewIcon = step.preview.icon;
            return (
              <div
                key={step.number}
                className="group relative p-7 sm:p-8 rounded-2xl bg-[#F6F4EE]/70 border border-[#E6E4DA] hover:border-[#183B32]/30 hover:bg-[#F6F4EE] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-editorial text-2xl font-normal text-[#B49A68]">
                      {step.number}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#E6E4DA] flex items-center justify-center text-[#183B32] group-hover:bg-[#183B32] group-hover:text-white transition-colors shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-[#183B32] tracking-tight mb-3">
                    {step.title}
                  </h3>

                  <p className="text-sm text-[#24342F]/80 leading-relaxed mb-6">
                    {step.description}
                  </p>

                  {/* Realistic Interface Preview Snippet */}
                  <div className="p-3.5 rounded-xl bg-white border border-[#E6E4DA] text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PreviewIcon className="w-3.5 h-3.5 text-[#183B32] shrink-0" />
                        <span className="font-medium text-[#183B32] truncate">{step.preview.label}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${step.preview.badgeColor}`}>
                        {step.preview.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#687871]">{step.preview.detail}</p>
                  </div>
                </div>

                {/* Step Action Link */}
                <div className="pt-6 mt-6 border-t border-[#E6E4DA]/70">
                  <button
                    onClick={step.onAction}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#183B32] group-hover:text-[#B49A68] transition-colors focus:outline-none focus-visible:underline"
                  >
                    <span>{step.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
