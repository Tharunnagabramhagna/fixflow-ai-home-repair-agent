import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Flame,
  Shield,
  RotateCcw,
  Maximize2,
  Minimize2,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  Appliance,
  AssistantChatMessage,
  AssistantPendingConfirmation,
} from '../types';

interface AssistantPanelProps {
  appliances: Appliance[];
  onOpenReportModal?: (suggestedText?: string) => void;
  onNavigateTab?: (tab: string) => void;
  onViewPassport?: (appliance: Appliance) => void;
  onRefreshData?: () => void;
  initialApplianceContext?: Appliance | null;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  appliances,
  onOpenReportModal: _onOpenReportModal,
  onNavigateTab: _onNavigateTab,
  onViewPassport: _onViewPassport,
  onRefreshData,
  initialApplianceContext,
}) => {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        "Hello! I'm FixFlow's AI Repair Assistant. Describe any appliance symptoms, strange noises, leaks, or errors, and I can check warranties, review Digital Repair Passports, guide you through safe step-by-step troubleshooting, or prepare a verified repair ticket.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingToken, setConfirmingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedApplianceId, setSelectedApplianceId] = useState<string>(
    initialApplianceContext?.id || ''
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setError(null);
    const userMessage: AssistantChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Send conversation history to backend (filtering to role and content)
      const payloadMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.sendAssistantMessage(
        payloadMessages,
        selectedApplianceId || undefined
      );

      const assistantMsg: AssistantChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.message.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        safetyAlert: res.safetyAlert || null,
        toolsUsed: res.toolsUsed || [],
        pendingConfirmation: res.pendingConfirmation || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[Assistant Client Error]', err);
      setError(err.message || 'Unable to communicate with the assistant service.');
      const fallbackMsg: AssistantChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          "I encountered a temporary connection issue. Please verify your network connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (
    pending: AssistantPendingConfirmation,
    messageId: string
  ) => {
    setConfirmingToken(pending.token);
    setError(null);

    try {
      await api.confirmAssistantAction(
        pending.token,
        pending.action,
        pending.proposal
      );

      // Mark the message proposal as confirmed
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              confirmed: true,
              pendingConfirmation: null,
            };
          }
          return m;
        })
      );

      // Add a confirmed celebration message
      const successMsg: AssistantChatMessage = {
        id: `conf-${Date.now()}`,
        role: 'assistant',
        content: `🎉 **Repair Case Confirmed & Created!**\n\nYour repair ticket for **${
          pending.proposal.appliance_name || 'your appliance'
        }** has been submitted to the queue. You can review and track updates in **Repair Cases**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, successMsg]);

      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      console.error('[Confirm Action Error]', err);
      setError(err.message || 'Failed to confirm action. The proposal may have expired.');
    } finally {
      setConfirmingToken(null);
    }
  };

  const handleCancelConfirmation = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            pendingConfirmation: null,
          };
        }
        return m;
      })
    );

    const cancelMsg: AssistantChatMessage = {
      id: `cancel-${Date.now()}`,
      role: 'assistant',
      content: 'Action cancelled. No repair cases or notes were created.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content:
          "Conversation cleared. How can I help you with your household appliances today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setError(null);
  };

  const suggestionChips = [
    { label: 'Check warranty on fridge', prompt: 'Is my Samsung refrigerator under warranty?' },
    { label: 'Dishwasher not draining', prompt: 'My dishwasher is leaving standing water in the bottom.' },
    { label: 'Washer thumping loudly', prompt: 'Front load washer makes a loud thumping noise during spin cycle.' },
    { label: 'Smell gas or burning', prompt: 'There is a burning smell and smoke near the microwave.' },
  ];

  return (
    <div
      className={`bg-[#EEF4EE] rounded-3xl border border-[#DDE7DD] shadow-xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
        isExpanded
          ? 'fixed inset-4 sm:inset-8 z-50 bg-[#F6F8F6] shadow-2xl border-[#183B32]/30 flex flex-col'
          : 'p-4 sm:p-5 h-[620px]'
      }`}
    >
      {/* Decorative background element */}
      <svg
        className="absolute top-0 right-0 w-36 h-36 pointer-events-none opacity-30 text-[#9EBA9E]"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <path d="M100 15 C 80 15, 70 35, 95 60 C 105 70, 75 90, 60 100" />
        <circle cx="70" cy="35" r="2.5" fill="currentColor" />
        <circle cx="95" cy="60" r="2" fill="currentColor" />
      </svg>

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-[#DDE7DD]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#DDE7DD] flex items-center justify-center text-[#183B32] shrink-0 shadow-2xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-[#183B32] tracking-tight">
                FixFlow AI Repair Assistant
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#D7E3D7] text-[#183B32]">
                <Sparkles className="w-2.5 h-2.5 text-[#B49A68]" />
                MCP
              </span>
            </div>
            <p className="text-[11px] text-[#687871]">
              Conversational troubleshooting & verified diagnostics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearChat}
            title="Reset conversation"
            className="p-1.5 text-[#687871] hover:text-[#183B32] hover:bg-white/60 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand full view'}
            className="p-1.5 text-[#687871] hover:text-[#183B32] hover:bg-white/60 rounded-lg transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Appliance Context Filter Selector */}
      {appliances.length > 0 && (
        <div className="relative z-10 py-2 border-b border-[#DDE7DD]/70 flex items-center gap-2 text-xs text-[#687871]">
          <span className="shrink-0 font-medium text-[11px] text-[#24342F]">Context Appliance:</span>
          <select
            value={selectedApplianceId}
            onChange={(e) => setSelectedApplianceId(e.target.value)}
            className="text-xs bg-white/80 border border-[#DDE7DD] rounded-lg px-2 py-1 text-[#24342F] focus:outline-none focus:ring-1 focus:ring-[#183B32] truncate"
          >
            <option value="">All registered appliances</option>
            {appliances.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.brand} {app.model})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages Stream */}
      <div className="relative z-10 flex-1 overflow-y-auto py-3 space-y-3.5 pr-1 text-xs">
        {messages.map((m) => {
          const isUser = m.role === 'user';

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-2xs leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-[#183B32] text-white rounded-br-xs'
                    : 'bg-white text-[#24342F] border border-[#E6E4DA] rounded-bl-xs'
                }`}
              >
                {/* Critical Safety Alert Banner inside assistant message */}
                {m.safetyAlert && (
                  <div className="mb-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1 animate-pulse">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-red-700">
                      <Flame className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{m.safetyAlert.title}</span>
                    </div>
                    <p className="text-[11px] leading-snug">{m.safetyAlert.message}</p>
                    <div className="mt-1 pt-1 border-t border-red-200/80 font-semibold text-[11px] text-red-800">
                      ⚠️ Action: {m.safetyAlert.actionRequired}
                    </div>
                  </div>
                )}

                {/* Body Text */}
                <div className="prose prose-xs max-w-none text-inherit leading-relaxed font-normal">
                  {m.content}
                </div>

                {/* Tool Activity Indicators */}
                {m.toolsUsed && m.toolsUsed.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#E6E4DA]/60 space-y-1">
                    <span className="text-[10px] font-semibold text-[#687871] block uppercase tracking-wider">
                      Verified MCP Tool Actions
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {m.toolsUsed.map((t, idx) => {
                        let label = t.tool.replace(/_/g, ' ');
                        let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        if (t.status === 'confirmation_required') {
                          badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                          label += ' (pending confirmation)';
                        } else if (t.status === 'error') {
                          badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
                          label += ' (access error)';
                        }
                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeColor}`}
                          >
                            <Shield className="w-3 h-3 shrink-0" />
                            <span className="capitalize">{label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pending Proposal Confirmation Card */}
                {m.pendingConfirmation && (
                  <div className="mt-3 p-3.5 rounded-xl bg-[#F6F4EE] border border-[#B49A68]/40 shadow-xs space-y-2 text-[#24342F]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#183B32] uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-[#B49A68]" />
                        Confirmation Required
                      </span>
                      <span className="text-[10px] text-[#687871] font-mono">
                        Single-Use Token
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p>
                        <strong className="text-[#183B32]">Appliance:</strong>{' '}
                        {m.pendingConfirmation.proposal.appliance_name || 'Selected Equipment'}
                      </p>
                      <p>
                        <strong className="text-[#183B32]">Reported Fault:</strong>{' '}
                        {m.pendingConfirmation.proposal.issue_description}
                      </p>
                      <p>
                        <strong className="text-[#183B32]">Priority:</strong>{' '}
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#183B32]/10 text-[#183B32]">
                          {m.pendingConfirmation.proposal.priority || 'Medium'}
                        </span>
                      </p>
                    </div>

                    <p className="text-[11px] text-[#687871] italic">
                      This consequential action requires your approval. Click below to submit:
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmAction(m.pendingConfirmation!, m.id)
                        }
                        disabled={confirmingToken === m.pendingConfirmation.token}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#183B32] hover:bg-[#102D27] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                      >
                        {confirmingToken === m.pendingConfirmation.token ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Confirming...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm & Submit Ticket</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancelConfirmation(m.id)}
                        disabled={confirmingToken === m.pendingConfirmation.token}
                        className="py-1.5 px-3 bg-white hover:bg-slate-50 text-[#687871] hover:text-[#24342F] border border-[#E6E4DA] rounded-lg text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[9px] text-[#8C9B93] mt-1 px-1">
                {m.timestamp}
              </span>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#687871] bg-white border border-[#E6E4DA] rounded-2xl px-3.5 py-2.5 w-max">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#183B32]" />
            <span>Consulting MCP diagnostic tools & analyzing symptoms...</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => handleSend()}
              className="text-xs font-bold underline hover:text-red-900 ml-2"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 3 && !loading && (
        <div className="relative z-10 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(chip.prompt)}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-[#F6F4EE] border border-[#DDE7DD] text-[11px] font-medium text-[#24342F] transition-all hover:border-[#183B32]/40 shadow-2xs"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="relative z-10 pt-2 border-t border-[#DDE7DD]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe an appliance problem, ask for warranty, or request repair..."
            disabled={loading}
            className="flex-1 bg-white border border-[#DDE7DD] rounded-xl px-3.5 py-2.5 text-xs text-[#24342F] placeholder:text-[#8C9B93] focus:outline-none focus:ring-1 focus:ring-[#183B32] shadow-xs disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="p-2.5 rounded-xl bg-[#183B32] hover:bg-[#102D27] text-white shadow-xs transition-all disabled:opacity-40 active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
