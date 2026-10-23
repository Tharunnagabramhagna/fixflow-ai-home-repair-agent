import React, { useState } from 'react';
import {
  User,
  Bell,
  CheckCircle2,
  Activity,
  ArrowRight,
  Info,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

interface SettingsViewProps {
  onNavigateTab?: (tab: string) => void;
  onOpenAuthModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigateTab, onOpenAuthModal }) => {
  const { user, isGuest } = useAuth();
  const [profile, setProfile] = useState(() => ({
    name: user?.name || (isGuest ? 'Guest Explorer' : 'Homeowner'),
    email: user?.email || (isGuest ? 'guest@fixflow.local' : 'homeowner@fixflow.local'),
    phone: '+1 (555) 839-2041',
    address: '742 Evergreen Terrace, Seattle, WA 98101',
    residenceType: 'Single Family Home',
  }));

  // Update profile when user state changes
  React.useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        name: user.name,
        email: user.email,
      }));
    }
  }, [user]);

  const [notifications, setNotifications] = useState({
    emailWarranty: true,
    smsStatus: true,
    pushAlerts: false,
  });

  const [savedToast, setSavedToast] = useState(false);

  const initials = user
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'GE';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-lg border border-slate-800 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Profile preferences saved locally</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#183B32] flex items-center gap-2.5">
            <User className="w-6 h-6 text-[#183B32]" />
            <span>Settings & Profile</span>
          </h1>
          <p className="text-xs text-[#687871] mt-1">
            Manage your homeowner identity, notification channels, and household defaults
          </p>
        </div>

        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('health')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F6F4EE] border border-[#E6E4DA] text-xs font-semibold text-[#183B32] hover:bg-[#DDE7DD] transition-all"
          >
            <Activity className="w-4 h-4 text-[#183B32]" />
            <span>Developer Diagnostics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Guest Mode Banner in Settings */}
      {isGuest && (
        <div className="bg-[#B49A68]/10 border border-[#B49A68]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#24342F]">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-[#B49A68] shrink-0" />
            <span>
              <strong>Guest Workspace:</strong> You are exploring FixFlow without an account. Profile preferences and sample data are not saved to a permanent account.
            </span>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 rounded-full bg-[#183B32] hover:bg-[#122C25] text-white text-xs font-semibold shrink-0 transition-colors"
            >
              Create Account
            </button>
          )}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#DDE7DD] border border-[#CBDBCB] flex items-center justify-center text-[#183B32] font-bold text-sm shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#183B32]">
              {isGuest ? 'Guest Explorer Profile' : 'Homeowner Profile'}
            </h2>
            <p className="text-xs text-[#687871]">
              {isGuest
                ? 'Temporary exploration session for FixFlow repair passports'
                : 'Primary account holder for FixFlow digital repair passports'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#24342F] mb-1">Full Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-[#E6E4DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] bg-[#F6F4EE]/50 focus:bg-white text-[#24342F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#24342F] mb-1">Email Address</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-[#E6E4DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] bg-[#F6F4EE]/50 focus:bg-white text-[#24342F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#24342F] mb-1">Contact Phone</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-[#E6E4DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] bg-[#F6F4EE]/50 focus:bg-white text-[#24342F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#24342F] mb-1">Residence Type</label>
              <input
                type="text"
                value={profile.residenceType}
                onChange={(e) => setProfile({ ...profile, residenceType: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-[#E6E4DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] bg-[#F6F4EE]/50 focus:bg-white text-[#24342F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24342F] mb-1">Household Address</label>
            <input
              type="text"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-[#E6E4DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] bg-[#F6F4EE]/50 focus:bg-white text-[#24342F]"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#183B32] text-white text-xs font-semibold hover:bg-[#102D27] transition-all shadow-xs"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#EAF3EA] border border-[#DDE7DD] flex items-center justify-center text-[#183B32]">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#183B32]">Notification Preferences</h2>
            <p className="text-xs text-[#687871]">Configure how you receive repair updates and warranty reminders</p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6E4DA] hover:bg-[#F6F4EE]/50 transition-colors cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-[#24342F]">Warranty Expiration Alerts</p>
              <p className="text-[11px] text-[#687871]">Send proactive reminder 30 days before manufacturer warranties expire</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailWarranty}
              onChange={(e) => setNotifications({ ...notifications, emailWarranty: e.target.checked })}
              className="w-4 h-4 accent-[#183B32] rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6E4DA] hover:bg-[#F6F4EE]/50 transition-colors cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-[#24342F]">SMS Repair Status Changes</p>
              <p className="text-[11px] text-[#687871]">Receive text message when a technician appointment is scheduled or confirmed</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.smsStatus}
              onChange={(e) => setNotifications({ ...notifications, smsStatus: e.target.checked })}
              className="w-4 h-4 accent-[#183B32] rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6E4DA] hover:bg-[#F6F4EE]/50 transition-colors cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-[#24342F]">Desktop Push Notifications</p>
              <p className="text-[11px] text-[#687871]">Show local browser notifications when fault reports are diagnosed</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.pushAlerts}
              onChange={(e) => setNotifications({ ...notifications, pushAlerts: e.target.checked })}
              className="w-4 h-4 accent-[#183B32] rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Prototype Boundary Note */}
      <div className="bg-[#F6F4EE] rounded-2xl border border-[#E6E4DA] p-5 text-xs text-[#687871] flex items-start gap-3">
        <Info className="w-5 h-5 text-[#183B32] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-[#183B32]">Phase 1 Prototype Notice</p>
          <p className="leading-relaxed">
            FixFlow currently operates in single-household prototype mode. Profile settings and notification preferences are preserved in local storage and session context. Cloud multi-user authentication, OAuth single sign-on, and Amazon Alexa+ account linking will be added in Phase 2.
          </p>
        </div>
      </div>
    </div>
  );
};
