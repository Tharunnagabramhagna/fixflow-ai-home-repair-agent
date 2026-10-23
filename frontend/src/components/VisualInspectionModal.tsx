import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Sparkles,
  Bot,
  RefreshCw,
  Eye,
  FileCheck,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import type { Appliance, VisualInspectionDetail } from '../types';

interface VisualInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appliances: Appliance[];
  initialApplianceId?: string;
  initialCaseId?: string;
  onDiscussWithAssistant?: (summaryText: string) => void;
  onApplianceUpdated?: (updatedAppliance: Appliance) => void;
}

export const VisualInspectionModal: React.FC<VisualInspectionModalProps> = ({
  isOpen,
  onClose,
  appliances,
  initialApplianceId,
  initialCaseId,
  onDiscussWithAssistant,
  onApplianceUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [selectedApplianceId, setSelectedApplianceId] = useState<string>(initialApplianceId || '');
  const [description, setDescription] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentInspection, setCurrentInspection] = useState<VisualInspectionDetail | null>(null);

  // History list
  const [history, setHistory] = useState<VisualInspectionDetail[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Passport update confirmation state
  const [pendingProposal, setPendingProposal] = useState<{
    token: string;
    details: any;
  } | null>(null);
  const [applying, setApplying] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await api.getInspections(selectedApplianceId ? { appliance_id: selectedApplianceId } : undefined);
      setHistory(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load inspection history');
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedApplianceId]);

  useEffect(() => {
    if (initialApplianceId) {
      setSelectedApplianceId(initialApplianceId);
    }
  }, [initialApplianceId]);

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      loadHistory();
    }
  }, [isOpen, activeTab, loadHistory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    setError(null);
    setApplySuccess(null);
    setPendingProposal(null);

    // Basic client check
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit. Please upload a smaller image.');
      return;
    }

    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result);
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Preset demo sample images for quick testing
  const loadDemoSample = (type: 'e15' | 'leak' | 'hazard') => {
    setError(null);
    // 1x1 clean PNG transparent pixel encoded
    const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    setImageBase64(samplePngBase64);
    setImagePreviewUrl(samplePngBase64);
    setImageFile(new File([new Blob([new Uint8Array(64)])], `sample_${type}.png`, { type: 'image/png' }));

    if (type === 'e15') {
      setDescription('Bosch dishwasher display is showing error code E15 with water pooling in the safety base pan.');
      if (appliances.length > 0) setSelectedApplianceId(appliances[0].id);
    } else if (type === 'leak') {
      setDescription('Samsung refrigerator model RF28R7551SR water line valve is dripping underneath.');
      if (appliances.length > 0) setSelectedApplianceId(appliances[0].id);
    } else if (type === 'hazard') {
      setDescription('There are sparks flying and a strong burning electrical odor from behind the control panel.');
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageBase64(null);
    setCurrentInspection(null);
    setPendingProposal(null);
    setApplySuccess(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!imageBase64) {
      setError('Please select or drop an appliance photograph to analyze.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setApplySuccess(null);
      setPendingProposal(null);

      setAnalysisStep('Uploading image securely...');
      await new Promise((r) => setTimeout(r, 400));

      setAnalysisStep('Scanning rating plate and visual evidence...');
      await new Promise((r) => setTimeout(r, 500));

      setAnalysisStep('Running multimodal diagnostic analysis...');

      const res = await api.analyzeInspection({
        imageBase64,
        filename: imageFile?.name || 'appliance_photo.jpg',
        mimeType: imageFile?.type || 'image/jpeg',
        description: description.trim() || undefined,
        applianceId: selectedApplianceId || undefined,
        caseId: initialCaseId || undefined,
      });

      setCurrentInspection(res.data);
    } catch (err: any) {
      setError(err.message || 'Visual analysis failed. Please try again.');
    } finally {
      setLoading(false);
      setAnalysisStep('');
    }
  };

  // Step 1: Request Passport update proposal
  const handleInitiateApply = async () => {
    if (!currentInspection) return;
    try {
      setApplying(true);
      setError(null);
      const res = await api.applyInspection(currentInspection.id, {
        brand: currentInspection.analysis.brand || undefined,
        modelNumber: currentInspection.analysis.modelNumber || undefined,
      });

      if (res.confirmationRequired) {
        setPendingProposal({
          token: res.token,
          details: res.proposal,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to prepare passport update');
    } finally {
      setApplying(false);
    }
  };

  // Step 2: Confirm passport update
  const handleConfirmApply = async () => {
    if (!currentInspection || !pendingProposal) return;
    try {
      setApplying(true);
      setError(null);
      const res = await api.applyInspection(currentInspection.id, {
        confirmationToken: pendingProposal.token,
        brand: pendingProposal.details.newBrand,
        modelNumber: pendingProposal.details.newModel,
      });

      if (res.success) {
        setApplySuccess(`Digital Passport updated! Brand: ${res.data.brand}, Model: ${res.data.model}`);
        setPendingProposal(null);
        if (onApplianceUpdated) {
          onApplianceUpdated(res.data);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm passport update');
    } finally {
      setApplying(false);
    }
  };

  const handleDeleteInspection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inspection and its stored image?')) return;
    try {
      await api.deleteInspection(id);
      if (currentInspection?.id === id) {
        setCurrentInspection(null);
      }
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to delete inspection');
    }
  };

  const handleDiscuss = () => {
    if (!currentInspection) return;
    const a = currentInspection.analysis;
    const summary = `I ran a visual AI inspection for my appliance. Observations: ${a.observations.join(', ')}. Possible causes: ${a.possibleCauses.join(', ')}. Error codes: ${a.visibleErrorCodes.join(', ') || 'None'}. How should I proceed?`;
    onClose();
    if (onDiscussWithAssistant) {
      onDiscussWithAssistant(summary);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FAF8F5] border border-[#E6E4DA] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#183B32] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Camera className="w-5 h-5 text-[#86EFAC]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-white">Multimodal AI Inspection</h3>
                <span className="text-[10px] font-bold bg-[#86EFAC]/20 text-[#86EFAC] border border-[#86EFAC]/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Phase 5
                </span>
              </div>
              <p className="text-xs text-white/75 mt-0.5">
                Analyze rating labels, error code displays, and visible damage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E6E4DA] bg-white px-4 sm:px-6 shrink-0">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 font-semibold text-xs tracking-wide border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-[#183B32] text-[#183B32]'
                : 'border-transparent text-gray-500 hover:text-[#183B32]'
            }`}
          >
            New Inspection
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 font-semibold text-xs tracking-wide border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-[#183B32] text-[#183B32]'
                : 'border-transparent text-gray-500 hover:text-[#183B32]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Saved Inspections
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {applySuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1 font-medium">{applySuccess}</div>
            </div>
          )}

          {activeTab === 'upload' ? (
            <>
              {/* Presets Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium">Quick Test Presets:</span>
                <button
                  type="button"
                  onClick={() => loadDemoSample('e15')}
                  className="px-2.5 py-1 bg-white border border-[#E6E4DA] rounded-lg text-[#183B32] hover:bg-[#F6F4EE] font-medium transition-all"
                >
                  Dishwasher E15 Code
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoSample('leak')}
                  className="px-2.5 py-1 bg-white border border-[#E6E4DA] rounded-lg text-[#183B32] hover:bg-[#F6F4EE] font-medium transition-all"
                >
                  Fridge Water Leak
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoSample('hazard')}
                  className="px-2.5 py-1 bg-red-50 border border-red-200 rounded-lg text-red-700 hover:bg-red-100 font-medium transition-all flex items-center gap-1"
                >
                  <ShieldAlert className="w-3 h-3 text-red-600" />
                  Electrical Sparks Hazard
                </button>
              </div>

              {/* Upload Drop Zone / Preview */}
              {!imagePreviewUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#183B32]/30 hover:border-[#183B32] rounded-2xl p-6 sm:p-8 bg-white/70 hover:bg-white transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="w-14 h-14 rounded-full bg-[#183B32]/10 flex items-center justify-center text-[#183B32]">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#183B32]">
                      Click to browse or drag and drop appliance photograph
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports JPEG, PNG, and WebP (up to 10MB)
                    </p>
                  </div>
                  <div className="text-[11px] text-gray-400 bg-[#F6F4EE] px-3 py-1 rounded-full border border-[#E6E4DA]">
                    EXIF metadata & GPS coordinates are automatically stripped for privacy
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#E6E4DA] p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-32 h-32 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={imagePreviewUrl}
                      alt="Selected preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="font-semibold text-sm text-[#183B32] truncate max-w-xs">
                        {imageFile?.name || 'Selected Photograph'}
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Ready
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : 'Image Loaded'}
                    </p>
                    <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Image
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Context inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#183B32] mb-1">
                    Link to Registered Appliance (Optional)
                  </label>
                  <select
                    value={selectedApplianceId}
                    onChange={(e) => setSelectedApplianceId(e.target.value)}
                    className="w-full bg-white border border-[#E6E4DA] rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#183B32]"
                  >
                    <option value="">-- None (Detect from photograph) --</option>
                    {appliances.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.brand} {app.name} ({app.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#183B32] mb-1">
                    Symptom or Visible Damage Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Flashing E15 code, puddle underneath, hum..."
                    className="w-full bg-white border border-[#E6E4DA] rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#183B32]"
                  />
                </div>
              </div>

              {/* Action Button */}
              {!currentInspection && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading || !imageBase64}
                  className="w-full py-3 bg-[#183B32] hover:bg-[#122E27] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#86EFAC]" />
                      <span>{analysisStep || 'Analyzing visual evidence...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#86EFAC]" />
                      <span>Run Visual AI Diagnostics</span>
                    </>
                  )}
                </button>
              )}

              {/* Inspection Results View */}
              {currentInspection && (
                <div className="space-y-4 pt-2">
                  {/* Safety Hazard Alert */}
                  {currentInspection.analysis.safetyWarnings.length > 0 && (
                    <div className="p-4 rounded-xl bg-red-600 text-white shadow-lg space-y-2 animate-pulse">
                      <div className="flex items-center gap-2 font-bold text-sm tracking-wide uppercase">
                        <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
                        CRITICAL SAFETY ALERT DETECTED
                      </div>
                      <div className="text-xs text-red-50 leading-relaxed space-y-1">
                        {currentInspection.analysis.safetyWarnings.map((warn, i) => (
                          <p key={i}>• {warn}</p>
                        ))}
                      </div>
                      <p className="text-[11px] font-semibold text-yellow-200 mt-2">
                        Do not attempt DIY disassembly while energized or leaking. Contact a certified professional.
                      </p>
                    </div>
                  )}

                  {/* Rating Plate & Identification */}
                  <div className="bg-white border border-[#E6E4DA] rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-[#183B32]" />
                        <h4 className="font-semibold text-xs text-[#183B32] uppercase tracking-wider">
                          Rating Plate & Model Identification
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          currentInspection.analysis.confidence === 'high'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Confidence: {currentInspection.analysis.confidence}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-[#FAF8F5] rounded-lg border border-[#E6E4DA]/60">
                        <span className="text-gray-400 text-[10px] uppercase font-semibold block">Appliance Type</span>
                        <span className="font-semibold text-[#183B32]">{currentInspection.analysis.applianceType || 'Unknown'}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] rounded-lg border border-[#E6E4DA]/60">
                        <span className="text-gray-400 text-[10px] uppercase font-semibold block">Brand</span>
                        <span className="font-semibold text-[#183B32]">{currentInspection.analysis.brand || 'Unidentified'}</span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] rounded-lg border border-[#E6E4DA]/60">
                        <span className="text-gray-400 text-[10px] uppercase font-semibold block">Detected Model</span>
                        <span className="font-mono font-bold text-[#183B32]">
                          {currentInspection.analysis.modelNumber || 'Unverified'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-[#FAF8F5] rounded-lg border border-[#E6E4DA]/60">
                        <span className="text-gray-400 text-[10px] uppercase font-semibold block">Status</span>
                        <span className="font-medium text-gray-700 capitalize">
                          {currentInspection.analysis.modelConfidence}
                        </span>
                      </div>
                    </div>

                    {/* Detected Error Codes */}
                    {currentInspection.analysis.visibleErrorCodes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Display Error Codes:</span>
                        <div className="flex gap-1.5">
                          {currentInspection.analysis.visibleErrorCodes.map((code) => (
                            <span
                              key={code}
                              className="px-2 py-0.5 bg-red-100 text-red-800 font-mono font-bold text-xs rounded border border-red-200"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Two-step passport update section */}
                    {currentInspection.appliance_id && (currentInspection.analysis.modelNumber || currentInspection.analysis.brand) && (
                      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-gray-600">
                          Update Digital Repair Passport with detected brand & model?
                        </div>
                        {!pendingProposal ? (
                          <button
                            type="button"
                            onClick={handleInitiateApply}
                            disabled={applying || Boolean(applySuccess)}
                            className="px-3.5 py-1.5 bg-[#183B32] hover:bg-[#122E27] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                          >
                            {applying ? 'Preparing...' : 'Apply to Passport'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                              Confirm: {pendingProposal.details.newBrand} {pendingProposal.details.newModel}
                            </span>
                            <button
                              type="button"
                              onClick={handleConfirmApply}
                              disabled={applying}
                              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingProposal(null)}
                              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Observations vs Inferred Hypotheses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Observed Visual Findings */}
                    <div className="bg-white border border-[#E6E4DA] rounded-xl p-4 shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#183B32] uppercase mb-2">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        Direct Visual Observations
                      </div>
                      <ul className="text-xs text-gray-700 space-y-1.5">
                        {currentInspection.analysis.observations.map((obs, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{obs}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Inferred Plausible Causes */}
                    <div className="bg-white border border-[#E6E4DA] rounded-xl p-4 shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#183B32] uppercase mb-2">
                        <Search className="w-3.5 h-3.5 text-amber-600" />
                        Inferred Diagnostic Causes
                      </div>
                      <ul className="text-xs text-gray-700 space-y-1.5">
                        {currentInspection.analysis.possibleCauses.map((cause, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{cause}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Next Steps */}
                  <div className="bg-white border border-[#E6E4DA] rounded-xl p-4 shadow-xs">
                    <h4 className="text-xs font-semibold text-[#183B32] uppercase mb-2">
                      Recommended Next Non-Invasive Steps
                    </h4>
                    <ol className="text-xs text-gray-700 space-y-1.5 list-decimal pl-4">
                      {currentInspection.analysis.recommendedNextSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Bottom Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="px-3.5 py-2 border border-[#E6E4DA] text-xs font-medium text-gray-600 hover:text-gray-900 bg-white rounded-xl hover:bg-gray-50 transition-all"
                    >
                      Scan Another Image
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscuss}
                      className="px-4 py-2 bg-[#183B32] hover:bg-[#122E27] text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-2"
                    >
                      <Bot className="w-4 h-4 text-[#86EFAC]" />
                      Discuss with AI Assistant
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#183B32]" />
                  Loading past inspections...
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 bg-white rounded-xl border border-dashed border-[#E6E4DA]">
                  No visual inspections recorded yet. Upload an appliance photo to begin.
                </div>
              ) : (
                history.map((insp) => (
                  <div
                    key={insp.id}
                    className="p-3.5 bg-white border border-[#E6E4DA] rounded-xl flex items-center justify-between gap-3 hover:border-[#183B32]/40 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={api.getInspectionImageUrl(insp.id)}
                          alt={insp.original_filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#183B32] truncate">
                            {insp.original_filename}
                          </span>
                          {insp.has_hazard === 1 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded">
                              Hazard
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {insp.analysis?.observations?.[0] || insp.user_description || 'Visual inspection recorded'}
                        </p>
                        <span className="text-[10px] text-gray-400">
                          {new Date(insp.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentInspection(insp);
                          setActiveTab('upload');
                        }}
                        className="px-2.5 py-1 text-xs bg-[#F6F4EE] hover:bg-[#E6E4DA] text-[#183B32] font-medium rounded-lg transition-colors"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInspection(insp.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
