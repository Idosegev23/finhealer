'use client';

import React, { useState, ReactNode } from 'react';
import { Check } from 'lucide-react';
import './stepper.css';

export interface StepProps {
  children: ReactNode;
}

export function Step({ children }: StepProps) {
  return <>{children}</>;
}

interface StepperProps {
  children: ReactNode[];
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onBeforeStepChange?: (fromStep: number, toStep: number) => Promise<boolean> | boolean;
  onFinalStepCompleted?: () => void;
  backButtonText?: string;
  nextButtonText?: string;
  finalButtonText?: string;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange,
  onBeforeStepChange,
  onFinalStepCompleted,
  backButtonText = 'הקודם',
  nextButtonText = 'הבא',
  finalButtonText = 'סיום',
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isProcessing, setIsProcessing] = useState(false);
  const steps = React.Children.toArray(children);
  const totalSteps = steps.length;

  const handleNext = async () => {
    if (isProcessing) return;

    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      
      // Call onBeforeStepChange if provided
      if (onBeforeStepChange) {
        setIsProcessing(true);
        try {
          const canProceed = await onBeforeStepChange(currentStep, nextStep);
          if (!canProceed) {
            setIsProcessing(false);
            return;
          }
        } catch (error) {
          console.error('Error in onBeforeStepChange:', error);
          setIsProcessing(false);
          return;
        }
        setIsProcessing(false);
      }
      
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
    } else {
      onFinalStepCompleted?.();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
    }
  };

  const handleStepClick = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
      onStepChange?.(step);
    }
  };

  return (
    <div className="outer-container">
      <div className="step-circle-container">
        {/* Step Indicators */}
        <div className="step-indicator-row">
          {steps.map((_, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            return (
              <React.Fragment key={stepNumber}>
                <button
                  className="step-indicator"
                  onClick={() => handleStepClick(stepNumber)}
                  disabled={stepNumber > currentStep}
                  aria-label={`Step ${stepNumber}`}
                >
                  <div
                    className="step-indicator-inner"
                    style={{
                      backgroundColor: isActive || isCompleted ? '#5227ff' : '#52525b',
                      cursor: stepNumber <= currentStep ? 'pointer' : 'default',
                    }}
                  >
                    {isCompleted ? (
                      <Check className="check-icon" />
                    ) : isActive ? (
                      <div className="active-dot" />
                    ) : (
                      <span className="step-number">{stepNumber}</span>
                    )}
                  </div>
                </button>

                {stepNumber < totalSteps && (
                  <div className="step-connector">
                    <div
                      className="step-connector-inner"
                      style={{
                        backgroundColor: isCompleted ? '#5227ff' : '#52525b',
                        width: isCompleted ? '100%' : '0%',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="step-content-default">
          <div className="step-default">{steps[currentStep - 1]}</div>
        </div>

        {/* Navigation Buttons */}
        <div className="footer-container">
          <div className={`footer-nav ${currentStep === 1 ? 'end' : 'spread'}`}>
            {currentStep > 1 && (
              <button className="back-button" onClick={handleBack}>
                {backButtonText}
              </button>
            )}
            <button 
              className="next-button" 
              onClick={handleNext}
              disabled={isProcessing}
              style={{ opacity: isProcessing ? 0.6 : 1 }}
            >
              {isProcessing ? 'מעבד...' : currentStep === totalSteps ? finalButtonText : nextButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

