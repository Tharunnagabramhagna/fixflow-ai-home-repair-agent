import React, { useState } from 'react';
import { FixFlowLogo } from '../brand/FixFlowLogo';
import { Menu, X, LayoutDashboard, LogOut, Compass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LandingHeaderProps {
  onRegisterClick: () => void;
  onSignInClick: () => void;
  onOpenDashboard?: () => void;
  onGuestClick?: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
  onRegisterClick,
  onSignInClick,
  onOpenDashboard,
  onGuestClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { status, user, logout } = useAuth();
  const isAuthenticated = status === 'authenticated' && user !== null;

  const userName = user?.name || '';
  const userEmail = user?.email || '';
  const userInitial = user
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
    : '';

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    try {
      await logout();
    } catch (err) {
      console.error('Sign out error:', err);
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

        {/* Right: Actions based on authentication state */}
        <div className="hidden md:flex items-center space-x-4">
          {isAuthenticated ? (
            /* Authenticated Navbar State */
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E6E4DA] shadow-2xs"
                title={`Signed in as ${userName} (${userEmail})`}
              >
                <div className="w-6 h-6 rounded-full bg-[#DDE7DD] text-[#183B32] font-bold text-[10px] flex items-center justify-center">
                  {userInitial}
                </div>
                <span className="text-xs font-semibold text-[#24342F]">{userName}</span>
              </div>

              {onOpenDashboard && (
                <button
                  onClick={onOpenDashboard}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#183B32] hover:bg-[#122C25] rounded-full transition-all shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#183B32]/40"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-[#B69A68]" />
                  <span>Open Dashboard</span>
                </button>
              )}

              <button
                onClick={handleSignOut}
                className="text-xs font-medium text-[#687871] hover:text-red-700 px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                title="Sign out of current account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            /* Guest / Unauthenticated Navbar State */
            <div className="flex items-center space-x-4">
              {onGuestClick && (
                <button
                  onClick={onGuestClick}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#183B32] bg-[#EEF4EE] hover:bg-[#DDE7DD] border border-[#CBDBCB]/70 rounded-full px-3.5 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
                >
                  <Compass className="w-3.5 h-3.5 text-[#183B32]" />
                  <span>Explore as Guest</span>
                </button>
              )}

              <button
                onClick={onSignInClick}
                className="text-sm font-medium text-[#24342F] hover:text-[#183B32] transition-colors px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] rounded"
              >
                Sign in
              </button>

              <button
                onClick={onRegisterClick}
                className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-white bg-[#183B32] hover:bg-[#122C25] rounded-full transition-all shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#183B32]/40"
              >
                Get Started
              </button>
            </div>
          )}
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
            {isAuthenticated ? (
              <>
                <div className="p-2.5 rounded-xl bg-white border border-[#E6E4DA] text-xs space-y-1">
                  <p className="font-semibold text-[#183B32]">{userName}</p>
                  <p className="text-[11px] text-[#8A9A92]">{userEmail}</p>
                </div>
                {onOpenDashboard && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenDashboard();
                    }}
                    className="w-full text-center py-2.5 text-sm font-semibold text-white bg-[#183B32] hover:bg-[#122C25] rounded-full shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#B69A68]" />
                    <span>Open Dashboard</span>
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full text-center py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                {onGuestClick && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onGuestClick();
                    }}
                    className="w-full text-center py-2.5 text-sm font-medium text-[#183B32] bg-[#EEF4EE] border border-[#CBDBCB] rounded-full hover:bg-[#DDE7DD] transition-colors flex items-center justify-center gap-2"
                  >
                    <Compass className="w-4 h-4 text-[#183B32]" />
                    <span>Continue as Guest</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignInClick();
                  }}
                  className="w-full text-center py-2.5 text-sm font-medium text-[#24342F] bg-white border border-[#E6E4DA] rounded-full hover:bg-slate-50 transition-colors"
                >
                  Sign In
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
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
