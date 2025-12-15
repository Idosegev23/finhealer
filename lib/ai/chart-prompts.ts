/**
 * Prompt templates for Gemini Image Generation
 * All prompts are in Hebrew with Phi branding
 */

export interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
  color?: string;
}

export interface MonthlyTrendData {
  month: string;
  income: number;
  expenses: number;
}

export interface PhiScoreData {
  score: number;
  breakdown: {
    savingsRate: number;
    budgetAdherence: number;
    debtRatio: number;
    emergencyFund: number;
  };
  trend: 'up' | 'down' | 'stable';
}

export interface MonthlySummaryData {
  month: string;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  topCategories: CategoryData[];
  phiScore: number;
  highlights: string[];
}

// Phi brand colors
const PHI_COLORS = {
  dark: '#2E3440',
  gold: '#A96B48',
  mint: '#8FBCBB',
  bg: '#ECEFF4',
  coral: '#D08770',
  slate: '#4C566A',
  frost: '#D8DEE9',
};

/**
 * Build prompt for pie chart showing expense distribution
 */
export function buildPieChartPrompt(
  title: string,
  categories: CategoryData[]
): string {
  const categoryLines = categories
    .map((c) => `- ${c.name}: ${c.amount.toLocaleString('he-IL')} ₪ (${c.percentage}%)`)
    .join('\n');

  return `Create a clean, modern pie chart infographic in Hebrew.

Title: "${title}"

Categories and amounts:
${categoryLines}

Style requirements:
- Minimalist, professional design
- Use these brand colors: gold accent ${PHI_COLORS.gold}, dark ${PHI_COLORS.dark}, mint ${PHI_COLORS.mint}
- Each slice should have a distinct but harmonious color
- Labels should be in Hebrew, right-to-left
- Include percentage labels on or near each slice
- Add the phi symbol (φ) in the bottom right corner
- Background should be clean white or very light gray
- Add a subtle shadow for depth

Square format (1:1 aspect ratio).
High quality, suitable for mobile viewing.`;
}

/**
 * Build prompt for monthly trend graph
 */
export function buildTrendPrompt(
  title: string,
  data: MonthlyTrendData[]
): string {
  const dataLines = data
    .map(
      (d) =>
        `- ${d.month}: הכנסות ${d.income.toLocaleString('he-IL')} ₪, הוצאות ${d.expenses.toLocaleString('he-IL')} ₪`
    )
    .join('\n');

  return `Create a clean, modern line chart infographic in Hebrew showing financial trends.

Title: "${title}"

Monthly data:
${dataLines}

Style requirements:
- Two lines: one for income (green/mint ${PHI_COLORS.mint}), one for expenses (coral ${PHI_COLORS.coral})
- X-axis: months (Hebrew)
- Y-axis: amounts in ₪ (Israeli Shekels)
- Clean grid lines, not too dense
- Legend showing "הכנסות" (income) and "הוצאות" (expenses)
- Add the phi symbol (φ) in the corner
- Background should be clean white or very light gray
- Use brand colors: dark ${PHI_COLORS.dark}, gold accent ${PHI_COLORS.gold}

Landscape format (16:9 aspect ratio).
High quality, professional business chart style.`;
}

/**
 * Build prompt for Phi Score visualization
 */
export function buildPhiScorePrompt(data: PhiScoreData): string {
  const trendArrow = data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→';
  const trendText =
    data.trend === 'up' ? 'במגמת עלייה' : data.trend === 'down' ? 'במגמת ירידה' : 'יציב';

  return `Create a stunning, modern visual representation of a financial health score in Hebrew.

Main Score: ${data.score}/100 (displayed prominently with the phi symbol φ)
Trend: ${trendArrow} ${trendText}

Score breakdown (show as smaller circular gauges or bars):
- שיעור חיסכון: ${data.breakdown.savingsRate}%
- עמידה בתקציב: ${data.breakdown.budgetAdherence}%
- יחס חוב: ${data.breakdown.debtRatio}%
- קרן חירום: ${data.breakdown.emergencyFund}%

Style requirements:
- The main score should be a large, beautiful circular gauge or dial
- Use a gradient from red (low) through yellow (medium) to green (high)
- The phi symbol (φ) should be integrated elegantly into the design
- Current score position should be clearly marked
- Score breakdown shown as smaller metrics below
- Brand colors: gold ${PHI_COLORS.gold}, dark ${PHI_COLORS.dark}, mint for good scores ${PHI_COLORS.mint}
- Clean, minimalist background
- Typography should be modern and readable in Hebrew

Title at top: "ציון φ שלך"

Square format (1:1 aspect ratio).
Premium, app-quality design.`;
}

/**
 * Build prompt for comprehensive monthly infographic
 */
export function buildMonthlyInfographicPrompt(data: MonthlySummaryData): string {
  const topCategoriesText = data.topCategories
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.name}: ${c.amount.toLocaleString('he-IL')} ₪`)
    .join('\n');

  const highlightsText = data.highlights.join('\n- ');

  const savingsPercent = Math.round((data.savings / data.totalIncome) * 100);

  return `Create a comprehensive, beautiful monthly financial summary infographic in Hebrew.

Header: "סיכום חודשי - ${data.month} ${data.year}"
Phi Score: ${data.phiScore}/100 (with φ symbol)

Key Metrics (show as large, clear numbers):
- סה״כ הכנסות: ${data.totalIncome.toLocaleString('he-IL')} ₪
- סה״כ הוצאות: ${data.totalExpenses.toLocaleString('he-IL')} ₪
- חיסכון: ${data.savings.toLocaleString('he-IL')} ₪ (${savingsPercent}%)

Top 5 Expense Categories (show as horizontal bars or mini pie):
${topCategoriesText}

Highlights:
- ${highlightsText}

Design requirements:
- Dashboard-style layout with clear sections
- Use card-like containers for each section
- Color coding: green for positive (savings), red for concerns
- Include small icons for each metric
- The phi symbol (φ) should appear in the header and score section
- Brand colors: primary ${PHI_COLORS.dark}, accent ${PHI_COLORS.gold}, success ${PHI_COLORS.mint}
- Clean white background with subtle shadows
- Hebrew text, right-to-left layout
- Footer: "מופק על ידי φ - היחס הזהב של הכסף שלך"

Portrait format (3:4 aspect ratio) - optimized for WhatsApp viewing.
Premium, professional infographic quality.`;
}

/**
 * Build a simple comparison chart prompt
 */
export function buildComparisonPrompt(
  title: string,
  current: { label: string; value: number },
  previous: { label: string; value: number }
): string {
  const change = current.value - previous.value;
  const changePercent = Math.round((change / previous.value) * 100);
  const isPositive = change >= 0;

  return `Create a clean comparison visualization in Hebrew.

Title: "${title}"

Comparison:
- ${previous.label}: ${previous.value.toLocaleString('he-IL')} ₪
- ${current.label}: ${current.value.toLocaleString('he-IL')} ₪
- שינוי: ${isPositive ? '+' : ''}${change.toLocaleString('he-IL')} ₪ (${isPositive ? '+' : ''}${changePercent}%)

Style:
- Show as two vertical bars side by side or a before/after comparison
- Use ${isPositive ? 'green' : 'red'} to indicate the change direction
- Include an arrow showing the trend
- Brand colors: dark ${PHI_COLORS.dark}, gold ${PHI_COLORS.gold}
- Add the phi symbol (φ) in the corner
- Clean, minimal design

Square format (1:1 aspect ratio).`;
}

/**
 * Build a goal progress chart prompt
 */
export function buildGoalProgressPrompt(
  goalName: string,
  currentAmount: number,
  targetAmount: number,
  deadline?: string
): string {
  const progressPercent = Math.round((currentAmount / targetAmount) * 100);
  const remaining = targetAmount - currentAmount;

  return `Create a motivational goal progress visualization in Hebrew.

Goal: "${goalName}"

Progress:
- יעד: ${targetAmount.toLocaleString('he-IL')} ₪
- נוכחי: ${currentAmount.toLocaleString('he-IL')} ₪
- נותר: ${remaining.toLocaleString('he-IL')} ₪
- התקדמות: ${progressPercent}%
${deadline ? `- תאריך יעד: ${deadline}` : ''}

Style:
- Show as a beautiful progress bar or circular progress indicator
- Use gradient from gold to mint as progress increases
- Include motivational elements (sparkles, checkmarks for milestones)
- The phi symbol (φ) integrated into the design
- Brand colors: gold ${PHI_COLORS.gold}, mint ${PHI_COLORS.mint}, dark ${PHI_COLORS.dark}
- Clean, inspiring design that motivates saving
- Add text: "אתה בדרך הנכונה!" if progress > 50%

Square format (1:1 aspect ratio).`;
}

