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
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Compass,
  LogIn,
  ArrowLeft,
} from 'lucide-react';
import { FixFlowLogo } from './brand/FixFlowLogo';
import type { AuthUser } from '../types';

export interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  isDesktop?: boolean;
  isWideDesktop?: boolean;
  desktopCollapsed: boolean;
  onToggleDesktopCollapse: () => void;
  applianceCount: number;
  openCasesCount: number;
  onBackToLanding?: () => void;
  user?: AuthUser | null;
  onSignOut?: () => void;
  onOpenAuthModal?: () => void;
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
  drawerOpen,
  onCloseDrawer,
  isDesktop,
  isWideDesktop = false,
  desktopCollapsed,
  onToggleDesktopCollapse,
  applianceCount,
  openCasesCount,
  onBackToLanding,
  user,
  onSignOut,
  onOpenAuthModal,
}) => {
  const isDesktopMode = isDesktop !== undefined ? isDesktop : isWideDesktop;
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Close drawer on Escape key press
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, onCloseDrawer]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const workspaceItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    {
      id: 'appliances',
      label: 'My Appliances',
      icon: Refrigerator,
      badge: applianceCount,
      badgeTitle: `${applianceCount} registered appliances`,
    },
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
  ];

  const isGuest = !user;
  const userName = user?.name || 'Guest Explorer';
  const userEmail = user?.email || 'Sample Workspace';
  const userInitial = user
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
    : 'G';

  const renderNavButton = (item: NavItem, isDrawer: boolean = false) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          onSelectTab(item.id);
          if (isDrawer) onCloseDrawer();
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

  const renderExpandedContent = (isDrawer: boolean = false) => (
    <div className="flex flex-col h-full w-full bg-white border-r border-[#E6E4DA] select-none relative">
      {/* Brand Header */}
      <div className="p-5 pb-4 flex items-center justify-between shrink-0 border-b border-[#E6E4DA]/60">
        <div className="flex items-center gap-3">
          <FixFlowLogo size="md" />
        </div>

        {isDrawer ? (
          <button
            onClick={onCloseDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-[#F6F4EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onToggleDesktopCollapse}
            className="p-1.5 rounded-lg text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
            title="Collapse sidebar (compact icon rail)"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto min-h-0">
        {/* Workspace Group */}
        <div>
          <span className="text-[10px] font-bold text-[#8A9A92] uppercase tracking-[0.14em] px-3 block mb-1.5">
            Workspace
          </span>
          <div className="space-y-1">
            {workspaceItems.map((item) => renderNavButton(item, isDrawer))}
          </div>
        </div>

        {/* Account and Support Group */}
        <div>
          <span className="text-[10px] font-bold text-[#8A9A92] uppercase tracking-[0.14em] px-3 block mb-1.5">
            Account & Support
          </span>
          <div className="space-y-1">
            {accountItems.map((item) => renderNavButton(item, isDrawer))}
            <button
              onClick={() => {
                setShowHelpModal(true);
                if (isDrawer) onCloseDrawer();
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

      {/* Bottom Area: User / Guest Profile Card */}
      <div className="p-4 border-t border-[#E6E4DA] bg-white relative z-10 space-y-2 shrink-0">
        {/* User / Guest Profile Card */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('settings');
            if (isDrawer) onCloseDrawer();
          }}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#F6F4EE] transition-colors group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
          title={isGuest ? 'Guest Explorer (Settings)' : `${userName} — Profile & Settings`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-full overflow-hidden border shrink-0 flex items-center justify-center font-bold text-xs ${
              isGuest ? 'bg-[#F6F4EE] border-[#CBDBCB] text-[#183B32]' : 'bg-[#DDE7DD] border-[#CBDBCB] text-[#183B32]'
            }`}>
              {isGuest ? <Compass className="w-4 h-4 text-[#183B32]" /> : userInitial}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-[#24342F] block truncate group-hover:text-[#183B32]">
                {userName}
              </span>
              <span className="text-[11px] text-[#8A9A92] block truncate">
                {userEmail}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#A3B2AA] group-hover:text-[#183B32] group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Action Row: Guest Sign In / Authenticated Sign Out + Public Website */}
        <div className="pt-2 border-t border-[#E6E4DA]/60 space-y-1.5">
          {isGuest && onOpenAuthModal ? (
            <button
              type="button"
              onClick={() => {
                if (isDrawer) onCloseDrawer();
                onOpenAuthModal();
              }}
              className="w-full text-xs font-semibold text-white bg-[#183B32] hover:bg-[#122C25] rounded-xl py-2 px-3 transition-colors flex items-center justify-center gap-2 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
              title="Create an account or sign in"
            >
              <LogIn className="w-3.5 h-3.5 text-[#B69A68]" />
              <span>Create Account / Sign In</span>
            </button>
          ) : (
            onSignOut && (
              <button
                type="button"
                onClick={() => {
                  if (isDrawer) onCloseDrawer();
                  onSignOut();
                }}
                className="w-full text-xs font-semibold text-[#687871] hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-xl py-2 px-3 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                title="Sign out of FixFlow account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )
          )}

          {onBackToLanding && (
            <button
              type="button"
              onClick={() => {
                if (isDrawer) onCloseDrawer();
                onBackToLanding();
              }}
              className="w-full text-center text-xs font-semibold text-[#183B32] bg-[#EEF4EE] hover:bg-[#DDE7DD] border border-[#CBDBCB]/70 rounded-xl py-2 px-3 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
              title="Back to Home Page"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Back to Home Page</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderCollapsedContent = () => (
    <div className="flex flex-col items-center h-full w-full bg-white border-r border-[#E6E4DA] py-4 select-none">
      {/* Top Brand Mark & Expand Button */}
      <div className="flex flex-col items-center gap-3 shrink-0 pb-3 border-b border-[#E6E4DA]/60 w-full px-2">
        <FixFlowLogo size="sm" showWordmark={false} />
        <button
          onClick={onToggleDesktopCollapse}
          className="p-2 rounded-xl text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Icons */}
      <nav className="flex-1 w-full px-2 py-4 space-y-2 overflow-y-auto min-h-0 flex flex-col items-center">
        {workspaceItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative p-3 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] ${
                isActive
                  ? 'bg-[#DDE7DD] text-[#183B32] shadow-2xs'
                  : 'text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE]'
              }`}
              title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#D97706] ring-2 ring-white"
                  title={`${item.badge} active`}
                />
              )}
            </button>
          );
        })}

        <div className="w-8 border-t border-[#E6E4DA] my-2" />

        {accountItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`p-3 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] ${
                isActive
                  ? 'bg-[#DDE7DD] text-[#183B32] shadow-2xs'
                  : 'text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE]'
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}

        <button
          onClick={() => setShowHelpModal(true)}
          className="p-3 rounded-xl text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
          title="Help & Support"
          aria-label="Help & Support"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </nav>

      {/* Bottom Icons: Profile/Guest, Website, Sign Out/In */}
      <div className="pt-3 border-t border-[#E6E4DA]/60 flex flex-col items-center gap-2.5 w-full px-2 shrink-0">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center hover:ring-2 hover:ring-[#183B32] transition-all font-bold text-xs ${
            isGuest ? 'bg-[#F6F4EE] border-[#CBDBCB] text-[#183B32]' : 'bg-[#DDE7DD] border-[#CBDBCB] text-[#183B32]'
          }`}
          title={`${userName} (${isGuest ? 'Guest Mode' : 'Profile & Settings'})`}
          aria-label="Profile and Settings"
        >
          {isGuest ? <Compass className="w-4 h-4 text-[#183B32]" /> : userInitial}
        </button>

        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="p-2.5 rounded-xl text-[#183B32] bg-[#EEF4EE] hover:bg-[#DDE7DD] transition-colors"
            title="Back to Home Page"
            aria-label="Back to Home Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {isGuest && onOpenAuthModal ? (
          <button
            onClick={onOpenAuthModal}
            className="p-2.5 rounded-xl text-white bg-[#183B32] hover:bg-[#122C25] transition-colors"
            title="Sign In / Register"
            aria-label="Sign In or Register"
          >
            <LogIn className="w-4 h-4" />
          </button>
        ) : (
          onSignOut && (
            <button
              onClick={onSignOut}
              className="p-2.5 rounded-xl text-[#687871] hover:text-red-700 hover:bg-red-50 transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP / LAPTOP IN-FLOW SIDEBAR (Compact 256px expanded / 80px collapsed rail) */}
      {isDesktopMode && (
        <aside
          className={`shrink-0 h-screen h-[100dvh] sticky top-0 z-30 transition-all duration-200 border-r border-[#E6E4DA] bg-white ${
            desktopCollapsed ? 'w-20' : 'w-64'
          }`}
          aria-label="Primary Navigation"
        >
          {desktopCollapsed ? renderCollapsedContent() : renderExpandedContent(false)}
        </aside>
      )}

      {/* 2. TABLET / MOBILE SLIDE-IN DRAWER (Capped at 280px width, never occupying entire screen) */}
      {!isDesktopMode && drawerOpen && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseDrawer}
            aria-hidden="true"
          />

          {/* Drawer Panel: strictly capped width (280px), within viewport, scrollable navigation */}
          <div className="relative w-72 max-w-[280px] h-full h-[100dvh] bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-200 flex flex-col overflow-hidden">
            {renderExpandedContent(true)}
          </div>
        </div>
      )}

      {/* Universal Help Modal */}
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
                aria-label="Close help modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-[#24342F] leading-relaxed">
              <p>
                <strong>Welcome to FixFlow — Smarter Home Care</strong>. This platform provides persistent digital Repair Passports for household appliances.
              </p>
              <div className="p-3 bg-[#F6F4EE] rounded-xl space-y-1.5">
                <p className="font-semibold text-[#183B32]">Platform Capabilities:</p>
                <ul className="list-disc pl-4 space-y-1 text-[#687871]">
                  <li>Register household appliances with model, serial & warranty dates</li>
                  <li>Report faults and track stateful repair cases</li>
                  <li>Audit chronological repair events and maintenance actions</li>
                  <li>Inspect digital Repair Passports with warranty validation</li>
                </ul>
              </div>
              <p className="text-[11px] text-[#8A9A92]">
                For questions or evaluation support, visit our GitHub repository or contact the developer team.
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
    </>
  );
};
