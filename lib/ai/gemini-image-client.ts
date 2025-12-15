/**
 * Gemini Image Generation Client
 * Uses Gemini 3 Pro Image Preview for high-quality chart generation
 */

import { GoogleGenAI } from '@google/genai';
import {
  buildPieChartPrompt,
  buildTrendPrompt,
  buildPhiScorePrompt,
  buildMonthlyInfographicPrompt,
  buildComparisonPrompt,
  buildGoalProgressPrompt,
  type CategoryData,
  type MonthlyTrendData,
  type PhiScoreData,
  type MonthlySummaryData,
} from './chart-prompts';

// Initialize Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not set');
  }
  return new GoogleGenAI({ apiKey });
};

// Model configuration
const IMAGE_MODEL = 'gemini-2.5-flash-preview-05-20'; // Using flash for faster generation
const PRO_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation'; // For higher quality when needed

export type ChartType =
  | 'pie'
  | 'trend'
  | 'phi_score'
  | 'monthly_infographic'
  | 'comparison'
  | 'goal_progress';

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export interface ChartOptions {
  useProModel?: boolean;
  aspectRatio?: '1:1' | '16:9' | '3:4' | '4:3';
}

/**
 * Generate an image from a text prompt using Gemini
 */
async function generateImageFromPrompt(
  prompt: string,
  options: ChartOptions = {}
): Promise<GeneratedImage | null> {
  try {
    const client = getGeminiClient();
    const model = options.useProModel ? PRO_IMAGE_MODEL : IMAGE_MODEL;

    console.log(`🎨 Generating image with ${model}...`);
    console.log(`📝 Prompt length: ${prompt.length} chars`);

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // Extract image from response
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ('inlineData' in part && part.inlineData) {
          console.log('✅ Image generated successfully');
          return {
            base64: part.inlineData.data || '',
            mimeType: part.inlineData.mimeType || 'image/png',
          };
        }
      }
    }

    console.log('⚠️ No image in response, checking for text...');
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ('text' in part && part.text) {
          console.log('📝 Response text:', part.text.substring(0, 200));
        }
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error generating image:', error);
    return null;
  }
}

/**
 * Generate a pie chart showing expense distribution
 */
export async function generatePieChart(
  title: string,
  categories: CategoryData[],
  options?: ChartOptions
): Promise<GeneratedImage | null> {
  const prompt = buildPieChartPrompt(title, categories);
  return generateImageFromPrompt(prompt, { aspectRatio: '1:1', ...options });
}

/**
 * Generate a trend chart showing income vs expenses over time
 */
export async function generateTrendChart(
  title: string,
  data: MonthlyTrendData[],
  options?: ChartOptions
): Promise<GeneratedImage | null> {
  const prompt = buildTrendPrompt(title, data);
  return generateImageFromPrompt(prompt, { aspectRatio: '16:9', ...options });
}

/**
 * Generate a Phi Score visualization
 */
export async function generatePhiScoreVisual(
  data: PhiScoreData,
  options?: ChartOptions
): Promise<GeneratedImage | null> {
  const prompt = buildPhiScorePrompt(data);
  return generateImageFromPrompt(prompt, { aspectRatio: '1:1', useProModel: true, ...options });
}

/**
 * Generate a comprehensive monthly infographic
 */
export async function generateMonthlyInfographic(
  data: MonthlySummaryData,
  options?: ChartOptions
): Promise<GeneratedImage | null> {
  const prompt = buildMonthlyInfographicPrompt(data);
  return generateImageFromPrompt(prompt, { aspectRatio: '3:4', useProModel: true, ...options });
}

/**
 * Generate a comparison chart
 */
export async function generateComparisonChart(
  title: string,
  current: { label: string; value: number },
  previous: { label: string; value: number },
  options?: ChartOptions
): Promise<GeneratedImage | null> {
  const prompt = buildComparisonPrompt(title, current, previous);
  return generateImageFromPrompt(prompt, { aspectRatio: '1:1', ...options });
}

/**
 * Generate a goal progress visualization
 */
export async function generateGoalProgressChart(
  goalName: string,
  currentAmount: number,
  targetAmount: number,
  deadline?: string,
  options?: ChartOptions
): Promise<GeneratedImage | null> {
  const prompt = buildGoalProgressPrompt(goalName, currentAmount, targetAmount, deadline);
  return generateImageFromPrompt(prompt, { aspectRatio: '1:1', ...options });
}

/**
 * Main function to generate any type of chart
 */
export async function generateChart(
  type: ChartType,
  data: Record<string, unknown>,
  options?: ChartOptions
): Promise<GeneratedImage | null> {
  switch (type) {
    case 'pie':
      return generatePieChart(
        (data.title as string) || 'התפלגות הוצאות',
        data.categories as CategoryData[]
      );

    case 'trend':
      return generateTrendChart(
        (data.title as string) || 'מגמות חודשיות',
        data.monthlyData as MonthlyTrendData[]
      );

    case 'phi_score':
      return generatePhiScoreVisual(data as unknown as PhiScoreData, options);

    case 'monthly_infographic':
      return generateMonthlyInfographic(data as unknown as MonthlySummaryData, options);

    case 'comparison':
      return generateComparisonChart(
        (data.title as string) || 'השוואה',
        data.current as { label: string; value: number },
        data.previous as { label: string; value: number },
        options
      );

    case 'goal_progress':
      return generateGoalProgressChart(
        data.goalName as string,
        data.currentAmount as number,
        data.targetAmount as number,
        data.deadline as string | undefined,
        options
      );

    default:
      console.error(`Unknown chart type: ${type}`);
      return null;
  }
}

/**
 * Helper to convert base64 to Buffer for file operations
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Helper to create a data URL from generated image
 */
export function toDataUrl(image: GeneratedImage): string {
  return `data:${image.mimeType};base64,${image.base64}`;
}

