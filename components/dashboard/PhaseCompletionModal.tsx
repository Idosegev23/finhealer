'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PhaseCompletionModalProps {
  newPhase: 'behavior' | 'budget' | 'goals' | 'monitoring';
  onClose: () => void;
}

const phaseInfo = {
  behavior: {
    title: 'ניתוח הרגלים',
    emoji: '🔍',
    congratsMessage: 'יש לך מספיק נתונים!',
    description: 'עכשיו אנחנו יכולים לנתח את ההרגלים הפיננסיים שלך ולזהות דפוסים',
    features: [
      'ניתוח הוצאות לפי קטגוריה',
      'זיהוי דפוסי הוצאה',
      'תובנות AI מותאמות אישית',
      'המלצות לשיפור',
    ],
  },
  budget: {
    title: 'תקציב חכם',
    emoji: '💰',
    congratsMessage: 'הבנו את ההרגלים שלך!',
    description: 'הגיע הזמן לבנות תקציב חכם המבוסס על ההתנהלות האמיתית שלך',
    features: [
      'תקציב מותאם אישית',
      'התראות חריגה',
      'השוואה בפועל מול תקציב',
      'התאמות אוטומטיות',
    ],
  },
  goals: {
    title: 'הגדרת יעדים',
    emoji: '🎯',
    congratsMessage: 'התקציב שלך מוכן!',
    description: 'עכשיו אפשר להגדיר יעדים פיננסיים ולעקוב אחרי ההתקדמות',
    features: [
      'יעדי חיסכון',
      'תחזיות AI',
      'מעקב התקדמות',
      'תזכורות והמלצות',
    ],
  },
  monitoring: {
    title: 'מעקב רציף',
    emoji: '📊',
    congratsMessage: 'הגעת ל-φ מושלם!',
    description: 'אתה במצב φ מושלם! עכשיו נמשיך לעקוב ולהתאים',
    features: [
      'דשבורד מלא',
      'כל התכונות פתוחות',
      'ניטור שוטף',
      'התאמות אוטומטיות',
    ],
  },
};

export function PhaseCompletionModal({ newPhase, onClose }: PhaseCompletionModalProps) {
  const [show, setShow] = useState(false);
  const info = phaseInfo[newPhase];

  useEffect(() => {
    // Animate in
    setTimeout(() => setShow(true), 100);
  }, []);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className={`fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <Card className={`max-w-2xl w-full bg-white p-8 relative transform transition-all duration-300 ${show ? 'scale-100' : 'scale-95'}`}>
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Celebration Animation */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-phi-gold to-phi-coral mb-4 animate-bounce">
            <span className="text-6xl">{info.emoji}</span>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-phi-gold animate-pulse" />
            <h2 className="text-4xl font-black text-phi-dark">
              כל הכבוד!
            </h2>
            <Sparkles className="w-6 h-6 text-phi-gold animate-pulse" />
          </div>
          
          <p className="text-xl text-phi-coral font-bold mb-2">
            {info.congratsMessage}
          </p>
          
          <div className="inline-block bg-phi-gold/20 px-6 py-2 rounded-full">
            <p className="text-lg font-semibold text-phi-dark">
              עברת לשלב: <span className="text-phi-gold">{info.title}</span>
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-gradient-to-l from-phi-mint/20 to-phi-coral/20 rounded-lg p-6 mb-6">
          <p className="text-lg text-gray-800 text-center leading-relaxed">
            {info.description}
          </p>
        </div>

        {/* New Features */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-phi-dark mb-4 text-center">
            🎁 מה חדש בשלב הזה?
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {info.features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 bg-white border-2 border-phi-gold/30 rounded-lg p-3 hover:border-phi-gold transition-all"
              >
                <CheckCircle className="w-5 h-5 text-phi-gold flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <Button
            onClick={handleClose}
            className="bg-gradient-to-l from-phi-gold to-phi-coral text-white text-xl font-bold py-6 px-12 hover:shadow-xl"
            size="lg"
          >
            בואו נתחיל! 
            <ArrowRight className="w-5 h-5 mr-2" />
          </Button>
        </div>

        {/* Confetti Effect (CSS) */}
        <style jsx>{`
          @keyframes confetti {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
          }
        `}</style>
      </Card>
    </div>
  );
}

