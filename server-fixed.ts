// @ts-nocheck
import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(process.cwd(), "policies_db.json");
const SECURITY_LOGS_FILE = path.join(process.cwd(), "security_audit.json");
app.use(express.json({ limit: "60mb" }));
app.use(express.urlencoded({ limit: "60mb", extended: true }));

function readJsonFile(file: string, fallback: any) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Failed to read ${file}:`, error);
  }
  return fallback;
}
function writeJsonFile(file: string, value: any) {
  try { fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8"); }
  catch (error) { console.error(`Failed to write ${file}:`, error); }
}
function loadPolicies(): any[] { return readJsonFile(DATA_FILE, []); }
function savePolicies(policies: any[]) { writeJsonFile(DATA_FILE, policies); }
function loadAuditLogs(): any[] {
  return readJsonFile(SECURITY_LOGS_FILE, [{ id: "sec-1", timestamp: new Date().toISOString(), action: "SYSTEM_INITIALIZED", actor: "VIJAY SHIROYA (CA)", details: "V Shiroya AI backend initialized.", ipAddress: "127.0.0.1" }]);
}
function addAuditLog(action: string, details: string, req: express.Request) {
  const logs = loadAuditLogs();
  logs.unshift({ id: `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`, timestamp: new Date().toISOString(), action, actor: "VIJAY SHIROYA (CA)", details, ipAddress: req.ip || "127.0.0.1" });
  writeJsonFile(SECURITY_LOGS_FILE, logs.slice(0, 100));
}
function cleanBase64(value?: string) {
  if (!value) return "";
  const comma = value.indexOf("base64,");
  return comma >= 0 ? value.slice(comma + 7) : value;
}
function cleanValue(value: any): any {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const v = value.trim();
    if (!v || /^(not available|n\/a|na|null|unknown|none)$/i.test(v)) return null;
    return v;
  }
  return value;
}
function cleanNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
function parseDateSafe(value: any): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  let d: Date | null = null;
  const iso = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (!d && dmy) d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  if (!d) { const parsed = new Date(raw); if (!Number.isNaN(parsed.getTime())) d = parsed; }
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
function isoDate(value: any): string | null {
  const d = parseDateSafe(value); if (!d) return null;
  return `${d.getFullYear().toString().padStart(4, "0")}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}
function calculateAge(dobValue: any, asOfValue?: any): number | null {
  const dob = parseDateSafe(dobValue); if (!dob) return null;
  const asOf = parseDateSafe(asOfValue) || new Date();
  let age = asOf.getFullYear() - dob.getFullYear();
  const birthdayPassed = asOf.getMonth() > dob.getMonth() || (asOf.getMonth() === dob.getMonth() && asOf.getDate() >= dob.getDate());
  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function normalizeResult(raw: any, pre: any = {}) {
  const result: any = { ...raw };
  const stringFields = ["ownerName","policyNumber","providerCompany","policyType","startDate","endDate","premiumFrequency","insuredPerson","nominee","nomineeRelationship","phoneNumber","email","address","dateOfBirth","agentName","agentPhone","branchName","paymentMode","maturityDate","documentType","detectedInsurer","appliedTemplate","ageSource"];
  stringFields.forEach(field => { result[field] = cleanValue(result[field]); });
  result.premiumAmount = cleanNumber(result.premiumAmount);
  result.sumAssured = cleanNumber(result.sumAssured);
  result.age = cleanNumber(result.age);
  ["startDate","endDate","dateOfBirth","maturityDate"].forEach(field => { if (result[field]) { const normalized = isoDate(result[field]); if (normalized) result[field] = normalized; } });
  if (result.age === null) {
    const calculated = calculateAge(result.dateOfBirth, result.startDate);
    if (calculated !== null) { result.age = calculated; result.ageSource = "calculated_from_date_of_birth_at_policy_start"; }
  } else result.ageSource = "explicitly_extracted_from_document";
  result.additionalDetails = Array.isArray(result.additionalDetails) ? result.additionalDetails.filter((x:any) => x && cleanValue(x.label) && cleanValue(x.value)).map((x:any) => ({ label:String(x.label).trim(), value:String(x.value).trim(), confidence:["high","medium","low"].includes(x.confidence) ? x.confidence : "medium" })) : [];
  result.missingFields = Array.isArray(result.missingFields) ? result.missingFields.map(String) : [];
  result.uncertainFields = Array.isArray(result.uncertainFields) ? result.uncertainFields.map(String) : [];
  result.fieldConfidenceMap = result.fieldConfidenceMap && typeof result.fieldConfidenceMap === "object" ? result.fieldConfidenceMap : {};
  result.fieldEvidence = Array.isArray(result.fieldEvidence) ? result.fieldEvidence : [];
  const requiredFields = ["ownerName","policyNumber","providerCompany","policyType","startDate","endDate","premiumAmount","sumAssured","insuredPerson","nominee","phoneNumber","email","address","dateOfBirth","age","maturityDate"];
  requiredFields.forEach(field => {
    const empty = result[field] === null || result[field] === undefined || result[field] === "";
    if (empty) { if (!result.missingFields.includes(field)) result.missingFields.push(field); if (!result.fieldConfidenceMap[field]) result.fieldConfidenceMap[field] = "low"; }
    else if (!result.fieldConfidenceMap[field]) result.fieldConfidenceMap[field] = "medium";
  });
  result.documentType = result.documentType || pre.documentType || "GENERAL_INSURANCE_DOC";
  result.detectedInsurer = result.detectedInsurer || pre.detectedInsurer || "Insurance Provider";
  result.appliedTemplate = result.appliedTemplate || pre.appliedTemplate || "Generic Insurance Document";
  const end = parseDateSafe(result.endDate);
  if (end) { const today = new Date(); today.setHours(0,0,0,0); const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86400000); result.policyStatus = diffDays < 0 ? "EXPIRED" : diffDays <= 30 ? "EXPIRING SOON" : "ACTIVE"; }
  else result.policyStatus = "ACTIVE";
  const text = `${result.policyType || ""} ${result.providerCompany || ""} ${result.extractedText || ""} ${result.additionalDetails.map((x:any) => `${x.label} ${x.value}`).join(" ")}`.toLowerCase();
  if (/vehicle|motor|car|bike|chassis|registration|idv|third party|own damage/.test(text)) result.category = "Vehicle";
  else if (/health|mediclaim|hospital|floater|cashless|room rent|pre-existing|star health|niva bupa|care health/.test(text)) result.category = "Health";
  else if (/fire|property|shopkeeper|dwelling|burglary|building|home insurance/.test(text)) result.category = "Fire";
  else if (/life|term|jeevan|endowment|ulip|pension|annuity|death benefit|lic|sbi life|max life|tata aia/.test(text)) result.category = "Life";
  else if (/travel|trip|passport|overseas/.test(text)) result.category = "Travel";
  else result.category = result.category || "General";
  if (!result.policyType) result.policyType = `${result.category} Insurance`;
  const available = requiredFields.filter(field => result[field] !== null && result[field] !== undefined && result[field] !== "").length;
  const evidenceCount = result.fieldEvidence.filter((x:any) => x && x.field && x.sourceText).length;
  const baseConfidence = Math.round((available / requiredFields.length) * 80 + Math.min(evidenceCount, requiredFields.length) / requiredFields.length * 20);
  const aiConfidence = Number(result.confidence);
  result.confidence = Math.max(0, Math.min(100, Number.isFinite(aiConfidence) ? aiConfidence : baseConfidence));
  return result;
}

const EXTRACTION_PROMPT = (fileName:string, instruction:string) => `You are an evidence-first insurance PDF extraction engine.

SOURCE OF TRUTH: ONLY THE ATTACHED PDF. Your answer must match what is visibly printed in the PDF. Do not use outside knowledge to fill missing fields.

FILE: ${fileName}
USER INSTRUCTION: ${instruction || "Extract the complete insurance document accurately."}

EXTRACTION RULES:
1. Inspect EVERY PAGE, not only the first page.
2. Read header, footer, side columns, stamps, tables, member/insured rows, nominee rows, premium tables, riders, endorsements, and fine print.
3. Preserve names, policy numbers, amounts, dates, ages, relationships and identifiers exactly as printed.
4. Do NOT confuse proposal number, customer ID, receipt number, claim number, application number and policy number.
5. Do NOT confuse premium with sum assured, sum insured, IDV, maturity value, bonus, GST or tax.
6. If several insured people appear, preserve all names and ages in insuredPerson/additionalDetails.
7. If an age is explicitly printed anywhere, extract that exact age. Do not replace it with current age.
8. If DOB is printed but age is not, leave age null; the server may calculate age separately using policy commencement date when possible.
9. Never invent dates, amounts, names, addresses, phone numbers or policy terms.
10. If a field is not visible, return null and list it in missingFields.
11. If a value is partially readable or ambiguous, keep the visible value and list the field in uncertainFields.
12. Every important top-level value should have a short exact supporting phrase in fieldEvidence.
13. Put every visible detail that does not fit a top-level field into additionalDetails rather than dropping it.
14. extractedText must be a faithful transcription-style summary of important visible content, not a generic description.
15. Return ONLY valid JSON matching the requested field names. No markdown fences. No commentary.

JSON fields to return:
ownerName, policyNumber, providerCompany, policyType, startDate, endDate, premiumAmount, premiumFrequency, sumAssured, insuredPerson, nominee, nomineeRelationship, phoneNumber, email, address, dateOfBirth, age, ageSource, agentName, agentPhone, branchName, paymentMode, maturityDate, documentType, detectedInsurer, appliedTemplate, additionalDetails, missingFields, uncertainFields, confidence, extractedText, fieldConfidenceMap, fieldEvidence.

Confidence rules:
- confidence is 0-100 and reflects evidence quality, not whether the field exists.
- Use high/medium/low in fieldConfidenceMap for individual fields.
- Do not inflate confidence just to make the result look good.
- If a value is clearly visible and supported by exact PDF text, mark it high.

The attached PDF is the only evidence. Do not answer from the filename.`;

async function callOpenRouter(fileData:string, fileName:string, instruction:string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured on the server.");
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const pdfData = `data:application/pdf;base64,${cleanBase64(fileData)}`;
  const body:any = {
    model,
    temperature: 0,
    messages: [{
      role: "user",
      content: [
        { type: "file", file: { filename: fileName, file_data: pdfData } },
        { type: "text", text: EXTRACTION_PROMPT(fileName, instruction) }
      ]
    }],
    response_format: { type: "json_object" }
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://v-shiroya-insurance.web.app",
        "X-Title": "V Shiroya Insurance PDF Analyzer"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const raw = await response.text();
    if (!response.ok) {
      let details = raw;
      try { details = JSON.stringify(JSON.parse(raw)); } catch {}
      throw new Error(`OpenRouter HTTP ${response.status}: ${details}`);
    }
    let payload:any;
    try { payload = JSON.parse(raw); } catch { throw new Error("OpenRouter returned invalid JSON."); }
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty AI response.");
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((x:any) => x?.text || "").join("") : JSON.stringify(content);
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try { return JSON.parse(cleaned); } catch { throw new Error(`OpenRouter returned non-JSON extraction output: ${cleaned.slice(0, 500)}`); }
  } finally { clearTimeout(timeout); }
}

async function analyzePolicyDocument(fileData:string|undefined,fileName:string,mimeType:string,instruction:string) {
  if (!fileData) throw new Error("The PDF data was not received by the server.");
  const pdf = cleanBase64(fileData);
  if (!pdf) throw new Error("The uploaded PDF is empty.");
  if (mimeType !== "application/pdf") throw new Error("Please upload a PDF document.");
  console.log(`OpenRouter PDF analysis started: ${fileName}`);
  const first = await callOpenRouter(pdf, fileName, instruction);
  const result = normalizeResult(first, { appliedTemplate: "OpenRouter PDF document analysis" });
  console.log(`OpenRouter PDF analysis completed: ${fileName} confidence=${result.confidence}%`);
  return result;
}

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"V Shiroya AI Backend",openrouterConfigured:Boolean(process.env.OPENROUTER_API_KEY),model:process.env.OPENROUTER_MODEL||"openrouter/free",timestamp:new Date().toISOString()}));
app.get("/api/auth/me",(_req,res)=>res.json({user:{id:"acc-1",name:"VIJAY SHIROYA",email:"vijay.ca@policyai.com",firmName:"VIJAY SHIROYA & Co. Chartered Accountants",role:"Senior Accountant / Auditor"}}));
app.post("/api/analyze-policy",async(req,res)=>{const{fileData,fileName,mimeType,instruction}=req.body||{};try{if(!fileName)return res.status(400).json({error:"Filename is required"});const extraction=await analyzePolicyDocument(fileData,fileName,mimeType||"application/pdf",instruction||"Extract the complete insurance document accurately.");addAuditLog("POLICY_ANALYSIS",`Analyzed PDF with OpenRouter: ${fileName}`,req);res.json({success:true,extraction});}catch(error:any){console.error("Policy analysis error:",error);res.status(500).json({error:"AI analysis failed.",details:error?.message||"Unknown analysis error",fileName:fileName||"uploaded_file"});}});
app.get("/api/policies",(req,res)=>{let policies=loadPolicies();const query=String(req.query.q||"").toLowerCase().trim();const status=String(req.query.status||"ALL");const provider=String(req.query.provider||"ALL");if(query)policies=policies.filter(p=>[p.ownerName,p.policyNumber,p.phoneNumber,p.providerCompany,p.policyType,p.category].some(v=>String(v||"").toLowerCase().includes(query)));if(status!=="ALL")policies=policies.filter(p=>p.policyStatus===status);if(provider!=="ALL")policies=policies.filter(p=>p.providerCompany===provider);res.json({success:true,count:policies.length,policies});});
app.post("/api/policies/check-duplicate",(req,res)=>{const{policyNumber,ownerName,phoneNumber}=req.body||{};const policies=loadPolicies();const duplicate=policies.find(p=>(policyNumber&&p.policyNumber&&String(p.policyNumber).toLowerCase().trim()===String(policyNumber).toLowerCase().trim())||(ownerName&&phoneNumber&&String(p.ownerName||"").toLowerCase().trim()===String(ownerName).toLowerCase().trim()&&p.phoneNumber===phoneNumber));res.json({isDuplicate:Boolean(duplicate),existingPolicy:duplicate||null});});
app.post("/api/policies",(req,res)=>{try{const policies=loadPolicies();const now=new Date().toISOString();const policy={...req.body,id:req.body?.id||`pol-${Date.now()}`,createdAt:now,updatedAt:now,userId:"acc-1"};policies.unshift(policy);savePolicies(policies);addAuditLog("POLICY_CREATED",`Saved policy #${policy.policyNumber}`,req);res.json({success:true,policy});}catch(error:any){res.status(500).json({error:"Failed to save policy record",details:error?.message});}});
app.put("/api/policies/:id",(req,res)=>{const policies=loadPolicies();const index=policies.findIndex(p=>p.id===req.params.id);if(index<0)return res.status(404).json({error:"Policy record not found"});policies[index]={...policies[index],...req.body,updatedAt:new Date().toISOString()};savePolicies(policies);addAuditLog("POLICY_UPDATED",`Updated policy #${policies[index].policyNumber}`,req);res.json({success:true,policy:policies[index]});});
app.delete("/api/policies/:id",(req,res)=>{const policies=loadPolicies();const existing=policies.find(p=>p.id===req.params.id);if(!existing)return res.status(404).json({error:"Policy not found"});savePolicies(policies.filter(p=>p.id!==req.params.id));addAuditLog("POLICY_DELETED",`Deleted policy #${existing.policyNumber}`,req);res.json({success:true});});
app.get("/api/stats",(_req,res)=>{const policies=loadPolicies();const currentMonth=new Date().toISOString().slice(0,7);res.json({totalPolicies:policies.length,activePolicies:policies.filter(p=>p.policyStatus==="ACTIVE").length,expiredPolicies:policies.filter(p=>p.policyStatus==="EXPIRED").length,expiringSoonPolicies:policies.filter(p=>p.policyStatus==="EXPIRING SOON").length,totalPremiumValue:policies.reduce((sum,p)=>sum+(Number(p.premiumAmount)||0),0),policiesAddedThisMonth:policies.filter(p=>String(p.createdAt||"").startsWith(currentMonth)).length});});
app.get("/api/security/audit",(_req,res)=>res.json({success:true,logs:loadAuditLogs()}));
const notificationHistoryLogs:any[]=[];
app.post("/api/notifications/send-alert",(req,res)=>{const{policyIds,channel="EMAIL",customMessage}=req.body||{};const policies=loadPolicies();const today=new Date();const targets=policies.filter(p=>{if(Array.isArray(policyIds)&&policyIds.length)return policyIds.includes(p.id);if(!p.endDate)return false;const days=Math.ceil((new Date(p.endDate).getTime()-today.getTime())/86400000);return days>=0&&days<=30;});const alerts=targets.map(p=>{const daysLeft=p.endDate?Math.ceil((new Date(p.endDate).getTime()-today.getTime())/86400000):30;const alert={id:`notif-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,policyId:p.id,policyNumber:p.policyNumber,ownerName:p.ownerName,recipientEmail:p.email||"N/A",recipientPhone:p.phoneNumber||"N/A",channel,subject:`Policy renewal notice - ${p.policyNumber}`,body:customMessage||`Your policy ${p.policyNumber} expires in ${daysLeft} days on ${p.endDate}.`,status:"GENERATED",sentAt:new Date().toISOString(),daysLeft};notificationHistoryLogs.unshift(alert);return alert;});res.json({success:true,message:`Generated ${alerts.length} ${channel} alert(s).`,countSent:alerts.length,alerts});});
app.get("/api/notifications/history",(_req,res)=>res.json({success:true,count:notificationHistoryLogs.length,logs:notificationHistoryLogs}));

async function startServer(){
  if(process.env.NODE_ENV!=="production"){
    const vite=await createViteServer({server:{middlewareMode:true},appType:"spa"});
    app.use(vite.middlewares);
  } else {
    const distPath=path.join(process.cwd(),"dist");
    app.use(express.static(distPath));
    app.get("*",(_req,res)=>res.sendFile(path.join(distPath,"index.html")));
  }
  app.listen(PORT,"0.0.0.0",()=>console.log(`V Shiroya AI Server listening on 0.0.0.0:${PORT}`));
}
startServer();
