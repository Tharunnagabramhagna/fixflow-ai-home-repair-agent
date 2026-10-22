import React, { useState } from 'react';
import { X, Cpu } from 'lucide-react';
import type { CreateApplianceData } from '../types';
import { api } from '../api/client';

interface RegisterApplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  'Kitchen',
  'Laundry',
  'HVAC',
  'Plumbing',
  'Water Filtration',
  'Cleaning',
  'Entertainment',
  'Other',
];

export const RegisterApplianceModal: React.FC<RegisterApplianceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [location, setLocation] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiration, setWarrantyExpiration] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission
    if (!name.trim() || !brand.trim() || !model.trim()) {
      setError('Name, Brand, and Model are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: CreateApplianceData = {
        name: name.trim(),
        category,
        brand: brand.trim(),
        model: model.trim(),
        serial_number: serialNumber.trim() || undefined,
        location: location.trim() || undefined,
        purchase_date: purchaseDate || undefined,
        warranty_expiration: warrantyExpiration || undefined,
        notes: notes.trim() || undefined,
      };

      await api.createAppliance(payload);
      // Reset form
      setName('');
      setBrand('');
      setModel('');
      setSerialNumber('');
      setLocation('');
      setPurchaseDate('');
      setWarrantyExpiration('');
      setNotes('');

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create appliance', err);
      setError(err.message || 'Failed to register appliance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#E6E4DA] overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6E4DA] flex items-center justify-between bg-[#F6F4EE]/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EAF3EA] text-[#183B32] border border-[#DDE7DD] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#183B32] text-base">Register Appliance</h3>
              <p className="text-xs text-[#687871]">Create a digital Repair Passport for this device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A9A92] hover:text-[#24342F] hover:bg-[#E6E4DA]/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Appliance Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Kitchen Refrigerator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Manufacturer / Brand *
              </label>
              <input
                type="text"
                placeholder="e.g. Samsung, LG, Bosch"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Model Number *
              </label>
              <input
                type="text"
                placeholder="e.g. RF28R7551SR"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Serial Number & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Serial Number (Optional)
              </label>
              <input
                type="text"
                placeholder="Found on barcode label"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Household Location
              </label>
              <input
                type="text"
                placeholder="e.g. Kitchen, Laundry, Garage"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Purchase Date & Warranty Expiration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Warranty Expiration Date
              </label>
              <input
                type="date"
                value={warrantyExpiration}
                onChange={(e) => setWarrantyExpiration(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Appliance Notes / Features
            </label>
            <input
              type="text"
              placeholder="e.g. French doors, smart dispenser, 10-year compressor warranty"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#E6E4DA] flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-[#687871] hover:text-[#24342F] hover:bg-[#F6F4EE] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#183B32] hover:bg-[#102D27] rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Save Appliance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
