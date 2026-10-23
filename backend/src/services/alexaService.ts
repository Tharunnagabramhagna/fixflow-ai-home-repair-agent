import { Database as DatabaseType } from 'better-sqlite3';
import crypto from 'crypto';
import db from '../db/database';
import * as applianceService from './applianceService';
import * as repairService from './repairService';
import { dispatchService } from './dispatchService';
import { confirmationManager } from './confirmationManager';
import { detectSafetyHazard } from './llmService';

export interface AlexaSlot {
  name: string;
  value?: string;
  resolutions?: any;
}

export interface AlexaRequestEnvelope {
  version: string;
  session?: {
    new: boolean;
    sessionId: string;
    application: { applicationId: string };
    attributes?: Record<string, any>;
    user: {
      userId: string;
      accessToken?: string;
    };
  };
  context?: any;
  request: {
    type: 'LaunchRequest' | 'IntentRequest' | 'SessionEndedRequest';
    requestId: string;
    timestamp: string;
    locale?: string;
    reason?: string;
    intent?: {
      name: string;
      confirmationStatus?: string;
      slots?: Record<string, AlexaSlot>;
    };
  };
}

export interface AlexaResponseEnvelope {
  version: '1.0';
  sessionAttributes?: Record<string, any>;
  response: {
    outputSpeech?: {
      type: 'PlainText' | 'SSML';
      text?: string;
      ssml?: string;
    };
    card?: {
      type: 'Simple' | 'Standard' | 'LinkAccount';
      title?: string;
      content?: string;
    };
    reprompt?: {
      outputSpeech: {
        type: 'PlainText' | 'SSML';
        text?: string;
        ssml?: string;
      };
    };
    shouldEndSession: boolean;
  };
}

export class AlexaService {
  /**
   * Resolve authenticated user from Alexa session accessToken
   */
  resolveUser(
    sessionUser?: { userId: string; accessToken?: string },
    targetDb?: DatabaseType
  ): { id: string | null; name: string; isGuest: boolean } {
    const activeDb = targetDb || db;

    if (sessionUser?.accessToken) {
      const tokenHash = crypto.createHash('sha256').update(sessionUser.accessToken).digest('hex');
      const session = activeDb
        .prepare("SELECT * FROM user_sessions WHERE token_hash = ? AND expires_at > datetime('now')")
        .get(tokenHash) as any;

      if (session) {
        return {
          id: session.user_id,
          name: session.user_name,
          isGuest: false,
        };
      }
    }

    // Default to sample demo context for guests
    return {
      id: 'sample',
      name: 'Guest User',
      isGuest: true,
    };
  }

  /**
   * Helper to format Alexa JSON response
   */
  buildResponse(options: {
    speech: string;
    reprompt?: string;
    shouldEndSession?: boolean;
    sessionAttributes?: Record<string, any>;
    cardTitle?: string;
    linkAccount?: boolean;
  }): AlexaResponseEnvelope {
    const response: AlexaResponseEnvelope['response'] = {
      outputSpeech: {
        type: 'PlainText',
        text: options.speech,
      },
      shouldEndSession: options.shouldEndSession ?? false,
    };

    if (options.reprompt) {
      response.reprompt = {
        outputSpeech: {
          type: 'PlainText',
          text: options.reprompt,
        },
      };
    }

    if (options.linkAccount) {
      response.card = {
        type: 'LinkAccount',
      };
    } else if (options.cardTitle) {
      response.card = {
        type: 'Simple',
        title: options.cardTitle,
        content: options.speech,
      };
    }

    return {
      version: '1.0',
      sessionAttributes: options.sessionAttributes || {},
      response,
    };
  }

  /**
   * Main entry point to process incoming Alexa requests
   */
  async handleRequest(
    envelope: AlexaRequestEnvelope,
    targetDb?: DatabaseType
  ): Promise<AlexaResponseEnvelope> {
    const activeDb = targetDb || db;
    const reqType = envelope.request.type;
    const sessionAttrs = { ...(envelope.session?.attributes || {}) };
    const user = this.resolveUser(envelope.session?.user, activeDb);

    switch (reqType) {
      case 'LaunchRequest': {
        return this.buildResponse({
          speech:
            "Welcome to FixFlow Home Repair Assistant. You can describe an appliance problem, check warranty status, review open repair cases, or track your contractor dispatch. What can I help you with?",
          reprompt: "You can say: 'What is wrong with my refrigerator?' or 'Check my dishwasher warranty'.",
          shouldEndSession: false,
          sessionAttributes: sessionAttrs,
          cardTitle: 'FixFlow Home Repair Assistant',
        });
      }

      case 'SessionEndedRequest': {
        return this.buildResponse({
          speech: '',
          shouldEndSession: true,
        });
      }

      case 'IntentRequest': {
        const intentName = envelope.request.intent?.name || '';
        const slots = envelope.request.intent?.slots || {};

        return this.handleIntent(intentName, slots, sessionAttrs, user, activeDb);
      }

      default:
        return this.buildResponse({
          speech: "I received an unsupported request type. How else may I assist you with your home appliances?",
          shouldEndSession: false,
        });
    }
  }

  private async handleIntent(
    intentName: string,
    slots: Record<string, AlexaSlot>,
    sessionAttrs: Record<string, any>,
    user: { id: string | null; name: string; isGuest: boolean },
    activeDb: DatabaseType
  ): Promise<AlexaResponseEnvelope> {
    switch (intentName) {
      // 1. Diagnose problem
      case 'DiagnoseApplianceIntent': {
        const applianceSlot = slots['Appliance']?.value || '';
        const symptomSlot = slots['Symptom']?.value || '';

        const fullUtterance = `${applianceSlot} ${symptomSlot}`.trim();

        // Safety check first
        const hazard = detectSafetyHazard(fullUtterance);
        if (hazard) {
          const warningText = hazard.actionRequired || hazard.message || 'Please turn off the circuit breaker or evacuate immediately if gas is present. Do not attempt DIY repair.';
          return this.buildResponse({
            speech: `CRITICAL SAFETY ALERT: ${warningText}`,
            reprompt: 'Are you in a safe location now?',
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
            cardTitle: `CRITICAL HAZARD: ${hazard.title}`,
          });
        }

        // Missing slots check
        if (!applianceSlot && !symptomSlot) {
          return this.buildResponse({
            speech: "Which appliance is having a problem, and what symptoms or sounds are you noticing?",
            reprompt: "For example, you can say: 'My Samsung refrigerator is leaking water'.",
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        if (!symptomSlot) {
          return this.buildResponse({
            speech: `What seems to be the issue with your ${applianceSlot}? Is it making a sound, leaking, or failing to turn on?`,
            reprompt: `Please tell me what symptoms your ${applianceSlot} is showing.`,
            shouldEndSession: false,
            sessionAttributes: { ...sessionAttrs, pendingAppliance: applianceSlot },
          });
        }

        // Return voice-optimized diagnosis
        let spokenGuidance = '';
        const lowerSymptom = symptomSlot.toLowerCase();
        if (lowerSymptom.includes('leak') || lowerSymptom.includes('water')) {
          spokenGuidance = `For a water leak in your ${applianceSlot}, first inspect the water supply valve and the drain hose for cracks or loose fittings. If the leak persists, avoid running the appliance and consider filing a repair case.`;
        } else if (lowerSymptom.includes('noise') || lowerSymptom.includes('buzz') || lowerSymptom.includes('hum')) {
          spokenGuidance = `An unusual humming or buzzing noise in your ${applianceSlot} is frequently caused by a vibrating fan motor, loose mounting bracket, or debris near the compressor. Ensure the unit is level.`;
        } else if (lowerSymptom.includes('cool') || lowerSymptom.includes('frost') || lowerSymptom.includes('freeze')) {
          spokenGuidance = `If your ${applianceSlot} is not cooling properly, check if the condenser coils are dusty and ensure the vents inside are not blocked by food containers.`;
        } else {
          spokenGuidance = `I noted the issue with your ${applianceSlot}: ${symptomSlot}. Check power connections and ensure filters are clean. Would you like me to prepare a repair ticket?`;
        }

        return this.buildResponse({
          speech: `${spokenGuidance} Would you like me to prepare a repair ticket for this?`,
          reprompt: "Say 'yes' to file a repair ticket, or 'check warranty' to look up coverage.",
          shouldEndSession: false,
          sessionAttributes: {
            ...sessionAttrs,
            lastDiagnosedAppliance: applianceSlot,
            lastSymptom: symptomSlot,
          },
          cardTitle: `Diagnosis for ${applianceSlot}`,
        });
      }

      // 2. Check warranty
      case 'CheckWarrantyIntent': {
        const applianceSlot = slots['Appliance']?.value || sessionAttrs['lastDiagnosedAppliance'] || '';
        const allAppliances = applianceService.getAllAppliances(user.id, activeDb);
        let appliances = allAppliances;
        if (applianceSlot) {
          const q = applianceSlot.toLowerCase();
          const filtered = allAppliances.filter(
            (a) =>
              a.name.toLowerCase().includes(q) ||
              a.brand.toLowerCase().includes(q) ||
              a.model.toLowerCase().includes(q) ||
              a.category.toLowerCase().includes(q)
          );
          if (filtered.length > 0) {
            appliances = filtered;
          }
        }

        if (appliances.length === 0) {
          return this.buildResponse({
            speech: `I could not find an appliance matching ${applianceSlot || 'your request'} in your inventory. You can say 'list my appliances' to review registered equipment.`,
            reprompt: 'Which appliance warranty would you like me to check?',
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        const app = appliances[0];
        if (!app.warranty_expiration) {
          return this.buildResponse({
            speech: `Your ${app.brand} ${app.name} has no warranty expiration date recorded in its Digital Repair Passport.`,
            reprompt: 'Would you like to check another appliance?',
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        const expDate = new Date(app.warranty_expiration);
        const now = new Date();
        const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isCovered = diffDays > 0;

        let warrantySpeech = '';
        if (isCovered) {
          warrantySpeech = `Good news! Your ${app.brand} ${app.name} is currently under warranty until ${app.warranty_expiration}, with ${diffDays} days of coverage remaining.`;
        } else {
          warrantySpeech = `Your ${app.brand} ${app.name} warranty expired on ${app.warranty_expiration}. Repairs may require out-of-pocket coverage.`;
        }

        return this.buildResponse({
          speech: `${warrantySpeech} Would you like me to initiate a repair request or check contractor dispatch?`,
          reprompt: 'How would you like to proceed?',
          shouldEndSession: false,
          sessionAttributes: { ...sessionAttrs, lastApplianceId: app.id },
          cardTitle: `Warranty Status: ${app.name}`,
        });
      }

      // 3. Review open repair cases
      case 'ReviewCaseIntent':
      case 'GetCaseStatusIntent': {
        const cases = repairService.getAllRepairCases({ user_id: user.id }, activeDb);
        if (cases.length === 0) {
          return this.buildResponse({
            speech: "You currently have no open repair cases on file. Would you like to diagnose an appliance or report a new issue?",
            reprompt: "You can say: 'Diagnose my washer' or 'Help'.",
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        const latest = cases[0];
        let caseSpeech = `Your latest repair case for the ${latest.appliance_name} is currently in status: ${latest.status}. `;
        if (latest.appointment_date) {
          caseSpeech += `A service appointment is scheduled for ${latest.appointment_date}. `;
        }
        caseSpeech += `Reported issue: ${latest.issue_description.substring(0, 100)}.`;

        return this.buildResponse({
          speech: `${caseSpeech} Would you like to check contractor dispatch status for this case?`,
          reprompt: "Say 'check dispatch' to track your technician, or 'help' for options.",
          shouldEndSession: false,
          sessionAttributes: { ...sessionAttrs, lastCaseId: latest.id },
          cardTitle: `Case Status: ${latest.appliance_name}`,
        });
      }

      // 4. Check contractor dispatch status
      case 'CheckDispatchStatusIntent': {
        let caseId = slots['CaseNumber']?.value || sessionAttrs['lastCaseId'];

        if (!caseId) {
          const cases = repairService.getAllRepairCases({ user_id: user.id }, activeDb);
          if (cases.length > 0) {
            caseId = cases[0].id;
          }
        }

        if (!caseId) {
          return this.buildResponse({
            speech: "You do not have any active repair cases with contractor dispatch scheduled. Would you like to report an appliance issue first?",
            reprompt: "Say 'Diagnose my refrigerator' to begin.",
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        const dispatch = dispatchService.getDispatchByCaseId(caseId, user.id, activeDb);
        if (!dispatch) {
          return this.buildResponse({
            speech: "A contractor dispatch has not been assigned for this repair case yet. Would you like me to request a technician dispatch now?",
            reprompt: "Say yes to request a dispatch, or no to cancel.",
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        let dispatchSpeech = '';
        switch (dispatch.status) {
          case 'pending':
            dispatchSpeech = `Your contractor dispatch request is pending assignment with ${dispatch.company_name}. A technician will be assigned shortly.`;
            break;
          case 'dispatched':
            dispatchSpeech = `Technician ${dispatch.contractor_name} from ${dispatch.company_name} has been dispatched. Estimated arrival time is ${dispatch.estimated_arrival_minutes || 25} minutes.`;
            break;
          case 'en_route':
            dispatchSpeech = `Technician ${dispatch.contractor_name} is currently en route in a ${dispatch.vehicle_info || 'service vehicle'}. Estimated arrival is ${dispatch.estimated_arrival_minutes || 15} minutes.`;
            break;
          case 'arrived':
            dispatchSpeech = `Technician ${dispatch.contractor_name} has arrived at your property and is currently conducting the repair inspection.`;
            break;
          case 'completed':
            dispatchSpeech = `Technician ${dispatch.contractor_name} completed the service visit. The repair case is marked resolved.`;
            break;
          case 'cancelled':
            dispatchSpeech = `The contractor dispatch for this repair case was cancelled.`;
            break;
        }

        return this.buildResponse({
          speech: `${dispatchSpeech} Can I help you with anything else?`,
          reprompt: "You can ask for another case status or say 'exit'.",
          shouldEndSession: false,
          sessionAttributes: { ...sessionAttrs, lastCaseId: caseId },
          cardTitle: `Dispatch Status: ${dispatch.status.toUpperCase()}`,
        });
      }

      // 5. Request repair with Two-Step Confirmation Proposal
      case 'RequestRepairIntent': {
        const applianceSlot = slots['Appliance']?.value || sessionAttrs['lastDiagnosedAppliance'] || '';
        const symptomSlot = slots['Symptom']?.value || sessionAttrs['lastSymptom'] || 'Needs maintenance check';

        // Find appliance
        const allAppliances = applianceService.getAllAppliances(user.id, activeDb);
        let appliances = allAppliances;
        if (applianceSlot) {
          const q = applianceSlot.toLowerCase();
          const filtered = allAppliances.filter(
            (a) =>
              a.name.toLowerCase().includes(q) ||
              a.brand.toLowerCase().includes(q) ||
              a.model.toLowerCase().includes(q) ||
              a.category.toLowerCase().includes(q)
          );
          if (filtered.length > 0) {
            appliances = filtered;
          }
        }

        if (appliances.length === 0) {
          return this.buildResponse({
            speech: `I couldn't locate an appliance matching ${applianceSlot || 'your request'}. Please specify which appliance needs repair.`,
            reprompt: 'Which appliance needs a repair ticket?',
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        const targetAppliance = appliances[0];
        const issueDesc = symptomSlot.length >= 10 ? symptomSlot : `${symptomSlot} — reported via Alexa voice assistant`;

        // Create 2-step confirmation proposal
        const proposal = confirmationManager.createProposal({
          action: 'create_repair_case',
          userId: user.id || 'sample',
          applianceId: targetAppliance.id,
          arguments: {
            appliance_id: targetAppliance.id,
            issue_description: issueDesc,
            priority: 'medium',
            appointment_date: null,
            appointment_notes: 'Created via Alexa voice command',
          },
          details: {
            applianceName: targetAppliance.name,
            brand: targetAppliance.brand,
            issue: issueDesc,
          },
        });

        // Store proposal in session attributes
        const newAttrs = {
          ...sessionAttrs,
          pendingConfirmation: {
            token: proposal.token,
            action: 'create_repair_case',
            applianceId: targetAppliance.id,
            issueDescription: issueDesc,
            applianceName: targetAppliance.name,
          },
        };

        return this.buildResponse({
          speech: `I have prepared a repair ticket for your ${targetAppliance.brand} ${targetAppliance.name} regarding: ${symptomSlot}. Would you like me to confirm and schedule this now?`,
          reprompt: "Please say 'yes' to submit the repair ticket, or 'no' to cancel.",
          shouldEndSession: false,
          sessionAttributes: newAttrs,
          cardTitle: `Confirm Repair: ${targetAppliance.name}`,
        });
      }

      // 6. Explicit User Confirmation (Yes)
      case 'AMAZON.YesIntent': {
        const pending = sessionAttrs['pendingConfirmation'];
        if (!pending || !pending.token) {
          // Check if user was previously prompted for dispatch
          return this.buildResponse({
            speech: "I don't have any pending repair tickets or dispatch requests waiting for confirmation. What would you like to do?",
            reprompt: "You can say: 'Diagnose my washer' or 'Check my refrigerator warranty'.",
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        // Verify and consume single-use token
        const verification = confirmationManager.verifyAndConsume({
          token: pending.token,
          action: 'create_repair_case',
          userId: user.id || 'sample',
          applianceId: pending.applianceId,
          arguments: {
            appliance_id: pending.applianceId,
            issue_description: pending.issueDescription,
            priority: 'medium',
            appointment_date: null,
            appointment_notes: 'Created via Alexa voice command',
          },
        });

        if (!verification.valid) {
          delete sessionAttrs['pendingConfirmation'];
          return this.buildResponse({
            speech: "That confirmation request has expired or was already completed. Please submit the repair request again if you still need assistance.",
            reprompt: "Would you like to try again?",
            shouldEndSession: false,
            sessionAttributes: sessionAttrs,
          });
        }

        // Execute case creation
        const createdCase = repairService.createRepairCase(
          {
            appliance_id: pending.applianceId,
            issue_description: pending.issueDescription,
            priority: 'medium',
          },
          user.id || 'sample',
          activeDb
        );

        // Auto-queue simulated contractor dispatch
        let dispatch: any = null;
        try {
          dispatch = dispatchService.initiateDispatch(
            createdCase.id,
            user.id || 'sample',
            'Initiated via Alexa Voice Assistant',
            activeDb
          );
        } catch {}

        delete sessionAttrs['pendingConfirmation'];
        sessionAttrs['lastCaseId'] = createdCase.id;

        const contractorInfo = dispatch ? `A simulated technician from ${dispatch.company_name} has been queued.` : '';

        return this.buildResponse({
          speech: `Your repair case for the ${pending.applianceName} has been confirmed and submitted. ${contractorInfo} You can track the dispatch status anytime by asking FixFlow.`,
          reprompt: "Can I assist you with anything else today?",
          shouldEndSession: false,
          sessionAttributes: sessionAttrs,
          cardTitle: 'Repair Ticket Confirmed',
        });
      }

      // 7. Explicit User Rejection (No)
      case 'AMAZON.NoIntent': {
        delete sessionAttrs['pendingConfirmation'];
        return this.buildResponse({
          speech: "Understood. The request has been cancelled. What else can I help you with?",
          reprompt: "You can ask for appliance diagnosis, warranty checks, or say 'exit'.",
          shouldEndSession: false,
          sessionAttributes: sessionAttrs,
        });
      }

      // 8. Help
      case 'AMAZON.HelpIntent': {
        return this.buildResponse({
          speech:
            "With FixFlow, you can say: 'Diagnose my refrigerator', 'Check warranty on my dishwasher', 'What is the status of my repair case?', or 'Check contractor dispatch'. What would you like to do?",
          reprompt: "How can FixFlow assist you?",
          shouldEndSession: false,
          sessionAttributes: sessionAttrs,
        });
      }

      // 9. Stop / Cancel
      case 'AMAZON.StopIntent':
      case 'AMAZON.CancelIntent': {
        return this.buildResponse({
          speech: "Thank you for using FixFlow Home Repair Assistant. Goodbye!",
          shouldEndSession: true,
        });
      }

      // 10. Fallback
      case 'AMAZON.FallbackIntent':
      default: {
        return this.buildResponse({
          speech:
            "I'm not sure how to help with that. You can ask me to diagnose an appliance, check warranty status, or track your contractor dispatch. What would you like to do?",
          reprompt: "You can say: 'Help' for a list of available voice commands.",
          shouldEndSession: false,
          sessionAttributes: sessionAttrs,
        });
      }
    }
  }
}

export const alexaService = new AlexaService();
