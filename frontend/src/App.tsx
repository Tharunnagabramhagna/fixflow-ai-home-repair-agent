import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './views/OverviewView';
import { AppliancesView } from './views/AppliancesView';
import { RepairCasesView } from './views/RepairCasesView';
import { RepairHistoryView } from './views/RepairHistoryView';
import { SettingsView } from './views/SettingsView';
import { SystemHealthView } from './views/SystemHealthView';
import { PublicLandingPage } from './components/landing/PublicLandingPage';
import { AppliancePassportModal } from './components/AppliancePassportModal';
import { ReportProblemModal } from './components/ReportProblemModal';
import { RegisterApplianceModal } from './components/RegisterApplianceModal';
import { StatusUpdateModal } from './components/StatusUpdateModal';
import { api } from './api/client';
import type { Appliance, RepairCase, DashboardSummary } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function App() {
  // Navigation / View mode: 'landing' (public marketing website) vs 'dashboard' (app workspace)
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('app')) {
      return 'dashboard';
    }
    return 'landing';
  });

  const [currentTab, setCurrentTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Data states
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [repairCases, setRepairCases] = useState<RepairCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal states
  const [passportAppliance, setPassportAppliance] = useState<Appliance | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportDefaultAppliance, setReportDefaultAppliance] = useState<Appliance | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [statusModalCase, setStatusModalCase] = useState<RepairCase | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumData, appsData, casesData] = await Promise.all([
        api.getDashboardSummary(),
        api.getAppliances(),
        api.getRepairs(),
      ]);
      setSummary(sumData);
      setAppliances(appsData);
      setRepairCases(casesData);
    } catch (err: any) {
      console.error('Failed to load FixFlow dashboard data', err);
      showToast(err.message || 'Failed to connect to backend server', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.includes('app')) {
        setViewMode('dashboard');
      } else {
        setViewMode('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToDashboard = (tab: string = 'overview') => {
    setCurrentTab(tab);
    setViewMode('dashboard');
    window.location.hash = '#/app';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToLanding = () => {
    setViewMode('landing');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handlers
  const handleOpenReportModal = (applianceOrText?: Appliance | string) => {
    if (typeof applianceOrText === 'string') {
      setReportDefaultAppliance(null);
    } else if (applianceOrText) {
      setReportDefaultAppliance(applianceOrText);
    } else {
      setReportDefaultAppliance(null);
    }
    setReportModalOpen(true);
  };

  const handleCaseUpdated = () => {
    loadAllData();
    showToast('Case status updated and audit event recorded');
  };

  const handleApplianceCreated = () => {
    loadAllData();
    showToast('Appliance registered and Repair Passport initialized');
  };

  const handleReportCreated = () => {
    loadAllData();
    showToast('Repair ticket created successfully');
  };

  const openCasesCount = repairCases.filter((c) =>
    ['open', 'diagnosed', 'scheduled', 'in_progress'].includes(c.status)
  ).length;

  return (
    <div className="min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-bounce ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* View Mode Switching: Public Landing vs. Dashboard */}
      {viewMode === 'landing' ? (
        <PublicLandingPage
          appliances={appliances}
          onLaunchDashboard={() => navigateToDashboard('overview')}
          onRegisterAppliance={() => {
            navigateToDashboard('appliances');
            setRegisterModalOpen(true);
          }}
          onReportProblem={() => {
            navigateToDashboard('repairs');
            handleOpenReportModal();
          }}
          onOpenPassport={(appliance) => setPassportAppliance(appliance)}
        />
      ) : (
        <div className="flex min-h-screen bg-[#F6F4EE] text-[#24342F] font-sans">
          {/* Sidebar Navigation */}
          <Sidebar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            applianceCount={appliances.length}
            openCasesCount={openCasesCount}
            onBackToLanding={navigateToLanding}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <Header
              currentTab={currentTab}
              onOpenMobile={() => setMobileOpen(true)}
              onOpenReportModal={() => handleOpenReportModal()}
              onOpenRegisterModal={() => setRegisterModalOpen(true)}
              onBackToLanding={navigateToLanding}
              appliances={appliances}
              repairCases={repairCases}
              onSelectAppliance={(a) => setPassportAppliance(a)}
              onSelectCase={(c) => {
                setCurrentTab('repairs');
                setStatusModalCase(c);
              }}
              onOpenSettings={() => setCurrentTab('settings')}
            />

            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {currentTab === 'overview' && (
                <OverviewView
                  summary={summary}
                  appliances={appliances}
                  repairCases={repairCases}
                  loading={loading}
                  onNavigateTab={setCurrentTab}
                  onViewPassport={(a) => setPassportAppliance(a)}
                  onReportIssue={handleOpenReportModal}
                  onRegisterAppliance={() => setRegisterModalOpen(true)}
                />
              )}

              {currentTab === 'appliances' && (
                <AppliancesView
                  appliances={appliances}
                  repairCases={repairCases}
                  loading={loading}
                  onOpenRegisterModal={() => setRegisterModalOpen(true)}
                  onViewPassport={(a) => setPassportAppliance(a)}
                  onReportIssue={handleOpenReportModal}
                />
              )}

              {currentTab === 'repairs' && (
                <RepairCasesView
                  repairCases={repairCases}
                  appliances={appliances}
                  loading={loading}
                  onOpenReportModal={() => handleOpenReportModal()}
                  onUpdateStatus={(c) => setStatusModalCase(c)}
                  onViewPassport={(a) => setPassportAppliance(a)}
                />
              )}

              {currentTab === 'history' && (
                <RepairHistoryView
                  summary={summary}
                  loading={loading}
                />
              )}

              {currentTab === 'settings' && <SettingsView onNavigateTab={setCurrentTab} />}
              {currentTab === 'health' && <SystemHealthView />}
            </main>
          </div>
        </div>
      )}

      {/* Universal Modals (Accessible from both Landing and Dashboard) */}
      <AppliancePassportModal
        appliance={passportAppliance}
        onClose={() => setPassportAppliance(null)}
        onReportIssue={(a) => {
          setPassportAppliance(null);
          if (viewMode === 'landing') navigateToDashboard('repairs');
          handleOpenReportModal(a);
        }}
      />

      <ReportProblemModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        appliances={appliances}
        defaultAppliance={reportDefaultAppliance}
        onSuccess={handleReportCreated}
      />

      <RegisterApplianceModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={handleApplianceCreated}
      />

      <StatusUpdateModal
        repairCase={statusModalCase}
        onClose={() => setStatusModalCase(null)}
        onSuccess={handleCaseUpdated}
      />
    </div>
  );
}

export default App;
