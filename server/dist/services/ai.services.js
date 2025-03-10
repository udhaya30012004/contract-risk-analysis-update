"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeContractWithAI = exports.detectContractType = exports.extractTextFromPDF = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const pdfjs_dist_1 = require("pdfjs-dist");
const pdfjs_dist_2 = require("pdfjs-dist");
const generative_ai_1 = require("@google/generative-ai");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Configure PDF.js worker
// Check if we're in production or development
pdfjs_dist_2.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.js';
const isProduction = process.env.NODE_ENV === 'production';
// Find the path to pdfjs-dist package to handle paths properly in both environments
let pdfJsPath;
try {
    pdfJsPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
    console.log(`Found pdfjs-dist at: ${pdfJsPath}`);
}
catch (err) {
    console.error('Failed to resolve pdfjs-dist path:', err);
    pdfJsPath = path.resolve(__dirname, '../../node_modules/pdfjs-dist');
    console.log(`Using fallback pdfjs-dist path: ${pdfJsPath}`);
}
// Set up the worker source based on environment
if (isProduction) {
    // For production environment - use a simple path that works in the deployed environment
    pdfjs_dist_2.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.js';
}
else {
    // For development environment - use module-relative path without file:/// protocol
    const workerPath = path.join(pdfJsPath, 'build/pdf.worker.min.js');
    pdfjs_dist_2.GlobalWorkerOptions.workerSrc = workerPath;
    console.log(`PDF Worker path: ${pdfjs_dist_2.GlobalWorkerOptions.workerSrc}`);
}
// Ensure the fonts directory exists and is accessible
const standardFontDataUrl = path.join(pdfJsPath, 'standard_fonts');
console.log(`Using standard font data from: ${standardFontDataUrl}`);
if (!fs.existsSync(standardFontDataUrl)) {
    console.warn(`Standard fonts directory not found at: ${standardFontDataUrl}. Falling back to CDN.`);
    // Optional: Use CDN for fonts if local files are missing
}
// Update the model name to current supported Gemini model
const AI_MODEL = "gemini-1.5-pro"; // Updated from gemini-2.0-flash
console.log(`Using AI model: ${AI_MODEL}`);
// Initialize Gemini API with environment check
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not defined in environment variables!");
}
const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY || "");
const aiModel = genAI.getGenerativeModel({ model: AI_MODEL });
console.log(`AI model initialized: ${aiModel ? "success" : "failed"}`);
const extractTextFromPDF = (fileKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Extracting text from PDF with key: ${fileKey}`);
        const fileData = yield redis_1.default.get(fileKey);
        if (!fileData) {
            throw new Error("File not found");
        }
        let fileBuffer;
        if (Buffer.isBuffer(fileData)) {
            fileBuffer = new Uint8Array(fileData);
        }
        else if (typeof fileData === "object" && fileData !== null) {
            // check if the object has the expected structure
            const bufferData = fileData;
            if (bufferData.type === "Buffer" && Array.isArray(bufferData.data)) {
                fileBuffer = new Uint8Array(bufferData.data);
            }
            else {
                throw new Error("Invalid file data structure");
            }
        }
        else {
            throw new Error(`Invalid file data type: ${typeof fileData}`);
        }
        console.log(`PDF buffer created, size: ${fileBuffer.length} bytes`);
        try {
            // Improved PDF loading configuration
            const loadingOptions = {
                data: fileBuffer,
                standardFontDataUrl: standardFontDataUrl,
                disableWorker: false // Try to use workers by default
            };
            // First attempt with web workers
            try {
                console.log('Attempting to load PDF with web workers');
                const loadingTask = (0, pdfjs_dist_1.getDocument)(loadingOptions);
                const pdfDocument = yield loadingTask.promise;
                console.log(`PDF loaded successfully with web workers. Pages: ${pdfDocument.numPages}`);
                let text = "";
                for (let i = 1; i <= pdfDocument.numPages; i++) {
                    console.log(`Processing page ${i}/${pdfDocument.numPages}`);
                    const page = yield pdfDocument.getPage(i);
                    const content = yield page.getTextContent();
                    text += content.items.map((item) => item.str).join(" ") + "\n";
                }
                console.log(`Text extraction complete. Total characters: ${text.length}`);
                return text;
            }
            catch (workerError) {
                // Fallback to disabled workers if the first attempt fails
                console.warn('Failed to load PDF with web workers, falling back to disabled workers:', workerError);
                const fallbackOptions = Object.assign(Object.assign({}, loadingOptions), { disableWorker: true });
                const fallbackTask = (0, pdfjs_dist_1.getDocument)(fallbackOptions);
                const pdfDocument = yield fallbackTask.promise;
                console.log(`PDF loaded successfully with disabled workers. Pages: ${pdfDocument.numPages}`);
                let text = "";
                for (let i = 1; i <= pdfDocument.numPages; i++) {
                    console.log(`Processing page ${i}/${pdfDocument.numPages}`);
                    const page = yield pdfDocument.getPage(i);
                    const content = yield page.getTextContent();
                    text += content.items.map((item) => item.str).join(" ") + "\n";
                }
                console.log(`Text extraction complete. Total characters: ${text.length}`);
                return text;
            }
        }
        catch (pdfError) {
            console.error("Error processing PDF document:", pdfError);
            throw new Error(`Failed to process PDF document: ${pdfError instanceof Error ? pdfError.message : JSON.stringify(pdfError)}`);
        }
    }
    catch (error) {
        console.error("PDF extraction error:", error);
        throw new Error(`Failed to extract text from PDF. Error: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
});
exports.extractTextFromPDF = extractTextFromPDF;
// The rest of your code remains unchanged
const detectContractType = (contractText) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Detecting contract type. Text length: ${contractText.length} chars`);
        const prompt = `
      Analyze the following contract text and determine the type of contract it is.
      Provide only the contract type as a single string (e.g., "Employment", "Non-Disclosure Agreement", "Sales", "Lease", etc.).
      Do not include any additional explanation or text.

      Contract text:
      ${contractText.substring(0, 2000)}
    `;
        console.log(`Sending contract type detection request to Gemini API`);
        const results = yield aiModel.generateContent(prompt);
        const response = results.response;
        const contractType = response.text().trim();
        console.log(`Detected contract type: ${contractType}`);
        return contractType;
    }
    catch (error) {
        console.error("Error detecting contract type:", error);
        // Return a default type in case of error to prevent application crash
        return "Unknown Contract";
    }
});
exports.detectContractType = detectContractType;
const analyzeContractWithAI = (contractText, tier, contractType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Analyzing ${contractType} contract for ${tier} tier user. Text length: ${contractText.length} chars`);
        let prompt;
        if (tier === "premium") {
            prompt = `
      Analyze the following ${contractType} contract and provide:
      1. A list of at least 10 potential risks for the party receiving the contract, each with a brief explanation and severity level (low, medium, high).
      2. A list of at least 10 potential opportunities or benefits for the receiving party, each with a brief explanation and impact level (low, medium, high).
      3. A comprehensive summary of the contract, including key terms and conditions.
      4. Any recommendations for improving the contract from the receiving party's perspective.
      5. A list of key clauses in the contract.
      6. An assessment of the contract's legal compliance.
      7. A list of potential negotiation points.
      8. The contract duration or term, if applicable.
      9. A summary of termination conditions, if applicable.
      10. A breakdown of any financial terms or compensation structure, if applicable.
      11. Any performance metrics or KPIs mentioned, if applicable.
      12. A summary of any specific clauses relevant to this type of contract (e.g., intellectual property for employment contracts, warranties for sales contracts).
      13. An overall score from 1 to 100, with 100 being the highest. This score represents the overall favorability of the contract based on the identified risks and opportunities.

      Format your response as a JSON object with the following structure:
      {
        "risks": [{"risk": "Risk description", "explanation": "Brief explanation", "severity": "low|medium|high"}],
        "opportunities": [{"opportunity": "Opportunity description", "explanation": "Brief explanation", "impact": "low|medium|high"}],
        "summary": "Comprehensive summary of the contract",
        "recommendations": ["Recommendation 1", "Recommendation 2", ...],
        "keyClauses": ["Clause 1", "Clause 2", ...],
        "legalCompliance": "Assessment of legal compliance",
        "negotiationPoints": ["Point 1", "Point 2", ...],
        "contractDuration": "Duration of the contract, if applicable",
        "terminationConditions": "Summary of termination conditions, if applicable",
        "overallScore": "Overall score from 1 to 100",
        "financialTerms": {
          "description": "Overview of financial terms",
          "details": ["Detail 1", "Detail 2", ...]
        },
        "performanceMetrics": ["Metric 1", "Metric 2", ...],
        "specificClauses": "Summary of clauses specific to this contract type"
      }
        `;
        }
        else {
            prompt = `
      Analyze the following ${contractType} contract and provide:
      1. A list of at least 5 potential risks for the party receiving the contract, each with a brief explanation and severity level (low, medium, high).
      2. A list of at least 5 potential opportunities or benefits for the receiving party, each with a brief explanation and impact level (low, medium, high).
      3. A brief summary of the contract
      4. An overall score from 1 to 100, with 100 being the highest. This score represents the overall favorability of the contract based on the identified risks and opportunities.

       {
        "risks": [{"risk": "Risk description", "explanation": "Brief explanation", "severity": "low|medium|high"}],
        "opportunities": [{"opportunity": "Opportunity description", "explanation": "Brief explanation", "impact": "low|medium|high"}],
        "summary": "Brief summary of the contract",
        "overallScore": "Overall score from 1 to 100"
      }
  `;
        }
        prompt += `
      Important: Provide only the JSON object in your response, without any additional text or formatting. 
      
      Contract text:
      ${contractText}
      `;
        console.log(`Sending contract analysis request to Gemini API for ${tier} tier`);
        const results = yield aiModel.generateContent(prompt);
        const response = results.response;
        let text = response.text();
        console.log(`Received analysis response. Length: ${text.length} chars`);
        // remove any markdown formatting
        text = text.replace(/```json\n?|\n?```/g, "").trim();
        try {
            // Attempt to fix common JSON errors
            text = text.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // Ensure all keys are quoted
            text = text.replace(/:\s*"([^"]*)"([^,}\]])/g, ': "$1"$2'); // Ensure all string values are properly quoted
            text = text.replace(/,\s*}/g, "}"); // Remove trailing commas
            console.log(`Parsing JSON response`);
            const analysis = JSON.parse(text);
            console.log(`JSON parsing successful`);
            return analysis;
        }
        catch (error) {
            console.error("Error parsing JSON:", error);
            console.log("Raw text before parsing attempt:", text.substring(0, 500) + "...");
        }
        console.log(`Using fallback parsing method`);
        const fallbackAnalysis = {
            risks: [],
            opportunities: [],
            summary: "Error analyzing contract",
            overallScore: 50
        };
        // Extract risks
        const risksMatch = text.match(/"risks"\s*:\s*\[([\s\S]*?)\]/);
        if (risksMatch) {
            fallbackAnalysis.risks = risksMatch[1].split("},").map((risk) => {
                const riskMatch = risk.match(/"risk"\s*:\s*"([^"]*)"/);
                const explanationMatch = risk.match(/"explanation"\s*:\s*"([^"]*)"/);
                const severityMatch = risk.match(/"severity"\s*:\s*"([^"]*)"/);
                return {
                    risk: riskMatch ? riskMatch[1] : "Unknown",
                    explanation: explanationMatch ? explanationMatch[1] : "Unknown",
                    severity: severityMatch ? severityMatch[1] : "medium"
                };
            });
        }
        //Extract opportunities
        const opportunitiesMatch = text.match(/"opportunities"\s*:\s*\[([\s\S]*?)\]/);
        if (opportunitiesMatch) {
            fallbackAnalysis.opportunities = opportunitiesMatch[1]
                .split("},")
                .map((opportunity) => {
                const opportunityMatch = opportunity.match(/"opportunity"\s*:\s*"([^"]*)"/);
                const explanationMatch = opportunity.match(/"explanation"\s*:\s*"([^"]*)"/);
                const impactMatch = opportunity.match(/"impact"\s*:\s*"([^"]*)"/);
                return {
                    opportunity: opportunityMatch ? opportunityMatch[1] : "Unknown",
                    explanation: explanationMatch ? explanationMatch[1] : "Unknown",
                    impact: impactMatch ? impactMatch[1] : "medium"
                };
            });
        }
        // Extract summary
        const summaryMatch = text.match(/"summary"\s*:\s*"([^"]*)"/);
        if (summaryMatch) {
            fallbackAnalysis.summary = summaryMatch[1];
        }
        // Extract overallScore
        const scoreMatch = text.match(/"overallScore"\s*:\s*(\d+)/);
        if (scoreMatch) {
            fallbackAnalysis.overallScore = parseInt(scoreMatch[1]);
        }
        console.log(`Fallback analysis created with ${fallbackAnalysis.risks.length} risks and ${fallbackAnalysis.opportunities.length} opportunities`);
        return fallbackAnalysis;
    }
    catch (error) {
        console.error("Contract analysis error:", error);
        // Return a minimal valid analysis to prevent application crash
        return {
            risks: [{ risk: "Error analyzing contract", explanation: "The analysis service encountered an error", severity: "high" }],
            opportunities: [{ opportunity: "Try again later", explanation: "The service may be temporarily unavailable", impact: "medium" }],
            summary: "Error analyzing contract. Please try again later.",
            overallScore: 50
        };
    }
});
exports.analyzeContractWithAI = analyzeContractWithAI;
