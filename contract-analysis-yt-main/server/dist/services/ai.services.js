"use strict";
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
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid"); // You may need to install this package
const AI_MODEL = "gemini-pro";
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: AI_MODEL });
// Create uploads directory if it doesn't exist
const uploadsDir = path_1.default.join(__dirname, "../uploads");
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const extractTextFromPDF = (fileKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fileData = yield redis_1.default.get(fileKey);
        if (!fileData) {
            throw new Error("File not found");
        }
        let fileBuffer;
        if (Buffer.isBuffer(fileData)) {
            fileBuffer = new Uint8Array(fileData);
        }
        else if (typeof fileData === "object" && fileData !== null) {
            // check if the the object has the expected structure
            const bufferData = fileData;
            if (bufferData.type === "Buffer" && Array.isArray(bufferData.data)) {
                fileBuffer = new Uint8Array(bufferData.data);
            }
            else {
                throw new Error("Invalid file data");
            }
        }
        else {
            throw new Error("Invalid file data");
        }
        // Save the PDF to disk to avoid Redis key size limitations
        const fileName = `${(0, uuid_1.v4)()}.pdf`;
        const filePath = path_1.default.join(uploadsDir, fileName);
        fs_1.default.writeFileSync(filePath, Buffer.from(fileBuffer));
        // Update Redis to store just the file path instead of file content
        yield redis_1.default.set(fileKey, filePath);
        // Continue with PDF processing using the file on disk
        const pdf = yield (0, pdfjs_dist_1.getDocument)(filePath).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = yield pdf.getPage(i);
            const content = yield page.getTextContent();
            text += content.items.map((item) => item.str).join(" ") + "\n";
        }
        return text;
    }
    catch (error) {
        console.log(error);
        throw new Error(`Failed to extract text from PDF. Error: ${JSON.stringify(error)}`);
    }
});
exports.extractTextFromPDF = extractTextFromPDF;
const detectContractType = (contractText) => __awaiter(void 0, void 0, void 0, function* () {
    const prompt = `
    Analyze the following contract text and determine the type of contract it is.
    Provide only the contract type as a single string (e.g., "Employment", "Non-Disclosure Agreement", "Sales", "Lease", etc.).
    Do not include any additional explanation or text.

    Contract text:
    ${contractText.substring(0, 2000)}
  `;
    const results = yield aiModel.generateContent(prompt);
    const response = results.response;
    return response.text().trim();
});
exports.detectContractType = detectContractType;
const analyzeContractWithAI = (contractText, tier, contractType) => __awaiter(void 0, void 0, void 0, function* () {
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
      "risks": [{"risk": "Risk description", "explanation": "Brief explanation"}],
      "opportunities": [{"opportunity": "Opportunity description", "explanation": "Brief explanation"}],
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
    const results = yield aiModel.generateContent(prompt);
    const response = yield results.response;
    let text = response.text();
    // remove any markdown formatting
    text = text.replace(/```json\n?|\n?```/g, "").trim();
    try {
        // Attempt to fix common JSON errors
        text = text.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // Ensure all keys are quoted
        text = text.replace(/:\s*"([^"]*)"([^,}\]])/g, ': "$1"$2'); // Ensure all string values are properly quoted
        text = text.replace(/,\s*}/g, "}"); // Remove trailing commas
        const analysis = JSON.parse(text);
        return analysis;
    }
    catch (error) {
        console.log("Error parsing JSON:", error);
    }
    const fallbackAnalysis = {
        risks: [],
        opportunities: [],
        summary: "Error analyzing contract",
    };
    // Extract risks
    const risksMatch = text.match(/"risks"\s*:\s*\[([\s\S]*?)\]/);
    if (risksMatch) {
        fallbackAnalysis.risks = risksMatch[1].split("},").map((risk) => {
            const riskMatch = risk.match(/"risk"\s*:\s*"([^"]*)"/);
            const explanationMatch = risk.match(/"explanation"\s*:\s*"([^"]*)"/);
            return {
                risk: riskMatch ? riskMatch[1] : "Unknown",
                explanation: explanationMatch ? explanationMatch[1] : "Unknown",
            };
        });
    }
    //Extact opportunities
    const opportunitiesMatch = text.match(/"opportunities"\s*:\s*\[([\s\S]*?)\]/);
    if (opportunitiesMatch) {
        fallbackAnalysis.opportunities = opportunitiesMatch[1]
            .split("},")
            .map((opportunity) => {
            const opportunityMatch = opportunity.match(/"opportunity"\s*:\s*"([^"]*)"/);
            const explanationMatch = opportunity.match(/"explanation"\s*:\s*"([^"]*)"/);
            return {
                opportunity: opportunityMatch ? opportunityMatch[1] : "Unknown",
                explanation: explanationMatch ? explanationMatch[1] : "Unknown",
            };
        });
    }
    // Extract summary
    const summaryMatch = text.match(/"summary"\s*:\s*"([^"]*)"/);
    if (summaryMatch) {
        fallbackAnalysis.summary = summaryMatch[1];
    }
    return fallbackAnalysis;
});
exports.analyzeContractWithAI = analyzeContractWithAI;
