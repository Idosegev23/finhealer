'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Check if already dismissed
    if (localStorage.getItem('pwa-dismissed')) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-dismissed', '1');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-phi-dark text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <div className="w-10 h-10 rounded-xl bg-phi-gold/20 flex items-center justify-center flex-shrink-0">
        <Smartphone className="w-5 h-5 text-phi-gold" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">התקן את Phi</p>
        <p className="text-xs text-white/60">גישה מהירה מהמסך הראשי</p>
      </div>
      <Button
        size="sm"
        onClick={handleInstall}
        className="bg-phi-gold hover:bg-phi-coral text-white"
      >
        <Download className="w-4 h-4 ml-1" />
        התקן
      </Button>
      <button onClick={handleDismiss} className="text-white/40 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
