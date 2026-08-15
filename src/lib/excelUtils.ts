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
    ['Age', String(policy.age ?? 'N/A')],
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

export function downloadPoliciesBulkExcel(policies: PolicyRecord[], customFilename = 'V_Shiroya_Policy_Bulk_Audit.csv'): void {
  const headers = ['Owner Name', 'Policy Number', 'Provider', 'Policy Type', 'Category', 'Status', 'Start Date', 'End Date', 'Premium', 'Sum Assured', 'Phone', 'Email', 'Age', 'Original File'];
  const rows = policies.map(policy => [
    policy.ownerName,
    policy.policyNumber,
    policy.providerCompany,
    policy.policyType,
    policy.category,
    policy.policyStatus,
    policy.startDate || 'N/A',
    policy.endDate || 'N/A',
    formatCurrency(policy.premiumAmount),
    formatCurrency(policy.sumAssured),
    policy.phoneNumber || 'N/A',
    policy.email || 'N/A',
    String(policy.age ?? 'N/A'),
    policy.originalFileName || 'policy_document.pdf'
  ].map(escapeCsvCell));

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell), ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = customFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
