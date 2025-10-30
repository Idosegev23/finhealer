-- הוספת שדות פרופיל אישי לטבלת users
-- תאריך: 2025-01-31

-- הוספת עמודות פרופיל אישי
ALTER TABLE users
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0 CHECK (children_count >= 0);

-- הוספת הערות לתיעוד
COMMENT ON COLUMN users.city IS 'עיר מגורים של המשתמש';
COMMENT ON COLUMN users.birth_date IS 'תאריך לידה';
COMMENT ON COLUMN users.marital_status IS 'מצב משפחתי: single/married/divorced/widowed';
COMMENT ON COLUMN users.children_count IS 'מספר ילדים';

-- יצירת אינדקס לחיפוש לפי עיר (לסטטיסטיקות עתידיות)
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_marital_status ON users(marital_status);

-- עדכון timestamp
UPDATE users
SET updated_at = NOW()
WHERE city IS NOT NULL OR birth_date IS NOT NULL OR marital_status IS NOT NULL OR children_count > 0;

