import { PolicyRecord } from '../types';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return `₹${Number(val).toLocaleString('en-IN')}`;
}

export function downloadSinglePolicyExcel(policy: Partial<PolicyRecord>, customFilename?: string): void {
  const ownerName = policy.ownerName || 'Client';
  const policyNum = policy.policyNumber || 'Draft';
  const filename = customFilename || `${ownerName.replace(/[^a-zA-Z0-9]/g, '_')}_Policy_${policyNum}_Details.csv`;

  const rows: string[][] = [
    ['V SHIROYA INSURANCE - POLICY AUDIT REPORT & DETAILS'],
    ['Generated Date', new Date().toLocaleString()],
    ['Report Type', 'Single Policy Audit & Detail Worksheet'],
    [''],
    ['SECTION 1: POLICY & PROVIDER INFORMATION'],
    ['Field Name', 'Field Value'],
    ['Policy Number', policy.policyNumber || 'N/A'],
    ['Insurance Provider / Company', policy.providerCompany || 'N/A'],
    ['Policy Plan Type', policy.policyType || 'N/A'],
    ['Policy Category', policy.category || 'N/A'],
    ['Policy Current Status', policy.policyStatus || 'ACTIVE'],
    [''],
    ['SECTION 2: COVERAGE & FINANCIAL DETAILS'],
    ['Field Name', 'Field Value'],
    ['Premium Amount', formatCurrency(policy.premiumAmount)],
    ['Sum Assured / Insured Value', formatCurrency(policy.sumAssured)],
    ['Premium Payment Frequency', policy.premiumFrequency || 'N/A'],
    ['Payment Mode', policy.paymentMode || 'N/A'],
    ['Policy Start Date', policy.startDate || 'N/A'],
    ['Policy Expiry / End Date', policy.endDate || 'N/A'],
    ['Maturity Date', policy.maturityDate || 'N/A'],
    [''],
    ['SECTION 3: INSURED & NOMINEE INFORMATION'],
    ['Field Name', 'Field Value'],
    ['Policy Owner / Proposer', policy.ownerName || 'N/A'],
    ['Insured Person Name', policy.insuredPerson || policy.ownerName || 'N/A'],
    ['Date of Birth', policy.dateOfBirth || 'N/A'],
    ['Age', policy.age ?? 'N/A'],
    ['Age Source', policy.ageSource || 'N/A'],
    ['Nominee Name', policy.nominee || 'N/A'],
    ['Nominee Relationship', policy.nomineeRelationship || 'N/A'],
    [''],
    ['SECTION 4: CONTACT & AGENT DETAILS'],
    ['Field Name', 'Field Value'],
    ['Phone Number', policy.phoneNumber || 'N/A'],
    ['Email Address', policy.email || 'N/A'],
    ['Residential / Communication Address', policy.address || 'N/A'],
    ['Assigned Agent Name', policy.agentName || 'N/A'],
    ['Agent Phone Number', policy.agentPhone || 'N/A'],
    ['Servicing Branch Name', policy.branchName || 'N/A'],
    [''],
    ['SECTION 5: ADDITIONAL EXTRACTED METADATA'],
    ['Field Name', 'Field Value']
  ];

  if (policy.additionalDetails?.length) {
    policy.additionalDetails.forEach(item => rows.push([item.label || 'Detail', String(item.value || '')]));
  } else {
    rows.push(['Additional Field Notes', 'No secondary rider notes recorded']);
  }

  if (policy.fieldEvidence?.length) {
    rows.push(['']);
    rows.push(['SECTION 6: PDF EVIDENCE']);
    rows.push(['Field', 'Supporting text visible in PDF']);
    policy.fieldEvidence.forEach(item => rows.push([item.field, item.sourceText]));
  }

  rows.push(['']);
  rows.push(['System Audit Timestamp', new Date().toISOString()]);
  rows.push(['Verification Note', 'Values are extracted from the uploaded PDF; review fields marked uncertain before final filing.']);

  const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPoliciesBulkExcel(policies: PolicyRecord[], customFilename?: string): void {
  const filename = customFilename || `V_Shiroya_Insurance_Policies_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  const headers = [
    'Policy ID', 'Policy Number', 'Owner / Proposer Name', 'Insurance Provider', 'Policy Type / Plan', 'Category',
    'Policy Status', 'Premium Amount (₹)', 'Sum Assured (₹)', 'Payment Mode', 'Start Date', 'End Date',
    'Date of Birth', 'Age', 'Age Source', 'Insured Person', 'Nominee Name', 'Nominee Relation', 'Phone Number',
    'Email Address', 'Agent Name', 'Branch Name', 'Created Date'
  ];

  const dataRows = policies.map(p => [
    p.id, p.policyNumber, p.ownerName, p.providerCompany, p.policyType, p.category || 'General', p.policyStatus,
    p.premiumAmount ?? '', p.sumAssured ?? '', p.paymentMode || '', p.startDate || '', p.endDate || '',
    p.dateOfBirth || '', p.age ?? '', p.ageSource || '', p.insuredPerson || '', p.nominee || '', p.nomineeRelationship || '',
    p.phoneNumber || '', p.email || '', p.agentName || '', p.branchName || '', p.createdAt || ''
  ]);

  const totalPremium = policies.reduce((sum, p) => sum + (Number(p.premiumAmount) || 0), 0);
  const totalSumAssured = policies.reduce((sum, p) => sum + (Number(p.sumAssured) || 0), 0);
  const summaryRow = ['TOTALS', `Total Count: ${policies.length}`, '', '', '', '', '', totalPremium, totalSumAssured, '', '', '', '', '', '', '', '', '', '', '', '', '', ''];

  const allRows = [
    ['V SHIROYA INSURANCE PORTAL - POLICIES MASTER EXCEL SHEET'],
    [`Export Date: ${new Date().toLocaleString()}`, `Total Policy Records: ${policies.length}`],
    [''],
    headers,
    ...dataRows,
    [''],
    summaryRow
  ];

  const csvContent = '\uFEFF' + allRows.map(r => r.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
