"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

// Custom Info Tooltip Component for FinHealer
interface InfoTooltipProps {
  content: string;
  type?: "info" | "warning" | "success" | "help";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function InfoTooltip({
  content,
  type = "info",
  side = "top",
  className,
}: InfoTooltipProps) {
  const iconMap = {
    info: Info,
    warning: AlertCircle,
    success: CheckCircle2,
    help: HelpCircle,
  };

  const colorMap = {
    info: "text-blue-500 hover:text-blue-600",
    warning: "text-orange-500 hover:text-orange-600",
    success: "text-green-500 hover:text-green-600",
    help: "text-gray-500 hover:text-gray-600",
  };

  const Icon = iconMap[type];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              colorMap[type],
              className
            )}
            aria-label="מידע נוסף"
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs text-right bg-white border-gray-200 shadow-lg"
          dir="rtl"
        >
          <p className="text-sm leading-relaxed">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Field Tooltip - for form fields
interface FieldTooltipProps {
  label: string;
  tooltip: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FieldTooltip({
  label,
  tooltip,
  required,
  children,
}: FieldTooltipProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
        <InfoTooltip content={tooltip} type="help" side="left" />
      </div>
      {children}
    </div>
  );
}

