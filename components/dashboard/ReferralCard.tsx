'use client';

import { useState, useEffect } from 'react';
import { Gift, Copy, Check, Share2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ReferralCard() {
  const [data, setData] = useState<{
    referralCode: string;
    referralCount: number;
    shareUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referral')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = data.shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareWhatsApp = () => {
    if (!data) return;
    const text = `היי! אני משתמש ב-Phi לניהול הכספים שלי וזה מדהים. הנה קישור להרשמה עם הטבה:\n${data.shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading || !data) return null;

  return (
    <Card className="bg-gradient-to-br from-phi-gold/10 to-phi-coral/10 border-phi-gold/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-phi-dark text-lg flex items-center gap-2">
          <Gift className="w-5 h-5 text-phi-gold" />
          הזמן חברים
        </CardTitle>
        <p className="text-xs text-phi-slate">שתף את Phi וקבל הטבות</p>
      </CardHeader>
      <CardContent>
        {/* Referral Code */}
        <div className="bg-white rounded-lg p-3 mb-4 border border-phi-gold/30">
          <p className="text-xs text-phi-slate mb-1">הקוד שלך:</p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-phi-dark tracking-wider flex-1">
              {data.referralCode}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={copyCode}
              className="border-phi-gold text-phi-gold"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Users className="w-4 h-4 text-phi-gold" />
          <span className="text-phi-dark font-medium">{data.referralCount} חברים הצטרפו</span>
        </div>

        {/* Share buttons */}
        <div className="flex gap-2">
          <Button
            onClick={shareWhatsApp}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            <Share2 className="w-4 h-4 ml-2" />
            שתף בווצאפ
          </Button>
          <Button
            onClick={copyCode}
            variant="outline"
            className="flex-1 border-phi-gold text-phi-gold"
          >
            {copied ? (
              <><Check className="w-4 h-4 ml-2" /> הועתק!</>
            ) : (
              <><Copy className="w-4 h-4 ml-2" /> העתק קישור</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
