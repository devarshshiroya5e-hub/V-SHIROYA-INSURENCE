import { PolicyRecord } from '../types';
import { getPdfFile } from './pdfStorage';

/**
 * Downloads the exact original document uploaded to the AI analyzer.
 * It never replaces the source document with a generated Microsoft/jsPDF summary.
 */
export const downloadPolicyPdf = async (policy: PolicyRecord) => {
  let docUrl = policy.documentUrl;

  // Prefer the exact uploaded source saved with the policy record.
  if (!docUrl && policy.id) {
    docUrl = await getPdfFile(policy.id);
  }

  // The analyzer stores the original document under its policy number.
  if (!docUrl && policy.policyNumber) {
    docUrl = await getPdfFile(policy.policyNumber);
  }

  // Also support documents uploaded before the policy number was known.
  if (!docUrl && policy.originalFileName) {
    docUrl = await getPdfFile(`upload:${policy.originalFileName}`);
  }

  if (!docUrl || typeof docUrl !== 'string') {
    window.alert('The original uploaded document is not available for this policy. Please upload/analyze the original document again and save the policy.');
    return;
  }

  let finalHref = docUrl;
  if (!docUrl.startsWith('data:') && !docUrl.startsWith('http') && !docUrl.startsWith('blob:')) {
    const mime = policy.fileType || 'application/pdf';
    finalHref = `data:${mime};base64,${docUrl}`;
  }

  const isPng = policy.fileType?.includes('png') || policy.originalFileName?.toLowerCase().endsWith('.png');
  const isJpg = policy.fileType?.includes('jpg') || policy.fileType?.includes('jpeg') || policy.originalFileName?.toLowerCase().endsWith('.jpg') || policy.originalFileName?.toLowerCase().endsWith('.jpeg');
  const defaultExt = isPng ? '.png' : isJpg ? '.jpg' : '.pdf';

  let cleanFileName = (policy.originalFileName || `Policy_${policy.policyNumber || 'Document'}`)
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!cleanFileName.toLowerCase().endsWith(defaultExt)) {
    cleanFileName += defaultExt;
  }

  const link = document.createElement('a');
  link.href = finalHref;
  link.download = cleanFileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
