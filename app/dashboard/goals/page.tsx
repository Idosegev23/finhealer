'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Plus, CheckCircle2, Clock, TrendingUp, Trash2, Edit2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  status: 'active' | 'completed' | 'cancelled';
  priority: number;
  created_at: string;
  child_name?: string;
}

interface GoalStats {
  total: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  completedCount: number;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    deadline: '',
    current_amount: '',
  });
  
  useEffect(() => {
    loadGoals();
  }, []);
  
  async function loadGoals() {
    try {
      const res = await fetch('/api/goals?status=all');
      const data = await res.json();
      setGoals(data.goals || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      const body = {
        name: formData.name,
        target_amount: parseFloat(formData.target_amount) || 0,
        current_amount: parseFloat(formData.current_amount) || 0,
        deadline: formData.deadline || null,
      };
      
      if (editingGoal) {
        // Update
        await fetch('/api/goals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, id: editingGoal.id }),
        });
      } else {
        // Create
        await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      
      // Reset form and reload
      setFormData({ name: '', target_amount: '', deadline: '', current_amount: '' });
      setShowAddForm(false);
      setEditingGoal(null);
      loadGoals();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  }
  
  async function handleDelete(id: string) {
    if (!confirm('האם למחוק את היעד?')) return;
    
    try {
      await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
      loadGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  }
  
  async function markComplete(goal: Goal) {
    try {
      await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: goal.id,
          status: 'completed',
          current_amount: goal.target_amount,
        }),
      });
      loadGoals();
    } catch (error) {
      console.error('Error completing goal:', error);
    }
  }
  
  function startEdit(goal: Goal) {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      deadline: goal.deadline?.split('T')[0] || '',
    });
    setShowAddForm(true);
  }
  
  function calculateProgress(goal: Goal): number {
    if (goal.target_amount <= 0) return 0;
    return Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
  }
  
  function getTimeRemaining(deadline: string | null): string {
    if (!deadline) return 'ללא דדליין';
    
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'פג תוקף';
    if (diffDays === 0) return 'היום!';
    if (diffDays === 1) return 'מחר';
    if (diffDays < 30) return `${diffDays} ימים`;
    if (diffDays < 365) return `${Math.round(diffDays / 30)} חודשים`;
    return `${Math.round(diffDays / 365)} שנים`;
  }
  
  function getProgressColor(progress: number): string {
    if (progress >= 100) return 'bg-emerald-500';
    if (progress >= 75) return 'bg-lime-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  }
  
  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-phi-bg to-phi-frost p-6 flex items-center justify-center">
        <div className="text-phi-slate">טוען יעדים...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-phi-bg to-phi-frost p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-phi-dark mb-2 flex items-center gap-3">
            <Target className="w-8 h-8 text-phi-gold" />
            היעדים שלי
          </h1>
          <p className="text-phi-slate">הגדר יעדים פיננסיים ועקוב אחרי ההתקדמות</p>
        </div>
        
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-white border-phi-frost">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-phi-slate">יעדים פעילים</p>
                    <p className="text-2xl font-bold text-phi-dark">{activeGoals.length}</p>
                  </div>
                  <Target className="w-10 h-10 text-phi-gold opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-phi-frost">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-phi-slate">סה&quot;כ יעד</p>
                    <p className="text-2xl font-bold text-phi-dark">
                      {stats.totalTargetAmount.toLocaleString('he-IL')} ₪
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-phi-mint opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-phi-frost">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-phi-slate">נחסך עד כה</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {stats.totalCurrentAmount.toLocaleString('he-IL')} ₪
                    </p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-phi-frost">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-phi-slate">הושלמו</p>
                    <p className="text-2xl font-bold text-phi-dark">{completedGoals.length}</p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-phi-gold opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Add Goal Button / Form */}
        <AnimatePresence>
          {showAddForm ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="mb-8 bg-white border-phi-gold border-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{editingGoal ? 'עריכת יעד' : 'יעד חדש'}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingGoal(null);
                        setFormData({ name: '', target_amount: '', deadline: '', current_amount: '' });
                      }}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">שם היעד</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="למשל: קרן חירום, רכב חדש"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="target_amount">סכום יעד (₪)</Label>
                        <Input
                          id="target_amount"
                          type="number"
                          value={formData.target_amount}
                          onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                          placeholder="30000"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="current_amount">נחסך עד כה (₪)</Label>
                        <Input
                          id="current_amount"
                          type="number"
                          value={formData.current_amount}
                          onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="deadline">תאריך יעד (אופציונלי)</Label>
                        <Input
                          id="deadline"
                          type="date"
                          value={formData.deadline}
                          onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingGoal(null);
                        }}
                      >
                        ביטול
                      </Button>
                      <Button type="submit" className="bg-phi-gold hover:bg-phi-gold/90">
                        {editingGoal ? 'עדכון' : 'שמור יעד'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              className="mb-8 bg-phi-gold hover:bg-phi-gold/90 text-white"
            >
              <Plus className="w-5 h-5 ml-2" />
              יעד חדש
            </Button>
          )}
        </AnimatePresence>
        
        {/* Active Goals */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-phi-dark mb-4">יעדים פעילים</h2>
          
          {activeGoals.length === 0 ? (
            <Card className="bg-white/50 border-dashed border-2 border-phi-frost">
              <CardContent className="p-8 text-center">
                <Target className="w-12 h-12 mx-auto text-phi-slate/50 mb-4" />
                <p className="text-phi-slate mb-4">אין עדיין יעדים פעילים</p>
                <Button
                  onClick={() => setShowAddForm(true)}
                  variant="outline"
                  className="border-phi-gold text-phi-gold hover:bg-phi-gold/10"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  הוסף יעד ראשון
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGoals.map((goal) => {
                const progress = calculateProgress(goal);
                const remaining = goal.target_amount - goal.current_amount;
                const timeRemaining = getTimeRemaining(goal.deadline);
                
                return (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="bg-white hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg text-phi-dark">{goal.name}</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(goal)}
                            >
                              <Edit2 className="w-4 h-4 text-phi-slate" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDelete(goal.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                        {goal.deadline && (
                          <CardDescription className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeRemaining}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-phi-slate">התקדמות</span>
                            <span className="font-semibold text-phi-dark">{progress}%</span>
                          </div>
                          <div className="h-3 bg-phi-frost rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className={`h-full ${getProgressColor(progress)}`}
                            />
                          </div>
                        </div>
                        
                        {/* Amounts */}
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-phi-slate">נחסך:</span>
                            <span className="font-medium text-emerald-600">
                              {goal.current_amount.toLocaleString('he-IL')} ₪
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-phi-slate">יעד:</span>
                            <span className="font-medium text-phi-dark">
                              {goal.target_amount.toLocaleString('he-IL')} ₪
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="text-phi-slate">נותר:</span>
                            <span className="font-semibold text-phi-gold">
                              {remaining.toLocaleString('he-IL')} ₪
                            </span>
                          </div>
                        </div>
                        
                        {/* Mark Complete Button */}
                        {progress >= 100 && (
                          <Button
                            onClick={() => markComplete(goal)}
                            className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600"
                          >
                            <CheckCircle2 className="w-4 h-4 ml-2" />
                            סמן כהושלם
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-phi-dark mb-4">יעדים שהושלמו 🎉</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedGoals.map((goal) => (
                <Card key={goal.id} className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <div>
                        <p className="font-medium text-phi-dark">{goal.name}</p>
                        <p className="text-sm text-emerald-600">
                          {goal.target_amount.toLocaleString('he-IL')} ₪
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {/* Tips Section */}
        <Card className="mt-8 bg-gradient-to-br from-phi-gold/10 to-phi-mint/10 border-phi-gold/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-phi-gold flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-phi-dark mb-2">טיפים להצלחה ביעדים</h3>
                <ul className="text-sm text-phi-slate space-y-1">
                  <li>• התחל עם יעד קטן וריאלי - ההצלחה תיתן לך מוטיבציה</li>
                  <li>• קבע הוראת קבע חודשית לחשבון חיסכון נפרד</li>
                  <li>• עדכן את ההתקדמות באופן קבוע</li>
                  <li>• חגוג כל אבן דרך בדרך ליעד!</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
