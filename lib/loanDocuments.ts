// Loan Application Document Requirements
// Defines required documents based on loan type and employment type

export interface DocumentRequirement {
  id: string;
  label: string;
  description: string;
  category: 'identity' | 'income' | 'banking' | 'property' | 'business' | 'other';
  required: boolean;
  externalLink?: string;
  accepts?: string; // File types accepted
}

// Common documents for all loan types
const COMMON_DOCUMENTS: DocumentRequirement[] = [
  {
    id: 'bank_israel_credit_report',
    label: 'דוח אשראי מבנק ישראל',
    description: 'דוח דירוג לקוח מבנק ישראל (חובה)',
    category: 'banking',
    required: true,
    externalLink: 'https://www.boi.org.il/he/ConsumerInformation/CreditData/Pages/Default.aspx',
    accepts: '.pdf',
  },
  {
    id: 'bank_account_confirmation',
    label: 'אישור ניהול חשבון בנק',
    description: 'אישור מהבנק או צילום צ\'ק',
    category: 'banking',
    required: true,
    accepts: '.pdf,.jpg,.jpeg,.png',
  },
  {
    id: 'bank_statements_3months',
    label: 'דוחות חשבון בנק (3 חודשים)',
    description: 'דוחות עו"ש בנקאיים של 3 החודשים האחרונים',
    category: 'banking',
    required: true,
    accepts: '.pdf',
  },
];

// Employee-specific documents
const EMPLOYEE_DOCUMENTS: DocumentRequirement[] = [
  {
    id: 'payslips_3months',
    label: 'תלושי שכר (3 חודשים)',
    description: '3 תלושי שכר אחרונים שלך',
    category: 'income',
    required: true,
    accepts: '.pdf,.jpg,.jpeg,.png',
  },
];

// Spouse employee documents
const SPOUSE_EMPLOYEE_DOCUMENTS: DocumentRequirement[] = [
  {
    id: 'spouse_payslips_3months',
    label: 'תלושי שכר של בן/בת הזוג (3 חודשים)',
    description: '3 תלושי שכר אחרונים של בן/בת הזוג',
    category: 'income',
    required: true,
    accepts: '.pdf,.jpg,.jpeg,.png',
  },
];

// Self-employed documents
const SELF_EMPLOYED_DOCUMENTS: DocumentRequirement[] = [
  {
    id: 'profit_loss_report',
    label: 'דוח רווח והפסד',
    description: 'דוח רווח והפסד של השנה האחרונה',
    category: 'income',
    required: true,
    accepts: '.pdf',
  },
  {
    id: 'tax_assessment_2years',
    label: 'דוחות שומה (שנתיים)',
    description: 'דוחות שומה של שנתיים אחרונות',
    category: 'income',
    required: true,
    accepts: '.pdf',
  },
];

// Business owner documents
const BUSINESS_OWNER_DOCUMENTS: DocumentRequirement[] = [
  ...SELF_EMPLOYED_DOCUMENTS,
  {
    id: 'company_financial_reports',
    label: 'דוחות כספיים של החברה',
    description: 'דוחות כספיים מלאים של החברה',
    category: 'business',
    required: true,
    accepts: '.pdf',
  },
  {
    id: 'company_bank_statements',
    label: 'חשבונות בנק של החברה',
    description: 'דוחות חשבון בנק של החברה (3 חודשים)',
    category: 'business',
    required: true,
    accepts: '.pdf',
  },
  {
    id: 'accountant_reports',
    label: 'דיווחים מרואה חשבון',
    description: 'דיווחים שנתיים מרואה חשבון',
    category: 'business',
    required: true,
    accepts: '.pdf',
  },
  {
    id: 'company_annual_reports',
    label: 'דיווחים שנתיים לחברה',
    description: 'כל הדיווחים השנתיים הרלוונטיים',
    category: 'business',
    required: true,
    accepts: '.pdf',
  },
];

// Mortgage-specific documents
const MORTGAGE_DOCUMENTS: DocumentRequirement[] = [
  {
    id: 'tabu_excerpt',
    label: 'נסח טאבו',
    description: 'נסח טאבו עדכני של הנכס או אישור מחברה משכנת',
    category: 'property',
    required: true,
    accepts: '.pdf',
  },
  {
    id: 'contractor_requirements',
    label: 'דרישות הקבלן',
    description: 'מסמך דרישות הקבלן לקבלת ההלוואה (אם רלוונטי)',
    category: 'property',
    required: false,
    accepts: '.pdf',
  },
  {
    id: 'existing_mortgage_schedule',
    label: 'לוח סילוקין של משכנתא קיימת',
    description: 'לוח סילוקין אם יש משכנתא עומדת',
    category: 'property',
    required: false,
    accepts: '.pdf',
  },
];

/**
 * Get required documents based on application type and employment type
 */
export function getRequiredDocuments(
  applicationType: 'regular' | 'mortgage',
  employmentType: 'employee' | 'self_employed' | 'business_owner' | 'spouse_employee'
): DocumentRequirement[] {
  const documents: DocumentRequirement[] = [...COMMON_DOCUMENTS];

  // Add employment-specific documents
  switch (employmentType) {
    case 'employee':
      documents.push(...EMPLOYEE_DOCUMENTS);
      break;
    case 'self_employed':
      documents.push(...SELF_EMPLOYED_DOCUMENTS);
      break;
    case 'business_owner':
      documents.push(...BUSINESS_OWNER_DOCUMENTS);
      break;
    case 'spouse_employee':
      documents.push(...EMPLOYEE_DOCUMENTS);
      documents.push(...SPOUSE_EMPLOYEE_DOCUMENTS);
      break;
  }

  // Add mortgage-specific documents
  if (applicationType === 'mortgage') {
    documents.push(...MORTGAGE_DOCUMENTS);
  }

  return documents;
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage(
  requiredDocs: DocumentRequirement[],
  uploadedDocs: string[]
): number {
  const requiredCount = requiredDocs.filter(d => d.required).length;
  const uploadedRequiredCount = requiredDocs
    .filter(d => d.required && uploadedDocs.includes(d.id))
    .length;
  
  return requiredCount > 0 ? Math.round((uploadedRequiredCount / requiredCount) * 100) : 0;
}

/**
 * Get missing required documents
 */
export function getMissingDocuments(
  requiredDocs: DocumentRequirement[],
  uploadedDocs: string[]
): DocumentRequirement[] {
  return requiredDocs.filter(d => d.required && !uploadedDocs.includes(d.id));
}

