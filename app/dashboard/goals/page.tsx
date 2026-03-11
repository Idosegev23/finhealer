/**
 * עמוד יעדים (φ Goals) - דשבורד מתקדם לניהול יעדים פיננסיים
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Target,
  TrendingUp,
  AlertCircle,
  Sparkles,
  PlayCircle,
  RotateCcw,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  ArrowUpDown,
} from 'lucide-react';
import type { Goal, GoalAllocationResult } from '@/types/goals';
import { GoalModal } from '@/components/goals/GoalModal';
import { GoalsListCard } from '@/components/goals/GoalsListCard';
import { GoalsDragList } from '@/components/goals/GoalsDragList';
import { GoalsTimeline } from '@/components/goals/GoalsTimeline';
import GoalDepositModal from '@/components/goals/GoalDepositModal';
import { createClientComponentClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [allocationResult, setAllocationResult] = useState<GoalAllocationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulatedIncome, setSimulatedIncome] = useState<number | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [isDragMode, setIsDragMode] = useState(false);
  const [depositingGoal, setDepositingGoal] = useState<Goal | null>(null);
  
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    loadGoalsAndAllocations();
  }, []);
  
  async function loadGoalsAndAllocations() {
    try {
      setLoading(true);
      
      // שלוף מזהה משתמש
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user');
        return;
      }
      
      setUserId(user.id);
      
      // שלוף יעדים מהDB
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('priority', { ascending: true });
      
      if (goalsError) {
        console.error('Error loading goals:', goalsError);
        return;
      }
      
      setGoals(goalsData || []);
      
      // חשב הקצאות
      const allocResponse = await fetch('/api/goals/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      
      const allocData = await allocResponse.json();
      if (allocData.success) {
        setAllocationResult(allocData.result);
      }
      
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSaveGoal(goalData: Partial<Goal>) {
    try {
      if (goalData.id) {
        // עדכון
        const { error } = await supabase
          .from('goals')
          .update(goalData)
          .eq('id', goalData.id);
        
        if (error) throw error;
      } else {
        // יצירה חדשה
        const { error } = await supabase
          .from('goals')
          .insert([{ ...goalData, current_amount: 0 }]);
        
        if (error) throw error;
      }
      
      // רענן רשימה
      await loadGoalsAndAllocations();
      setIsModalOpen(false);
      setEditingGoal(null);
    } catch (error) {
      console.error('Error saving goal:', error);
      throw error;
    }
  }
  
  async function handleDeleteGoal(goalId: string) {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ status: 'cancelled' })
        .eq('id', goalId);
      
      if (error) throw error;
      
      await loadGoalsAndAllocations();
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  }
  
  function handleEditGoal(goal: Goal) {
    setEditingGoal(goal);
    setIsModalOpen(true);
  }
  
  function handleNewGoal() {
    setEditingGoal(null);
    setIsModalOpen(true);
  }
  
  async function handleReorderGoals(reorderedGoals: Goal[]) {
    try {
      // עדכן עדיפויות בDB
      for (const goal of reorderedGoals) {
        await supabase
          .from('goals')
          .update({ priority: goal.priority })
          .eq('id', goal.id);
      }
      
      // רענן נתונים
      await loadGoalsAndAllocations();
      setIsDragMode(false);
    } catch (error) {
      console.error('Error reordering goals:', error);
      throw error;
    }
  }
  
  async function runSimulation(incomeChange: number) {
    setIsSimulating(true);

    try {
      const simResponse = await fetch('/api/goals/simulate', {
          method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          scenario: {
            type: 'income_change',
            income_change: incomeChange,
          },
        }),
      });
      
      const simData = await simResponse.json();
      if (simData.success) {
        setSimulationResult(simData.result);
      }
      
    } catch (error) {
      console.error('Error running simulation:', error);
    } finally {
      setIsSimulating(false);
    }
  }
  
  function handleSimulationSlider(value: number[]) {
    const income = allocationResult?.summary.total_income || 0;
    const change = value[0];
    setSimulatedIncome(income + change);
  }
  
  function applySimulation() {
    if (simulatedIncome && allocationResult) {
      const change = simulatedIncome - allocationResult.summary.total_income;
      runSimulation(change);
    }
  }
  
  function resetSimulation() {
    setSimulatedIncome(null);
    setSimulationResult(null);
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold mx-auto mb-4"></div>
          <p className="text-phi-slate">טוען יעדים...</p>
        </div>
      </div>
    );
  }
  
  const currentIncome = allocationResult?.summary.total_income || 0;
  const displayedResult = simulationResult?.after || allocationResult;
  const isSimulationActive = simulationResult !== null;
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" dir="rtl">
      {/* כותרת וכפתור יעד חדש */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-phi-dark flex items-center gap-3 mb-2">
            <Target className="w-10 h-10 text-phi-gold" />
            φ היעדים שלך
          </h1>
          <p className="text-phi-slate text-lg">
            {goals.length === 0
              ? 'הגדר יעדים פיננסיים ונתחיל לעבוד לקראתם'
              : `${goals.length} יעדים פעילים`}
          </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setIsDragMode(true)} size="lg" variant="outline" className="gap-2">
              <ArrowUpDown className="w-5 h-5" />
              שנה סדר
            </Button>
            <Button onClick={handleNewGoal} size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              יעד חדש
            </Button>
          </div>
        </div>
        
      {/* סיכום כללי */}
      {allocationResult && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-phi-mint/20 to-phi-mint/5 border-phi-mint/30">
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                  <p className="text-sm text-phi-slate mb-1">הכנסה חודשית</p>
                  <p className="text-2xl font-bold text-phi-dark">
                    {currentIncome.toLocaleString('he-IL')} ₪
                  </p>
                  </div>
                <DollarSign className="w-10 h-10 text-phi-mint" />
                </div>
              </CardContent>
            </Card>
            
          <Card className="bg-gradient-to-br from-phi-gold/20 to-phi-gold/5 border-phi-gold/30">
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                  <p className="text-sm text-phi-slate mb-1">זמין ליעדים</p>
                    <p className="text-2xl font-bold text-phi-dark">
                    {allocationResult.summary.available_for_goals.toLocaleString('he-IL')} ₪
                    </p>
                  </div>
                <Target className="w-10 h-10 text-phi-gold" />
                </div>
              </CardContent>
            </Card>
            
          <Card className="bg-gradient-to-br from-phi-coral/20 to-phi-coral/5 border-phi-coral/30">
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                  <p className="text-sm text-phi-slate mb-1">סה״כ מוקצה</p>
                  <p className="text-2xl font-bold text-phi-dark">
                    {allocationResult.summary.total_allocated.toLocaleString('he-IL')} ₪
                    </p>
                  </div>
                <TrendingUp className="w-10 h-10 text-phi-coral" />
                </div>
              </CardContent>
            </Card>
            
          <Card className={`bg-gradient-to-br ${
            allocationResult.safetyCheck.passed
              ? 'from-green-500/20 to-green-500/5 border-green-500/30'
              : 'from-red-500/20 to-red-500/5 border-red-500/30'
          }`}>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                  <p className="text-sm text-phi-slate mb-1">מצב תקציבי</p>
                  <p className="text-lg font-bold text-phi-dark">
                    {allocationResult.safetyCheck.comfort_level === 'excellent' && 'מצוין'}
                    {allocationResult.safetyCheck.comfort_level === 'comfortable' && 'נוח'}
                    {allocationResult.safetyCheck.comfort_level === 'tight' && 'צמוד'}
                    {allocationResult.safetyCheck.comfort_level === 'critical' && 'קריטי'}
                  </p>
                  </div>
                {allocationResult.safetyCheck.passed ? (
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-red-600" />
                )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
      {/* אזהרות */}
      {allocationResult && allocationResult.warnings.length > 0 && (
        <Alert className="mb-6 border-phi-coral bg-phi-coral/10">
          <AlertCircle className="h-4 w-4 text-phi-coral" />
          <AlertDescription className="text-phi-dark">
            {allocationResult.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}
      
      {/* סימולטור */}
      <Card className="mb-8">
                <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-phi-gold" />
            סימולטור - מה יקרה אם...
                  </CardTitle>
          <CardDescription>
            משוך את הסליידר לראות איך שינוי בהכנסה ישפיע על היעדים שלך
          </CardDescription>
                </CardHeader>
                <CardContent>
          <div className="space-y-6">
                      <div>
              <div className="flex justify-between mb-3">
                <span className="text-sm text-phi-slate">הכנסה חודשית</span>
                <span className="text-lg font-bold text-phi-dark">
                  {(simulatedIncome || currentIncome).toLocaleString('he-IL')} ₪
                </span>
                      </div>
              <Slider
                value={[simulatedIncome ? simulatedIncome - currentIncome : 0]}
                onValueChange={handleSimulationSlider}
                min={-currentIncome * 0.5}
                max={currentIncome * 0.5}
                step={100}
                className="mb-4"
                        />
              <div className="flex justify-between text-sm text-phi-slate">
                <span>{(currentIncome * 0.5).toLocaleString('he-IL')}- ₪</span>
                <span>ללא שינוי</span>
                <span>+{(currentIncome * 0.5).toLocaleString('he-IL')} ₪</span>
                      </div>
                    </div>
                    
            <div className="flex gap-3">
              <Button 
                onClick={applySimulation}
                disabled={!simulatedIncome || isSimulating}
                className="flex-1 bg-phi-gold hover:bg-phi-gold/90"
              >
                <PlayCircle className="w-4 h-4 ml-2" />
                {isSimulating ? 'מחשב...' : 'הרץ סימולציה'}
              </Button>
                      <Button
                onClick={resetSimulation}
                        variant="outline"
                disabled={!isSimulationActive}
                      >
                <RotateCcw className="w-4 h-4 ml-2" />
                איפוס
                      </Button>
            </div>
            
            {/* תוצאות סימולציה */}
            {simulationResult && (
              <div className="bg-phi-mint/10 border border-phi-mint/30 rounded-lg p-4 mt-4">
                <h4 className="font-bold text-phi-dark mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-phi-mint" />
                  תוצאות הסימולציה
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-phi-slate">יעדים שישתפרו:</span>
                    <span className="font-bold text-green-600">
                      {simulationResult.impact_summary.goals_improved}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-phi-slate">יעדים שיוקטנו:</span>
                    <span className="font-bold text-red-600">
                      {simulationResult.impact_summary.goals_worsened}
                    </span>
                  </div>
                  {simulationResult.impact_summary.total_time_saved_months > 0 && (
                    <div className="flex justify-between">
                      <span className="text-phi-slate">חודשים שנחסכו:</span>
                      <span className="font-bold text-phi-mint">
                        {simulationResult.impact_summary.total_time_saved_months}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 mt-3 border-t border-phi-mint/20">
                    <p className="text-phi-dark font-medium">
                      {simulationResult.impact_summary.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
                </CardContent>
              </Card>
      
      {/* ציר זמן ויזואלי (Timeline) */}
      {goals.length > 0 && (
        <div className="mt-8">
          <GoalsTimeline goals={goals} />
        </div>
      )}
      
      {/* רשימת יעדים - עם קומפוננטה חדשה */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-phi-dark mb-4">רשימת יעדים</h2>
        <GoalsListCard
          goals={goals}
          onEdit={handleEditGoal}
          onDelete={handleDeleteGoal}
          onDeposit={(goal) => setDepositingGoal(goal)}
        />
        
        {/* Modal להפקדה */}
        {depositingGoal && (
          <GoalDepositModal
            goal={depositingGoal}
            isOpen={!!depositingGoal}
            onClose={() => setDepositingGoal(null)}
            onSuccess={() => {
              loadGoalsAndAllocations();
              alert('ההפקדה נוספה בהצלחה!');
            }}
          />
        )}
      </div>
      
      {/* פירוט הקצאות - לפי המערכת הישנה */}
      {displayedResult && displayedResult.allocations.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>פירוט הקצאות</CardTitle>
            <CardDescription>
              חישוב אוטומטי של φ Goals Balancer
            </CardDescription>
          </CardHeader>
          <CardContent>
            {displayedResult.allocations.length > 0 ? (
            <div className="space-y-4">
              {displayedResult.allocations.map((allocation: any, index: number) => {
                const goal = goals.find(g => g.id === allocation.goal_id);
                if (!goal) return null;
                
                const progress = (goal.current_amount / goal.target_amount) * 100;
                const priorityColor = goal.priority <= 3 ? 'text-red-600' : goal.priority <= 6 ? 'text-yellow-600' : 'text-green-600';
                
                return (
                  <Card key={goal.id} className={isSimulationActive && allocation.monthly_allocation !== allocationResult?.allocations.find((a: any) => a.goal_id === allocation.goal_id)?.monthly_allocation ? 'border-phi-gold border-2' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-phi-dark">{goal.name}</h3>
                            <span className={`text-sm font-medium ${priorityColor}`}>
                              עדיפות {goal.priority}
                            </span>
                          </div>
                          <div className="flex gap-6 text-sm text-phi-slate">
                            <span>יעד: {goal.target_amount.toLocaleString('he-IL')} ₪</span>
                            <span>נוכחי: {goal.current_amount.toLocaleString('he-IL')} ₪</span>
                            <span>נותר: {allocation.remaining_amount.toLocaleString('he-IL')} ₪</span>
                          </div>
                        </div>
                      </div>
                      
                      <Progress value={progress} className="mb-4 h-3" />
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-phi-slate mb-1">הקצאה חודשית</p>
                          <p className="font-bold text-phi-dark">
                            {allocation.monthly_allocation.toLocaleString('he-IL')} ₪
                          </p>
                        </div>
                        <div>
                          <p className="text-phi-slate mb-1">חודשים לסיום</p>
                          <p className="font-bold text-phi-dark flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {allocation.months_to_complete}
                          </p>
                        </div>
                        <div>
                          <p className="text-phi-slate mb-1">סיום צפוי</p>
                          <p className="font-bold text-phi-dark">
                            {new Date(allocation.expected_completion_date).toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div>
                          <p className="text-phi-slate mb-1">סטטוס</p>
                          <p className={`font-bold ${allocation.is_achievable ? 'text-green-600' : 'text-red-600'}`}>
                            {allocation.is_achievable ? '✅ ניתן להשגה' : '⚠️ קשה'}
                          </p>
                        </div>
                      </div>
                        
                      {allocation.warnings.length > 0 && (
                        <div className="mt-4 text-sm text-phi-slate bg-phi-coral/10 p-3 rounded-lg">
                          {allocation.warnings.join(', ')}
                        </div>
                        )}
                      </CardContent>
                    </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-phi-slate/30 mx-auto mb-4" />
              <p className="text-phi-slate text-lg mb-4">אין עדיין יעדים פעילים</p>
              <Button className="bg-phi-gold hover:bg-phi-gold/90">
                הוסף יעד ראשון
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}
      
      {/* המלצות */}
      {allocationResult && allocationResult.suggestions.length > 0 && (
        <Card className="mt-6 border-phi-mint bg-phi-mint/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-phi-mint">
              <Sparkles className="w-6 h-6" />
              המלצות φ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allocationResult.suggestions.map((suggestion, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-lg">
                  <div className={`rounded-full p-2 ${
                    suggestion.priority === 'high' ? 'bg-red-100' :
                    suggestion.priority === 'medium' ? 'bg-yellow-100' :
                    'bg-green-100'
                  }`}>
                    <TrendingUp className={`w-5 h-5 ${
                      suggestion.priority === 'high' ? 'text-red-600' :
                      suggestion.priority === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-phi-dark mb-1">{suggestion.message}</p>
                    <p className="text-sm text-phi-slate">{suggestion.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Modals */}
      <GoalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
        goal={editingGoal}
        userId={userId}
      />
      
      {/* Drag & Drop Dialog */}
      <Dialog open={isDragMode} onOpenChange={setIsDragMode}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              סדר עדיפויות יעדים
            </DialogTitle>
            <DialogDescription>גרור את היעדים כדי לשנות את סדר העדיפויות</DialogDescription>
          </DialogHeader>
          <GoalsDragList
            goals={goals}
            onSave={handleReorderGoals}
            onClose={() => setIsDragMode(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
