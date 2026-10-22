import React from 'react';

export const LandingFeatures: React.FC = () => {
  return (
    <section id="features" className="py-20 sm:py-28 bg-[#F6F4EE] border-t border-[#E6E4DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Section Label */}
        <div className="max-w-2xl mx-auto text-center mb-16 sm:mb-20">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[#B49A68]">
            CORE ARCHITECTURE
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl text-[#183B32] mt-3 font-normal tracking-tight">
            Designed for calm, methodical home maintenance.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#687871] leading-relaxed">
            Eliminating fragmented records with a single, structured system for every household appliance.
          </p>
        </div>

        {/* 3 Refined Feature Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
          
          {/* Column 1 — Your Repair Passport */}
          <div className="space-y-4 sm:space-y-5">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#E6E4DA] flex items-center justify-center text-[#183B32] shadow-xs">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 7h8" />
                <path d="M8 11h6" />
                <path d="M8 15h4" />
                <path d="M4 8h1" />
              </svg>
            </div>

            <h3 className="text-xs font-bold tracking-[0.16em] uppercase text-[#183B32]">
              YOUR REPAIR PASSPORT
            </h3>

            <p className="text-sm sm:text-base text-[#24342F]/85 leading-relaxed">
              Every appliance gets one organized record for its details, documents, warranty, and repair history.
            </p>

            <div className="pt-2 text-xs text-[#687871] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B49A68]" />
              <span>Model specifications & serial tracking</span>
            </div>
          </div>

          {/* Column 2 — Warranty Clarity */}
          <div className="space-y-4 sm:space-y-5">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#E6E4DA] flex items-center justify-center text-[#183B32] shadow-xs">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            </div>

            <h3 className="text-xs font-bold tracking-[0.16em] uppercase text-[#183B32]">
              WARRANTY CLARITY
            </h3>

            <p className="text-sm sm:text-base text-[#24342F]/85 leading-relaxed">
              Keep purchase details and warranty information accessible when you need them.
            </p>

            <div className="pt-2 text-xs text-[#687871] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B49A68]" />
              <span>Real-time coverage status evaluation</span>
            </div>
          </div>

          {/* Column 3 — Repair Timeline */}
          <div className="space-y-4 sm:space-y-5">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#E6E4DA] flex items-center justify-center text-[#183B32] shadow-xs">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <path d="M6 9v3a3 3 0 0 0 3 3h6" />
                <path d="M18 9v6" />
              </svg>
            </div>

            <h3 className="text-xs font-bold tracking-[0.16em] uppercase text-[#183B32]">
              REPAIR TIMELINE
            </h3>

            <p className="text-sm sm:text-base text-[#24342F]/85 leading-relaxed">
              Follow repair cases and understand what happened over time.
            </p>

            <div className="pt-2 text-xs text-[#687871] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B49A68]" />
              <span>Immutable audit logs & technician notes</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
