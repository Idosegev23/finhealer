'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Stepper, { Step } from '@/components/shared/Stepper';
import Step1Personal from './steps/Step1Personal';
import Step2Income from './steps/Step2Income';
import Step3FixedExpenses from './steps/Step3FixedExpenses';
import Step4DebtsAssets from './steps/Step4DebtsAssets';
import Step5History from './steps/Step5History';
import Step6Goals from './steps/Step6Goals';

interface FullReflectionWizardProps {
  categories: any[];
  userId: string;
}

export default function FullReflectionWizard({ categories, userId }: FullReflectionWizardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // State לכל הנתונים
  const [data, setData] = useState({
    // Step 1 - Personal
    age: null,
    marital_status: '',
    children_count: 0,
    children_ages: [],
    city: '',

    // Step 2 - Income
    monthly_income: 0,
    additional_income: 0,
    spouse_income: 0,

    // Step 3 - Fixed Expenses (39 fields)
    // דיור
    rent_mortgage: 0,
    building_maintenance: 0,
    property_tax: 0,
    // ביטוחים
    life_insurance: 0,
    health_insurance: 0,
    car_insurance: 0,
    home_insurance: 0,
    // תקשורת
    cellular: 0,
    internet: 0,
    tv_cable: 0,
    // רכב
    leasing: 0,
    fuel: 0,
    parking: 0,
    public_transport: 0,
    // ילדים
    daycare: 0,
    afterschool: 0,
    tuition: 0,
    extracurricular: 0,
    babysitter: 0,
    // בריאות
    gym: 0,
    therapy: 0,
    medication: 0,
    // חיסכון
    pension_funds: 0,
    // מנויים
    streaming: 0,
    digital_services: 0,
    // חובה
    electricity: 0,
    water: 0,
    gas: 0,
    // אחר
    other_fixed: 0,

    // Step 4 - Debts & Assets
    credit_card_debt: 0,
    bank_loans: 0,
    other_debts: 0,
    current_savings: 0,
    investments: 0,
    owns_home: false,
    owns_car: false,

    // Step 5 - History
    baselines: {},
    months_back: 3,

    // Step 6 - Goals
    why_here: [],
    short_term_goal: '',
    long_term_dream: ''
  });

  const handleChange = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      // חישוב סכום הוצאות קבועות
      const totalFixedExpenses =
        (data.rent_mortgage || 0) + (data.building_maintenance || 0) + (data.property_tax || 0) +
        (data.life_insurance || 0) + (data.health_insurance || 0) + (data.car_insurance || 0) + (data.home_insurance || 0) +
        (data.cellular || 0) + (data.internet || 0) + (data.tv_cable || 0) +
        (data.leasing || 0) + (data.fuel || 0) + (data.parking || 0) + (data.public_transport || 0) +
        (data.daycare || 0) + (data.afterschool || 0) + (data.tuition || 0) + (data.extracurricular || 0) + (data.babysitter || 0) +
        (data.gym || 0) + (data.therapy || 0) + (data.medication || 0) +
        (data.pension_funds || 0) +
        (data.streaming || 0) + (data.digital_services || 0) +
        (data.electricity || 0) + (data.water || 0) + (data.gas || 0) +
        (data.other_fixed || 0);

      const totalMonthlyIncome = (data.monthly_income || 0) + (data.additional_income || 0) + (data.spouse_income || 0);

      // שמירת פרופיל פיננסי
      const profileResponse = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Personal
          age: data.age,
          marital_status: data.marital_status,
          children_count: data.children_count,
          children_ages: data.children_ages,
          city: data.city,
          // Income
          monthly_income: data.monthly_income,
          additional_income: data.additional_income,
          spouse_income: data.spouse_income,
          total_monthly_income: totalMonthlyIncome,
          // Fixed Expenses - כל 39 השדות
          rent_mortgage: data.rent_mortgage,
          building_maintenance: data.building_maintenance,
          property_tax: data.property_tax,
          life_insurance: data.life_insurance,
          health_insurance: data.health_insurance,
          car_insurance: data.car_insurance,
          home_insurance: data.home_insurance,
          cellular: data.cellular,
          internet: data.internet,
          tv_cable: data.tv_cable,
          leasing: data.leasing,
          fuel: data.fuel,
          parking: data.parking,
          public_transport: data.public_transport,
          daycare: data.daycare,
          afterschool: data.afterschool,
          tuition: data.tuition,
          extracurricular: data.extracurricular,
          babysitter: data.babysitter,
          gym: data.gym,
          therapy: data.therapy,
          medication: data.medication,
          pension_funds: data.pension_funds,
          streaming: data.streaming,
          digital_services: data.digital_services,
          electricity: data.electricity,
          water: data.water,
          gas: data.gas,
          other_fixed: data.other_fixed,
          total_fixed_expenses: totalFixedExpenses,
          // Debts & Assets
          credit_card_debt: data.credit_card_debt,
          bank_loans: data.bank_loans,
          other_debts: data.other_debts,
          current_savings: data.current_savings,
          investments: data.investments,
          owns_home: data.owns_home,
          owns_car: data.owns_car,
          current_account_balance: data.current_account_balance || 0,
          // Goals
          why_here: data.why_here,
          short_term_goal: data.short_term_goal,
          long_term_dream: data.long_term_dream,
          completed: true
        })
      });

      if (!profileResponse.ok) {
        throw new Error('שגיאה בשמירת הפרופיל');
      }

      // שמירת baselines
      const baselines = Object.entries(data.baselines)
        .filter(([_, amount]) => parseInt(amount as string) > 0)
        .map(([category, amount]) => ({
          category,
          avg_amount: parseInt(amount as string),
          months_back: data.months_back
        }));

      if (baselines.length > 0) {
        const baselinesResponse = await fetch('/api/reflection/baseline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baselines })
        });

        if (!baselinesResponse.ok) {
          throw new Error('שגיאה בשמירת ההיסטוריה');
        }
      }

      // הצלחה - מעבר ל-dashboard
      router.push('/dashboard?reflection=completed');
      router.refresh();
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בשמירת הנתונים. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] py-12 px-4" dir="rtl">
      <Stepper
        initialStep={1}
        onStepChange={(step) => setCurrentStep(step)}
        onFinalStepCompleted={handleComplete}
        backButtonText="← הקודם"
        nextButtonText={loading && currentStep === 6 ? 'שומר...' : 'הבא →'}
      >
        <Step>
          <Step1Personal data={data} onChange={handleChange} />
        </Step>
        
        <Step>
          <Step2Income data={data} onChange={handleChange} />
        </Step>
        
        <Step>
          <Step3FixedExpenses data={data} onChange={handleChange} />
        </Step>
        
        <Step>
          <Step4DebtsAssets data={data} onChange={handleChange} />
        </Step>
        
        <Step>
          <Step5History categories={categories} data={data} onChange={handleChange} />
        </Step>
        
        <Step>
          <Step6Goals data={data} onChange={handleChange} />
        </Step>
      </Stepper>

      {/* Progress text */}
      <div className="text-center mt-8 text-sm text-[#555555]">
        שלב {currentStep} מתוך 6
      </div>
    </div>
  );
}


