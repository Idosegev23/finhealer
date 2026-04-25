import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Canonical phase order — Goals BEFORE Budget per Gadi's methodology
// (PHI_PHASES_CORRECT_FLOW.md): need to know goals before building a budget that supports them.
export type Phase = 'data_collection' | 'behavior' | 'goals' | 'budget' | 'monitoring';

export const PHASE_ORDER: Phase[] = ['data_collection', 'behavior', 'goals', 'budget', 'monitoring'];

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
 */
export function useUserPhase(): UserPhaseData {
  const [phase, setPhase] = useState<Phase>('data_collection');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchUserPhase = async () => {
      try {
        setLoading(true);
        const supabase = createClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          throw new Error('User not authenticated');
        }

        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('phase, created_at')
          .eq('id', user.id)
          .single();

        if (dbError) {
          throw dbError;
        }

        const userInfo = userData as any;
        const userPhase = (userInfo?.phase as Phase) || 'data_collection';
        setPhase(userPhase);

        const phaseProgress = calculatePhaseProgress(userPhase);
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

  return { phase, loading, error, nextPhase, progress, isReady };
}

function getNextPhase(currentPhase: Phase): Phase | null {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
    return null;
  }
  return PHASE_ORDER[currentIndex + 1];
}

function calculatePhaseProgress(phase: Phase): number {
  const phaseMap: Record<Phase, number> = {
    data_collection: 20,
    behavior: 40,
    goals: 60,
    budget: 80,
    monitoring: 100,
  };
  return phaseMap[phase] || 0;
}

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
