import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Bell, Refrigerator, Wrench, X, LogOut, Settings as SettingsIcon, ShieldCheck, Compass, LogIn } from 'lucide-react';
import type { Appliance, RepairCase, AuthUser } from '../types';

interface HeaderProps {
  currentTab: string;
  onOpenDrawer: () => void;
  isDesktop?: boolean;
  isWideDesktop?: boolean;
  desktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
  onOpenReportModal?: () => void;
  onOpenRegisterModal?: () => void;
  onSearch?: (query: string) => void;
  appliances?: Appliance[];
  repairCases?: RepairCase[];
  onSelectAppliance?: (appliance: Appliance) => void;
  onSelectCase?: (repairCase: RepairCase) => void;
  onOpenSettings?: () => void;
  user?: AuthUser | null;
  onSignOut?: () => void;
  onOpenAuthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab: _currentTab,
  onOpenDrawer,
  isDesktop,
  isWideDesktop = false,
  desktopCollapsed = false,
  onToggleDesktopCollapse,
  onSearch,
  appliances = [],
  repairCases = [],
  onSelectAppliance,
  onSelectCase,
  onOpenSettings,
  user,
  onSignOut,
  onOpenAuthModal,
}) => {
  const isDesktopMode = isDesktop !== undefined ? isDesktop : isWideDesktop;
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isGuest = !user;
  const userName = user?.name || 'Guest Explorer';
  const userEmail = user?.email || 'Sample Workspace';
  const userInitial = user
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
    : 'G';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowSearchDropdown(val.trim().length > 0);
    if (onSearch) {
      onSearch(val);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = searchQuery.toLowerCase().trim();
  const matchedAppliances = q
    ? appliances.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.brand.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q) ||
          (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
          a.category.toLowerCase().includes(q)
      ).slice(0, 4)
    : [];

  const matchedCases = q
    ? repairCases.filter(
        (c) =>
          c.issue_description.toLowerCase().includes(q) ||
          (c.appliance_name && c.appliance_name.toLowerCase().includes(q)) ||
          c.status.toLowerCase().includes(q) ||
          c.priority.toLowerCase().includes(q)
      ).slice(0, 4)
    : [];

  const hasResults = matchedAppliances.length > 0 || matchedCases.length > 0;

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-[#E6E4DA] sticky top-0 z-20 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        {/* Left: Visible Sidebar Toggle Button (collapses in-flow rail on desktop, opens drawer on mobile) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isDesktopMode && onToggleDesktopCollapse) {
                onToggleDesktopCollapse();
              } else {
                onOpenDrawer();
              }
            }}
            className="p-2 rounded-xl text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
            aria-label={
              isDesktopMode
                ? desktopCollapsed
                  ? 'Expand sidebar navigation'
                  : 'Collapse sidebar navigation'
                : 'Open navigation drawer'
            }
            title={
              isDesktopMode
                ? desktopCollapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
                : 'Open Navigation'
            }
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Global Search Bar with Live Result Dropdown */}
        <div ref={searchContainerRef} className="flex-1 max-w-xl mx-auto relative">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A3B2AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setShowSearchDropdown(true);
              }}
              placeholder="Search appliances, brands, serial numbers, repair cases..."
              className="w-full bg-[#F6F4EE]/60 hover:bg-[#F6F4EE] focus:bg-white border border-[#E6E4DA] rounded-xl pl-9.5 pr-8 py-2 text-xs sm:text-sm text-[#24342F] placeholder-[#8A9A92] focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {showSearchDropdown && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-[#E6E4DA] shadow-xl p-3 z-30 max-h-96 overflow-y-auto space-y-3">
              {!hasResults ? (
                <div className="p-4 text-center text-xs text-[#687871]">
                  No appliances or repair tickets match "{searchQuery}"
                </div>
              ) : (
                <>
                  {matchedAppliances.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-[#8A9A92] uppercase tracking-wider px-2 block mb-1">
                        Appliances ({matchedAppliances.length})
                      </span>
                      <div className="space-y-1">
                        {matchedAppliances.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setShowSearchDropdown(false);
                              if (onSelectAppliance) onSelectAppliance(a);
                            }}
                            className="p-2 rounded-xl hover:bg-[#F6F4EE] cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Refrigerator className="w-4 h-4 text-[#183B32]" />
                              <div>
                                <p className="font-semibold text-[#24342F]">{a.name}</p>
                                <p className="text-[11px] text-[#687871]">
                                  {a.brand} · {a.model} {a.serial_number ? `· SN: ${a.serial_number}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-[#183B32] bg-[#DDE7DD] px-2 py-0.5 rounded-full">
                              Passport →
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchedCases.length > 0 && (
                    <div className="border-t border-[#E6E4DA] pt-2">
                      <span className="text-[10px] font-bold text-[#8A9A92] uppercase tracking-wider px-2 block mb-1">
                        Repair Cases ({matchedCases.length})
                      </span>
                      <div className="space-y-1">
                        {matchedCases.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setShowSearchDropdown(false);
                              if (onSelectCase) onSelectCase(c);
                            }}
                            className="p-2 rounded-xl hover:bg-[#F6F4EE] cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Wrench className="w-4 h-4 text-[#D97706] shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-[#24342F] truncate">
                                  {c.appliance_name ? `${c.appliance_name}: ` : ''}{c.issue_description}
                                </p>
                                <p className="text-[10px] text-[#687871] capitalize">
                                  Status: {c.status.replace('_', ' ')} · Priority: {c.priority}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-[#4A5D54] bg-[#F1F3F2] px-2 py-0.5 rounded-full uppercase shrink-0">
                              {c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Guest Indicator / Notifications / User Account Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Guest Sign-In / Register Action */}
          {isGuest && onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#183B32] text-white text-xs font-semibold hover:bg-[#122C25] transition-all shadow-2xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          )}

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationPopup(!showNotificationPopup)}
              aria-label="Notifications"
              className="p-2 rounded-xl text-[#687871] hover:text-[#183B32] hover:bg-[#F6F4EE] transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-[#D97706] absolute top-1.5 right-1.5 ring-2 ring-white" />
            </button>

            {/* Notification Dropdown */}
            {showNotificationPopup && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-[#E6E4DA] shadow-lg p-3 text-xs z-30 space-y-2">
                <div className="flex items-center justify-between border-b border-[#E6E4DA] pb-2">
                  <span className="font-bold text-[#183B32]">Notifications</span>
                  <span className="text-[10px] text-[#8A9A92]">1 pending</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EE] rounded-xl space-y-1">
                  <p className="font-semibold text-[#24342F] text-[11px]">
                    Technician Visit Scheduled
                  </p>
                  <p className="text-[10px] text-[#687871]">
                    LG Washer bottom leak inspection scheduled for Oct 25, 2026 at 10:00 AM.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Guest Dropdown Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border shadow-2xs cursor-pointer select-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] ${
                isGuest
                  ? 'bg-[#F6F4EE] text-[#183B32] border-[#CBDBCB] hover:ring-2 hover:ring-[#183B32]/30'
                  : 'bg-[#DDE7DD] text-[#183B32] border-[#CBDBCB] hover:ring-2 hover:ring-[#183B32]/30'
              }`}
              title={`${userName} — Account Menu`}
              aria-label="User account menu"
              aria-expanded={showUserDropdown}
            >
              {userInitial}
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#E6E4DA] shadow-xl p-3 text-xs z-30 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                {/* Account Details */}
                <div className="px-1.5 pb-2 border-b border-[#E6E4DA]">
                  <p className="font-bold text-[#183B32] text-sm">{userName}</p>
                  <p className="text-[11px] text-[#8A9A92] truncate">{userEmail}</p>
                  {isGuest ? (
                    <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6F4EE] text-[#687871] border border-[#E6E4DA]">
                      <Compass className="w-3 h-3 text-[#183B32]" />
                      <span>Guest Workspace (Sample Mode)</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#DDE7DD] text-[#183B32]">
                      <ShieldCheck className="w-3 h-3 text-[#183B32]" />
                      <span>Authenticated Homeowner</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-1">
                  {isGuest && onOpenAuthModal && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenAuthModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left bg-[#183B32] text-white hover:bg-[#122C25] transition-colors font-semibold"
                    >
                      <LogIn className="w-4 h-4 text-[#B69A68]" />
                      <span>Create Account / Sign In</span>
                    </button>
                  )}

                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-[#24342F] hover:bg-[#F6F4EE] hover:text-[#183B32] transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4 text-[#687871]" />
                      <span>Settings & Profile</span>
                    </button>
                  )}

                  {!isGuest && onSignOut && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-red-600 hover:bg-red-50 transition-colors font-medium"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
