import { Database as DatabaseType } from 'better-sqlite3';
import db from '../db/database';
import * as applianceService from './applianceService';
import * as repairService from './repairService';
import { dispatchService } from './dispatchService';
import { confirmationManager } from './confirmationManager';
import { detectSafetyHazard } from './llmService';
import { hashToken } from './authService';

export interface AlexaPlusUserContext {
  userId: string | null;
  userName: string;
  isGuest: boolean;
}

export interface AlexaPlusRequestPayload {
  header: {
    namespace: string;
    name: string;
    messageId: string;
    payloadVersion: string;
  };
  payload: Record<string, any>;
}

export interface AlexaPlusResponsePayload {
  header: {
    namespace: string;
    name: string;
    messageId: string;
    payloadVersion: string;
  };
  payload: Record<string, any>;
}

export class AlexaPlusAdapter {
  /**
   * Resolve user context from Authorization header Bearer token
   */
  resolveUser(authHeader?: string, targetDb?: DatabaseType): AlexaPlusUserContext {
    const activeDb = targetDb || db;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { userId: null, userName: 'Guest User', isGuest: true };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return { userId: null, userName: 'Guest User', isGuest: true };
    }

    const tokenHash = hashToken(token);
    const session = activeDb
      .prepare("SELECT * FROM user_sessions WHERE token_hash = ? AND expires_at > datetime('now')")
      .get(tokenHash) as any;

    if (session) {
      return {
        userId: session.user_id,
        userName: session.user_name || 'Homeowner',
        isGuest: false,
      };
    }

    return { userId: null, userName: 'Guest User', isGuest: true };
  }

  /**
   * Main router for com.amazon.alexa.homeservices.v1 SPI requests
   */
  async handleOperation(
    request: AlexaPlusRequestPayload,
    userContext: AlexaPlusUserContext,
    targetDb?: DatabaseType
  ): Promise<AlexaPlusResponsePayload> {
    const activeDb = targetDb || db;
    const { namespace, name, messageId } = request.header;

    if (namespace !== 'com.amazon.alexa.homeservices.v1') {
      return this.buildErrorResponse(
        messageId,
        'INVALID_NAMESPACE',
        `Unsupported namespace: ${namespace}. Expected com.amazon.alexa.homeservices.v1`
      );
    }

    switch (name) {
      case 'Discover':
        return this.handleDiscover(messageId);

      case 'GetDiagnostics':
        return this.handleGetDiagnostics(messageId, request.payload, userContext, activeDb);

      case 'CheckAvailability':
        return this.handleCheckAvailability(messageId, request.payload);

      case 'CreateBooking':
        return this.handleCreateBooking(messageId, request.payload, userContext, activeDb);

      case 'GetBookingStatus':
        return this.handleGetBookingStatus(messageId, request.payload, userContext, activeDb);

      case 'CancelBooking':
        return this.handleCancelBooking(messageId, request.payload, userContext, activeDb);

      default:
        return this.buildErrorResponse(
          messageId,
          'INVALID_OPERATION',
          `Unsupported operation: ${name} in namespace ${namespace}`
        );
    }
  }

  /**
   * Discover capabilities and supported categories
   */
  private handleDiscover(messageId: string): AlexaPlusResponsePayload {
    return {
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'DiscoverResponse',
        messageId,
        payloadVersion: '1.0',
      },
      payload: {
        serviceId: 'fixflow-home-repair',
        name: 'FixFlow Appliance Diagnostics & Contractor Dispatch',
        category: 'home_services',
        discoveryStrategy: 'AUTO_MATCH',
        supportedCategories: ['Kitchen', 'Laundry', 'HVAC', 'Plumbing', 'Electrical'],
        supportedOperations: [
          'Discover',
          'GetDiagnostics',
          'CheckAvailability',
          'CreateBooking',
          'GetBookingStatus',
          'CancelBooking',
        ],
        features: [
          'two_step_mutation_confirmation',
          'safety_hazard_interceptor',
          'warranty_verification',
          'digital_repair_passport',
          'simulated_contractor_dispatch',
        ],
        simulationNotice:
          'FixFlow contractor dispatch is a simulated demonstration for the Amazon Developers Hackathon Alexa+ Track.',
      },
    };
  }

  /**
   * Get diagnostics, warranty check, and Digital Repair Passport summary
   */
  private handleGetDiagnostics(
    messageId: string,
    payload: Record<string, any>,
    userContext: AlexaPlusUserContext,
    activeDb: DatabaseType
  ): AlexaPlusResponsePayload {
    const { applianceId, symptomDescription } = payload;

    // 1. Safety interceptor check
    if (symptomDescription) {
      const hazard = detectSafetyHazard(symptomDescription);
      if (hazard && hazard.severity === 'critical') {
        return {
          header: {
            namespace: 'com.amazon.alexa.homeservices.v1',
            name: 'SafetyHaltResponse',
            messageId,
            payloadVersion: '1.0',
          },
          payload: {
            isHazardous: true,
            severity: 'CRITICAL',
            title: hazard.title,
            warning: hazard.message,
            actionRequired: hazard.actionRequired,
            canProceedWithBooking: false,
          },
        };
      }
    }

    if (!applianceId) {
      return this.buildErrorResponse(messageId, 'MISSING_PARAMETER', 'applianceId is required for diagnostics.');
    }

    // 2. Fetch appliance and warranty records
    const appliance = applianceService.getApplianceById(applianceId, userContext.userId || undefined, activeDb);
    if (!appliance) {
      return this.buildErrorResponse(messageId, 'APPLIANCE_NOT_FOUND', `Appliance ${applianceId} not found or access denied.`);
    }

    const history = applianceService.getApplianceHistory(applianceId, userContext.userId || undefined, activeDb);
    const docs = history?.documents || [];
    const now = new Date();
    const expDate = appliance.warranty_expiration ? new Date(appliance.warranty_expiration) : null;
    const isActive = expDate ? expDate > now : false;
    const daysRemaining = expDate && isActive ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const warrantyStatus = isActive ? 'ACTIVE' : 'EXPIRED';

    return {
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'GetDiagnosticsResponse',
        messageId,
        payloadVersion: '1.0',
      },
      payload: {
        appliance: {
          id: appliance.id,
          name: appliance.name,
          brand: appliance.brand,
          model: appliance.model,
          serialNumber: appliance.serial_number,
          category: appliance.category,
          location: appliance.location,
        },
        warranty: {
          isActive,
          expirationDate: appliance.warranty_expiration,
          daysRemaining,
          status: warrantyStatus,
          documents: docs.map((d: any) => d.original_name),
        },
        repairPassport: {
          totalPastRepairs: history?.cases?.length || 0,
          lastRepairedAt: (history?.cases?.[0] as any)?.created_at || null,
          cases: (history?.cases || []).slice(0, 3).map((c: any) => ({
            id: c.id,
            issue: c.issue_description,
            status: c.status,
            priority: c.priority,
          })),
        },
        triageSummary: isActive
          ? `Active warranty coverage detected for ${appliance.brand} ${appliance.name}. Service may be eligible for manufacturer warranty repair.`
          : `Warranty expired for ${appliance.brand} ${appliance.name}. Standard service dispatch recommended.`,
        canProceedWithBooking: true,
      },
    };
  }

  /**
   * Check technician scheduling availability
   */
  private handleCheckAvailability(
    messageId: string,
    payload: Record<string, any>
  ): AlexaPlusResponsePayload {
    const { postalCode, serviceType } = payload;

    // Generate upcoming simulated availability slots
    const now = new Date();
    const slots = [];
    for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      slots.push({
        slotId: `slot-${dateStr}-morning`,
        date: dateStr,
        startTime: '09:00',
        endTime: '12:00',
        contractorName: 'Metro Pro HVAC & Repair',
        isAvailable: true,
      });
      slots.push({
        slotId: `slot-${dateStr}-afternoon`,
        date: dateStr,
        startTime: '13:00',
        endTime: '17:00',
        contractorName: 'HomeServe Certified Technicians',
        isAvailable: true,
      });
    }

    return {
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'CheckAvailabilityResponse',
        messageId,
        payloadVersion: '1.0',
      },
      payload: {
        postalCode: postalCode || '98101',
        serviceType: serviceType || 'appliance_repair',
        availableSlots: slots,
        providerNetwork: 'FixFlow Simulated Certified Partner Network',
        isSimulated: true,
      },
    };
  }

  /**
   * Create service booking with two-step confirmation enforcement
   */
  private async handleCreateBooking(
    messageId: string,
    payload: Record<string, any>,
    userContext: AlexaPlusUserContext,
    activeDb: DatabaseType
  ): Promise<AlexaPlusResponsePayload> {
    if (userContext.isGuest || !userContext.userId) {
      return this.buildErrorResponse(
        messageId,
        'AUTHENTICATION_REQUIRED',
        'Account linking required: Guest users cannot create service bookings. Please link your FixFlow account in the Alexa app.'
      );
    }

    const { applianceId, issueDescription, slotId, priority, confirmationToken } = payload;

    if (!applianceId || !issueDescription) {
      return this.buildErrorResponse(
        messageId,
        'MISSING_PARAMETER',
        'applianceId and issueDescription are required to create a service booking.'
      );
    }

    const appliance = applianceService.getApplianceById(applianceId, userContext.userId, activeDb);
    if (!appliance) {
      return this.buildErrorResponse(
        messageId,
        'APPLIANCE_NOT_FOUND',
        `Appliance ${applianceId} not found or access denied.`
      );
    }

    // Two-step confirmation enforcement
    const bookingArgs = {
      appliance_id: applianceId,
      issue_description: issueDescription,
      priority: priority || 'medium',
      slot_id: slotId || null,
    };

    if (!confirmationToken) {
      // Step 1: Return booking proposal and single-use confirmation token
      const proposal = confirmationManager.createProposal({
        action: 'create_repair_case',
        userId: userContext.userId,
        applianceId: appliance.id,
        arguments: bookingArgs,
        details: {
          appliance_name: appliance.name,
          brand: appliance.brand,
          model: appliance.model,
          issue_description: issueDescription,
          slot_id: slotId || 'next-available',
          is_simulated: true,
        },
      });

      return {
        header: {
          namespace: 'com.amazon.alexa.homeservices.v1',
          name: 'ConfirmationRequiredResponse',
          messageId,
          payloadVersion: '1.0',
        },
        payload: {
          status: 'CONFIRMATION_REQUIRED',
          confirmationToken: proposal.token,
          proposal: {
            applianceName: appliance.name,
            brand: appliance.brand,
            model: appliance.model,
            issueDescription,
            scheduledSlot: slotId || 'Next available certified technician',
            estimatedCost: '$0.00 (Simulated Demonstration)',
            disclaimer: 'FixFlow Contractor Dispatch is a simulated demonstration. No real technician will be sent to your home.',
          },
          instruction: 'Please ask the customer to confirm this service booking.',
        },
      };
    }

    // Step 2: Validate confirmation token and arguments
    const verification = confirmationManager.verifyAndConsume({
      token: confirmationToken,
      action: 'create_repair_case',
      userId: userContext.userId,
      applianceId: appliance.id,
      arguments: bookingArgs,
    });

    if (!verification.valid) {
      return this.buildErrorResponse(
        messageId,
        'INVALID_CONFIRMATION_TOKEN',
        verification.reason || 'Confirmation token is invalid, expired, or arguments do not match.'
      );
    }

    // Execute case creation
    const newCase = repairService.createRepairCase(
      {
        appliance_id: appliance.id,
        issue_description: issueDescription,
        priority: priority || 'medium',
        appointment_notes: slotId ? `Booked via Alexa+ (Slot: ${slotId})` : 'Booked via Alexa+',
      },
      userContext.userId,
      activeDb
    );

    // Queue simulated contractor dispatch
    const dispatch = dispatchService.initiateDispatch(
      newCase.id,
      userContext.userId,
      `Alexa+ Home Services booking for ${appliance.name}`,
      activeDb
    );

    return {
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'CreateBookingResponse',
        messageId,
        payloadVersion: '1.0',
      },
      payload: {
        status: 'CONFIRMED',
        bookingId: newCase.id,
        repairCase: {
          id: newCase.id,
          applianceName: appliance.name,
          status: newCase.status,
          priority: newCase.priority,
          createdAt: newCase.created_at,
        },
        contractorDispatch: {
          dispatchId: dispatch.id,
          contractorName: dispatch.contractor_name,
          companyName: dispatch.company_name,
          status: dispatch.status,
          estimatedArrivalMinutes: dispatch.estimated_arrival_minutes,
          isSimulated: true,
        },
        confirmationMessage: `Your service booking for ${appliance.name} has been confirmed. Case ID: ${newCase.id.substring(0, 8)}. A simulated technician has been queued.`,
        simulationNotice: 'Simulated dispatch for hackathon evaluation only.',
      },
    };
  }

  /**
   * Get booking status and live dispatch updates
   */
  private handleGetBookingStatus(
    messageId: string,
    payload: Record<string, any>,
    userContext: AlexaPlusUserContext,
    activeDb: DatabaseType
  ): AlexaPlusResponsePayload {
    if (userContext.isGuest || !userContext.userId) {
      return this.buildErrorResponse(
        messageId,
        'AUTHENTICATION_REQUIRED',
        'Account linking required to view booking status.'
      );
    }

    const bookingId = payload.bookingId || payload.caseId;
    if (!bookingId) {
      return this.buildErrorResponse(messageId, 'MISSING_PARAMETER', 'bookingId is required.');
    }

    const repairCase = repairService.getRepairCaseById(bookingId, userContext.userId, activeDb);
    if (!repairCase) {
      return this.buildErrorResponse(
        messageId,
        'BOOKING_NOT_FOUND',
        `Booking with ID ${bookingId} was not found or access denied.`
      );
    }

    const dispatch = dispatchService.getDispatchByCaseId(bookingId, userContext.userId, activeDb);

    return {
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'GetBookingStatusResponse',
        messageId,
        payloadVersion: '1.0',
      },
      payload: {
        bookingId: repairCase.id,
        status: repairCase.status,
        applianceName: repairCase.appliance_name,
        issueDescription: repairCase.issue_description,
        appointmentDate: repairCase.appointment_date,
        createdAt: repairCase.created_at,
        dispatch: dispatch
          ? {
              dispatchId: dispatch.id,
              contractorName: dispatch.contractor_name,
              companyName: dispatch.company_name,
              status: dispatch.status,
              estimatedArrivalMinutes: dispatch.estimated_arrival_minutes,
              vehicleInfo: dispatch.vehicle_info,
              isSimulated: true,
              latestEvent: dispatch.events[dispatch.events.length - 1]?.message || null,
            }
          : null,
      },
    };
  }

  /**
   * Cancel service booking
   */
  private handleCancelBooking(
    messageId: string,
    payload: Record<string, any>,
    userContext: AlexaPlusUserContext,
    activeDb: DatabaseType
  ): AlexaPlusResponsePayload {
    if (userContext.isGuest || !userContext.userId) {
      return this.buildErrorResponse(
        messageId,
        'AUTHENTICATION_REQUIRED',
        'Account linking required to cancel a service booking.'
      );
    }

    const bookingId = payload.bookingId || payload.caseId;
    const { cancellationReason } = payload;
    if (!bookingId) {
      return this.buildErrorResponse(messageId, 'MISSING_PARAMETER', 'bookingId is required.');
    }

    const repairCase = repairService.getRepairCaseById(bookingId, userContext.userId, activeDb);
    if (!repairCase) {
      return this.buildErrorResponse(
        messageId,
        'BOOKING_NOT_FOUND',
        `Booking ${bookingId} not found or access denied.`
      );
    }

    // Cancel dispatch if active
    const dispatch = dispatchService.getDispatchByCaseId(bookingId, userContext.userId, activeDb);
    if (dispatch && dispatch.status !== 'completed' && dispatch.status !== 'cancelled') {
      try {
        dispatchService.advanceDispatchStatus(
          bookingId,
          userContext.userId,
          'cancelled',
          cancellationReason || 'Cancelled by homeowner via Alexa+',
          activeDb
        );
      } catch {}
    }

    // Update case status to closed
    try {
      repairService.updateRepairStatus(
        bookingId,
        {
          status: 'closed',
        },
        userContext.userId,
        activeDb
      );
    } catch {
      // If closed transition is invalid from current state, leave case in updated status
    }

    return {
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'CancelBookingResponse',
        messageId,
        payloadVersion: '1.0',
      },
      payload: {
        status: 'CANCELLED',
        bookingId,
        cancellationReason: cancellationReason || 'Cancelled by homeowner via Alexa+',
        message: 'Your service booking and simulated contractor dispatch have been cancelled.',
        isSimulated: true,
      },
    };
  }

  /**
   * Helper to format standardized SPI error response
   */
  private buildErrorResponse(
    messageId: string,
    errorCode: string,
    description: string
  ): AlexaPlusResponsePayload {
    return {
      header: {
        namespace: 'com.amazon.alexa.homeservices.v1',
        name: 'ErrorResponse',
        messageId,
        payloadVersion: '1.0',
      },
      payload: {
        errorCode,
        description,
      },
    };
  }
}

export const alexaPlusAdapter = new AlexaPlusAdapter();
