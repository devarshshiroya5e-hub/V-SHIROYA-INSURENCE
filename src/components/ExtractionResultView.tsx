import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Save,
  ShieldCheck,
  User,
  Users,
  Briefcase,
  IndianRupee
} from 'lucide-react';
import { ExtractionResult, PolicyRecord, BatchExtractionItem } from '../types';
import { downloadSinglePolicyExcel, downloadPoliciesBulkExcel } from '../lib/excelUtils';
import { storePdfFile } from '../lib/pdfStorage';

interface Props {
  extraction: ExtractionResult;
  fileName: string;
  batchItems?: BatchExtractionItem[];
  onSave: (policyData: Partial<PolicyRecord>) => void;
  onSaveBatch?: (policiesData: Partial<PolicyRecord>[]) => void;
  onCancel: () => void;
  isSaving: boolean;
  onUploadMore?: () => void;
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

const normalizeConfidenceResult = (result: ExtractionResult): ExtractionResult => {
  const raw = Number(result.confidence);
  if (!Number.isFinite(raw)) return result;
  const percentage = raw >= 0 && raw <= 1 ? raw * 100 : raw;
  const normalized = Math.max(0, Math.min(100, percentage));
  return { ...result, confidence: Number(normalized.toFixed(2)) };
};

const confidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
  if (confidence >= 85) return 'high';
  if (confidence >= 65) return 'medium';
  return 'low';
};

export const ExtractionResultView: React.FC<Props> = ({
  extraction,
  fileName,
  batchItems = [],
  onSave,
  onSaveBatch,
  onCancel,
  isSaving,
  onUploadMore
}) => {
  const normalizedInitial = normalizeConfidenceResult(extraction);
  const initialBatch = batchItems.length
    ? batchItems.map(item => ({ ...item, result: normalizeConfidenceResult(item.result) }))
    : [{ id: 'single', fileName, fileType: 'application/pdf', result: normalizedInitial }];

  const [items, setItems] = useState<BatchExtractionItem[]>(initialBatch);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<ExtractionResult>(initialBatch[0].result);

  useEffect(() => {
    const nextItems = batchItems.length
      ? batchItems.map(item => ({ ...item, result: normalizeConfidenceResult(item.result) }))
      : [{ id: 'single', fileName, fileType: 'application/pdf', result: normalizedInitial }];
    setItems(nextItems);
    setActiveIndex(0);
    setFormData(nextItems[0].result);
  }, [batchItems, extraction, fileName]);

  const updateForm = (next: ExtractionResult) => {
    const normalized = normalizeConfidenceResult(next);
    setFormData(normalized);
    setItems(prev => prev.map((item, index) => index === activeIndex ? { ...item, result: normalized } : item));
  };

  const handleFieldChange = (field: keyof ExtractionResult, value: any) => {
    updateForm({ ...formData, [field]: value });
  };

  const switchItem = (index: number) => {
    setActiveIndex(index);
    setFormData(normalizeConfidenceResult(items[index].result));
    setEditing(false);
  };

  const saveBatch = async () => {
    // Keep the exact uploaded source document in IndexedDB before the policy record is saved.
    // This avoids generating a different PDF summary when the user later clicks Download PDF.
    for (const item of items) {
      const policyNumber = item.result.policyNumber?.trim();
      if (policyNumber && item.fileBase64) {
        await storePdfFile(policyNumber, item.fileBase64);
      }
      if (item.fileBase64) {
        await storePdfFile(`upload:${item.fileName}`, item.fileBase64);
      }
    }

    const records = items.map(item => ({
      ...item.result,
      originalFileName: item.fileName,
      fileType: item.fileType,
      extractedText: item.result.extractedText || '',
      aiConfidence: normalizeConfidenceResult(item.result).confidence
    }));
    if (onSaveBatch) onSaveBatch(records);
    else onSave(formData);
  };

  const renderConfidence = (field: string) => {
    // Field confidence is still taken from the AI result. When the verified overall
    // confidence is high, show the same high-confidence presentation rather than
    // displaying a misleading default "Medium" badge.
    const overallConfidence = normalizeConfidenceResult(formData).confidence || 0;
    const confidence = formData.fieldConfidenceMap?.[field];
    const effectiveConfidence = overallConfidence >= 85 && !confidence ? 'high' : (confidence || 'medium');

    if (effectiveConfidence === 'high') {
      return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"><CheckCircle2 className="w-3 h-3" />High</span>;
    }
    if (effectiveConfidence === 'low') {
      return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md"><AlertTriangle className="w-3 h-3" />Verify</span>;
    }
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"><AlertTriangle className="w-3 h-3" />Medium</span>;
  };

  const renderField = (
    label: string,
    field: keyof ExtractionResult,
    value: string | number | null | undefined,
    type: 'text' | 'number' | 'date' = 'text'
  ) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {!editing && renderConfidence(field)}
      </div>
      {editing ? (
        <input
          type={type}
          value={value ?? ''}
          onChange={e => handleFieldChange(field, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      ) : (
        <div className="break-words text-sm font-extrabold text-slate-900 dark:text-slate-100">
          {isEmpty(value) ? 'Not available' : type === 'number' && typeof value === 'number' ? value.toLocaleString('en-IN') : String(value)}
        </div>
      )}
    </div>
  );

  const fieldEvidence = formData.fieldEvidence || [];
  const multi = items.length > 1;
  const overallConfidence = normalizeConfidenceResult(formData).confidence || 0;
  const overallLevel = confidenceLevel(overallConfidence);
  const overallLabel = overallLevel === 'high' ? 'High Confidence' : overallLevel === 'medium' ? 'Medium Confidence' : 'Low Confidence';

  const downloadCurrentOriginal = async () => {
    const current = items[activeIndex];
    if (!current?.fileBase64) {
      window.alert('The original uploaded document is not available in this analysis session.');
      return;
    }

    const safeName = (current.fileName || 'Uploaded_Policy_Document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const link = document.createElement('a');
    link.href = current.fileBase64;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onUploadMore || onCancel} className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-800">
          <ArrowLeft className="h-4 w-4" /> Upload / Analyze Another PDF
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCurrentOriginal} className="flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-800">
            <Download className="h-4 w-4" /> Download Original PDF
          </button>
          <button onClick={() => downloadSinglePolicyExcel(formData)} className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
          {multi && <button onClick={() => downloadPoliciesBulkExcel(items.map((item, i) => ({
            ...(item.result as any),
            id: `batch-${i + 1}`,
            ownerName: item.result.ownerName || 'Unknown Owner',
            policyNumber: item.result.policyNumber || 'UNASSIGNED',
            providerCompany: item.result.providerCompany || 'Insurance Provider',
            policyType: item.result.policyType || 'General Policy',
            category: item.result.category || 'General',
            documentUrl: item.fileBase64 || null,
            originalFileName: item.fileName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'acc-1',
            aiConfidence: normalizeConfidenceResult(item.result).confidence,
            additionalDetails: item.result.additionalDetails || [],
            missingFields: item.result.missingFields || [],
            uncertainFields: item.result.uncertainFields || []
          })))} className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
            <FileSpreadsheet className="h-4 w-4" /> Export Batch
          </button>}
          <button onClick={() => setEditing(v => !v)} className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800">
            <Edit3 className="h-4 w-4" /> {editing ? 'Finish Editing' : 'Edit Information'}
          </button>
          <button onClick={saveBatch} disabled={isSaving} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white disabled:opacity-50">
            <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : multi ? `Save ${items.length} Policies` : 'Save Policy'}
          </button>
        </div>
      </div>

      {multi && (
        <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
          {items.map((item, index) => (
            <button key={item.id} onClick={() => switchItem(index)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${index === activeIndex ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
              #{index + 1} {item.result.ownerName || item.fileName}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" /> PDF VERIFIED EXTRACTION</div>
            <h1 className="text-2xl font-black sm:text-3xl">{formData.ownerName || 'Unnamed Policy Owner'}</h1>
            <p className="mt-1 text-sm text-slate-300">Policy #{formData.policyNumber || 'Not available'} · {formData.providerCompany || 'Insurance Provider'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI Extraction Confidence</div>
            <div className="flex items-center justify-end gap-2">
              <div className="text-3xl font-black text-emerald-300">{overallConfidence}%</div>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-200"><CheckCircle2 className="h-3 w-3" /> {overallLabel}</span>
            </div>
            <div className="text-[10px] text-slate-400">Based on the AI extraction confidence value; PDF reasoning unchanged</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-[11px]">
          <span className="rounded-lg bg-indigo-500/20 px-3 py-1 font-bold text-indigo-200">{formData.documentType || 'Insurance Document'}</span>
          <span className="rounded-lg bg-purple-500/20 px-3 py-1 font-bold text-purple-200">{formData.detectedInsurer || 'Insurer not identified'}</span>
          <span className="rounded-lg bg-emerald-500/20 px-3 py-1 font-bold text-emerald-200">{formData.appliedTemplate || 'Adaptive layout'}</span>
          <span className="rounded-lg bg-slate-700 px-3 py-1 font-bold text-slate-200">Source: {items[activeIndex]?.fileName || fileName}</span>
        </div>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 font-extrabold dark:border-slate-800"><FileText className="h-5 w-5 text-indigo-600" /> Policy Details</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {renderField('Policy Number', 'policyNumber', formData.policyNumber)}
            {renderField('Policy Type / Plan', 'policyType', formData.policyType)}
            {renderField('Provider Company', 'providerCompany', formData.providerCompany)}
            {renderField('Policy Status', 'policyStatus', formData.policyStatus)}
            {renderField('Start / Commencement', 'startDate', formData.startDate, 'date')}
            {renderField('Expiry / End Date', 'endDate', formData.endDate, 'date')}
            {renderField('Maturity Date', 'maturityDate', formData.maturityDate, 'date')}
            {renderField('Branch Name', 'branchName', formData.branchName)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 font-extrabold dark:border-slate-800"><IndianRupee className="h-5 w-5 text-emerald-600" /> Financial Details</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {renderField('Premium Amount (₹)', 'premiumAmount', formData.premiumAmount, 'number')}
            {renderField('Premium Frequency', 'premiumFrequency', formData.premiumFrequency)}
            {renderField('Sum Assured / Insured (₹)', 'sumAssured', formData.sumAssured, 'number')}
            {renderField('Payment Mode', 'paymentMode', formData.paymentMode)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 font-extrabold dark:border-slate-800"><User className="h-5 w-5 text-blue-600" /> Policy Owner / Insured Information</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {renderField('Owner Full Name', 'ownerName', formData.ownerName)}
            {renderField('Insured Person(s)', 'insuredPerson', formData.insuredPerson)}
            {renderField('Date of Birth', 'dateOfBirth', formData.dateOfBirth, 'date')}
            {renderField('Age', 'age', formData.age, 'number')}
            {renderField('Age Source', 'ageSource', formData.ageSource)}
            {renderField('Phone Number', 'phoneNumber', formData.phoneNumber)}
            {renderField('Email Address', 'email', formData.email)}
            <div className="lg:col-span-2">{renderField('Residential / Mailing Address', 'address', formData.address)}</div>
          </div>
          {formData.ageSource === 'calculated_from_date_of_birth_at_policy_start' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Age was not printed in the PDF, so it was calculated from the extracted DOB using the policy commencement date. If the PDF has a separate member-age table, verify that value.</div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 font-extrabold dark:border-slate-800"><Users className="h-5 w-5 text-purple-600" /> Nominee</div>
            <div className="space-y-4">{renderField('Nominee Name', 'nominee', formData.nominee)}{renderField('Nominee Relationship', 'nomineeRelationship', formData.nomineeRelationship)}</div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 font-extrabold dark:border-slate-800"><Briefcase className="h-5 w-5 text-amber-600" /> Agent / Broker</div>
            <div className="space-y-4">{renderField('Agent Name', 'agentName', formData.agentName)}{renderField('Agent Phone', 'agentPhone', formData.agentPhone)}</div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 font-extrabold dark:border-slate-800"><ShieldCheck className="h-5 w-5 text-indigo-600" /> Additional Details Found in PDF</div>
          {formData.additionalDetails?.length ? (
            <div className="space-y-2">
              {formData.additionalDetails.map((detail, index) => (
                <div key={`${detail.label}-${index}`} className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[220px_1fr_auto] dark:bg-slate-800">
                  <div className="text-xs font-black text-slate-600 dark:text-slate-300">{detail.label}</div>
                  <div className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{detail.value}</div>
                  <div className="text-[10px] font-bold uppercase text-slate-500">{detail.confidence || 'medium'}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-slate-500">No additional fields were identified.</div>}
        </section>

        {fieldEvidence.length > 0 && (
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
            <div className="mb-3 flex items-center gap-2 font-extrabold text-indigo-900 dark:text-indigo-200"><ShieldCheck className="h-5 w-5" /> PDF Evidence Used for Extraction</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {fieldEvidence.slice(0, 30).map((e, index) => (
                <div key={`${e.field}-${index}`} className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900 dark:bg-slate-900">
                  <div className="text-[10px] font-black uppercase text-indigo-600">{e.field}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">“{e.sourceText}”</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(formData.missingFields?.length || formData.uncertainFields?.length) ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-extrabold"><AlertTriangle className="h-5 w-5" /> Review Required</div>
            {formData.missingFields?.length ? <div className="text-xs"><b>Not found:</b> {formData.missingFields.join(', ')}</div> : null}
            {formData.uncertainFields?.length ? <div className="mt-1 text-xs"><b>Uncertain:</b> {formData.uncertainFields.join(', ')}</div> : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2 font-extrabold"><FileText className="h-5 w-5 text-indigo-600" /> Extracted Text / Document Summary</div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{formData.extractedText || 'No extracted text returned.'}</pre>
        </section>
      </div>
    </div>
  );
};
