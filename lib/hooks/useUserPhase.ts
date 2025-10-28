import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Phase = 'reflection' | 'behavior' | 'budget' | 'goals' | 'monitoring';

export interface UserPhaseData {
  phase: Phase;
  loading: boolean;
  error: string | null;
  nextPhase: Phase | null;
  progress: number; // 0-100
  isReady: boolean;
}

/**
 * Hook לזיהוי השלב (Phase) של המשתמש במסע ההבראה הפיננסית
 * 
 * @returns {UserPhaseData} מידע על שלב המשתמש
 * 
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { phase, loading, progress } = useUserPhase();
 *   
 *   if (loading) return <Skeleton />;
 *   
 *   return <PhaseComponent phase={phase} />;
 * }
 * ```
 */
export function useUserPhase(): UserPhaseData {
  const [phase, setPhase] = useState<Phase>('reflection');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchUserPhase = async () => {
      try {
        setLoading(true);
        const supabase = createClient();

        // קבל משתמש נוכחי
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error('User not authenticated');
        }

        // קבל phase מ-users table
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('phase, created_at')
          .eq('id', user.id)
          .single();

        if (dbError) {
          throw dbError;
        }

        // Type assertion for userData
        const userInfo = userData as any;

        const userPhase = (userInfo?.phase as Phase) || 'reflection';
        setPhase(userPhase);

        // חשב progress לפי שלב
        const phaseProgress = calculatePhaseProgress(userPhase, userInfo?.created_at);
        setProgress(phaseProgress);

      } catch (err) {
        console.error('Error fetching user phase:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUserPhase();
  }, []);

  const nextPhase = getNextPhase(phase);
  const isReady = !loading && !error;

  return {
    phase,
    loading,
    error,
    nextPhase,
    progress,
    isReady,
  };
}

/**
 * מחזיר את השלב הבא במסע
 */
function getNextPhase(currentPhase: Phase): Phase | null {
  const phases: Phase[] = ['reflection', 'behavior', 'budget', 'goals', 'monitoring'];
  const currentIndex = phases.indexOf(currentPhase);
  
  if (currentIndex === -1 || currentIndex === phases.length - 1) {
    return null; // כבר בשלב אחרון
  }
  
  return phases[currentIndex + 1];
}

/**
 * מחשב אחוז התקדמות בשלב הנוכחי
 */
function calculatePhaseProgress(phase: Phase, createdAt?: string): number {
  // לוגיקה בסיסית - אפשר להרחיב
  const phaseMap: Record<Phase, number> = {
    reflection: 20,
    behavior: 40,
    budget: 60,
    goals: 80,
    monitoring: 100,
  };
  
  return phaseMap[phase] || 0;
}

/**
 * Hook לעדכון Phase של המשתמש
 * 
 * @example
 * ```tsx
 * function CompleteReflection() {
 *   const updatePhase = useUpdateUserPhase();
 *   
 *   const handleComplete = async () => {
 *     await updatePhase('behavior');
 *   };
 * }
 * ```
 */
export function useUpdateUserPhase() {
  return async (newPhase: Phase) => {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await (supabase as any)
      .from('users')
      .update({ phase: newPhase })
      .eq('id', user.id);

    if (error) throw error;
    
    return { success: true };
  };
}

