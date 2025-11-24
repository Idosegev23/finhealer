-- ============================================================================
-- Migration: Complete Update of Expense Categories
-- תאריך: 2025-11-23
-- תיאור: עדכון מלא של כל קטגוריות ההוצאות לפי הקובץ המעודכן
--         146 קטגוריות עם סדר תצוגה, קבוצות וסיווג מעודכנים
-- ============================================================================

-- ניקוי הטבלה הקיימת
TRUNCATE TABLE expense_categories CASCADE;

-- הוספת כל הקטגוריות לפי הסדר החדש
INSERT INTO expense_categories (name, expense_type, category_group, applicable_to, display_order, is_active) VALUES

-- דיור - קבועות (1-20, 96)
('ארנונה למגורים', 'fixed', 'דיור', 'both', 1, true),
('ארנונה לעסק', 'fixed', 'דיור', 'self_employed', 2, true),
('חשמל לבית', 'fixed', 'דיור', 'both', 3, true),
('חשמל לעסק', 'fixed', 'דיור', 'self_employed', 4, true),
('מים למגורים', 'fixed', 'דיור', 'both', 5, true),
('מים לעסק', 'fixed', 'דיור', 'both', 5, true),
('גז', 'fixed', 'דיור', 'both', 6, true),
('ועד בית', 'fixed', 'דיור', 'both', 7, true),
('דמי ניהול בבניין משרדים', 'fixed', 'דיור', 'self_employed', 8, true),
('שכירות למגורים', 'fixed', 'דיור', 'both', 9, true),
('שכירות משרד / קליניקה', 'fixed', 'דיור', 'self_employed', 10, true),
('תיקונים בבית', 'fixed', 'דיור', 'both', 11, true),
('אחזקת מבנה / עסק', 'fixed', 'דיור', 'self_employed', 12, true),
('ניקיון עסק', 'fixed', 'דיור', 'self_employed', 13, true),
('ניקיון חיצוני / עוזרת', 'fixed', 'דיור', 'both', 14, true),
('גינון לעסק', 'fixed', 'דיור', 'both', 15, true),
('גינון למגורים', 'fixed', 'דיור', 'both', 16, true),
('טכנאים (מזגן מקרר וכו'') לעסק', 'fixed', 'דיור', 'both', 17, true),
('טכנאים (מזגן מקרר וכו'') למגורים', 'fixed', 'דיור', 'both', 96, true),

-- בריאות - קבועות (18-20)
('תרופות', 'fixed', 'בריאות', 'both', 18, true),
('טיפולי שיניים', 'fixed', 'בריאות', 'both', 19, true),
('קופת חולים', 'fixed', 'בריאות', 'both', 20, true),

-- תקשורת - קבועות (21-25)
('אינטרנט ביתי', 'fixed', 'תקשורת', 'both', 21, true),
('אינטרנט עיסקי', 'fixed', 'תקשורת', 'both', 22, true),
('טלפונים ניידים', 'fixed', 'תקשורת', 'both', 23, true),
('טלפונים עסקיים', 'fixed', 'תקשורת', 'self_employed', 24, true),
('טלוויזיה (YES / HOT / סלקום)', 'fixed', 'תקשורת', 'both', 25, true),

-- ביטוחים - קבועות (26-52)
('ביטוח חיים', 'fixed', 'ביטוחים', 'both', 26, true),
('ביטוח בריאות', 'fixed', 'ביטוחים', 'both', 27, true),
('ביטוח מבנה מגורים', 'fixed', 'ביטוחים', 'both', 28, true),
('ביטוח מבנה עסקי', 'fixed', 'ביטוחים', 'both', 29, true),
('ביטוח תכולהמגורים', 'fixed', 'ביטוחים', 'both', 30, true),
('ביטוח תכולה עסקי', 'fixed', 'ביטוחים', 'both', 31, true),
('ביטוח לאובדן כושר עבודה', 'fixed', 'ביטוחים', 'self_employed', 43, true),
('ביטוח רכב', 'fixed', 'ביטוחים', 'both', 44, true),
('ביטוח עסק', 'fixed', 'ביטוחים', 'self_employed', 45, true),
('ביטוח דירה', 'fixed', 'ביטוחים', 'both', 46, true),
('חיסכון פנסיוני', 'fixed', 'ביטוחים', 'both', 47, true),
('ביטוח אחריות מקצועית', 'fixed', 'ביטוחים', 'self_employed', 48, true),
('ביטוח צד ג''', 'fixed', 'ביטוחים', 'both', 49, true),
('ביטוח חובה לרכב', 'fixed', 'ביטוחים', 'both', 50, true),
('ביטוח חיות מחמד', 'fixed', 'ביטוחים', 'both', 51, true),
('ביטוח בריאות לעובדים', 'fixed', 'ביטוחים', 'self_employed', 52, true),

-- מיסים - קבועות (32-33, 39-42)
('מס הכנסה', 'fixed', 'מיסים', 'both', 32, true),
('מס בריאות', 'fixed', 'מיסים', 'both', 33, true),
('אגרת רישוי עסק', 'fixed', 'מיסים', 'self_employed', 39, true),
('מיסים ומקדמות מס', 'fixed', 'מיסים', 'self_employed', 40, true),
('דמי ביטוח לאומי', 'fixed', 'מיסים', 'both', 41, true),
('מע"מ', 'fixed', 'מיסים', 'both', 42, true),

-- ייעוץ - קבועות (34-38)
('יועץ עסקי / פיננסי', 'fixed', 'ייעוץ', 'self_employed', 34, true),
('רואה חשבון', 'fixed', 'ייעוץ', 'self_employed', 35, true),
('ייעוץ משפטי שוטף', 'fixed', 'ייעוץ', 'self_employed', 36, true),
('הנהלת חשבונות', 'fixed', 'ייעוץ', 'self_employed', 37, true),
('שכר טרחה שוטף', 'fixed', 'ייעוץ', 'both', 38, true),

-- חינוך - קבועות (53-56)
('חינוך גנים ובתי ספר', 'fixed', 'חינוך', 'both', 53, true),
('חוגים לילדים', 'fixed', 'חינוך', 'both', 54, true),
('שיעורים פרטיים', 'fixed', 'חינוך', 'both', 55, true),
('גני ילדים פרטיים', 'fixed', 'חינוך', 'both', 56, true),

-- פיננסים - קבועות (57-72)
('הלוואות בנקאיות', 'fixed', 'פיננסים', 'both', 57, true),
('הלוואות עסקיות', 'fixed', 'פיננסים', 'self_employed', 58, true),
('עמלות בנק פרטי', 'fixed', 'פיננסים', 'both', 59, true),
('עמלות בנק עסקי', 'fixed', 'פיננסים', 'both', 60, true),
('דמי ניהול חשבון עסקי', 'fixed', 'פיננסים', 'self_employed', 61, true),
('דמי ניהול חשבון פרטי', 'fixed', 'פיננסים', 'employee', 62, true),
('הלוואה פרטית מהבנק', 'fixed', 'פיננסים', 'employee', 63, true),
('הלוואה עסקית מהבנק', 'fixed', 'פיננסים', 'self_employed', 64, true),
('הלוואת משכנתא למגורים', 'fixed', 'פיננסים', 'employee', 65, true),
('הלוואת משכנתא לעסק', 'fixed', 'פיננסים', 'self_employed', 66, true),
('הלוואת משכנתא הפוכה', 'fixed', 'פיננסים', 'both', 67, true),
('הלוואות פנסיוניות', 'fixed', 'פיננסים', 'both', 68, true),
('הלוואות חוץ בנקאיות פרטית', 'fixed', 'פיננסים', 'both', 69, true),
('הלוואות חוץ בנקאיות עסקית', 'fixed', 'פיננסים', 'both', 70, true),
('הלוואה מכרטיס אשראי פרטי', 'fixed', 'פיננסים', 'both', 71, true),
('הלוואה מכרטיס אשראי עסקי', 'fixed', 'פיננסים', 'both', 72, true),

-- רכב - קבועות (73-74)
('טסט לרכב', 'fixed', 'רכב', 'both', 73, true),
('תשלומי רישוי רכב', 'fixed', 'רכב', 'both', 74, true),

-- משרד - קבועות (75-82)
('תוכנות ורישיונות', 'fixed', 'משרד', 'self_employed', 75, true),
('שירותי ענן', 'fixed', 'משרד', 'self_employed', 76, true),
('תחזוקת אתר אינטרנט', 'fixed', 'משרד', 'self_employed', 77, true),
('דומיין ואחסון', 'fixed', 'משרד', 'self_employed', 78, true),
('ציוד טכני לעסק', 'fixed', 'משרד', 'self_employed', 79, true),
('תפעול מערכות ניהול', 'fixed', 'משרד', 'self_employed', 80, true),
('תחזוקת מחשבים', 'fixed', 'משרד', 'self_employed', 81, true),
('אבטחת מידע', 'fixed', 'משרד', 'self_employed', 82, true),

-- מנויים - קבועות (83-84)
('מנויים דיגיטליים (נטפליקס ספוטיפיי)', 'fixed', 'מנויים', 'both', 83, true),
('מנויים עסקיים (Canva ChatGPT Adobe וכו'')', 'fixed', 'מנויים', 'self_employed', 84, true),

-- לימודים - קבועות (85-89)
('קורסים ולמידה אישית', 'fixed', 'לימודים', 'both', 85, true),
('הכשרות מקצועיות', 'fixed', 'לימודים', 'self_employed', 86, true),
('קורסים אונליין', 'fixed', 'לימודים', 'both', 87, true),
('השתלמויות מקצועיות', 'fixed', 'לימודים', 'self_employed', 88, true),
('הדרכות צוות מיוחד שוטף', 'fixed', 'לימודים', 'self_employed', 89, true),

-- רכב - משתנות (90-94)
('תחבורה ציבורית', 'variable', 'רכב', 'both', 90, true),
('דלק', 'variable', 'רכב', 'both', 91, true),
('חניה', 'variable', 'רכב', 'both', 92, true),
('כביש 6 / כבישי אגרה', 'variable', 'רכב', 'both', 93, true),
('טיפולי רכב / מוסך', 'variable', 'רכב', 'both', 94, true),

-- דיור - משתנות (95, 97-98)
('ניקיון בית', 'variable', 'דיור', 'both', 95, true),
('ציוד ניקיון / תחזוקה', 'variable', 'דיור', 'both', 97, true),
('ציוד לבית', 'variable', 'דיור', 'both', 98, true),

-- לימודים - משתנות (99)
('השתלמות מקצועית', 'variable', 'לימודים', 'both', 99, true),

-- שיווק - משתנות (100-103)
('שיווק ופרסום', 'variable', 'שיווק', 'self_employed', 100, true),
('קמפיינים דיגיטליים', 'variable', 'שיווק', 'self_employed', 101, true),
('עיצוב גרפי', 'variable', 'שיווק', 'self_employed', 102, true),
('הדפסות ודפוס', 'variable', 'שיווק', 'self_employed', 103, true),

-- מזון - משתנות (104-106)
('מזון ומשקאות', 'variable', 'מזון', 'both', 104, true),
('קניות סופר', 'variable', 'מזון', 'both', 105, true),
('מסעדות', 'variable', 'מזון', 'both', 106, true),

-- אישי - משתנות (107-108)
('ביגוד', 'variable', 'אישי', 'both', 107, true),
('קוסמטיקה וטיפוח', 'variable', 'אישי', 'both', 108, true),

-- בילויים - משתנות (109-110)
('חופשות', 'variable', 'בילויים', 'both', 109, true),
('בילויים ובידור', 'variable', 'בילויים', 'both', 110, true),

-- חינוך - משתנות (111-113)
('ציוד לימודי (לילדים)', 'variable', 'חינוך', 'employee', 111, true),
('תשלומי ועד הורים', 'variable', 'חינוך', 'both', 112, true),
('צעצועים ומתנות לילדים', 'variable', 'חינוך', 'both', 113, true),

-- בריאות - משתנות (114-116)
('טיפול רגשי / פסיכולוג', 'variable', 'בריאות', 'both', 114, true),
('טיפולים רפואיים פרטיים', 'variable', 'בריאות', 'both', 115, true),
('רופא משפחה פרטי', 'variable', 'בריאות', 'both', 116, true),

-- מתנות - משתנות (117-119)
('תרומות', 'variable', 'מתנות', 'both', 117, true),
('מתנות', 'variable', 'מתנות', 'both', 118, true),
('ימי הולדת', 'variable', 'מתנות', 'both', 119, true),

-- חיות מחמד - משתנות (120)
('הוצאות על חיות מחמד', 'variable', 'חיות מחמד', 'both', 120, true),

-- עובדים - משתנות (121-123)
('בונוסים והטבות', 'variable', 'עובדים', 'self_employed', 121, true),
('הוצאות רווחה לעובדים', 'variable', 'עובדים', 'self_employed', 122, true),
('נסיעות לעובדים', 'variable', 'עובדים', 'self_employed', 123, true),

-- שירותים - משתנות (124-129)
('שירותים כלליים', 'variable', 'שירותים', 'both', 124, true),
('שירותי תיקונים', 'variable', 'שירותים', 'both', 125, true),
('שירותי ניקיון', 'variable', 'שירותים', 'both', 126, true),
('שירותי גינון', 'variable', 'שירותים', 'both', 127, true),
('שירותים מקצועיים', 'variable', 'שירותים', 'both', 128, true),
('שירותי מחשוב', 'variable', 'שירותים', 'both', 129, true),

-- משרד - משתנות (130)
('ציוד משרדי', 'variable', 'משרד', 'self_employed', 130, true),

-- דיור - מיוחדות (131-132)
('רהיטים', 'special', 'דיור', 'both', 131, true),
('מכשירי חשמל', 'special', 'דיור', 'both', 132, true),

-- משרד - מיוחדות (133, 146)
('מחשבים וציוד טכנולוגי', 'special', 'משרד', 'both', 133, true),
('ריהוט משרדי', 'special', 'משרד', 'self_employed', 146, true),

-- העברות פיננסיות - מיוחדות (134-135)
('חיוב כרטיס אשראי', 'special', 'העברות פיננסיות', 'both', 134, true),
('משיכת מזומן', 'special', 'העברות פיננסיות', 'both', 135, true),

-- עובדים - מיוחדות (136-138)
('תשלום משכורת', 'special', 'עובדים', 'both', 136, true),
('תשלומי פנסיה לעובדים', 'special', 'עובדים', 'self_employed', 137, true),
('שכר עובדים', 'special', 'עובדים', 'self_employed', 138, true),

-- משפטי - מיוחדות (139, 144)
('הוצאות משפטיות', 'special', 'משפטי', 'both', 139, true),
('ייעוץ משפטי מיוחד', 'special', 'משפטי', 'self_employed', 144, true),

-- אירועים - מיוחדות (140)
('אירועים משפחתיים (חתונה בר מצווה וכו'')', 'special', 'אירועים', 'both', 140, true),

-- חינוך - מיוחדות (141)
('קייטנות', 'special', 'חינוך', 'both', 141, true),

-- מיסים - מיוחדות (142)
('אגרות ומסים חריגים', 'special', 'מיסים', 'self_employed', 142, true),

-- עיסקי - מיוחדות (143)
('יעוץ עסקי מיוחד', 'special', 'עיסקי', 'self_employed', 143, true),

-- לימודים - מיוחדות (145)
('הדרכות צוות מיוחד', 'special', 'לימודים', 'self_employed', 145, true);

-- עדכון אינדקסים
CREATE INDEX IF NOT EXISTS idx_expense_categories_group ON expense_categories(category_group);
CREATE INDEX IF NOT EXISTS idx_expense_categories_type ON expense_categories(expense_type);
CREATE INDEX IF NOT EXISTS idx_expense_categories_applicable ON expense_categories(applicable_to);
CREATE INDEX IF NOT EXISTS idx_expense_categories_display_order ON expense_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON expense_categories(is_active) WHERE is_active = true;

-- הודעת סיום
DO $$
BEGIN
  RAISE NOTICE '✅ נטענו % קטגוריות הוצאות בהצלחה', (SELECT COUNT(*) FROM expense_categories);
  RAISE NOTICE '📊 קבועות: %', (SELECT COUNT(*) FROM expense_categories WHERE expense_type = 'fixed');
  RAISE NOTICE '📊 משתנות: %', (SELECT COUNT(*) FROM expense_categories WHERE expense_type = 'variable');
  RAISE NOTICE '📊 מיוחדות: %', (SELECT COUNT(*) FROM expense_categories WHERE expense_type = 'special');
END $$;

COMMENT ON TABLE expense_categories IS 'Expense categories completely updated on 2025-11-23 with 146 categories';


