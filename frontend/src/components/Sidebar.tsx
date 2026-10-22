import React, { useState, useEffect } from 'react';
import {
  Home,
  Refrigerator,
  Wrench,
  History,
  Settings,
  HelpCircle,
  ChevronRight,
  X,
  Activity,
} from 'lucide-react';
import { FixFlowLogo } from './brand/FixFlowLogo';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  applianceCount: number;
  openCasesCount: number;
  onBackToLanding?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: number;
  badgeColor?: string;
  badgeTitle?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  applianceCount,
  openCasesCount,
  onBackToLanding,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const workspaceItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'appliances', label: 'My Appliances', icon: Refrigerator, badge: applianceCount, badgeTitle: `${applianceCount} registered appliances` },
    {
      id: 'repairs',
      label: 'Repair Cases',
      icon: Wrench,
      badge: openCasesCount,
      badgeColor: 'bg-[#FDE68A] text-[#B45309]',
      badgeTitle: `${openCasesCount} active repair cases requiring attention`,
    },
    { id: 'history', label: 'Repair History', icon: History },
  ];

  const accountItems: NavItem[] = [
    { id: 'settings', label: 'Settings & Profile', icon: Settings },
    { id: 'health', label: 'System Health', icon: Activity },
  ];

  const renderNavButton = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          onSelectTab(item.id);
          onCloseMobile();
        }}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] ${
          isActive
            ? 'bg-[#DDE7DD] text-[#183B32] font-semibold shadow-2xs'
            : 'text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE] font-medium'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 transition-colors ${
              isActive ? 'text-[#183B32]' : 'text-[#687871] group-hover:text-[#183B32]'
            }`}
          />
          <span className="truncate">{item.label}</span>
        </div>

        {item.badge !== undefined && item.badge > 0 && (
          <span
            title={item.badgeTitle}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
              item.badgeColor || 'bg-[#DDE7DD] text-[#183B32]'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const content = (
    <div className="flex flex-col h-full w-full bg-white border-r border-[#E6E4DA] select-none relative">
      {/* Brand Header */}
      <div className="p-6 pb-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <FixFlowLogo size="md" />
        </div>

        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-4 py-2 space-y-5 overflow-y-auto min-h-0">
        {/* Workspace Group */}
        <div>
          <span className="text-[10px] font-bold text-[#8A9A92] uppercase tracking-[0.14em] px-3 block mb-1.5">
            Workspace
          </span>
          <div className="space-y-1">
            {workspaceItems.map(renderNavButton)}
          </div>
        </div>

        {/* Account and Support Group */}
        <div>
          <span className="text-[10px] font-bold text-[#8A9A92] uppercase tracking-[0.14em] px-3 block mb-1.5">
            Account & Support
          </span>
          <div className="space-y-1">
            {accountItems.map(renderNavButton)}
            <button
              onClick={() => {
                setShowHelpModal(true);
                onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all text-left text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <HelpCircle className="w-4 h-4 text-[#687871] shrink-0" />
                <span className="truncate">Help & Support</span>
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom Area: Alex Carter Profile & Public Website Link */}
      <div className="p-4 border-t border-[#E6E4DA] bg-white relative z-10 space-y-2 shrink-0">
        {/* User Profile Card */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('settings');
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#F6F4EE] transition-colors group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
          title="Manage Profile & Settings"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-[#DDE7DD] border border-[#CBDBCB] shrink-0 flex items-center justify-center">
              {!avatarError ? (
                <img
                  src="/avatars/alex_carter.jpg"
                  alt="Alex Carter"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className="text-xs font-bold text-[#183B32]">AC</span>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-[#24342F] block truncate group-hover:text-[#183B32]">
                Alex Carter
              </span>
              <span className="text-[11px] text-[#8A9A92] block truncate">
                alex.carter@gmail.com
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#A3B2AA] group-hover:text-[#183B32] group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Back to Public Landing link */}
        {onBackToLanding && (
          <div className="pt-1.5 border-t border-[#E6E4DA]/60">
            <button
              type="button"
              onClick={() => {
                onBackToLanding();
                onCloseMobile();
              }}
              className="w-full text-center text-xs font-semibold text-[#183B32] bg-[#EEF4EE] hover:bg-[#DDE7DD] border border-[#CBDBCB]/70 rounded-xl py-2 px-3 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
              title="Return to FixFlow Public Website"
            >
              <span className="text-sm">←</span>
              <span>Public Website</span>
            </button>
          </div>
        )}
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E6E4DA] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E4DA] pb-3">
              <div className="flex items-center gap-2 text-[#183B32] font-bold">
                <HelpCircle className="w-5 h-5" />
                <span>FixFlow Help & Support</span>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-[#24342F] leading-relaxed">
              <p>
                <strong>Welcome to FixFlow — Smarter Home Care</strong>. This platform provides persistent digital Repair Passports for household appliances.
              </p>
              <div className="p-3 bg-[#F6F4EE] rounded-xl space-y-1.5">
                <p className="font-semibold text-[#183B32]">Current Prototype Capabilities:</p>
                <ul className="list-disc pl-4 space-y-1 text-[#687871]">
                  <li>Register household appliances with model, serial & warranty dates</li>
                  <li>Report faults and track stateful repair cases</li>
                  <li>Audit chronological repair events and maintenance actions</li>
                  <li>Local rule-based troubleshooting preview</li>
                </ul>
              </div>
              <p className="text-[11px] text-[#8A9A92]">
                For questions or hackathon evaluation support, visit our GitHub repository or contact the developer team.
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-[#183B32] text-white text-xs font-semibold hover:bg-[#102D27]"
              >
                Close Help
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:block w-64 shrink-0 h-screen h-[100dvh] sticky top-0 z-30 bg-white">
        {content}
      </aside>

      {/* Mobile Drawer (with slide-in transition & overlay) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col w-72 max-w-[80vw] h-full bg-white shadow-2xl z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
