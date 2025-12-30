/**
 * Income Categories for Phi
 * Synced from income_categories table
 */

export interface IncomeCategoryDef {
  id: string;
  name: string;
  group: string;
  type: 'fixed' | 'variable' | 'passive' | 'one_time';
  keywords: string[];
}

export const INCOME_SUPER_GROUPS = {
  'הכנסות קבועות': ['משכורת', 'קצבאות'],
  'הכנסות עצמאיות': ['עצמאי', 'עסק'],
  'הכנסות פסיביות': ['השקעות', 'נכסים'],
  'הכנסות אחרות': ['אחר', 'העברות'],
};

// Generated from DB: income_categories
export const INCOME_CATEGORIES: IncomeCategoryDef[] = [
  // --- משכורת ---
  { id: 'inc_1', name: 'משכורת', group: 'משכורת', type: 'fixed', keywords: ['משכורת', 'שכר', 'salary', 'wages'] },
  { id: 'inc_2', name: 'בונוס', group: 'משכורת', type: 'variable', keywords: ['בונוס', 'מענק', 'bonus'] },
  { id: 'inc_3', name: 'שעות נוספות', group: 'משכורת', type: 'variable', keywords: ['שעות נוספות', 'overtime'] },
  { id: 'inc_4', name: 'שכר חודש 13', group: 'משכורת', type: 'one_time', keywords: ['חודש 13', 'משכורת 13'] },
  { id: 'inc_5', name: 'דמי הבראה', group: 'משכורת', type: 'one_time', keywords: ['הבראה', 'דמי הבראה'] },

  // --- עצמאי ---
  { id: 'inc_6', name: 'הכנסה מעוסק פטור', group: 'עצמאי', type: 'variable', keywords: ['עוסק פטור', 'פרילנס', 'freelance'] },
  { id: 'inc_7', name: 'הכנסה מעוסק מורשה', group: 'עצמאי', type: 'variable', keywords: ['עוסק מורשה', 'עצמאי'] },
  { id: 'inc_8', name: 'הכנסה מחברה', group: 'עצמאי', type: 'variable', keywords: ['חברה בעמ', 'בע"מ', 'company'] },

  // --- עסק ---
  { id: 'inc_9', name: 'הכנסה מעסק', group: 'עסק', type: 'variable', keywords: ['עסק', 'הכנסה עסקית', 'business'] },
  { id: 'inc_10', name: 'מכירות', group: 'עסק', type: 'variable', keywords: ['מכירות', 'sales', 'תקבולים'] },
  { id: 'inc_11', name: 'שירותים', group: 'עסק', type: 'variable', keywords: ['שירותים', 'services', 'ייעוץ'] },
  { id: 'inc_12', name: 'תמלוגים', group: 'עסק', type: 'passive', keywords: ['תמלוגים', 'royalties', 'רישוי'] },

  // --- השקעות ---
  { id: 'inc_13', name: 'דיבידנדים', group: 'השקעות', type: 'passive', keywords: ['דיבידנד', 'dividend', 'מניות'] },
  { id: 'inc_14', name: 'ריבית', group: 'השקעות', type: 'passive', keywords: ['ריבית', 'interest', 'פיקדון'] },
  { id: 'inc_15', name: 'רווחי הון', group: 'השקעות', type: 'one_time', keywords: ['רווח הון', 'capital gain', 'מכירת מניות'] },
  { id: 'inc_16', name: 'השקעות', group: 'השקעות', type: 'passive', keywords: ['השקעות', 'investments', 'תשואה'] },

  // --- נכסים ---
  { id: 'inc_17', name: 'שכר דירה', group: 'נכסים', type: 'fixed', keywords: ['שכר דירה', 'שכירות', 'rent', 'השכרה'] },

  // --- קצבאות ---
  { id: 'inc_18', name: 'קצבת זקנה', group: 'קצבאות', type: 'fixed', keywords: ['קצבת זקנה', 'פנסיה', 'pension'] },
  { id: 'inc_19', name: 'קצבת נכות', group: 'קצבאות', type: 'fixed', keywords: ['קצבת נכות', 'נכות', 'disability'] },
  { id: 'inc_20', name: 'קצבת אבטלה', group: 'קצבאות', type: 'fixed', keywords: ['אבטלה', 'דמי אבטלה', 'unemployment'] },
  { id: 'inc_21', name: 'דמי לידה', group: 'קצבאות', type: 'one_time', keywords: ['דמי לידה', 'לידה', 'maternity'] },
  { id: 'inc_22', name: 'גמלת ילדים', group: 'קצבאות', type: 'fixed', keywords: ['גמלת ילדים', 'ילדים', 'child allowance'] },
  { id: 'inc_23', name: 'דמי מילואים', group: 'קצבאות', type: 'one_time', keywords: ['מילואים', 'reserve'] },
  { id: 'inc_24', name: 'ביטוח לאומי', group: 'קצבאות', type: 'fixed', keywords: ['ביטוח לאומי', 'גמלה'] },

  // --- אחר ---
  { id: 'inc_25', name: 'החזר מס', group: 'אחר', type: 'one_time', keywords: ['החזר מס', 'זיכוי מס', 'tax refund'] },
  { id: 'inc_26', name: 'מתנה', group: 'אחר', type: 'one_time', keywords: ['מתנה', 'gift', 'מתנה כספית'] },
  { id: 'inc_27', name: 'ירושה', group: 'אחר', type: 'one_time', keywords: ['ירושה', 'inheritance'] },
  { id: 'inc_28', name: 'פיצויים', group: 'אחר', type: 'one_time', keywords: ['פיצויים', 'פיצויי פיטורין', 'severance'] },
  { id: 'inc_29', name: 'זכייה', group: 'אחר', type: 'one_time', keywords: ['זכייה', 'פרס', 'לוטו', 'prize'] },
  
  // --- העברות ---
  { id: 'inc_30', name: 'העברה נכנסת', group: 'העברות', type: 'variable', keywords: ['העברה', 'transfer', 'העברה נכנסת'] },
  
  // --- ברירת מחדל ---
  { id: 'inc_31', name: 'הכנסה אחרת', group: 'אחר', type: 'variable', keywords: ['אחר', 'הכנסה אחרת', 'other'] },
];

/**
 * Find best matching income category
 */
export function findBestIncomeMatch(text: string): IncomeCategoryDef | null {
  if (!text || text.length < 2) return null;
  
  const t = text.toLowerCase().trim();
  
  // 1. Exact name match
  const exact = INCOME_CATEGORIES.find(c => c.name.toLowerCase() === t);
  if (exact) return exact;

  // 2. Exact keyword match
  const keywordExact = INCOME_CATEGORIES.find(c => 
    c.keywords.some(k => k.toLowerCase() === t)
  );
  if (keywordExact) return keywordExact;
  
  // 3. Group match
  const groupExact = INCOME_CATEGORIES.find(c => c.group.toLowerCase() === t);
  if (groupExact) return groupExact;
  
  // 4. Partial keyword match
  const keywordPartial = INCOME_CATEGORIES.find(c => 
    c.keywords.some(k => k.toLowerCase().includes(t) || t.includes(k.toLowerCase()))
  );
  if (keywordPartial) return keywordPartial;
  
  // 5. Partial name match
  const partialMatch = INCOME_CATEGORIES.find(c => 
    c.name.toLowerCase().includes(t) || t.includes(c.name.toLowerCase())
  );
  if (partialMatch) return partialMatch;
  
  // 6. Word-based fuzzy search
  const words = t.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    for (const word of words) {
      // Keywords first
      const keywordWordMatch = INCOME_CATEGORIES.find(c => 
        c.keywords.some(k => k.toLowerCase().includes(word))
      );
      if (keywordWordMatch) return keywordWordMatch;
      
      // Then name and group
      const wordMatch = INCOME_CATEGORIES.find(c => 
        c.name.toLowerCase().includes(word) || 
        c.group.toLowerCase().includes(word)
      );
      if (wordMatch) return wordMatch;
    }
  }

  return null;
}

/**
 * Find top matching income categories with scores
 */
export function findTopIncomeMatches(text: string, limit: number = 3): IncomeCategoryDef[] {
  if (!text || text.length < 2) return [];
  
  const t = text.toLowerCase().trim();
  const words = t.split(/\s+/).filter(w => w.length > 2);
  
  const scored = INCOME_CATEGORIES.map(cat => {
    let score = 0;
    const name = cat.name.toLowerCase();
    const group = cat.group.toLowerCase();
    const keywords = cat.keywords.map(k => k.toLowerCase());
    
    // Exact matches
    if (name === t) score += 100;
    if (group === t) score += 80;
    if (keywords.includes(t)) score += 90;
    
    // Partial matches
    if (name.includes(t)) score += 50;
    if (t.includes(name)) score += 40;
    keywords.forEach(k => {
      if (k.includes(t) || t.includes(k)) score += 30;
    });
    
    // Word matches
    words.forEach(word => {
      if (name.includes(word)) score += 20;
      if (group.includes(word)) score += 15;
      keywords.forEach(k => {
        if (k.includes(word)) score += 10;
      });
    });
    
    return { cat, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.cat);
}

/**
 * Get all income categories by group
 */
export function getIncomeCategoriesByGroup(group: string): IncomeCategoryDef[] {
  return INCOME_CATEGORIES.filter(c => c.group === group);
}

/**
 * Get all unique income category groups
 */
export function getIncomeGroups(): string[] {
  return [...new Set(INCOME_CATEGORIES.map(c => c.group))];
}

