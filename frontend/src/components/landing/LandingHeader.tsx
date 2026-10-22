import React, { useState } from 'react';
import { FixFlowLogo } from '../brand/FixFlowLogo';
import { Menu, X } from 'lucide-react';

interface LandingHeaderProps {
  onRegisterClick: () => void;
  onSignInClick: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
  onRegisterClick,
  onSignInClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F6F4EE]/95 backdrop-blur-md border-b border-[#E6E4DA] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Left: Brand Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] rounded-md transition-opacity hover:opacity-90"
          aria-label="FixFlow Homepage"
        >
          <FixFlowLogo size="md" />
        </button>

        {/* Center: Editorial Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 lg:space-x-10" aria-label="Main Navigation">
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-sm font-medium text-[#24342F] hover:text-[#183B32] transition-colors focus:outline-none focus-visible:underline"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('repair-passport')}
            className="text-sm font-medium text-[#24342F] hover:text-[#183B32] transition-colors focus:outline-none focus-visible:underline"
          >
            Repair Passport
          </button>
          <button
            onClick={() => scrollToSection('features')}
            className="text-sm font-medium text-[#24342F] hover:text-[#183B32] transition-colors focus:outline-none focus-visible:underline"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="text-sm font-medium text-[#24342F] hover:text-[#183B32] transition-colors focus:outline-none focus-visible:underline"
          >
            About
          </button>
        </nav>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center space-x-6">
          <button
            onClick={onSignInClick}
            className="text-sm font-medium text-[#24342F] hover:text-[#183B32] transition-colors px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] rounded"
          >
            Sign in
          </button>

          <button
            onClick={onRegisterClick}
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-[#183B32] hover:bg-[#122C25] rounded-full transition-all shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#183B32]/40"
          >
            Get Started
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex items-center md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#183B32] hover:bg-[#EAE5D9] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#183B32]"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E6E4DA] bg-[#F6F4EE] px-5 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-3 pt-2" aria-label="Mobile Navigation">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left text-base font-medium text-[#24342F] hover:text-[#183B32] py-1.5 focus:outline-none"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('repair-passport')}
              className="text-left text-base font-medium text-[#24342F] hover:text-[#183B32] py-1.5 focus:outline-none"
            >
              Repair Passport
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-left text-base font-medium text-[#24342F] hover:text-[#183B32] py-1.5 focus:outline-none"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-left text-base font-medium text-[#24342F] hover:text-[#183B32] py-1.5 focus:outline-none"
            >
              About FixFlow
            </button>
          </nav>

          <div className="pt-4 border-t border-[#E6E4DA] flex flex-col gap-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onSignInClick();
              }}
              className="w-full text-center py-2.5 text-sm font-medium text-[#24342F] bg-white border border-[#E6E4DA] rounded-full hover:bg-slate-50 transition-colors"
            >
              Sign In (Local Demo)
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onRegisterClick();
              }}
              className="w-full text-center py-2.5 text-sm font-medium text-white bg-[#183B32] hover:bg-[#122C25] rounded-full shadow-xs transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
