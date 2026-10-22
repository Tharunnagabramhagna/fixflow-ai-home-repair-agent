import React from 'react';
import { FixFlowLogo } from '../brand/FixFlowLogo';
import { Database, Terminal } from 'lucide-react';

interface LandingFooterProps {
  onRegisterClick: () => void;
  onSignInClick: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onRegisterClick,
  onSignInClick,
}) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer id="about" className="bg-[#102D27] text-[#F6F4EE] pt-16 pb-12 border-t border-[#183B32]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand & Description */}
          <div className="md:col-span-5 space-y-4">
            <FixFlowLogo size="md" theme="dark" />
            <p className="text-xs sm:text-sm text-[#A3B8AD] max-w-sm leading-relaxed">
              FixFlow brings clarity to household appliance maintenance with Digital Repair Passports, structured diagnostic records, and verified warranty timelines.
            </p>
            <div className="flex items-center gap-3 text-xs text-[#B49A68] pt-2">
              <span className="inline-flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                SQLite WAL Persistence
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Validated REST API
              </span>
            </div>
          </div>

          {/* Platform Navigation */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold tracking-[0.18em] uppercase text-[#B49A68]">
              PLATFORM
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#C8D6CF]">
              <li>
                <button
                  onClick={() => scrollTo('how-it-works')}
                  className="hover:text-white transition-colors focus:outline-none focus-visible:underline"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollTo('repair-passport')}
                  className="hover:text-white transition-colors focus:outline-none focus-visible:underline"
                >
                  Digital Repair Passport
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollTo('features')}
                  className="hover:text-white transition-colors focus:outline-none focus-visible:underline"
                >
                  Core Architecture
                </button>
              </li>
              <li>
                <button
                  onClick={onRegisterClick}
                  className="hover:text-white transition-colors focus:outline-none focus-visible:underline"
                >
                  Register Appliance
                </button>
              </li>
            </ul>
          </div>

          {/* Development Context */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold tracking-[0.18em] uppercase text-[#B49A68]">
              DEVELOPMENT & PREVIEW
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#C8D6CF]">
              <li>
                <button
                  onClick={onSignInClick}
                  className="hover:text-white transition-colors focus:outline-none focus-visible:underline"
                >
                  Sign In (Local Demo Access)
                </button>
              </li>
              <li className="pt-2 text-[11px] text-[#7E968B] leading-relaxed">
                Phase 1 Development Preview: All appliance registers and repair tracking workflows operate with local SQLite persistence. External voice and AI agent layers are planned for subsequent phases.
              </li>
            </ul>
          </div>

        </div>

        {/* Footer Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7E968B]">
          <p>© {new Date().getFullYear()} FixFlow · Amazon Developers Hackathon (Alexa+ Track).</p>
          <div className="flex items-center gap-4">
            <span>Local Development Environment</span>
            <span>·</span>
            <span>Version 1.0.0</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
