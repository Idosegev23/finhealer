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
  // Additional harmonious colors for charts
  chartColors: [
    '#A96B48', // Gold (primary)
    '#2E3440', // Dark
    '#8FBCBB', // Mint
    '#D08770', // Coral
    '#5E81AC', // Blue
    '#B48EAD', // Purple
    '#EBCB8B', // Yellow
    '#88C0D0', // Light blue
  ],
};

/**
 * Build a structured JSON prompt for Gemini Image Generation
 * This format provides maximum consistency and control
 */
export function buildStructuredPieChartPrompt(
  title: string,
  subtitle: string,
  categories: CategoryData[],
  note?: { title: string; text: string }
): string {
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  
  // Assign colors if not specified
  const slicesData = categories.slice(0, 8).map((cat, i) => ({
    key: `slice_${i + 1}`,
    label: cat.name,
    value: cat.amount,
    percentage: Math.round((cat.amount / total) * 100),
    color_hex: cat.color || PHI_COLORS.chartColors[i % PHI_COLORS.chartColors.length],
    emphasis: i === 0 ? 'primary' : 'normal',
  }));

  const chartSpec = {
    goal: "Generate a clean, high-legibility pie chart infographic with side labels and percentages, with perfectly readable Hebrew text.",
    language: {
      ui_direction: "RTL",
      primary_language: "he"
    },
    chart_spec: {
      chart_type: "pie",
      title: {
        enabled: true,
        text: title,
        subtitle_enabled: true,
        subtitle_text: subtitle
      },
      data_rules: {
        values_are_percentages: false,
        auto_compute_percentages: true,
        total_hint: `${total.toLocaleString('he-IL')} ₪`,
        rounding: {
          enabled: true,
          decimals: 0,
          ensure_sum_to_100: true
        },
        sort_slices: {
          enabled: true,
          method: "descending"
        }
      },
      data: slicesData.map(s => ({
        key: s.key,
        label: s.label,
        value: `${s.value.toLocaleString('he-IL')} ₪`,
        percentage: `${s.percentage}%`,
        color_hex: s.color_hex,
        emphasis: s.emphasis
      })),
      slice_labels: {
        show_on_chart: true,
        content: "percentage_only",
        min_font_size_px: 22,
        max_font_size_px: 36,
        contrast_rule: "always_high_contrast",
        avoid_overlap: true
      },
      side_legend: {
        enabled: true,
        position: "both_sides",
        layout: "stacked",
        items: {
          show_color_dot: true,
          show_label: true,
          show_value: true,
          show_percentage: true,
          format: "{{LABEL}} - {{VALUE}} ({{PCT}}%)"
        },
        connector_lines: {
          enabled: true,
          style: "thin",
          attach_to_slices: true
        }
      },
      ...(note && {
        annotation_blocks: {
          enabled: true,
          blocks: [{
            key: "note_1",
            position: "bottom_right",
            title: note.title,
            text: note.text
          }]
        }
      }),
      phi_branding: {
        enabled: true,
        symbol: "φ",
        position: "bottom_right",
        tagline: "היחס הזהב של הכסף שלך"
      }
    },
    design_system: {
      canvas: {
        aspect_ratio: "16:9",
        resolution: "2K",
        background: {
          type: "solid",
          color_hex: "#FFFFFF"
        },
        safe_margins_px: 80
      },
      typography: {
        font_family_preference: ["Heebo", "Arial", "Sans-Serif"],
        title: {
          weight: 800,
          size_px: 56,
          color_hex: PHI_COLORS.dark
        },
        subtitle: {
          weight: 500,
          size_px: 28,
          color_hex: PHI_COLORS.slate
        },
        legend: {
          weight: 600,
          size_px: 26,
          color_hex: PHI_COLORS.dark,
          line_height: 1.25
        }
      },
      styling: {
        chart_style: "flat_clean",
        slice_border: {
          enabled: true,
          color_hex: "#FFFFFF",
          width_px: 3
        },
        shadow: {
          enabled: false
        }
      }
    },
    text_constraints: {
      must_be_perfectly_readable: true,
      no_lorem_ipsum: true,
      rtl_required: true,
      all_text_in_hebrew: true
    },
    negative_constraints: [
      "no watermark",
      "no blurry text",
      "no misspelled Hebrew",
      "no overlapping labels",
      "no random icons",
      "no 3D chart effects",
      "no gradients unless specified"
    ]
  };

  return `Generate a pie chart image according to this specification:

${JSON.stringify(chartSpec, null, 2)}

IMPORTANT: Create the actual visual image, not text. The chart must have:
- Clear Hebrew labels in RTL direction
- The phi symbol (φ) visible in the design
- Colors exactly as specified
- Clean, professional look`;
}

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

