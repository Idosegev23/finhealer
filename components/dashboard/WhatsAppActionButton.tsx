'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface WhatsAppActionButtonProps {
  text: string;
  prefilledMessage?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function WhatsAppActionButton({
  text,
  prefilledMessage,
  variant = 'primary',
  size = 'md',
  className = '',
}: WhatsAppActionButtonProps) {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '972544266506';
  let whatsappUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`;

  if (prefilledMessage) {
    whatsappUrl += `?text=${encodeURIComponent(prefilledMessage)}`;
  }

  // Variant styles
  const variantStyles = {
    primary: 'bg-[#25D366] hover:bg-[#20BA5A] text-white',
    secondary: 'bg-phi-mint hover:bg-phi-mint/80 text-white',
    outline: 'border-2 border-[#25D366] hover:bg-[#25D366] text-[#25D366] hover:text-white',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <Link
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center gap-2 rounded-xl font-semibold
        transition-all duration-200 shadow-sm hover:shadow-md
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      <MessageCircle className="w-5 h-5" />
      {text}
    </Link>
  );
}

