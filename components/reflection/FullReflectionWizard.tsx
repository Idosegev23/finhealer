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
      const dataFields = data as any
      const totalFixedExpenses = 
        (dataFields.rent_mortgage || 0) + (dataFields.building_maintenance || 0) + (dataFields.property_tax || 0) +
        (dataFields.life_insurance || 0) + (dataFields.health_insurance || 0) + (dataFields.car_insurance || 0) + (dataFields.home_insurance || 0) +
        (dataFields.cellular || 0) + (dataFields.internet || 0) + (dataFields.tv_cable || 0) +
        (dataFields.leasing || 0) + (dataFields.fuel || 0) + (dataFields.parking || 0) + (dataFields.public_transport || 0) +
        (dataFields.daycare || 0) + (dataFields.afterschool || 0) + (dataFields.tuition || 0) + (dataFields.extracurricular || 0) + (dataFields.babysitter || 0) +
        (dataFields.gym || 0) + (dataFields.therapy || 0) + (dataFields.medication || 0) +
        (dataFields.pension_funds || 0) +
        (dataFields.streaming || 0) + (dataFields.digital_services || 0) +
        (dataFields.electricity || 0) + (dataFields.water || 0) + (dataFields.gas || 0) +
        (dataFields.other_fixed || 0);

      const totalMonthlyIncome = (dataFields.monthly_income || 0) + (dataFields.additional_income || 0) + (dataFields.spouse_income || 0);

      // שמירת פרופיל פיננסי
      const profileResponse = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Personal
          age: dataFields.age,
          marital_status: dataFields.marital_status,
          children_count: dataFields.children_count,
          children_ages: dataFields.children_ages,
          city: dataFields.city,
          // Income
          monthly_income: dataFields.monthly_income,
          additional_income: dataFields.additional_income,
          spouse_income: dataFields.spouse_income,
          total_monthly_income: totalMonthlyIncome,
          // Fixed Expenses - כל 39 השדות
          rent_mortgage: dataFields.rent_mortgage,
          building_maintenance: dataFields.building_maintenance,
          property_tax: dataFields.property_tax,
          life_insurance: dataFields.life_insurance,
          health_insurance: dataFields.health_insurance,
          car_insurance: dataFields.car_insurance,
          home_insurance: dataFields.home_insurance,
          cellular: dataFields.cellular,
          internet: dataFields.internet,
          tv_cable: dataFields.tv_cable,
          leasing: dataFields.leasing,
          fuel: dataFields.fuel,
          parking: dataFields.parking,
          public_transport: dataFields.public_transport,
          daycare: dataFields.daycare,
          afterschool: dataFields.afterschool,
          tuition: dataFields.tuition,
          extracurricular: dataFields.extracurricular,
          babysitter: dataFields.babysitter,
          gym: dataFields.gym,
          therapy: dataFields.therapy,
          medication: dataFields.medication,
          pension_funds: dataFields.pension_funds,
          streaming: dataFields.streaming,
          digital_services: dataFields.digital_services,
          electricity: dataFields.electricity,
          water: dataFields.water,
          gas: dataFields.gas,
          other_fixed: dataFields.other_fixed,
          total_fixed_expenses: totalFixedExpenses,
          // Debts & Assets
          credit_card_debt: dataFields.credit_card_debt,
          bank_loans: dataFields.bank_loans,
          other_debts: dataFields.other_debts,
          current_savings: dataFields.current_savings,
          investments: dataFields.investments,
          owns_home: dataFields.owns_home,
          owns_car: dataFields.owns_car,
          current_account_balance: dataFields.current_account_balance || 0,
          // Goals
          why_here: dataFields.why_here,
          short_term_goal: dataFields.short_term_goal,
          long_term_dream: dataFields.long_term_dream,
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


