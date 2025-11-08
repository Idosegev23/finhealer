# Charts Components

קומפוננטות גרפים של Phi - מוטיב φ (Phi) + Pie:

- **PhiPieChart.tsx** - גרף עוגה (Pie Chart) מותאם לעיצוב Phi

## שימוש

```tsx
import PhiPieChart from '@/components/charts/PhiPieChart'

const data = [
  { name: 'מזון', value: 3000 },
  { name: 'דיור', value: 5000 },
  { name: 'תחבורה', value: 1500 },
  { name: 'בילויים', value: 800 },
]

<PhiPieChart
  data={data}
  title="התפלגות הוצאות"
  size="md"
  showLegend
  animated
/>
```

## הקונספט: φ (Phi) + Pie

משחק מילים מושלם:
- **φ (Phi)** = היחס הזהב המתמטי - סמל לאיזון ושלמות
- **Pie** = גרפי עוגה - ויזואליזציה מושלמת לחלוקה והתפלגות

הצבעים:
- Phi Gold (`#A96B48`)
- Phi Mint (`#8FBCBB`)
- Phi Coral (`#D08770`)
- Phi Slate (`#4C566A`)
- ועוד...

