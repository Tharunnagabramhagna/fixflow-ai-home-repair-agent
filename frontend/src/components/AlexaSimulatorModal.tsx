import React, { useState } from 'react';
import {
  Mic,
  Volume2,
  X,
  Play,
  RotateCcw,
  AlertTriangle,
  Code2,
  Send,
  Radio,
} from 'lucide-react';
import { api } from '../api/client';

interface AlexaSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SamplePreset {
  label: string;
  description: string;
  requestType: 'LaunchRequest' | 'IntentRequest';
  intentName?: string;
  slots?: Record<string, { name: string; value: string }>;
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    label: 'Launch Skill',
    description: '"Alexa, open FixFlow"',
    requestType: 'LaunchRequest',
  },
  {
    label: 'Diagnose Refrigerator',
    description: '"My refrigerator is leaking water"',
    requestType: 'IntentRequest',
    intentName: 'DiagnoseApplianceIntent',
    slots: {
      Appliance: { name: 'Appliance', value: 'refrigerator' },
      Symptom: { name: 'Symptom', value: 'water leak from bottom' },
    },
  },
  {
    label: 'Hazard Alert (Gas Leak)',
    description: '"I smell natural gas near the kitchen stove"',
    requestType: 'IntentRequest',
    intentName: 'DiagnoseApplianceIntent',
    slots: {
      Appliance: { name: 'Appliance', value: 'kitchen stove' },
      Symptom: { name: 'Symptom', value: 'I smell a strong gas leak and hearing hissing' },
    },
  },
  {
    label: 'Check Warranty',
    description: '"Check warranty on my refrigerator"',
    requestType: 'IntentRequest',
    intentName: 'CheckWarrantyIntent',
    slots: {
      Appliance: { name: 'Appliance', value: 'refrigerator' },
    },
  },
  {
    label: 'Check Dispatch Status',
    description: '"Where is my repair technician?"',
    requestType: 'IntentRequest',
    intentName: 'CheckDispatchStatusIntent',
  },
  {
    label: 'Request Repair (Step 1)',
    description: '"File a repair ticket for my refrigerator"',
    requestType: 'IntentRequest',
    intentName: 'RequestRepairIntent',
    slots: {
      Appliance: { name: 'Appliance', value: 'refrigerator' },
      Symptom: { name: 'Symptom', value: 'Compressor clicking and not cooling' },
    },
  },
  {
    label: 'Confirm Proposal (Yes)',
    description: '"Yes, please confirm and schedule"',
    requestType: 'IntentRequest',
    intentName: 'AMAZON.YesIntent',
  },
  {
    label: 'Cancel Proposal (No)',
    description: '"No, cancel request"',
    requestType: 'IntentRequest',
    intentName: 'AMAZON.NoIntent',
  },
  {
    label: 'Ask for Help',
    description: '"Help"',
    requestType: 'IntentRequest',
    intentName: 'AMAZON.HelpIntent',
  },
];

export const AlexaSimulatorModal: React.FC<AlexaSimulatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<SamplePreset>(SAMPLE_PRESETS[0]);
  const [sessionAttributes, setSessionAttributes] = useState<Record<string, any>>({});
  const [sessionId] = useState<string>(() => `amzn1.echo-api.session.${Date.now()}`);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<boolean>(false);
  const [showJson, setShowJson] = useState<boolean>(false);

  // Custom slots state
  const [customAppliance, setCustomAppliance] = useState<string>('refrigerator');
  const [customSymptom, setCustomSymptom] = useState<string>('leaking water');

  if (!isOpen) return null;

  const handleSend = async (preset = selectedPreset) => {
    try {
      setLoading(true);
      setError(null);

      // Build payload envelope
      const timestamp = new Date().toISOString();
      let reqBody: any;

      if (preset.requestType === 'LaunchRequest') {
        reqBody = {
          type: 'LaunchRequest',
          requestId: `amzn1.echo-api.request.${Date.now()}`,
          timestamp,
        };
      } else {
        const slots: Record<string, any> = {};
        if (preset.intentName === 'DiagnoseApplianceIntent' || preset.intentName === 'RequestRepairIntent') {
          slots['Appliance'] = { name: 'Appliance', value: customAppliance };
          slots['Symptom'] = { name: 'Symptom', value: customSymptom };
        } else if (preset.intentName === 'CheckWarrantyIntent') {
          slots['Appliance'] = { name: 'Appliance', value: customAppliance };
        } else if (preset.slots) {
          Object.assign(slots, preset.slots);
        }

        reqBody = {
          type: 'IntentRequest',
          requestId: `amzn1.echo-api.request.${Date.now()}`,
          timestamp,
          intent: {
            name: preset.intentName,
            slots,
          },
        };
      }

      const envelope = {
        version: '1.0',
        session: {
          new: Object.keys(sessionAttributes).length === 0,
          sessionId,
          application: { applicationId: 'amzn1.ask.skill.fixflow-home-repair' },
          attributes: sessionAttributes,
          user: {
            userId: 'amzn1.ask.account.fixflow-demo-user',
          },
        },
        request: reqBody,
      };

      const res = await api.sendAlexaRequest(envelope);
      setResponse(res);

      if (res.sessionAttributes) {
        setSessionAttributes(res.sessionAttributes);
      }
    } catch (err: any) {
      setError(err.message || 'Alexa request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleResetSession = () => {
    setSessionAttributes({});
    setResponse(null);
    setError(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speechOutput = response?.response?.outputSpeech?.text;
  const repromptOutput = response?.response?.reprompt?.outputSpeech?.text;
  const cardTitle = response?.response?.card?.title;
  const shouldEndSession = response?.response?.shouldEndSession;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>Alexa Voice Assistant Simulator</span>
                <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                  Phase 4 Testbed
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Simulate voice utterances and test Alexa Skills Kit responses, verbal confirmation, and dispatch tracking.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Presets Carousel / Grid */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Select Sample Voice Command
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SAMPLE_PRESETS.map((preset) => {
                const isSelected = selectedPreset.label === preset.label;
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setSelectedPreset(preset);
                      if (preset.slots?.Appliance) setCustomAppliance(preset.slots.Appliance.value);
                      if (preset.slots?.Symptom) setCustomSymptom(preset.slots.Symptom.value);
                    }}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-medium shadow-md shadow-blue-500/10'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <p className="font-semibold text-slate-200 truncate">{preset.label}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot customization for Diagnose / Request Repair */}
          {(selectedPreset.intentName === 'DiagnoseApplianceIntent' ||
            selectedPreset.intentName === 'RequestRepairIntent' ||
            selectedPreset.intentName === 'CheckWarrantyIntent') && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-medium text-slate-300 block">Customize Slot Values:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Appliance Slot:</label>
                  <input
                    type="text"
                    value={customAppliance}
                    onChange={(e) => setCustomAppliance(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. refrigerator, dishwasher, washer"
                  />
                </div>
                {selectedPreset.intentName !== 'CheckWarrantyIntent' && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Symptom Slot:</label>
                    <input
                      type="text"
                      value={customSymptom}
                      onChange={(e) => setCustomSymptom(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      placeholder="e.g. leaking water, humming sound, not heating"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Trigger Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleResetSession}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800/80 rounded-lg hover:bg-slate-800 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Alexa Session</span>
            </button>

            <button
              onClick={() => handleSend(selectedPreset)}
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <Radio className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Send Alexa Utterance</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Spoken Output Speech Presentation */}
          {response && (
            <div className="bg-slate-950 p-5 rounded-2xl border border-blue-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Volume2 className={`w-4 h-4 ${speaking ? 'animate-bounce text-emerald-400' : ''}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Alexa Spoken Response
                    </h4>
                    {cardTitle && <p className="text-[11px] text-slate-400">{cardTitle}</p>}
                  </div>
                </div>

                {speechOutput && (
                  <button
                    onClick={() => handleSpeakSpeech(speechOutput)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                      speaking
                        ? 'bg-emerald-600 text-white animate-pulse'
                        : 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{speaking ? 'Speaking...' : 'Play Audio'}</span>
                  </button>
                )}
              </div>

              {/* Spoken Text Bubble */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-100 font-medium leading-relaxed">
                "{speechOutput || 'No speech output returned.'}"
              </div>

              {repromptOutput && (
                <div className="text-xs text-slate-400 pl-2 border-l-2 border-indigo-500">
                  <span className="font-semibold text-slate-300">Reprompt:</span> "{repromptOutput}"
                </div>
              )}

              {/* Active Session Attributes / Confirmation token */}
              {sessionAttributes && Object.keys(sessionAttributes).length > 0 && (
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400 font-semibold mb-1">
                    <span>Active Session Attributes:</span>
                    {sessionAttributes.pendingConfirmation && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 text-[10px]">
                        Pending Verbal Confirmation (Say "Yes")
                      </span>
                    )}
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-24">
                    {JSON.stringify(sessionAttributes, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500 border-t border-slate-800/60">
                <span>
                  Session Status: {shouldEndSession ? 'Ended (Goodbye)' : 'Open / Listening'}
                </span>
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="hover:text-slate-300 flex items-center space-x-1"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showJson ? 'Hide Raw JSON' : 'View ASK JSON Envelope'}</span>
                </button>
              </div>

              {showJson && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48">
                  <pre>{JSON.stringify(response, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
