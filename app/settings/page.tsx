'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Phone, MessageSquare, Bell, User, CreditCard, Lock } from 'lucide-react';

type Tab = 'profile' | 'whatsapp' | 'notifications' | 'subscription' | 'privacy';

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // טען tab מה-URL אם יש
  useEffect(() => {
    const tab = searchParams.get('tab') as Tab;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <header className="bg-[#1E2A3B] border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">⚙️ הגדרות</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
              <TabButton
                icon={<User className="w-5 h-5" />}
                label="פרופיל אישי"
                active={activeTab === 'profile'}
                onClick={() => setActiveTab('profile')}
              />
              <TabButton
                icon={<MessageSquare className="w-5 h-5" />}
                label="WhatsApp"
                active={activeTab === 'whatsapp'}
                onClick={() => setActiveTab('whatsapp')}
              />
              <TabButton
                icon={<Bell className="w-5 h-5" />}
                label="התראות"
                active={activeTab === 'notifications'}
                onClick={() => setActiveTab('notifications')}
              />
              <TabButton
                icon={<CreditCard className="w-5 h-5" />}
                label="מנוי ותשלומים"
                active={activeTab === 'subscription'}
                onClick={() => setActiveTab('subscription')}
              />
              <TabButton
                icon={<Lock className="w-5 h-5" />}
                label="פרטיות ואבטחה"
                active={activeTab === 'privacy'}
                onClick={() => setActiveTab('privacy')}
              />
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'whatsapp' && <WhatsAppTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'subscription' && <SubscriptionTab />}
            {activeTab === 'privacy' && <PrivacyTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-all ${
        active
          ? 'bg-[#3A7BD5] text-white shadow-md'
          : 'text-[#555555] hover:bg-[#F5F6F8]'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function ProfileTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">פרופיל אישי</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">שם מלא</label>
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
            placeholder="שם מלא"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">מייל</label>
          <input
            type="email"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">טלפון</label>
          <input
            type="tel"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
            placeholder="050-123-4567"
          />
        </div>
        <button className="bg-[#3A7BD5] text-white px-6 py-2 rounded-lg hover:bg-[#2E5EA5] transition">
          שמור שינויים
        </button>
      </div>
    </div>
  );
}

function WhatsAppTab() {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">חיבור WhatsApp</h2>
      
      {!isConnected ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#25D366]/10 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-[#25D366]" />
          </div>
          <h3 className="text-2xl font-bold text-[#1E2A3B] mb-4">
            התחבר לWhatsApp וקבל עדכונים 📱
          </h3>
          <p className="text-[#555555] mb-6 max-w-md mx-auto">
            חבר את מספר הטלפון שלך כדי לקבל:
          </p>
          <ul className="text-right max-w-md mx-auto mb-8 space-y-2 text-[#555555]">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#25D366] rounded-full"></span>
              <span>הודעות על חריגות תקציב</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#25D366] rounded-full"></span>
              <span>תזכורות יומיות לרישום הוצאות</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#25D366] rounded-full"></span>
              <span>עדכונים על התקדמות יעדים</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#25D366] rounded-full"></span>
              <span>אפשרות לרשום הוצאות ישירות מהצ׳אט</span>
            </li>
          </ul>

          <div className="max-w-md mx-auto">
            <label className="block text-sm font-medium text-[#555555] mb-2 text-right">
              מספר טלפון (עם WhatsApp)
            </label>
            <input
              type="tel"
              dir="ltr"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent mb-4"
              placeholder="050-123-4567"
            />
            <button
              onClick={() => setIsConnected(true)}
              className="w-full bg-[#25D366] text-white px-6 py-3 rounded-lg hover:bg-[#20BA5A] transition font-semibold"
            >
              התחבר עכשיו
            </button>
          </div>

          <p className="text-xs text-[#999999] mt-4">
            נשלח לך קוד אימות ב-WhatsApp
          </p>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#25D366]/10 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-[#25D366]" />
          </div>
          <h3 className="text-2xl font-bold text-[#1E2A3B] mb-4">
            ✅ מחובר בהצלחה!
          </h3>
          <p className="text-[#555555] mb-6">
            המספר שלך: <span className="font-semibold">050-123-4567</span>
          </p>
          <button
            onClick={() => setIsConnected(false)}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition"
          >
            נתק חיבור
          </button>
        </div>
      )}
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">התראות</h2>
      <div className="space-y-4">
        <NotificationToggle
          title="חריגות תקציב"
          description="קבל התראה כאשר אתה עובר את התקציב החודשי"
          defaultChecked={true}
        />
        <NotificationToggle
          title="התקדמות יעדים"
          description="עדכונים על התקדמות ביעדים החיסכון שלך"
          defaultChecked={true}
        />
        <NotificationToggle
          title="תזכורת יומית"
          description="תזכורת להזין הוצאות בסוף היום"
          defaultChecked={false}
        />
        <NotificationToggle
          title="סיכום שבועי"
          description="דוח שבועי על המצב הפיננסי שלך"
          defaultChecked={true}
        />
      </div>
    </div>
  );
}

function NotificationToggle({
  title,
  description,
  defaultChecked,
}: {
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
      <div className="flex-1 text-right mr-4">
        <h4 className="font-medium text-[#1E2A3B]">{title}</h4>
        <p className="text-sm text-[#555555]">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-[#3A7BD5]' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-1' : 'translate-x-7'
          }`}
        />
      </button>
    </div>
  );
}

function SubscriptionTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">מנוי ותשלומים</h2>
      <div className="border border-[#3A7BD5] rounded-lg p-6 mb-6 bg-[#3A7BD5]/5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-right">
            <h3 className="text-lg font-bold text-[#1E2A3B]">תוכנית Basic</h3>
            <p className="text-sm text-[#555555]">מנוי חודשי פעיל</p>
          </div>
          <span className="text-3xl font-bold text-[#3A7BD5]">₪49</span>
        </div>
        <p className="text-sm text-[#555555] mb-4">
          התשלום הבא: 15 בנובמבר 2025
        </p>
        <button className="w-full bg-[#F6A623] text-white px-4 py-2 rounded-lg hover:bg-[#E09515] transition font-semibold">
          שדרג ל-Advanced (₪119/חודש)
        </button>
      </div>
      <button className="text-red-500 hover:text-red-600 text-sm">
        בטל מנוי
      </button>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">פרטיות ואבטחה</h2>
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-[#1E2A3B] mb-2">הורד את הנתונים שלך</h4>
          <p className="text-sm text-[#555555] mb-4">
            קבל קובץ עם כל הנתונים שלך
          </p>
          <button className="bg-[#3A7BD5] text-white px-4 py-2 rounded-lg hover:bg-[#2E5EA5] transition text-sm">
            הורד נתונים
          </button>
        </div>
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h4 className="font-medium text-red-600 mb-2">מחק חשבון</h4>
          <p className="text-sm text-[#555555] mb-4">
            פעולה זו תמחק לצמיתות את כל הנתונים שלך
          </p>
          <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm">
            מחק חשבון
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">טוען...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

