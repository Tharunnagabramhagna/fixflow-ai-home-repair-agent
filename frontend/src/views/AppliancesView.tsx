import React, { useState } from 'react';
import { Search, Plus, Cpu } from 'lucide-react';
import { ApplianceCard } from '../components/ApplianceCard';
import type { Appliance, RepairCase } from '../types';

interface AppliancesViewProps {
  appliances: Appliance[];
  repairCases: RepairCase[];
  loading: boolean;
  onOpenRegisterModal: () => void;
  onViewPassport: (appliance: Appliance) => void;
  onReportIssue: (appliance: Appliance) => void;
}

export const AppliancesView: React.FC<AppliancesViewProps> = ({
  appliances,
  repairCases,
  loading,
  onOpenRegisterModal,
  onViewPassport,
  onReportIssue,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Compute categories
  const categories = ['All', ...Array.from(new Set(appliances.map((a) => a.category)))];

  // Map open cases per appliance
  const openCasesByAppliance = repairCases.reduce((acc, c) => {
    if (['open', 'diagnosed', 'scheduled', 'in_progress'].includes(c.status)) {
      acc[c.appliance_id] = (acc[c.appliance_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filter appliances
  const filtered = appliances.filter((a) => {
    const matchesCat = selectedCategory === 'All' || a.category === selectedCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.brand.toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q) ||
      (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
      (a.location && a.location.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border border-[#E6E4DA] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row gap-3.5 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8A9A92] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search appliances, brands, models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-[#E6E4DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#183B32] focus:border-[#183B32] bg-[#F6F4EE]/50 focus:bg-white text-[#24342F] placeholder-[#8A9A92] transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-[#183B32] text-white shadow-xs'
                  : 'bg-white border border-[#E6E4DA] text-[#687871] hover:bg-[#F6F4EE] hover:text-[#183B32]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E6E4DA] p-12 text-center text-[#687871] text-xs">
          Loading appliances...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#E6E4DA] p-12 text-center space-y-3">
          <Cpu className="w-8 h-8 text-[#A3B2AA] mx-auto" />
          <h3 className="text-sm font-semibold text-[#24342F]">No appliances found</h3>
          <p className="text-xs text-[#687871] max-w-sm mx-auto">
            {search || selectedCategory !== 'All'
              ? 'Try adjusting your search query or category filters.'
              : 'Register your first appliance to start building digital Repair Passports.'}
          </p>
          <button
            onClick={onOpenRegisterModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#183B32] text-white text-xs font-semibold hover:bg-[#102D27] transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Register Appliance</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((appliance) => (
            <ApplianceCard
              key={appliance.id}
              appliance={appliance}
              openCasesCount={openCasesByAppliance[appliance.id] || 0}
              onViewPassport={onViewPassport}
              onReportIssue={onReportIssue}
            />
          ))}
        </div>
      )}
    </div>
  );
};
