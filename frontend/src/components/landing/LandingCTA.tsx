import React from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

interface LandingCTAProps {
  onRegisterClick: () => void;
  onExploreClick: () => void;
}

export const LandingCTA: React.FC<LandingCTAProps> = ({
  onRegisterClick,
  onExploreClick,
}) => {
  return (
    <section className="py-20 sm:py-28 bg-[#183B32] text-[#F6F4EE] relative overflow-hidden">
      {/* Subtle architectural curvature accent */}
      <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute right-48 -bottom-12 w-64 h-64 rounded-full border border-[#B49A68]/15 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-xs font-semibold tracking-[0.18em] uppercase text-[#B49A68] border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B49A68]" />
            ORGANIZED HOME MAINTENANCE
          </div>

          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#F6F4EE] leading-[1.15]">
            Bring clarity to your household appliances today.
          </h2>

          <p className="text-base sm:text-lg text-[#C8D6CF] font-normal leading-relaxed max-w-2xl mx-auto">
            Experience thoughtful, organized home care. Catalog your household appliances, evaluate warranty coverage, and maintain an immutable record from fault to fix.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onRegisterClick}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-sm sm:text-base font-semibold text-[#183B32] bg-[#F6F4EE] hover:bg-[#EAE5D9] rounded-full shadow-lg transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Create Your Repair Passport
            </button>

            <button
              onClick={onExploreClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 text-sm sm:text-base font-medium text-[#F6F4EE] bg-white/10 hover:bg-white/15 border border-white/20 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A68]"
            >
              <span>Explore How It Works</span>
              <ArrowRight className="w-4 h-4 text-[#B49A68]" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
