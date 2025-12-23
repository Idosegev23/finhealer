export interface CategoryDef {
  id: string;
  name: string;
  group: string;
  type: 'fixed' | 'variable' | 'special';
  keywords: string[];
}

export const SUPER_GROUPS = {
  'מגורים ומחיה': ['דיור', 'מזון', 'תקשורת'],
  'משפחה ובריאות': ['בריאות', 'חינוך', 'ביטוחים', 'חיות מחמד'],
  'פנאי וקניות': ['בילויים', 'אישי', 'מנויים', 'מתנות', 'אירועים'],
  'תחבורה': ['רכב'],
  'עסק': ['משרד', 'שיווק', 'עובדים', 'ייעוץ', 'מיסים', 'עיסקי', 'משפטי', 'שירותים', 'לימודים'],
  'פיננסים': ['פיננסים', 'העברות פיננסיות'],
};

// Generated from DB: expense_categories
export const CATEGORIES: CategoryDef[] = [
  // --- אירועים ---
  { id: 'cat_140', name: 'אירועים משפחתיים (חתונה בר מצווה וכו\')', group: 'אירועים', type: 'special', keywords: [] },

  // --- אישי ---
  { id: 'cat_107', name: 'ביגוד', group: 'אישי', type: 'variable', keywords: [] },
  { id: 'cat_108', name: 'קוסמטיקה וטיפוח', group: 'אישי', type: 'variable', keywords: [] },

  // --- ביטוחים ---
  { id: 'cat_26', name: 'ביטוח חיים', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_27', name: 'ביטוח בריאות', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_28', name: 'ביטוח מבנה מגורים', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_29', name: 'ביטוח מבנה עסקי', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_30', name: 'ביטוח תכולהמגורים', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_31', name: 'ביטוח תכולה עסקי', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_43', name: 'ביטוח לאובדן כושר עבודה', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_44', name: 'ביטוח רכב', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_45', name: 'ביטוח עסק', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_46', name: 'ביטוח דירה', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_47', name: 'חיסכון פנסיוני', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_48', name: 'ביטוח אחריות מקצועית', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_49', name: 'ביטוח צד ג\'', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_50', name: 'ביטוח חובה לרכב', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_51', name: 'ביטוח חיות מחמד', group: 'ביטוחים', type: 'fixed', keywords: [] },
  { id: 'cat_52', name: 'ביטוח בריאות לעובדים', group: 'ביטוחים', type: 'fixed', keywords: [] },

  // --- בילויים ---
  { id: 'cat_109', name: 'חופשות', group: 'בילויים', type: 'variable', keywords: [] },
  { id: 'cat_110', name: 'בילויים ובידור', group: 'בילויים', type: 'variable', keywords: [] },

  // --- בריאות ---
  { id: 'cat_18', name: 'תרופות', group: 'בריאות', type: 'fixed', keywords: [] },
  { id: 'cat_19', name: 'טיפולי שיניים', group: 'בריאות', type: 'fixed', keywords: [] },
  { id: 'cat_20', name: 'קופת חולים', group: 'בריאות', type: 'fixed', keywords: [] },
  { id: 'cat_114', name: 'טיפול רגשי / פסיכולוג', group: 'בריאות', type: 'variable', keywords: [] },
  { id: 'cat_115', name: 'טיפולים רפואיים פרטיים', group: 'בריאות', type: 'variable', keywords: [] },
  { id: 'cat_116', name: 'רופא משפחה פרטי', group: 'בריאות', type: 'variable', keywords: [] },

  // --- דיור ---
  { id: 'cat_1', name: 'ארנונה למגורים', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_2', name: 'ארנונה לעסק', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_3', name: 'חשמל לבית', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_4', name: 'חשמל לעסק', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_5_1', name: 'מים למגורים', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_5_2', name: 'מים לעסק', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_6', name: 'גז', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_7', name: 'ועד בית', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_8', name: 'דמי ניהול בבניין משרדים', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_9', name: 'שכירות למגורים', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_10', name: 'שכירות משרד / קליניקה', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_11', name: 'תיקונים בבית', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_12', name: 'אחזקת מבנה / עסק', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_13', name: 'ניקיון עסק', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_14', name: 'ניקיון חיצוני / עוזרת', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_15', name: 'גינון לעסק', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_16', name: 'גינון למגורים', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_17', name: 'טכנאים (מזגן מקרר וכו\') לעסק', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_95', name: 'ניקיון בית', group: 'דיור', type: 'variable', keywords: [] },
  { id: 'cat_96', name: 'טכנאים (מזגן מקרר וכו\') למגורים', group: 'דיור', type: 'fixed', keywords: [] },
  { id: 'cat_97', name: 'ציוד ניקיון / תחזוקה', group: 'דיור', type: 'variable', keywords: [] },
  { id: 'cat_98', name: 'ציוד לבית', group: 'דיור', type: 'variable', keywords: [] },
  { id: 'cat_131', name: 'רהיטים', group: 'דיור', type: 'special', keywords: [] },
  { id: 'cat_132', name: 'מכשירי חשמל', group: 'דיור', type: 'special', keywords: [] },

  // --- העברות פיננסיות ---
  { id: 'cat_134', name: 'חיוב כרטיס אשראי', group: 'העברות פיננסיות', type: 'special', keywords: [] },
  { id: 'cat_135', name: 'משיכת מזומן', group: 'העברות פיננסיות', type: 'special', keywords: [] },

  // --- חיות מחמד ---
  { id: 'cat_120', name: 'הוצאות על חיות מחמד', group: 'חיות מחמד', type: 'variable', keywords: [] },

  // --- חינוך ---
  { id: 'cat_53', name: 'חינוך גנים ובתי ספר', group: 'חינוך', type: 'fixed', keywords: [] },
  { id: 'cat_54', name: 'חוגים לילדים', group: 'חינוך', type: 'fixed', keywords: [] },
  { id: 'cat_55', name: 'שיעורים פרטיים', group: 'חינוך', type: 'fixed', keywords: [] },
  { id: 'cat_56', name: 'גני ילדים פרטיים', group: 'חינוך', type: 'fixed', keywords: [] },
  { id: 'cat_111', name: 'ציוד לימודי (לילדים)', group: 'חינוך', type: 'variable', keywords: [] },
  { id: 'cat_112', name: 'תשלומי ועד הורים', group: 'חינוך', type: 'variable', keywords: [] },
  { id: 'cat_113', name: 'צעצועים ומתנות לילדים', group: 'חינוך', type: 'variable', keywords: [] },
  { id: 'cat_141', name: 'קייטנות', group: 'חינוך', type: 'special', keywords: [] },

  // --- ייעוץ ---
  { id: 'cat_34', name: 'יועץ עסקי / פיננסי', group: 'ייעוץ', type: 'fixed', keywords: [] },
  { id: 'cat_35', name: 'רואה חשבון', group: 'ייעוץ', type: 'fixed', keywords: [] },
  { id: 'cat_36', name: 'ייעוץ משפטי שוטף', group: 'ייעוץ', type: 'fixed', keywords: [] },
  { id: 'cat_37', name: 'הנהלת חשבונות', group: 'ייעוץ', type: 'fixed', keywords: [] },
  { id: 'cat_38', name: 'שכר טרחה שוטף', group: 'ייעוץ', type: 'fixed', keywords: [] },

  // --- לימודים ---
  { id: 'cat_85', name: 'קורסים ולמידה אישית', group: 'לימודים', type: 'fixed', keywords: [] },
  { id: 'cat_86', name: 'הכשרות מקצועיות', group: 'לימודים', type: 'fixed', keywords: [] },
  { id: 'cat_87', name: 'קורסים אונליין', group: 'לימודים', type: 'fixed', keywords: [] },
  { id: 'cat_88', name: 'השתלמויות מקצועיות', group: 'לימודים', type: 'fixed', keywords: [] },
  { id: 'cat_89', name: 'הדרכות צוות מיוחד שוטף', group: 'לימודים', type: 'fixed', keywords: [] },
  { id: 'cat_99', name: 'השתלמות מקצועית', group: 'לימודים', type: 'variable', keywords: [] },
  { id: 'cat_145', name: 'הדרכות צוות מיוחד', group: 'לימודים', type: 'special', keywords: [] },

  // --- מזון ---
  { id: 'cat_104', name: 'מזון ומשקאות', group: 'מזון', type: 'variable', keywords: [] },
  { id: 'cat_105', name: 'קניות סופר', group: 'מזון', type: 'variable', keywords: [] },
  { id: 'cat_106', name: 'מסעדות', group: 'מזון', type: 'variable', keywords: [] },

  // --- מיסים ---
  { id: 'cat_32', name: 'מס הכנסה', group: 'מיסים', type: 'fixed', keywords: [] },
  { id: 'cat_33', name: 'מס בריאות', group: 'מיסים', type: 'fixed', keywords: [] },
  { id: 'cat_39', name: 'אגרת רישוי עסק', group: 'מיסים', type: 'fixed', keywords: [] },
  { id: 'cat_40', name: 'מיסים ומקדמות מס', group: 'מיסים', type: 'fixed', keywords: [] },
  { id: 'cat_41', name: 'דמי ביטוח לאומי', group: 'מיסים', type: 'fixed', keywords: [] },
  { id: 'cat_42', name: 'מע"מ', group: 'מיסים', type: 'fixed', keywords: [] },
  { id: 'cat_142', name: 'אגרות ומסים חריגים', group: 'מיסים', type: 'special', keywords: [] },

  // --- מנויים ---
  { id: 'cat_83', name: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', group: 'מנויים', type: 'fixed', keywords: [] },
  { id: 'cat_84', name: 'מנויים עסקיים (Canva ChatGPT Adobe וכו\')', group: 'מנויים', type: 'fixed', keywords: [] },

  // --- משפטי ---
  { id: 'cat_139', name: 'הוצאות משפטיות', group: 'משפטי', type: 'special', keywords: [] },
  { id: 'cat_144', name: 'ייעוץ משפטי מיוחד', group: 'משפטי', type: 'special', keywords: [] },

  // --- משרד ---
  { id: 'cat_75', name: 'תוכנות ורישיונות', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_76', name: 'שירותי ענן', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_77', name: 'תחזוקת אתר אינטרנט', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_78', name: 'דומיין ואחסון', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_79', name: 'ציוד טכני לעסק', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_80', name: 'תפעול מערכות ניהול', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_81', name: 'תחזוקת מחשבים', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_82', name: 'אבטחת מידע', group: 'משרד', type: 'fixed', keywords: [] },
  { id: 'cat_130', name: 'ציוד משרדי', group: 'משרד', type: 'variable', keywords: [] },
  { id: 'cat_133', name: 'מחשבים וציוד טכנולוגי', group: 'משרד', type: 'special', keywords: [] },
  { id: 'cat_146', name: 'ריהוט משרדי', group: 'משרד', type: 'special', keywords: [] },

  // --- מתנות ---
  { id: 'cat_117', name: 'תרומות', group: 'מתנות', type: 'variable', keywords: [] },
  { id: 'cat_118', name: 'מתנות', group: 'מתנות', type: 'variable', keywords: [] },
  { id: 'cat_119', name: 'ימי הולדת', group: 'מתנות', type: 'variable', keywords: [] },

  // --- עובדים ---
  { id: 'cat_121', name: 'בונוסים והטבות', group: 'עובדים', type: 'variable', keywords: [] },
  { id: 'cat_122', name: 'הוצאות רווחה לעובדים', group: 'עובדים', type: 'variable', keywords: [] },
  { id: 'cat_123', name: 'נסיעות לעובדים', group: 'עובדים', type: 'variable', keywords: [] },
  { id: 'cat_136', name: 'תשלום משכורת', group: 'עובדים', type: 'special', keywords: [] },
  { id: 'cat_137', name: 'תשלומי פנסיה לעובדים', group: 'עובדים', type: 'special', keywords: [] },
  { id: 'cat_138', name: 'שכר עובדים', group: 'עובדים', type: 'special', keywords: [] },

  // --- עיסקי ---
  { id: 'cat_143', name: 'יעוץ עסקי מיוחד', group: 'עיסקי', type: 'special', keywords: [] },

  // --- פיננסים ---
  { id: 'cat_57', name: 'הלוואות בנקאיות', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_58', name: 'הלוואות עסקיות', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_59', name: 'עמלות בנק פרטי', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_60', name: 'עמלות בנק עסקי', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_61', name: 'דמי ניהול חשבון עסקי', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_62', name: 'דמי ניהול חשבון פרטי', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_63', name: 'הלוואה פרטית מהבנק', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_64', name: 'הלוואה עסקית מהבנק', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_65', name: 'הלוואת משכנתא למגורים', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_66', name: 'הלוואת משכנתא לעסק', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_67', name: 'הלוואת משכנתא הפוכה', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_68', name: 'הלוואות פנסיוניות', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_69', name: 'הלוואות חוץ בנקאיות פרטית', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_70', name: 'הלוואות חוץ בנקאיות עסקית', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_71', name: 'הלוואה מכרטיס אשראי פרטי', group: 'פיננסים', type: 'fixed', keywords: [] },
  { id: 'cat_72', name: 'הלוואה מכרטיס אשראי עסקי', group: 'פיננסים', type: 'fixed', keywords: [] },

  // --- רכב ---
  { id: 'cat_73', name: 'טסט לרכב', group: 'רכב', type: 'fixed', keywords: [] },
  { id: 'cat_74', name: 'תשלומי רישוי רכב', group: 'רכב', type: 'fixed', keywords: [] },
  { id: 'cat_90', name: 'תחבורה ציבורית', group: 'רכב', type: 'variable', keywords: [] },
  { id: 'cat_91', name: 'דלק', group: 'רכב', type: 'variable', keywords: [] },
  { id: 'cat_92', name: 'חניה', group: 'רכב', type: 'variable', keywords: [] },
  { id: 'cat_93', name: 'כביש 6 / כבישי אגרה', group: 'רכב', type: 'variable', keywords: [] },
  { id: 'cat_94', name: 'טיפולי רכב / מוסך', group: 'רכב', type: 'variable', keywords: [] },

  // --- שיווק ---
  { id: 'cat_100', name: 'שיווק ופרסום', group: 'שיווק', type: 'variable', keywords: [] },
  { id: 'cat_101', name: 'קמפיינים דיגיטליים', group: 'שיווק', type: 'variable', keywords: [] },
  { id: 'cat_102', name: 'עיצוב גרפי', group: 'שיווק', type: 'variable', keywords: [] },
  { id: 'cat_103', name: 'הדפסות ודפוס', group: 'שיווק', type: 'variable', keywords: [] },

  // --- שירותים ---
  { id: 'cat_124', name: 'שירותים כלליים', group: 'שירותים', type: 'variable', keywords: [] },
  { id: 'cat_125', name: 'שירותי תיקונים', group: 'שירותים', type: 'variable', keywords: [] },
  { id: 'cat_126', name: 'שירותי ניקיון', group: 'שירותים', type: 'variable', keywords: [] },
  { id: 'cat_127', name: 'שירותי גינון', group: 'שירותים', type: 'variable', keywords: [] },
  { id: 'cat_128', name: 'שירותים מקצועיים', group: 'שירותים', type: 'variable', keywords: [] },
  { id: 'cat_129', name: 'שירותי מחשוב', group: 'שירותים', type: 'variable', keywords: [] },

  // --- תקשורת ---
  { id: 'cat_21', name: 'אינטרנט ביתי', group: 'תקשורת', type: 'fixed', keywords: [] },
  { id: 'cat_22', name: 'אינטרנט עיסקי', group: 'תקשורת', type: 'fixed', keywords: [] },
  { id: 'cat_23', name: 'טלפונים ניידים', group: 'תקשורת', type: 'fixed', keywords: [] },
  { id: 'cat_24', name: 'טלפונים עסקיים', group: 'תקשורת', type: 'fixed', keywords: [] },
  { id: 'cat_25', name: 'טלוויזיה (YES / HOT / סלקום)', group: 'תקשורת', type: 'fixed', keywords: [] },
];

export function getCategoriesByGroup(group: string): CategoryDef[] {
  return CATEGORIES.filter(c => c.group === group);
}

export function searchCategories(query: string): CategoryDef[] {
  const q = query.toLowerCase();
  return CATEGORIES.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.keywords.some(k => k.includes(q))
  );
}

export function getCategoryByName(name: string): CategoryDef | undefined {
  return CATEGORIES.find(c => c.name === name);
}

// פונקציה למציאת קטגוריה לפי טקסט חופשי (חיפוש מדויק יותר)
export function findBestMatch(text: string): CategoryDef | null {
  const t = text.toLowerCase();
  // 1. חיפוש מדויק בשם
  const exact = CATEGORIES.find(c => c.name.toLowerCase() === t);
  if (exact) return exact;

  // 2. חיפוש keyword מדויק
  const keywordMatch = CATEGORIES.find(c => c.keywords.some(k => k === t));
  if (keywordMatch) return keywordMatch;

  return null;
}
