'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface FloatingWhatsAppButtonProps {
  prefilledMessage?: string;
}

export default function FloatingWhatsAppButton({
  prefilledMessage = 'היי',
}: FloatingWhatsAppButtonProps) {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '972544266506';
  let whatsappUrl = `https://wa.me/${whatsappNumber}`;

  if (prefilledMessage) {
    whatsappUrl += `?text=${encodeURIComponent(prefilledMessage)}`;
  }

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
      className="fixed bottom-6 left-6 z-50"
    >
      <Link
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 bg-[#25D366] hover:bg-[#20BA5A] text-white pl-5 pr-4 py-3 rounded-full font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="hidden group-hover:inline-block transition-all duration-300">
          דבר עם φ
        </span>
        
        {/* Pulse animation */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-400"></span>
        </span>
      </Link>
      
      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-phi-dark text-white text-xs py-1 px-2 rounded whitespace-nowrap">
        פתח שיחה עם φ
      </div>
    </motion.div>
  );
}

