# Landing Components

קומפוננטות ייחודיות לדף הנחיתה של Phi:

- **PhiAnimation.tsx** - אנימציית φ עם ספירלת פיבונאצ'י
- **PhiScore.tsx** - מד ציון φ (0-100) עגול עם צבעים דינמיים

## שימוש

```tsx
import PhiAnimation from '@/components/landing/PhiAnimation'
import PhiScore from '@/components/landing/PhiScore'

// PhiAnimation
<PhiAnimation className="w-full max-w-md" />

// PhiScore
<PhiScore score={73} size="lg" animated showLabel />
```

