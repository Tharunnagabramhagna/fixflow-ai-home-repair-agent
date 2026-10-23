import { detectSafetyHazard } from './llmService';

export interface MultimodalAnalysisResult {
  applianceType: string | null;
  brand: string | null;
  modelNumber: string | null;
  modelConfidence: 'high' | 'medium' | 'low' | 'unverified';
  visibleErrorCodes: string[];
  observations: string[];
  possibleCauses: string[];
  recommendedNextSteps: string[];
  safetyWarnings: string[];
  confidence: 'high' | 'medium' | 'low';
  requiresProfessionalInspection: boolean;
  evidenceNotes: {
    visualFindings: string[];
    inferredHypotheses: string[];
    unreadableDetails: string[];
  };
  disclaimer: string;
}

export interface AnalyzeImageOptions {
  imageBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  userDescription?: string;
  applianceContext?: {
    name?: string;
    brand?: string;
    model?: string;
    category?: string;
  };
}

export const MULTIMODAL_SYSTEM_PROMPT = `You are FixFlow's Multimodal AI Diagnostic Specialist.
Your task is to analyze home appliance photographs, error code displays, visible damage, or model number labels submitted by homeowners.

CRITICAL RULES:
1. SEPARATE OBSERVATION FROM INFERENCE:
   - "visualFindings" must only contain what is directly visible in the image (e.g., "Digital display shows error code E15", "Corrosion around bottom water inlet hose", "Ice accumulation on rear evaporator panel").
   - "inferredHypotheses" contains plausible causes based on mechanical knowledge (e.g., "Float switch may be tripped due to water in base pan").
2. UNCERTAINTY & UNVERIFIED LABELS:
   - If a model number or serial tag is blurry, partially obscured, or unreadable, mark "modelNumber" as null and "modelConfidence" as "unverified". Explicitly list what was unreadable in "unreadableDetails".
   - Do NOT invent model numbers, serial numbers, or error codes.
3. SAFETY FIRST:
   - Identify hazards: gas leaks, active electrical sparking, scorch marks, burnt wiring, pooling water near high-voltage plugs.
   - If hazard is detected, populate "safetyWarnings", set "requiresProfessionalInspection" to true, and instruct the user to stop immediately.
4. NO FABRICATED CERTAINTY:
   - A photograph cannot prove an internal motor coil or compressor valve has failed. Use calibrated language ("suggests", "consistent with", "potential failure").

Return your response strictly as valid JSON adhering to the following schema:
{
  "applianceType": string | null,
  "brand": string | null,
  "modelNumber": string | null,
  "modelConfidence": "high" | "medium" | "low" | "unverified",
  "visibleErrorCodes": string[],
  "observations": string[],
  "possibleCauses": string[],
  "recommendedNextSteps": string[],
  "safetyWarnings": string[],
  "confidence": "high" | "medium" | "low",
  "requiresProfessionalInspection": boolean,
  "evidenceNotes": {
    "visualFindings": string[],
    "inferredHypotheses": string[],
    "unreadableDetails": string[]
  },
  "disclaimer": string
}`;

export class MultimodalService {
  /**
   * Deterministic visual inspection simulator for tests, offline mode, or fallback
   */
  simulateVisualAnalysis(
    options: AnalyzeImageOptions
  ): MultimodalAnalysisResult {
    const desc = (options.userDescription || '').toLowerCase();
    const appCtx = options.applianceContext;

    const visualFindings: string[] = [];
    const inferredHypotheses: string[] = [];
    const unreadableDetails: string[] = [];
    const safetyWarnings: string[] = [];
    const visibleErrorCodes: string[] = [];

    // 1. Safety hazard check
    const hazard = detectSafetyHazard(desc);
    let requiresPro = false;

    if (hazard) {
      safetyWarnings.push(`CRITICAL SAFETY HAZARD: ${hazard.title}`);
      safetyWarnings.push(hazard.actionRequired);
      requiresPro = true;
      visualFindings.push('Visual evidence or symptom description indicates active hazardous condition.');
      inferredHypotheses.push('Possible compromised electrical insulator or ruptured line.');
    }

    // 2. Error code extraction heuristics
    const errorCodeMatch = desc.match(/\b([A-Z0-9]{1,3}[-_]?[0-9]{1,3}|E[0-9]{1,2}|F[0-9]{1,2}|LE|OE|UE|4E|5E|dE|IE)\b/i);
    if (errorCodeMatch) {
      const code = errorCodeMatch[1].toUpperCase();
      visibleErrorCodes.push(code);
      visualFindings.push(`Appliance control console or display panel exhibits error code: ${code}.`);

      if (code === 'E15') {
        inferredHypotheses.push('Dishwasher flood protection sensor or float switch detected water in the bottom safety pan.');
      } else if (code === '4E' || code === 'IE') {
        inferredHypotheses.push('Water supply inlet fault. Appliance is not filling with water within the expected cycle time limit.');
      } else if (code === 'LE') {
        inferredHypotheses.push('Low water level sensor tripped or motor communication error.');
      } else {
        inferredHypotheses.push(`Manufacturer diagnostic code ${code} indicates a sensor or cycle abnormality.`);
      }
    }

    // 3. Physical symptom analysis
    if (desc.includes('leak') || desc.includes('water') || desc.includes('puddle')) {
      visualFindings.push('Visible moisture accumulation, dripping, or condensation around base/hoses.');
      inferredHypotheses.push('Possible degraded rubber gasket, loose drain hose clamp, or cracked water valve body.');
    }

    if (desc.includes('ice') || desc.includes('frost') || desc.includes('freeze')) {
      visualFindings.push('Frost accumulation or ice buildup observed on coils/surfaces.');
      inferredHypotheses.push('Defrost thermostat failure, clogged defrost drain tube, or compromised door gasket seal.');
    }

    if (desc.includes('rust') || desc.includes('corrosion')) {
      visualFindings.push('Surface oxidation and rust staining around metal bracket or water connection.');
      inferredHypotheses.push('Slow, chronic moisture exposure over extended period.');
    }

    if (desc.includes('spark') || desc.includes('burn') || desc.includes('smoke')) {
      safetyWarnings.push('Electrical arcing or heat damage observed. Fire risk present.');
      visualFindings.push('Charring, discoloration, or heat distortion near terminal block.');
      requiresPro = true;
    }

    // 4. Model label detection
    let detectedBrand: string | null = null;
    let detectedModel: string | null = null;
    let modelConfidence: 'high' | 'medium' | 'low' | 'unverified' = 'unverified';
    let applianceType: string | null = null;

    if (desc.includes('samsung')) detectedBrand = 'Samsung';
    else if (desc.includes('bosch')) detectedBrand = 'Bosch';
    else if (desc.includes('whirlpool')) detectedBrand = 'Whirlpool';
    else if (desc.includes('lg')) detectedBrand = 'LG';
    else if (desc.includes('ge')) detectedBrand = 'GE Appliances';
    else if (appCtx?.brand) detectedBrand = appCtx.brand;

    if (desc.includes('dish')) applianceType = 'Dishwasher';
    else if (desc.includes('fridge') || desc.includes('refrigerator')) applianceType = 'Refrigerator';
    else if (desc.includes('washer') || desc.includes('washing machine')) applianceType = 'Washing Machine';
    else if (desc.includes('dryer')) applianceType = 'Clothes Dryer';
    else if (desc.includes('oven') || desc.includes('range')) applianceType = 'Oven / Range';
    else if (appCtx?.category) applianceType = appCtx.category;

    const modelMatch = desc.match(/\b(?:model[:\s#]*|m\/n[:\s#]*)([A-Z0-9]{5,12})\b/i);
    if (modelMatch) {
      detectedModel = modelMatch[1].toUpperCase();
      modelConfidence = 'high';
      visualFindings.push(`Rating plate / barcode label reveals model number: ${detectedModel}.`);
    } else if (desc.includes('blurry') || desc.includes('unreadable') || desc.includes('label')) {
      detectedModel = null;
      modelConfidence = 'unverified';
      unreadableDetails.push('Model/serial rating sticker is partially illegible, glare-covered, or obscured.');
    } else if (appCtx?.model) {
      detectedModel = appCtx.model;
      modelConfidence = 'medium';
    }

    if (visualFindings.length === 0) {
      visualFindings.push('Exterior appliance assembly with standard cosmetic wear.');
      inferredHypotheses.push('Reported issue may involve internal mechanical or electronic components not visible externally.');
      unreadableDetails.push('No direct line-of-sight to internal motor assembly or hidden valves.');
    }

    const recommendedNextSteps: string[] = [];
    if (requiresPro) {
      recommendedNextSteps.push('Disconnect power/gas to appliance safely.');
      recommendedNextSteps.push('Schedule certified technician inspection. Do not operate.');
    } else if (visibleErrorCodes.length > 0) {
      recommendedNextSteps.push(`Consult technical service manual for specific reset procedure for code ${visibleErrorCodes.join(', ')}.`);
      recommendedNextSteps.push('Perform a complete power cycle (unplug for 5 minutes and restore power).');
    } else {
      recommendedNextSteps.push('Inspect accessible water inlet and drain hoses for kinks, cracks, or loose fittings.');
      recommendedNextSteps.push('Verify wall power outlet and circuit breaker.');
      recommendedNextSteps.push('If symptoms persist, file a repair case with FixFlow Assistant.');
    }

    const confidence: 'high' | 'medium' | 'low' = visibleErrorCodes.length > 0 || modelConfidence === 'high' ? 'high' : 'medium';

    return {
      applianceType: applianceType || 'Appliance',
      brand: detectedBrand,
      modelNumber: detectedModel,
      modelConfidence,
      visibleErrorCodes,
      observations: visualFindings,
      possibleCauses: inferredHypotheses,
      recommendedNextSteps,
      safetyWarnings,
      confidence,
      requiresProfessionalInspection: requiresPro,
      evidenceNotes: {
        visualFindings,
        inferredHypotheses,
        unreadableDetails,
      },
      disclaimer:
        'Visual AI diagnostics provides non-invasive triage based on visible exterior evidence and reported symptoms. It does not replace internal diagnostic testing by a licensed professional technician.',
    };
  }

  /**
   * Main analysis execution (invokes provider or fallback simulator)
   */
  async analyze(options: AnalyzeImageOptions): Promise<MultimodalAnalysisResult> {
    const providerOverride = process.env.LLM_PROVIDER;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // In simulator mode, test environment, or when no keys configured
    if (
      providerOverride === 'simulator' ||
      process.env.NODE_ENV === 'test' ||
      (!geminiKey && !openaiKey && !anthropicKey)
    ) {
      return this.simulateVisualAnalysis(options);
    }

    const base64Data = options.imageBuffer.toString('base64');
    const userPrompt = `Homeowner Symptom Description: "${options.userDescription || 'None provided'}".
Appliance Context: ${options.applianceContext ? JSON.stringify(options.applianceContext) : 'None'}.
Please analyze the attached appliance image according to your instructions.`;

    // 1. Google Gemini Multimodal
    if (geminiKey) {
      try {
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

        const requestBody = {
          contents: [
            {
              role: 'user',
              parts: [
                { text: MULTIMODAL_SYSTEM_PROMPT + '\n\n' + userPrompt },
                {
                  inlineData: {
                    mimeType: options.mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (res.ok) {
          const json = (await res.json()) as any;
          const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const parsed = JSON.parse(candidateText);
            return this.validateAndNormalizeResult(parsed);
          }
        }
      } catch (err) {
        console.warn('[MultimodalService] Gemini API call failed, falling back to simulator:', err);
      }
    }

    // 2. OpenAI Multimodal (GPT-4o)
    if (openaiKey) {
      try {
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const url = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;

        const requestBody = {
          model,
          messages: [
            { role: 'system', content: MULTIMODAL_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${options.mimeType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (res.ok) {
          const json = (await res.json()) as any;
          const content = json.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return this.validateAndNormalizeResult(parsed);
          }
        }
      } catch (err) {
        console.warn('[MultimodalService] OpenAI API call failed, falling back to simulator:', err);
      }
    }

    // Default fallback to deterministic simulator
    return this.simulateVisualAnalysis(options);
  }

  /**
   * Validate & normalize returned structured object
   */
  private validateAndNormalizeResult(data: any): MultimodalAnalysisResult {
    return {
      applianceType: typeof data.applianceType === 'string' ? data.applianceType : null,
      brand: typeof data.brand === 'string' ? data.brand : null,
      modelNumber: typeof data.modelNumber === 'string' ? data.modelNumber : null,
      modelConfidence: ['high', 'medium', 'low', 'unverified'].includes(data.modelConfidence)
        ? data.modelConfidence
        : 'unverified',
      visibleErrorCodes: Array.isArray(data.visibleErrorCodes) ? data.visibleErrorCodes.map(String) : [],
      observations: Array.isArray(data.observations) ? data.observations.map(String) : [],
      possibleCauses: Array.isArray(data.possibleCauses) ? data.possibleCauses.map(String) : [],
      recommendedNextSteps: Array.isArray(data.recommendedNextSteps) ? data.recommendedNextSteps.map(String) : [],
      safetyWarnings: Array.isArray(data.safetyWarnings) ? data.safetyWarnings.map(String) : [],
      confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
      requiresProfessionalInspection: Boolean(data.requiresProfessionalInspection),
      evidenceNotes: {
        visualFindings: Array.isArray(data.evidenceNotes?.visualFindings) ? data.evidenceNotes.visualFindings.map(String) : [],
        inferredHypotheses: Array.isArray(data.evidenceNotes?.inferredHypotheses) ? data.evidenceNotes.inferredHypotheses.map(String) : [],
        unreadableDetails: Array.isArray(data.evidenceNotes?.unreadableDetails) ? data.evidenceNotes.unreadableDetails.map(String) : [],
      },
      disclaimer: typeof data.disclaimer === 'string'
        ? data.disclaimer
        : 'Visual AI diagnostics provides non-invasive triage and does not replace inspection by a qualified professional.',
    };
  }
}

export const multimodalService = new MultimodalService();
