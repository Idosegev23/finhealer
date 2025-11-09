'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Phone, MessageSquare, Bell, User, CreditCard, Lock, Loader2, CheckCircle, ArrowRight, Plus, Pencil, Trash2, Baby, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Tab = 'profile' | 'whatsapp' | 'notifications' | 'subscription' | 'privacy';

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">⚙️ הגדרות</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-white hover:text-gray-200 transition-colors bg-[#2E3A4B] hover:bg-[#3A4A5B] px-4 py-2 rounded-lg"
          >
            <ArrowRight className="w-4 h-4" />
            חזרה למסך הראשי
          </button>
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

interface Child {
  id: string;
  name: string;
  birth_date: string;
  notes?: string;
}

function ProfileTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [userData, setUserData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    birth_date: '',
    city: '',
    marital_status: '',
    children_count: 0,
  });
  
  // Children management
  const [children, setChildren] = useState<Child[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [childForm, setChildForm] = useState({
    name: '',
    birth_date: '',
    notes: '',
  });

  useEffect(() => {
    loadUserData();
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      setChildrenLoading(true);
      const response = await fetch('/api/children');
      const data = await response.json();
      
      if (data.children) {
        setChildren(data.children);
      }
    } catch (err) {
      console.error('Error loading children:', err);
    } finally {
      setChildrenLoading(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleAddChild = async () => {
    if (!childForm.name || !childForm.birth_date) {
      setError('שם ותאריך לידה הם שדות חובה');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childForm),
      });

      const data = await response.json();
      
      if (data.success) {
        setChildren([...children, data.child]);
        setChildForm({ name: '', birth_date: '', notes: '' });
        setShowAddChild(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || 'שגיאה בהוספת ילד');
      }
    } catch (err) {
      console.error('Error adding child:', err);
      setError('שגיאה בהוספת ילד');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateChild = async () => {
    if (!editingChild || !childForm.name || !childForm.birth_date) {
      setError('שם ותאריך לידה הם שדות חובה');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/children', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingChild.id,
          ...childForm,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setChildren(children.map(c => c.id === editingChild.id ? data.child : c));
        setChildForm({ name: '', birth_date: '', notes: '' });
        setEditingChild(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || 'שגיאה בעדכון ילד');
      }
    } catch (err) {
      console.error('Error updating child:', err);
      setError('שגיאה בעדכון ילד');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק ילד זה?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/children?id=${childId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setChildren(children.filter(c => c.id !== childId));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || 'שגיאה במחיקת ילד');
      }
    } catch (err) {
      console.error('Error deleting child:', err);
      setError('שגיאה במחיקת ילד');
    } finally {
      setSaving(false);
    }
  };

  const startEditChild = (child: Child) => {
    setEditingChild(child);
    setChildForm({
      name: child.name,
      birth_date: child.birth_date,
      notes: child.notes || '',
    });
    setShowAddChild(true);
  };

  const cancelChildForm = () => {
    setShowAddChild(false);
    setEditingChild(null);
    setChildForm({ name: '', birth_date: '', notes: '' });
  };

  const loadUserData = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('לא מחובר');
        setLoading(false);
        return;
      }

      // טעינת נתונים בסיסיים מטבלת users
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('name, phone, email')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Error loading profile:', profileError);
        setError('שגיאה בטעינת הפרופיל');
        setLoading(false);
        return;
      }

      // טעינת פרטים אישיים מטבלת user_financial_profile
      const { data: financialProfile } = await supabase
        .from('user_financial_profile')
        .select('birth_date, city, marital_status, children_count')
        .eq('user_id', user.id)
        .single();

      // Type assertion for Supabase data
      const userData = profile as any;
      const finData = financialProfile as any;
      
      setUserData({ ...userData, ...finData });
      setFormData({
        name: userData.name || '',
        phone: userData.phone || '',
        birth_date: finData?.birth_date || '',
        city: finData?.city || '',
        marital_status: finData?.marital_status || '',
        children_count: finData?.children_count || 0,
      });
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError('שגיאה בטעינת הנתונים');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בשמירת הפרופיל');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'שגיאה בשמירת הפרופיל');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#3A7BD5]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">פרופיל אישי</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-right">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-right flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>הפרופיל עודכן בהצלחה!</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">שם מלא</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
            placeholder="שם מלא"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">מייל</label>
          <input
            type="email"
            value={userData?.email || ''}
            disabled
            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed"
            placeholder="email@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">לא ניתן לשנות את כתובת המייל</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">טלפון</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            dir="ltr"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
            placeholder="050-123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">תאריך לידה</label>
          <input
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">עיר מגורים</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
            placeholder="תל אביב"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">מצב משפחתי</label>
          <select
            value={formData.marital_status}
            onChange={(e) => setFormData({ ...formData, marital_status: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
          >
            <option value="">בחר מצב משפחתי</option>
            <option value="single">רווק/ה</option>
            <option value="married">נשוי/אה</option>
            <option value="divorced">גרוש/ה</option>
            <option value="widowed">אלמן/ה</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#555555] mb-2">מספר ילדים</label>
          <input
            type="number"
            value={formData.children_count === 0 ? '' : formData.children_count}
            onChange={(e) => setFormData({ ...formData, children_count: parseInt(e.target.value) || 0 })}
            min="0"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
            placeholder="0"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#3A7BD5] text-white px-6 py-2 rounded-lg hover:bg-[#2E5EA5] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>שומר...</span>
            </>
          ) : (
            'שמור שינויים'
          )}
        </button>
      </div>

      {/* Children Management Section */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#1E2A3B] flex items-center gap-2">
            <Baby className="w-5 h-5" />
            פרטי ילדים
          </h3>
          {!showAddChild && (
            <button
              onClick={() => setShowAddChild(true)}
              className="flex items-center gap-2 text-[#3A7BD5] hover:text-[#2E5EA5] transition"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">הוסף ילד</span>
            </button>
          )}
        </div>

        {/* Add/Edit Child Form */}
        {showAddChild && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-[#1E2A3B]">
                {editingChild ? 'ערוך פרטי ילד' : 'הוסף ילד חדש'}
              </h4>
              <button
                onClick={cancelChildForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#555555] mb-1">
                  שם <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={childForm.name}
                  onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent text-sm"
                  placeholder="שם הילד/ה"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#555555] mb-1">
                  תאריך לידה <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={childForm.birth_date}
                  onChange={(e) => setChildForm({ ...childForm, birth_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#555555] mb-1">
                  הערות (אופציונלי)
                </label>
                <textarea
                  value={childForm.notes}
                  onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent text-sm"
                  placeholder="הערות נוספות..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={editingChild ? handleUpdateChild : handleAddChild}
                  disabled={saving}
                  className="flex-1 bg-[#3A7BD5] text-white px-4 py-2 rounded-lg hover:bg-[#2E5EA5] transition disabled:opacity-50 text-sm font-medium"
                >
                  {editingChild ? 'עדכן' : 'הוסף'}
                </button>
                <button
                  onClick={cancelChildForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Children List */}
        {childrenLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Baby className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">טרם הוספת פרטי ילדים</p>
            <p className="text-xs mt-1">לחץ על &quot;הוסף ילד&quot; כדי להתחיל</p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-[#1E2A3B]">{child.name}</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      גיל {calculateAge(child.birth_date)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    תאריך לידה: {new Date(child.birth_date).toLocaleDateString('he-IL')}
                  </p>
                  {child.notes && (
                    <p className="text-xs text-gray-400 mt-1">{child.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditChild(child)}
                    className="p-2 text-[#3A7BD5] hover:bg-blue-50 rounded-lg transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteChild(child.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WhatsAppTab() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('phone, wa_opt_in')
        .eq('id', user.id)
        .single();

      setUserData(profile);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  };

  const isConnected = userData?.wa_opt_in && userData?.phone;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#3A7BD5]" />
      </div>
    );
  }

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

          <p className="text-sm text-gray-600 mb-4">
            עדכן את מספר הטלפון שלך בטאב &quot;פרופיל אישי&quot; כדי להתחבר
          </p>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#25D366]/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#25D366]" />
          </div>
          <h3 className="text-2xl font-bold text-[#1E2A3B] mb-4">
            ✅ מחובר בהצלחה!
          </h3>
          <p className="text-[#555555] mb-6">
            המספר שלך: <span className="font-semibold">{userData?.phone}</span>
          </p>
          <p className="text-sm text-gray-600">
            תקבל הודעות ב-WhatsApp במספר זה
          </p>
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
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setLoading(false);
        return;
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      setSubscription(sub);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  };

  const handleUpgrade = async (newPlan: 'basic' | 'premium') => {
    setUpdating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/subscription/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בעדכון המנוי');
      }

      setSuccess(data.message);
      await loadSubscription();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error updating subscription:', err);
      setError(err.message || 'שגיאה בעדכון המנוי');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('האם אתה בטוח שברצונך לבטל את המנוי? תוכל להמשיך להשתמש בשירות עד סוף התקופה ששולמה.')) {
      return;
    }

    setCancelling(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בביטול המנוי');
      }

      setSuccess(data.message);
      await loadSubscription();
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.message || 'שגיאה בביטול המנוי');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#3A7BD5]" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'basic';
  const currentAmount = subscription?.amount || 49;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">מנוי ותשלומים</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-right">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-right flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      <div className="border border-[#3A7BD5] rounded-lg p-6 mb-6 bg-[#3A7BD5]/5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-right">
            <h3 className="text-lg font-bold text-[#1E2A3B]">
              תוכנית {currentPlan === 'basic' ? 'Basic' : 'Premium'}
            </h3>
            <p className="text-sm text-[#555555]">מנוי חודשי פעיל</p>
          </div>
          <span className="text-3xl font-bold text-[#3A7BD5]">₪{currentAmount}</span>
        </div>
        <p className="text-sm text-[#555555] mb-4">
          מנוי חודשי מתחדש אוטומטית
        </p>
        
        {currentPlan === 'basic' && (
          <button
            onClick={() => handleUpgrade('premium')}
            disabled={updating}
            className="w-full bg-gradient-to-r from-[#F6A623] to-[#F2994A] text-white px-4 py-2 rounded-lg hover:opacity-90 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {updating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>משדרג...</span>
              </>
            ) : (
              `שדרג ל-Premium (₪119/חודש)`
            )}
          </button>
        )}

        {currentPlan === 'premium' && (
          <button
            onClick={() => handleUpgrade('basic')}
            disabled={updating}
            className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {updating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>מוריד...</span>
              </>
            ) : (
              `עבור ל-Basic (₪49/חודש)`
            )}
          </button>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[#1E2A3B] mb-2">בטל מנוי</h3>
        <p className="text-sm text-[#555555] mb-4">
          ביטול המנוי ייכנס לתוקף בסוף התקופה הנוכחית. תוכל להמשיך להשתמש בשירות עד אז.
        </p>
        <button
          onClick={handleCancelSubscription}
          disabled={cancelling}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {cancelling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>מבטל...</span>
            </>
          ) : (
            'בטל מנוי'
          )}
        </button>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const [changingPassword, setChangingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserData(user);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('הסיסמאות לא תואמות');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בשינוי הסיסמה');
      }

      setSuccess('הסיסמה שונתה בהצלחה!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err.message || 'שגיאה בשינוי הסיסמה');
    } finally {
      setChangingPassword(false);
    }
  };

  // בדוק אם המשתמש נכנס עם email/password או Google
  const isEmailPasswordUser = userData?.app_metadata?.provider === 'email';

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#3A7BD5]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-[#1E2A3B] mb-6">פרטיות ואבטחה</h2>
      <div className="space-y-4">
        {isEmailPasswordUser && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-[#1E2A3B] mb-2">שינוי סיסמה</h4>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-right">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-right flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>{success}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#555555] mb-1">סיסמה חדשה</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
                  placeholder="לפחות 6 תווים"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#555555] mb-1">אימות סיסמה</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
                  placeholder="הזן שוב את הסיסמה החדשה"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="bg-[#3A7BD5] text-white px-4 py-2 rounded-lg hover:bg-[#2E5EA5] transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>משנה...</span>
                  </>
                ) : (
                  'שמור סיסמה חדשה'
                )}
              </button>
            </div>
          </div>
        )}

        {!isEmailPasswordUser && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <p className="text-sm text-gray-700 text-right">
              💡 התחברת באמצעות Google. לשינוי סיסמה, היכנס להגדרות חשבון Google שלך.
            </p>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-[#1E2A3B] mb-2">הורד את הנתונים שלך</h4>
          <p className="text-sm text-[#555555] mb-4">
            קבל קובץ JSON עם כל הנתונים הפיננסיים שלך
          </p>
          <button 
            onClick={async () => {
              setExporting(true);
              try {
                const response = await fetch('/api/profile/export-data');
                if (!response.ok) throw new Error('שגיאה בייצוא נתונים');
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `finhealer-data-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                
                setSuccess('הנתונים הורדו בהצלחה!');
                setTimeout(() => setSuccess(''), 3000);
              } catch (err: any) {
                setError(err.message || 'שגיאה בהורדת הנתונים');
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="bg-[#3A7BD5] text-white px-4 py-2 rounded-lg hover:bg-[#2E5EA5] transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>מוריד...</span>
              </>
            ) : (
              'הורד נתונים'
            )}
          </button>
        </div>

        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h4 className="font-medium text-red-600 mb-2">מחק חשבון</h4>
          <p className="text-sm text-[#555555] mb-4">
            ⚠️ פעולה זו תמחק לצמיתות את כל הנתונים שלך ולא ניתן לשחזר אותם!
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                הקלד &quot;מחק את החשבון שלי&quot; כדי לאשר:
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="מחק את החשבון שלי"
              />
            </div>
            <button 
              onClick={async () => {
                if (deleteConfirm !== 'מחק את החשבון שלי') {
                  setError('נא להקליד את הטקסט המבוקש בדיוק');
                  return;
                }
                
                if (!confirm('האם אתה בטוח לחלוטין? פעולה זו לא ניתנת לביטול!')) {
                  return;
                }
                
                setDeleting(true);
                setError('');
                
                try {
                  const response = await fetch('/api/profile/delete-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ confirmText: deleteConfirm }),
                  });
                  
                  const data = await response.json();
                  
                  if (!response.ok) {
                    throw new Error(data.error || 'שגיאה במחיקת החשבון');
                  }
                  
                  alert(data.message);
                  window.location.href = '/';
                } catch (err: any) {
                  setError(err.message || 'שגיאה במחיקת החשבון');
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting || deleteConfirm !== 'מחק את החשבון שלי'}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>מוחק...</span>
                </>
              ) : (
                'מחק חשבון לצמיתות'
              )}
          </button>
          </div>
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
