import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, FileText, ChevronRight } from 'lucide-react';

interface LandingHeroProps {
  onRegisterClick: () => void;
  onExploreClick: () => void;
  onViewSamplePassport: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onRegisterClick,
  onExploreClick,
  onViewSamplePassport,
}) => {
  return (
    <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column — Editorial Typography & Structured Actions */}
          <div className="lg:col-span-6 xl:col-span-6 space-y-6 sm:space-y-8 z-10">
            {/* Restrained Eyebrow */}
            <div className="inline-flex items-center gap-2">
              <span className="text-xs sm:text-[13px] font-semibold tracking-[0.22em] text-[#B49A68] uppercase font-sans">
                SMARTER HOME CARE
              </span>
            </div>

            {/* Large Editorial Headline (Constrained width for intentional line breaks) */}
            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[62px] text-[#183B32] font-normal tracking-tight leading-[1.08] max-w-xl">
              Your home deserves a better repair story.
            </h1>

            {/* Controlled Body Copy */}
            <p className="text-base sm:text-lg text-[#24342F]/90 font-normal leading-relaxed max-w-lg">
              Keep every appliance, warranty, and repair in one thoughtful place. FixFlow brings clarity to home maintenance, from the first fault to the final fix.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
              <button
                onClick={onRegisterClick}
                className="inline-flex items-center justify-center px-7 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-white bg-[#183B32] hover:bg-[#122C25] rounded-full shadow-sm hover:shadow transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#183B32]/40"
              >
                Create Your Repair Passport
              </button>

              <button
                onClick={onExploreClick}
                className="group inline-flex items-center justify-center gap-2 text-sm sm:text-base font-medium text-[#183B32] hover:text-[#B49A68] transition-colors py-2 focus:outline-none focus-visible:underline"
              >
                <span>Explore How It Works</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Restrained Trust Strip */}
            <div className="pt-6 border-t border-[#E6E4DA] flex flex-wrap items-center gap-6 sm:gap-8 text-xs text-[#687871]">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#183B32]" />
                Permanent Digital Passport
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#B49A68]" />
                Warranty Tracking
              </span>
              <span className="inline-flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#183B32]" />
                Auditable Case Logs
              </span>
            </div>
          </div>

          {/* Right Column — Architectural Photography & Integrated Repair Passport */}
          <div className="lg:col-span-6 xl:col-span-6 relative">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              
              {/* Architectural Image Container */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl shadow-[#183B32]/10 border border-[#E6E4DA] bg-[#EAE5D9]">
                <img
                  src="/hero_luxury_appliances.jpg"
                  alt="Minimalist modern home kitchen with French door refrigerator and built-in front-load washing machine"
                  className="w-full h-auto object-cover aspect-[4/3] block"
                  loading="eager"
                  width="800"
                  height="600"
                />

                {/* Subtle natural architectural vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Champagne Brass Guiding Connector (Desktop only) */}
              <div className="hidden lg:block absolute top-[44%] left-[28%] w-16 h-12 pointer-events-none z-20">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 70 50" fill="none" aria-hidden="true">
                  <circle cx="68" cy="12" r="3" fill="#B49A68" />
                  <circle cx="68" cy="12" r="7" stroke="#B49A68" strokeWidth="0.8" opacity="0.6" />
                  <path
                    d="M 68 12 C 40 12, 35 40, 2 48"
                    stroke="#B49A68"
                    strokeWidth="1.4"
                    strokeDasharray="2 2"
                  />
                </svg>
              </div>

              {/* Integrated Floating Repair Passport Card */}
              {/* Positioned overlapping on desktop (lg+), flowing below cleanly on mobile */}
              <div className="mt-5 lg:mt-0 lg:absolute lg:top-[38%] lg:-left-8 xl:-left-10 z-30 w-full sm:w-[320px]">
                <div className="bg-white/95 backdrop-blur-md border border-[#E6E4DA] shadow-xl shadow-[#183B32]/12 rounded-2xl p-5 transition-transform duration-300 hover:scale-[1.01]">
                  
                  {/* Card Eyebrow */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#687871]">
                      REPAIR PASSPORT
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#183B32]/30" />
                  </div>

                  {/* Appliance Details */}
                  <div className="mt-2.5">
                    <h2 className="text-lg font-semibold text-[#183B32] tracking-tight">
                      Samsung Refrigerator
                    </h2>
                    <p className="text-xs text-[#687871] font-medium mt-0.5">
                      Model: RT28T / RF28R
                    </p>
                  </div>

                  {/* Warranty Active Badge */}
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DDE7DD] text-[#183B32] border border-[#CCDCCD]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#183B32]" />
                      Warranty: Active until Mar 2027
                    </span>
                  </div>

                  {/* Purchase & Repair Information */}
                  <div className="mt-4 pt-3 border-t border-[#EFECE3] space-y-2 text-xs text-[#24342F]">
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[#687871]">Purchase details</span>
                      <span className="font-medium text-[#183B32]">Verified · Dealer</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-[#687871]">Repair history</span>
                      <span className="font-medium text-[#183B32]">1 Case Recorded</span>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="mt-4 pt-3 border-t border-[#EFECE3]">
                    <button
                      onClick={onViewSamplePassport}
                      className="group w-full inline-flex items-center justify-between text-xs font-semibold text-[#183B32] hover:text-[#B49A68] transition-colors py-1 focus:outline-none focus-visible:underline"
                    >
                      <span>View Appliance Record</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>

                  {/* Subtle Demo Disclosure */}
                  <p className="mt-2 text-[10px] text-[#8C9C94] text-center font-normal">
                    Representative demo record
                  </p>

                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
