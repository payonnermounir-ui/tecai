import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";

// ==================== الأنواع (Types) ====================
type Lang = "ar" | "en" | "zh";
type AuthMode = "login" | "register";
type Role = "user" | "admin";
type Route = "home" | "deposit" | "withdraw" | "bind-bank" | "settings" | "devices";
type MainTab = "home" | "products" | "team" | "profile";
type DepositChannel = "TRC20" | "BEP20" | "D17" | "Flouci" | "Bank";
type WithdrawType = "bank" | "usdt";
type WithdrawProvider = "Bank" | "D17" | "Flouci";
type WithdrawNetwork = "TRC20" | "BEP20";
type TxFilter = "all" | "deposit" | "withdraw" | "pending" | "approved" | "rejected";

type OwnedDevice = {
  id: string;
  phone: string;
  planCode: string;
  planPrice: number;
  dailyIncome: number;
  totalIncome: number;
  validityDays: number;
  image: string;
  purchasedAt: string;
  earnedAmount?: number;
  lastPayoutAt?: string;
};

type Session = { role: Role; phone: string } | null;

type WithdrawalChannel = {
  id: string;
  provider: WithdrawProvider;
  holderName: string;
  phone: string;
  accountNumber: string;
};

type UserAccount = {
  loginPassword: string;
  paymentPassword?: string;
  channels: WithdrawalChannel[];
  referredBy?: string;
};

type Transaction = {
  id: string;
  phone: string;
  type: "deposit" | "withdraw";
  amount: number;
  method: string;
  status: "pending" | "approved" | "rejected";
  payoutDetails?: string;
  receiptName?: string;
  receiptDataUrl?: string;
  createdAt: string;
};

// ==================== الثوابت ====================
const ADMIN_PHONE = "55810112";
const ADMIN_PASSWORD = "TECAI@2026";
const ADMIN_PHONE_WITH_CODE = "+21655810112";
const COUNTRY_CODES = ["+216", "+20", "+966", "+971", "+86", "+1"];
const REFERRAL_DEPOSIT_RATE = 0.05;
const REFERRAL_PROFIT_RATE = 0.025;
const DAILY_DEVICE_PROFIT_RATE = 0.03;
const WITHDRAW_SERVICE_FEE_RATE = 0.2;
const DEVICE_PAYOUT_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ==================== دوال مساعدة ====================
function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function buildAuthEmail(phone: string) {
  const compact = normalizePhone(phone).replace(/[^0-9+]/g, "");
  const safeLocalPart = compact.replace(/\+/g, "");
  return `u${safeLocalPart}@tecai.app`;
}

function createUniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatAmount(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function parseAmountInput(value: string) {
  const normalized = value.replace(/,/g, ".").trim();
  return Number(normalized);
}

// ==================== دوال Supabase ====================
async function fetchUserDevices(phone: string): Promise<OwnedDevice[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('phone', phone);
    
  if (error) {
    console.error('Error fetching devices:', error);
    return [];
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    phone: row.phone,
    planCode: row.plan_code,
    planPrice: row.plan_price,
    dailyIncome: row.daily_income,
    totalIncome: row.total_income,
    validityDays: row.validity_days,
    image: row.image,
    purchasedAt: row.purchased_at,
    earnedAmount: row.earned_amount || 0,
    lastPayoutAt: row.last_payout_at,
  }));
}

async function fetchUserBalance(phone: string): Promise<number> {
  if (!supabase) return 0;
  
  const { data, error } = await supabase
    .from('wallets')
    .select('balance')
    .eq('phone', phone)
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
  
  return data?.balance ?? 0;
}

// ==================== مكون التطبيق الرئيسي ====================
export default function App() {
  const [lang, setLang] = useState<Lang>("ar");
  const [session, setSession] = useState<Session>(null);
  const [accounts, setAccounts] = useState<Record<string, UserAccount>>({});
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [devices, setDevices] = useState<OwnedDevice[]>([]);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [route, setRoute] = useState<Route>("home");
  const [mainTab, setMainTab] = useState<MainTab>("home");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [phoneInput, setPhoneInput] = useState("");
  const [password, setPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const [depositChannel, setDepositChannel] = useState<DepositChannel>("TRC20");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReceipt, setDepositReceipt] = useState<File | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [paymentPasswordInput, setPaymentPasswordInput] = useState("");

  const currentPhone = session?.phone ?? "";
  const balance = balances[currentPhone] ?? 0;
  const userDevices = devices.filter((device) => device.phone === currentPhone);
  const t = DICT[lang];
  const isRtl = lang === "ar";

  // تحميل البيانات من Supabase عند تسجيل الدخول
  useEffect(() => {
    if (session?.role === "user" && session.phone) {
      // جلب الأجهزة
      fetchUserDevices(session.phone).then(remoteDevices => {
        if (remoteDevices.length > 0) {
          setDevices(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            const newDevices = remoteDevices.filter(d => !existingIds.has(d.id));
            return [...newDevices, ...prev];
          });
        }
      });
      
      // جلب الرصيد
      fetchUserBalance(session.phone).then(remoteBalance => {
        setBalances(prev => ({ ...prev, [session.phone]: remoteBalance }));
      });
    }
  }, [session]);

  // تحديث الساعة
  useEffect(() => {
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // دوال المصادقة
  function getFullPhone() {
    return `${countryCode}${phoneInput.trim()}`;
  }

  async function onUserAuthSubmit() {
    const fullPhone = getFullPhone();
    
    if (authMode === "register") {
      if (password.length < 6) {
        setNotice("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        return;
      }
      if (password !== confirmPassword) {
        setNotice("كلمتا المرور غير متطابقتين");
        return;
      }

      const email = buildAuthEmail(fullPhone);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { phone: fullPhone } }
      });

      if (error) {
        setNotice(error.message);
        return;
      }

      // إنشاء ملف شخصي في جدول profiles
      await supabase.from('profiles').insert({ phone: fullPhone, login_password: password });
      await supabase.from('wallets').insert({ phone: fullPhone, balance: 0 });
      
      setNotice("تم إنشاء الحساب بنجاح");
      setAuthMode("login");
      resetAuthFields();
      return;
    }

    // تسجيل الدخول
    const email = buildAuthEmail(fullPhone);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setNotice("بيانات الدخول غير صحيحة");
      return;
    }

    setSession({ role: "user", phone: fullPhone });
    resetAuthFields();
  }

  function resetAuthFields() {
    setPhoneInput("");
    setPassword("");
    setConfirmPassword("");
  }

  function logout() {
    supabase.auth.signOut();
    setSession(null);
    setRoute("home");
  }

  // شراء جهاز
  async function activateProductPlan(plan: any) {
    if (balance < plan.price) {
      setRoute("deposit");
      setNotice("الرصيد غير كاف");
      return;
    }

    const newBalance = balance - plan.price;
    
    // تحديث الرصيد في Supabase
    await supabase.from('wallets').update({ balance: newBalance }).eq('phone', currentPhone);
    setBalances(prev => ({ ...prev, [currentPhone]: newBalance }));

    // إضافة الجهاز
    const newDevice: OwnedDevice = {
      id: createUniqueId("dv"),
      phone: currentPhone,
      planCode: plan.code,
      planPrice: plan.price,
      dailyIncome: plan.dailyIncome,
      totalIncome: plan.totalIncome,
      validityDays: plan.validityDays,
      image: plan.image,
      purchasedAt: new Date().toISOString(),
      earnedAmount: 0,
      lastPayoutAt: new Date().toISOString(),
    };

    await supabase.from('devices').insert({
      id: newDevice.id,
      phone: newDevice.phone,
      plan_code: newDevice.planCode,
      plan_price: newDevice.planPrice,
      daily_income: newDevice.dailyIncome,
      total_income: newDevice.totalIncome,
      validity_days: newDevice.validityDays,
      image: newDevice.image,
      purchased_at: newDevice.purchasedAt,
    });

    setDevices(prev => [newDevice, ...prev]);
    setNotice("تم شراء الجهاز بنجاح");
    setRoute("devices");
  }

  // واجهة المستخدم
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
          <h1 className="text-3xl font-bold text-center mb-6">TECAI</h1>
          
          <div className="space-y-3">
            <div className="flex gap-2">
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="border rounded-lg px-3 py-2">
                {COUNTRY_CODES.map(code => <option key={code}>{code}</option>)}
              </select>
              <input 
                type="tel" 
                value={phoneInput} 
                onChange={(e) => setPhoneInput(e.target.value)} 
                placeholder="رقم الهاتف" 
                className="border rounded-lg px-3 py-2 flex-1"
              />
            </div>
            
            <input 
              type={showAuthPassword ? "text" : "password"} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="كلمة المرور" 
              className="border rounded-lg px-3 py-2 w-full"
            />
            
            {authMode === "register" && (
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="تأكيد كلمة المرور" 
                className="border rounded-lg px-3 py-2 w-full"
              />
            )}
            
            <button onClick={onUserAuthSubmit} className="bg-black text-white rounded-lg py-2 w-full">
              {authMode === "login" ? "دخول" : "إنشاء حساب"}
            </button>
            
            <button onClick={() => setAuthMode(prev => prev === "login" ? "register" : "login")} className="border rounded-lg py-2 w-full">
              {authMode === "login" ? "إنشاء حساب جديد" : "لديك حساب؟ سجل دخول"}
            </button>
          </div>
          
          {notice && <div className="mt-3 text-red-500 text-center text-sm">{notice}</div>}
        </div>
      </div>
    );
  }

  // واجهة المستخدم بعد تسجيل الدخول
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-100 pb-20">
      <main className="max-w-sm mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">TECAI</h1>
          <button onClick={logout} className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm">خروج</button>
        </div>
        
        {/* الرصيد */}
        <div className="bg-green-500 text-white rounded-2xl p-4 text-center mb-4">
          <p className="text-sm">رصيد الحساب</p>
          <p className="text-3xl font-bold">{formatAmount(balance)} TND</p>
        </div>
        
        {/* الأجهزة */}
        <div className="bg-white rounded-2xl p-4 mb-4">
          <h2 className="font-bold mb-3">أجهزتي ({userDevices.length})</h2>
          {userDevices.length === 0 ? (
            <p className="text-gray-500 text-center py-4">لا توجد أجهزة مفعلة</p>
          ) : (
            userDevices.map(device => (
              <div key={device.id} className="border-b py-2">
                <p className="font-semibold">{device.planCode} - {device.planPrice} TND</p>
                <p className="text-sm text-gray-600">الدخل اليومي: {device.dailyIncome} TND</p>
                <p className="text-sm text-gray-600">تاريخ الشراء: {new Date(device.purchasedAt).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
        
        {/* أزرار الإجراءات */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setRoute("deposit")} className="bg-blue-500 text-white rounded-xl py-3">إيداع</button>
          <button onClick={() => setRoute("withdraw")} className="bg-orange-500 text-white rounded-xl py-3">سحب</button>
          <button onClick={() => setRoute("devices")} className="bg-purple-500 text-white rounded-xl py-3">أجهزتي</button>
          <button onClick={() => setRoute("settings")} className="bg-gray-500 text-white rounded-xl py-3">الإعدادات</button>
        </div>
      </main>
    </div>
  );
}

// ==================== القواميس (مختصرة) ====================
const DICT = {
  ar: {
    appName: "TECAI",
    login: "دخول",
    register: "تسجيل",
    phone: "رقم الهاتف",
    password: "كلمة المرور",
    accountBalance: "رصيد الحساب",
    myDevices: "أجهزتي",
    deposit: "إيداع",
    withdraw: "سحب",
    settings: "الإعدادات",
    logout: "خروج",
    tnd: "TND",
  },
  en: {
    appName: "TECAI",
    login: "Login",
    register: "Register",
    phone: "Phone",
    password: "Password",
    accountBalance: "Account balance",
    myDevices: "My devices",
    deposit: "Deposit",
    withdraw: "Withdraw",
    settings: "Settings",
    logout: "Logout",
    tnd: "TND",
  },
  zh: {
    appName: "TECAI",
    login: "登录",
    register: "注册",
    phone: "手机号",
    password: "密码",
    accountBalance: "账户余额",
    myDevices: "我的设备",
    deposit: "充值",
    withdraw: "提现",
    settings: "设置",
    logout: "退出",
    tnd: "TND",
  },
};

// منتجات الروبوتات (مختصرة)
const ROBOT_PRODUCTS = [
  { code: "A1", price: 30, dailyIncome: 0.9, totalIncome: 90, validityDays: 100, image: "/images/robot-30.png" },
  { code: "A2", price: 80, dailyIncome: 5, totalIncome: 500, validityDays: 100, image: "/images/robot-80.png" },
  { code: "A3", price: 230, dailyIncome: 6.9, totalIncome: 828, validityDays: 120, image: "/images/robot-230.png" },
];
