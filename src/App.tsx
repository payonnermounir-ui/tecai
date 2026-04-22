import { useEffect, useMemo, useState } from "react";
import {
  createDevice,
  createNotification,
  createProfit,
  createTransaction,
  createUser,
  deleteNotification,
  getAllUsers,
  getBalance,
  getDevices,
  getNotifications,
  getProfits,
  getTransactions,
  getUserByEmail,
  markNotificationAsRead,
  rpcAdminSendNotification,
  rpcBuyDevice,
  updateBalance,
  updateDevice,
} from "./lib/supabaseState";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Lang = "ar" | "en";
type Role = "user" | "admin";
type Session = { role: Role; email: string } | null;
type MainTab = "home" | "products" | "devices" | "team" | "profile";
type Route = "home" | "deposit" | "withdraw" | "settings";
type TxStatus = "pending" | "approved" | "rejected";

type Tx = {
  id: string;
  email: string;
  type: "deposit" | "withdraw";
  amount: number;
  method: string;
  status: TxStatus;
  receiptName?: string;
  receiptDataUrl?: string;
  payoutDetails?: string;
  createdAt: string;
};

type Device = {
  id: string;
  email: string;
  planCode: string;
  planPrice: number;
  dailyIncome: number;
  totalIncome: number;
  validityDays: number;
  image: string;
  purchasedAt: string;
  earnedAmount: number;
  lastPayoutAt: string;
};

type Profit = {
  id: string;
  email: string;
  deviceId: string;
  amount: number;
  cycles: number;
  createdAt: string;
};

type AppNotif = {
  id: string;
  email: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type ActionDialog = {
  open: boolean;
  title: string;
  message: string;
};

type LocalProfile = {
  payPassword?: string;
};

type InvitedUser = {
  email: string;
  created_at?: string;
};

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      {open ? (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
          <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.96 18.96 0 0 1-4.23 5.21" />
          <path d="M6.61 6.61A18.16 18.16 0 0 0 1 12s4 8 11 8a10.94 10.94 0 0 0 5.39-1.39" />
        </>
      )}
    </svg>
  );
}

const ADMIN_EMAIL = "admin@tecai.app";
const ADMIN_PASSWORD = "TECAI@2026";
const PAYOUT_MS = 24 * 60 * 60 * 1000;

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  A1: "/images/robot-plan-a1.png",
  A2: "/images/robot-plan-a2.png",
  A3: "/images/robot-plan-a3.png",
  A4: "/images/robot-plan-a4.png",
  A5: "/images/robot-plan-a5.png",
};

const BRAND_THUMB = "/images/hero-city-new.png";
const HOME_SLIDER_IMAGES = [
  "/images/robot-arms.png",
  "/images/robot-device-1.png",
  "/images/robot-device-2.png",
  "/images/robot-plan-a1.png",
  "/images/robot-plan-a3.png",
];

const DEPOSIT_DESTINATIONS: Record<string, string> = {
  TRC20: "TXLsHureixQs123XNcyzSWZ8edH6yTxS67",
  BEP20: "0x0bcb69e95e45c419b17182a5f2f2bbadca7c9c75",
  D17: "55810112",
  Flouci: "55810112",
};

const PRODUCTS = [
  { code: "A1", price: 30, validityDays: 100, image: PRODUCT_IMAGE_MAP.A1 },
  { code: "A2", price: 80, validityDays: 100, image: PRODUCT_IMAGE_MAP.A2 },
  { code: "A3", price: 230, validityDays: 120, image: PRODUCT_IMAGE_MAP.A3 },
  { code: "A4", price: 580, validityDays: 120, image: PRODUCT_IMAGE_MAP.A4 },
  { code: "A5", price: 1400, validityDays: 150, image: PRODUCT_IMAGE_MAP.A5 },
].map((p) => {
  const dailyIncome = Number((p.price * 0.03).toFixed(4));
  return { ...p, dailyIncome, totalIncome: Number((dailyIncome * p.validityDays).toFixed(4)) };
});

const DICT = {
  ar: {
    appName: "TECAI",
    login: "دخول",
    register: "تسجيل",
    logout: "خروج",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    userLogin: "دخول المستخدم",
    adminLogin: "دخول الإدارة",
    badCredentials: "بيانات الدخول غير صحيحة",
    created: "تم إنشاء الحساب بنجاح",
    passShort: "كلمة المرور قصيرة",
    passMismatch: "كلمة المرور غير متطابقة",
    balance: "رصيد الحساب",
    todayProfit: "أرباح اليوم",
    totalDeposit: "إجمالي الإيداع",
    pendingOps: "طلبات العمليات المعلقة",
    home: "الرئيسية",
    noPending: "لا يوجد طلبات حالياً",
    approve: "قبول",
    reject: "رفض",
    pending: "قيد المراجعة",
    approved: "مقبول",
    rejected: "مرفوض",
    deposit: "إيداع",
    withdraw: "سحب",
    products: "المنتج",
    devices: "أجهزتي",
    profile: "أنا",
    amount: "المبلغ",
    submitDeposit: "تأكيد الإيداع",
    submitWithdraw: "تأكيد السحب",
    uploadProof: "رفع إيصال",
    chooseFile: "اختر صورة أو PDF",
    minDeposit: "الحد الأدنى للإيداع 1",
    minWithdraw: "الحد الأدنى للسحب 2",
    buy: "شراء",
    bought: "تم شراء الجهاز",
    noBalance: "الرصيد غير كاف",
    txHistory: "سجل العمليات",
    noTx: "لا توجد عمليات",
    sendNotification: "إرسال إشعار",
    notificationTitle: "عنوان الإشعار",
    notificationBody: "نص الإشعار",
    selectUser: "اختر المستخدم",
    sent: "تم الإرسال",
    notifications: "الإشعارات",
    noNotifications: "لا توجد إشعارات",
    savePay: "حفظ كلمة سحب",
    payPassword: "كلمة سحب",
    settings: "الإعدادات",
    openSettings: "الانتقال إلى الإعدادات",
    createPayFirst: "إنشاء كلمة السحب لأول مرة",
    currentPayPassword: "كلمة السحب الحالية",
    newPayPassword: "كلمة السحب الجديدة",
    confirmPayPassword: "تأكيد كلمة السحب",
    paySaved: "تم حفظ كلمة السحب",
    fillAllFields: "يرجى تعبئة كل الحقول",
    payShort: "كلمة السحب قصيرة",
    payMismatch: "تأكيد كلمة السحب غير مطابق",
    currentPayWrong: "كلمة السحب الحالية غير صحيحة",
    welcomeTitle: "مرحبا بك في TECAI",
    welcomeLine1: "1) اختر خطة روبوت من صفحة المنتج.",
    welcomeLine2: "2) الإيداع الأدنى 30 د.ت أو 10 USD ويصل بعد المراجعة.",
    welcomeLine3: "3) السحب الأدنى 10 د.ت أو 5 USD ورسوم الخدمة 20%.",
    welcomeLine4: "4) يمكنك متابعة كل العمليات من صفحة أنا.",
    close: "إغلاق",
    tnd: "د.ت",
  },
  en: {
    appName: "TECAI",
    login: "Login",
    register: "Register",
    logout: "Logout",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    userLogin: "User login",
    adminLogin: "Admin login",
    badCredentials: "Invalid credentials",
    created: "Account created",
    passShort: "Password is too short",
    passMismatch: "Passwords do not match",
    balance: "Account balance",
    todayProfit: "Today profit",
    totalDeposit: "Total deposit",
    pendingOps: "Pending operations",
    home: "Home",
    noPending: "No pending operations",
    approve: "Approve",
    reject: "Reject",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    deposit: "Deposit",
    withdraw: "Withdraw",
    products: "Products",
    devices: "My devices",
    profile: "Profile",
    amount: "Amount",
    submitDeposit: "Confirm deposit",
    submitWithdraw: "Confirm withdraw",
    uploadProof: "Upload receipt",
    chooseFile: "Choose image or PDF",
    minDeposit: "Minimum deposit is 1",
    minWithdraw: "Minimum withdraw is 2",
    buy: "Buy",
    bought: "Device purchased",
    noBalance: "Insufficient balance",
    txHistory: "Transaction history",
    noTx: "No transactions",
    sendNotification: "Send notification",
    notificationTitle: "Notification title",
    notificationBody: "Notification body",
    selectUser: "Select user",
    sent: "Sent",
    notifications: "Notifications",
    noNotifications: "No notifications",
    savePay: "Save withdraw password",
    payPassword: "Withdraw password",
    settings: "Settings",
    openSettings: "Open settings",
    createPayFirst: "Create withdraw password for first time",
    currentPayPassword: "Current withdraw password",
    newPayPassword: "New withdraw password",
    confirmPayPassword: "Confirm withdraw password",
    paySaved: "Withdraw password saved",
    fillAllFields: "Please fill all fields",
    payShort: "Withdraw password is too short",
    payMismatch: "Withdraw password confirmation does not match",
    currentPayWrong: "Current withdraw password is incorrect",
    welcomeTitle: "Welcome to TECAI",
    welcomeLine1: "1) Choose a robot plan from Products.",
    welcomeLine2: "2) Minimum deposit is 30 TND or 10 USD, credited after review.",
    welcomeLine3: "3) Minimum withdrawal is 10 TND or 5 USD, with 20% service fee.",
    welcomeLine4: "4) Track all operations from Profile.",
    close: "Close",
    tnd: "TND",
  },
} as const;

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatAmount(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function formatStatAmount(n: number) {
  if (!Number.isFinite(n)) return "0.00";
  return Number(n).toFixed(2);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseAmount(v: string) {
  return Number(v.replace(/,/g, ".").trim());
}

function parseReferralFromLocation() {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    return ref ? ref.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

function isUsdMethod(method: string) {
  return method === "TRC20" || method === "BEP20" || method.includes("USDT");
}

function isWithdrawAllowedNow() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekday = day >= 1 && day <= 5;
  const inWindow = hour >= 10 && hour < 18;
  return isWeekday && inWindow;
}

function mapTx(row: any): Tx {
  return {
    id: String(row.id),
    email: String(row.email),
    type: row.type,
    amount: Number(row.amount || 0),
    method: String(row.method || ""),
    status: row.status,
    receiptName: row.receipt_name || undefined,
    receiptDataUrl: row.receipt_url || undefined,
    payoutDetails: row.payout_details || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapDevice(row: any): Device {
  const fallbackImage = PRODUCT_IMAGE_MAP[String(row.plan_code || "")] || PRODUCT_IMAGE_MAP.A1;
  return {
    id: String(row.id),
    email: String(row.email),
    planCode: String(row.plan_code),
    planPrice: Number(row.plan_price || 0),
    dailyIncome: Number(row.daily_income || 0),
    totalIncome: Number(row.total_income || 0),
    validityDays: Number(row.validity_days || 0),
    image: String(row.image || fallbackImage),
    purchasedAt: row.purchased_at || new Date().toISOString(),
    earnedAmount: Number(row.earned_amount || 0),
    lastPayoutAt: row.last_payout_at || row.purchased_at || new Date().toISOString(),
  };
}

function mapProfit(row: any): Profit {
  return {
    id: String(row.id),
    email: String(row.email),
    deviceId: String(row.device_id),
    amount: Number(row.amount || 0),
    cycles: Number(row.cycles || 0),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapNotif(row: any): AppNotif {
  return {
    id: String(row.id),
    email: String(row.email),
    title: String(row.title || ""),
    message: String(row.message || ""),
    read: Boolean(row.is_read),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export default function App() {
  const [lang, setLang] = useState<Lang>("ar");
  const [session, setSession] = useState<Session>(null);
  const [tab, setTab] = useState<MainTab>("home");
  const [route, setRoute] = useState<Route>("home");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [notice, setNotice] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [profits, setProfits] = useState<Profit[]>([]);
  const [notifications, setNotifications] = useState<AppNotif[]>([]);
  const [profiles, setProfiles] = useState<Record<string, LocalProfile>>(() => {
    try {
      const raw = localStorage.getItem("tecai:profiles");
      return raw ? (JSON.parse(raw) as Record<string, LocalProfile>) : {};
    } catch {
      return {};
    }
  });

  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("TRC20");
  const [depositFile, setDepositFile] = useState<File | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("Bank");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawPayPassword, setWithdrawPayPassword] = useState("");
  const [showWithdrawPayPassword, setShowWithdrawPayPassword] = useState(false);

  const [newPayPassword, setNewPayPassword] = useState("");
  const [currentPayPassword, setCurrentPayPassword] = useState("");
  const [confirmNewPayPassword, setConfirmNewPayPassword] = useState("");
  const [showCurrentPayPassword, setShowCurrentPayPassword] = useState(false);
  const [showNewPayPassword, setShowNewPayPassword] = useState(false);
  const [showConfirmNewPayPassword, setShowConfirmNewPayPassword] = useState(false);

  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [notifUser, setNotifUser] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");

  const [showNotifications, setShowNotifications] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialog>({ open: false, title: "", message: "" });
  const [homeSliderIndex, setHomeSliderIndex] = useState(0);

  const t = DICT[lang];
  const isAdmin = session?.role === "admin";
  const currentEmail = session?.email || "";
  const depositDestination = DEPOSIT_DESTINATIONS[depositMethod] || "";

  const pendingCount = useMemo(() => txs.filter((x) => x.status === "pending").length, [txs]);
  const totalDeposit = useMemo(() => txs.filter((x) => x.type === "deposit" && x.status === "approved").reduce((s, x) => s + x.amount, 0), [txs]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const referralLink = useMemo(() => `${window.location.origin}?ref=${encodeURIComponent(currentEmail)}`, [currentEmail]);

  const todayProfit = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return profits
      .filter((p) => new Date(p.createdAt).getTime() >= todayStart.getTime())
      .reduce((s, p) => s + p.amount, 0);
  }, [profits]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (route !== "home" || tab !== "home") return;
    const timer = window.setInterval(() => {
      setHomeSliderIndex((prev) => (prev + 1) % HOME_SLIDER_IMAGES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [route, tab]);

  useEffect(() => {
    localStorage.setItem("tecai:profiles", JSON.stringify(profiles));
  }, [profiles]);

  async function loadUserData(emailValue: string) {
    const existingUser = await getUserByEmail(emailValue);
    if (!existingUser) {
      await createUser(emailValue, "local_user");
    }
    const [bal, txRows, deviceRows, profitRows, notifRows] = await Promise.all([
      getBalance(emailValue),
      getTransactions(emailValue),
      getDevices(emailValue),
      getProfits(emailValue),
      getNotifications(emailValue),
    ]);
    setBalance(Number(bal?.balance || 0));
    setTxs((txRows || []).map(mapTx));
    setDevices((deviceRows || []).map(mapDevice));
    setProfits((profitRows || []).map(mapProfit));
    setNotifications((notifRows || []).map(mapNotif));

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('users').select('email, created_at').eq('referred_by', emailValue);
      setInvitedUsers((data as InvitedUser[] | null) || []);
    }
  }

  async function loadAdminData() {
    const [txRows, users] = await Promise.all([getTransactions(), getAllUsers()]);
    setTxs((txRows || []).map(mapTx));
    setAllUsers((users || []).map((u: any) => String(u.email)).filter((e) => e !== ADMIN_EMAIL));
  }

  useEffect(() => {
    if (!session) return;
    if (session.role === "admin") {
      void loadAdminData();
      return;
    }
    setShowWelcomeModal(true);
    void loadUserData(session.email);
  }, [session]);

  useEffect(() => {
    if (!session || session.role !== "user") return;

    const run = async () => {
      const now = Date.now();
      let totalAdded = 0;
      for (const device of devices) {
        const parsedLast = new Date(device.lastPayoutAt).getTime();
        const purchased = new Date(device.purchasedAt).getTime();
        const last = Number.isFinite(parsedLast) ? parsedLast : purchased;
        const end = purchased + device.validityDays * PAYOUT_MS;
        const effectiveNow = Math.min(now, end);
        const elapsed = effectiveNow - last;
        const cycles = Math.floor(elapsed / PAYOUT_MS);
        if (cycles <= 0) continue;

        const remaining = Math.max(0, Number((device.totalIncome - device.earnedAmount).toFixed(4)));
        const payout = Math.min(Number((cycles * device.dailyIncome).toFixed(4)), remaining);
        if (payout <= 0) continue;

        const nextEarned = Number((device.earnedAmount + payout).toFixed(4));
        const nextPayoutAt = new Date(last + cycles * PAYOUT_MS).toISOString();

        await updateDevice(device.id, { earned_amount: nextEarned, last_payout_at: nextPayoutAt });
        await createProfit({
          email: currentEmail,
          device_id: device.id,
          amount: payout,
          cycles,
        });
        totalAdded += payout;
      }

      if (totalAdded > 0) {
        const latest = await getBalance(currentEmail);
        const nextBalance = Number((Number(latest?.balance || 0) + totalAdded).toFixed(4));
        const ok = await updateBalance(currentEmail, nextBalance, Number(latest?.total_deposit || 0));
        if (!ok) {
          setNotice(lang === "ar" ? "تعذر تحديث الرصيد تلقائيا" : "Failed to apply automatic profit");
          return;
        }
        await loadUserData(currentEmail);
      }
    };

    void run();
    const interval = window.setInterval(() => void run(), 60_000);
    return () => window.clearInterval(interval);
  }, [session, devices, balance, currentEmail]);

  async function handleAuthSubmit() {
    const safeEmail = email.trim().toLowerCase();
    if (!safeEmail || !password) {
      setNotice(t.badCredentials);
      return;
    }

    if (authMode === "register") {
      if (password.length < 4) return setNotice(t.passShort);
      if (password !== confirmPassword) return setNotice(t.passMismatch);
      if (!isSupabaseConfigured || !supabase) return setNotice("Supabase not configured");

      // محاولة التسجيل
      const signUp = await supabase.auth.signUp({ email: safeEmail, password });
      if (signUp.error) return setNotice(signUp.error.message);

      // تسجيل الدخول التلقائي بعد التسجيل
      const signIn = await supabase.auth.signInWithPassword({ email: safeEmail, password });
      
      // حتى لو فشل تسجيل الدخول (بسبب تأكيد الإيميل مثلا)، سنقوم بإنشاء سجل المستخدم في الجدول الخاص بنا
      const referredBy = parseReferralFromLocation();
      await createUser(safeEmail, password, referredBy || undefined);
      await updateBalance(safeEmail, 0);

      if (signIn.error) {
        setNotice(lang === "ar" ? "تم التسجيل بنجاح، يرجى تسجيل الدخول" : "Registered successfully, please login");
        setAuthMode("login");
      } else {
        setSession({ role: "user", email: safeEmail });
      }
      return;
    }

    if (safeEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      if (!isSupabaseConfigured || !supabase) return setNotice("Supabase not configured");
      let adminSignIn = await supabase.auth.signInWithPassword({ email: safeEmail, password });

      if (adminSignIn.error?.message?.toLowerCase().includes("invalid login credentials")) {
        const signUpAdmin = await supabase.auth.signUp({ email: safeEmail, password });
        if (!signUpAdmin.error) {
          adminSignIn = await supabase.auth.signInWithPassword({ email: safeEmail, password });
        }
      }

      if (adminSignIn.error) {
        setNotice("فشل دخول الأدمن: تأكد من وجود حساب الأدمن في Auth");
        return;
      }
      setSession({ role: "admin", email: safeEmail });
      return;
    }

    if (!isSupabaseConfigured || !supabase) return setNotice("Supabase not configured");
    const signIn = await supabase.auth.signInWithPassword({ email: safeEmail, password });
    if (signIn.error) return setNotice(t.badCredentials);

    const existing = await getUserByEmail(safeEmail);
    if (!existing) {
      await createUser(safeEmail, password);
      await updateBalance(safeEmail, 0);
    }
    setSession({ role: "user", email: safeEmail });
  }

  async function handleDeposit() {
    const amount = parseAmount(depositAmount);
    const minAmount = isUsdMethod(depositMethod) ? 10 : 30;
    if (!Number.isFinite(amount) || amount < minAmount) {
      return setNotice(lang === "ar" ? `الحد الأدنى للإيداع ${minAmount} ${isUsdMethod(depositMethod) ? "USD" : "د.ت"}` : `Minimum deposit is ${minAmount} ${isUsdMethod(depositMethod) ? "USD" : "TND"}`);
    }
    if (!depositFile) return setNotice(t.chooseFile);

    const receipt = await fileToDataUrl(depositFile);
    const tx: Tx = {
      id: id("tx"),
      email: currentEmail,
      type: "deposit",
      amount,
      method: depositMethod,
      status: "pending",
      receiptName: depositFile.name,
      receiptDataUrl: receipt,
      createdAt: new Date().toISOString(),
    };

    await createTransaction({
      id: tx.id,
      email: tx.email,
      type: tx.type,
      amount: tx.amount,
      method: tx.method,
      status: tx.status,
      receipt_url: tx.receiptDataUrl,
      receipt_name: tx.receiptName,
      created_at: tx.createdAt,
    });

    await loadUserData(currentEmail);
    setDepositAmount("");
    setDepositFile(null);
    setActionDialog({
      open: true,
      title: lang === "ar" ? "تم إرسال طلب الإيداع" : "Deposit request sent",
      message:
        lang === "ar"
          ? "تم استلام الطلب وهو الآن قيد المراجعة. سيتم إضافة الرصيد بعد موافقة الإدارة."
          : "Your request is now pending review. Balance will be credited after admin approval.",
    });
  }

  async function handleWithdraw() {
    const amount = parseAmount(withdrawAmount);
    const minAmount = isUsdMethod(withdrawMethod) ? 5 : 10;
    if (!Number.isFinite(amount) || amount < minAmount) {
      setActionDialog({
        open: true,
        title: lang === "ar" ? "تنبيه" : "Notice",
        message:
          lang === "ar"
            ? `الحد الأدنى للسحب هو ${minAmount} ${isUsdMethod(withdrawMethod) ? "USD" : "د.ت"}.`
            : `Minimum withdrawal amount is ${minAmount} ${isUsdMethod(withdrawMethod) ? "USD" : "TND"}.`,
      });
      return;
    }
    if (!isWithdrawAllowedNow()) {
      setActionDialog({
        open: true,
        title: lang === "ar" ? "تنبيه" : "Notice",
        message:
          lang === "ar"
            ? "السحب متاح من الإثنين إلى الجمعة، 10:00 - 18:00."
            : "Withdrawals are available Monday to Friday, 10:00 - 18:00.",
      });
      return;
    }
    if (amount > balance) {
      setActionDialog({
        open: true,
        title: lang === "ar" ? "تنبيه" : "Notice",
        message: lang === "ar" ? "رصيدك غير كاف لعملية السحب." : "Your balance is insufficient for withdrawal.",
      });
      return;
    }

    const profile = profiles[currentEmail];
    if (!profile?.payPassword) return setNotice("يرجى حفظ كلمة سحب في صفحة أنا");
    if (withdrawPayPassword !== profile.payPassword) return setNotice("كلمة سحب غير صحيحة");

    const tx: Tx = {
      id: id("tx"),
      email: currentEmail,
      type: "withdraw",
      amount,
      method: withdrawMethod,
      status: "pending",
      payoutDetails: withdrawAddress,
      createdAt: new Date().toISOString(),
    };

    await createTransaction({
      id: tx.id,
      email: tx.email,
      type: tx.type,
      amount: tx.amount,
      method: tx.method,
      status: tx.status,
      payout_details: tx.payoutDetails,
      created_at: tx.createdAt,
    });

    await loadUserData(currentEmail);
    setWithdrawAmount("");
    setWithdrawAddress("");
    setWithdrawPayPassword("");
    setNotice("تم إرسال طلب السحب، تتم المراجعة والموافقة خلال 48 ساعة");
  }

  async function handleBuy(plan: (typeof PRODUCTS)[number]) {
    if (balance < plan.price) {
      setActionDialog({
        open: true,
        title: lang === "ar" ? "تنبيه" : "Notice",
        message: lang === "ar" ? "رصيدك غير كاف لشراء هذا الجهاز." : "Your balance is not enough to buy this device.",
      });
      return;
    }

    const rpcRes = await rpcBuyDevice({
      plan_code: plan.code,
      plan_price: plan.price,
      daily_income: plan.dailyIncome,
      total_income: plan.totalIncome,
      validity_days: plan.validityDays,
      image: plan.image,
    });

    if (rpcRes.ok) {
      await loadUserData(currentEmail);
      setActionDialog({
        open: true,
        title: lang === "ar" ? "تم الشراء بنجاح" : "Purchase successful",
        message:
          lang === "ar"
            ? "تم شراء الجهاز بنجاح. ستجد جهازك الآن في صفحة أجهزتي."
            : "Device purchased successfully. You can find it now in My Devices.",
      });
      setNotice(t.bought);
      return;
    }

    const ok = await createDevice({
      email: currentEmail,
      plan_code: plan.code,
      plan_price: plan.price,
      daily_income: plan.dailyIncome,
      total_income: plan.totalIncome,
      validity_days: plan.validityDays,
      image: plan.image,
    });
    if (!ok) {
      setActionDialog({
        open: true,
        title: lang === "ar" ? "تعذر إتمام الشراء" : "Purchase failed",
        message:
          lang === "ar"
            ? "تعذر تنفيذ عملية الشراء. تحقق من صلاحيات RLS أو فعّل دالة user_buy_device في Supabase."
            : "Purchase failed. Check RLS policies or create user_buy_device RPC in Supabase.",
      });
      return;
    }

    const latest = await getBalance(currentEmail);
    const currentBalance = Number(latest?.balance || 0);
    const currentTotalDeposit = Number(latest?.total_deposit || 0);
    const nextBalance = Number((currentBalance - plan.price).toFixed(4));
    const balanceOk = await updateBalance(currentEmail, nextBalance, currentTotalDeposit);
    if (!balanceOk) {
      setActionDialog({
        open: true,
        title: lang === "ar" ? "فشل خصم الرصيد" : "Balance update failed",
        message:
          lang === "ar"
            ? "تم إنشاء الجهاز لكن تعذر خصم الرصيد. فعّل دالة user_buy_device لمنع تكرار هذه المشكلة."
            : "Device was created but balance deduction failed. Enable user_buy_device RPC to avoid this issue.",
      });
      await loadUserData(currentEmail);
      return;
    }

    await loadUserData(currentEmail);
    setActionDialog({
      open: true,
      title: lang === "ar" ? "تم الشراء بنجاح" : "Purchase successful",
      message:
        lang === "ar"
          ? "تم شراء الجهاز بنجاح. ستجد جهازك الآن في صفحة أجهزتي."
          : "Device purchased successfully. You can find it now in My Devices.",
    });
    setNotice(t.bought);
  }

  async function handleApproveReject(tx: Tx, status: "approved" | "rejected") {
    if (tx.type === "deposit" && status === "approved" && !tx.receiptDataUrl) {
      setNotice("لا يمكن قبول الإيداع بدون إثبات دفع");
      return;
    }
    if (!supabase) {
      setNotice("Supabase غير مهيأ");
      return;
    }

    const { data, error } = await supabase.rpc("admin_decide_transaction", {
      p_tx_id: tx.id,
      p_decision: status,
    });

    if (error) {
      setNotice("فشل تحديث العملية");
      return;
    }

    if (!data?.ok) {
      setNotice(String(data?.message || "تعذر تنفيذ العملية"));
      return;
    }

    await loadAdminData();
    setNotice(status === "approved" ? "تمت الموافقة" : "تم الرفض");
  }

  async function handleSendNotification() {
    if (!notifUser || !notifTitle || !notifBody) return setNotice("يرجى تعبئة جميع الحقول");
    const rpcRes = await rpcAdminSendNotification({ user_email: notifUser, title: notifTitle, message: notifBody });
    if (rpcRes.ok) {
      setNotifUser("");
      setNotifTitle("");
      setNotifBody("");
      setNotice(t.sent);
      return;
    }

    const ok = await createNotification({ email: notifUser, title: notifTitle, message: notifBody });
    if (!ok) {
      setActionDialog({
        open: true,
        title: lang === "ar" ? "فشل إرسال الإشعار" : "Notification failed",
        message:
          lang === "ar"
            ? "لم يتم حفظ الإشعار في Supabase. تحقق من صلاحيات RLS لجدول notifications (insert) للأدمن."
            : "Notification was not saved to Supabase. Check notifications insert RLS policy for admin.",
      });
      return;
    }
    setNotifUser("");
    setNotifTitle("");
    setNotifBody("");
    setNotice(t.sent);
  }

  async function handleMarkRead(n: AppNotif) {
    await markNotificationAsRead(n.id);
    await loadUserData(currentEmail);
  }

  async function handleDeleteNotification(n: AppNotif) {
    await deleteNotification(n.id);
    await loadUserData(currentEmail);
  }

  function handleCreatePayPassword() {
    if (!newPayPassword || !confirmNewPayPassword) {
      setNotice(t.fillAllFields);
      return;
    }
    if (newPayPassword.length < 4) {
      setNotice(t.payShort);
      return;
    }
    if (newPayPassword !== confirmNewPayPassword) {
      setNotice(t.payMismatch);
      return;
    }
    setProfiles((prev) => ({ ...prev, [currentEmail]: { payPassword: newPayPassword } }));
    setNewPayPassword("");
    setConfirmNewPayPassword("");
    setNotice(t.paySaved);
  }

  function handleChangePayPassword() {
    const existing = profiles[currentEmail]?.payPassword;
    if (!existing) {
      setNotice(lang === "ar" ? "قم بإنشاء كلمة السحب أولاً من صفحة أنا" : "Create withdraw password first from profile");
      return;
    }
    if (!currentPayPassword || !newPayPassword || !confirmNewPayPassword) {
      setNotice(t.fillAllFields);
      return;
    }
    if (currentPayPassword !== existing) {
      setNotice(t.currentPayWrong);
      return;
    }
    if (newPayPassword.length < 4) {
      setNotice(t.payShort);
      return;
    }
    if (newPayPassword !== confirmNewPayPassword) {
      setNotice(t.payMismatch);
      return;
    }
    setProfiles((prev) => ({ ...prev, [currentEmail]: { payPassword: newPayPassword } }));
    setCurrentPayPassword("");
    setNewPayPassword("");
    setConfirmNewPayPassword("");
    setNotice(t.paySaved);
  }

  function logout() {
    if (session && supabase) {
      void supabase.auth.signOut();
    }
    setSession(null);
    setEmail("");
    setPassword("");
  }

  function openTelegramHelp() {
    const url = "https://t.me/tecaipro";
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) window.location.href = url;
  }

  if (!session) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-city-new.png')" }}
        />
        <div className="absolute inset-0 bg-zinc-900/35" />
        <div className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white/95 p-6 shadow-lg backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-zinc-600">{t.appName}</p>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-zinc-300 px-2 py-1 text-sm">
              <option value="ar">AR</option>
              <option value="en">EN</option>
            </select>
          </div>
          <h1 className="text-center text-5xl font-black text-blue-600">{t.appName}</h1>
          <div className="mt-6 space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-zinc-300 px-3 py-3" placeholder={t.email} />
            <div className="relative">
              <input
                type={showLoginPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 pe-10"
                placeholder={t.password}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((p) => !p)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500"
              >
                <EyeIcon open={showLoginPassword} />
              </button>
            </div>
            {authMode === "register" && (
              <div className="relative">
                <input
                  type={showRegisterConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-3 pe-10"
                  placeholder={t.confirmPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterConfirmPassword((p) => !p)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500"
                >
                  <EyeIcon open={showRegisterConfirmPassword} />
                </button>
              </div>
            )}
            <button onClick={handleAuthSubmit} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white">
              {authMode === "login" ? t.login : t.register}
            </button>
            <button onClick={() => setAuthMode((p) => (p === "login" ? "register" : "login"))} className="w-full rounded-xl border border-zinc-300 py-3 font-bold">
              {authMode === "login" ? t.register : t.login}
            </button>
          </div>
          {notice && <p className="mt-4 rounded-xl bg-blue-50 p-2 text-center text-sm text-blue-700">{notice}</p>}
        </div>
      </div>
    );
  }

  if (isAdmin) {
    const pending = txs.filter((x) => x.status === "pending");
    return (
      <div className="min-h-screen bg-zinc-100 p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black">{t.pendingOps}</h1>
            <button onClick={logout} className="rounded-xl bg-zinc-900 px-4 py-2 text-white">{t.logout}</button>
          </div>

          {pending.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white p-4">{t.noPending}</p>
          ) : (
            pending.map((tx) => (
              <div key={tx.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold">{tx.type === "deposit" ? t.deposit : t.withdraw}</p>
                  <p className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-sm">Email: <span className="font-semibold">{tx.email}</span></p>
                <p className="text-sm">{t.amount}: <span className="font-semibold">{formatAmount(tx.amount)} {t.tnd}</span></p>
                <p className="text-sm">{tx.method}</p>
                <div className="mt-2">
                  {tx.type === "deposit" ? (
                    tx.receiptDataUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">تم رفع الإثبات</span>
                          <span className="text-xs text-zinc-500">{tx.receiptName || "receipt"}</span>
                        </div>
                        {tx.receiptDataUrl.startsWith("data:image") && (
                          <img
                            src={tx.receiptDataUrl}
                            alt="proof-thumb"
                            className="h-24 w-24 rounded-lg border border-zinc-200 object-cover"
                          />
                        )}
                        <button
                          onClick={() => setProofPreviewUrl(tx.receiptDataUrl || "")}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
                        >
                          عرض وصل الإيداع
                        </button>
                      </div>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">لا يوجد إثبات مرفوع</span>
                    )
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void handleApproveReject(tx, "approved")}
                    disabled={tx.type === "deposit" && !tx.receiptDataUrl}
                    className="rounded-lg bg-emerald-600 py-2 text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {t.approve}
                  </button>
                  <button onClick={() => void handleApproveReject(tx, "rejected")} className="rounded-lg bg-rose-600 py-2 text-white">{t.reject}</button>
                </div>
              </div>
            ))
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="mb-2 font-bold">{t.sendNotification}</p>
            <select value={notifUser} onChange={(e) => setNotifUser(e.target.value)} className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2">
              <option value="">{t.selectUser}</option>
              {allUsers.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <input value={notifUser} onChange={(e) => setNotifUser(e.target.value.trim().toLowerCase())} placeholder="user@email.com" className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2" />
            <input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder={t.notificationTitle} className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2" />
            <textarea value={notifBody} onChange={(e) => setNotifBody(e.target.value)} placeholder={t.notificationBody} className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2" rows={3} />
            <button onClick={() => void handleSendNotification()} className="w-full rounded-lg bg-indigo-600 py-2 text-white">{t.sendNotification}</button>
          </div>

          {notice && <p className="rounded-xl bg-blue-50 p-2 text-center text-sm text-blue-700">{notice}</p>}

          {proofPreviewUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setProofPreviewUrl("")}>
              <div className="w-full max-w-xl rounded-2xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
                {proofPreviewUrl.startsWith("data:image") ? (
                  <img src={proofPreviewUrl} alt="proof" className="max-h-[70vh] w-full rounded-lg object-contain" />
                ) : (
                  <iframe src={proofPreviewUrl} title="proof" className="h-[70vh] w-full rounded-lg" />
                )}
                <button className="mt-3 w-full rounded-lg border border-zinc-300 py-2" onClick={() => setProofPreviewUrl("")}>إغلاق</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 pb-20" dir={lang === "ar" ? "rtl" : "ltr"}>
      <main className="mx-auto max-w-4xl p-4">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {route !== "home" && (
              <button onClick={() => setRoute("home")} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-lg">←</button>
            )}
            <h1 className="text-3xl font-black">{route === "home" ? "TECAI" : route === "deposit" ? t.deposit : route === "withdraw" ? t.withdraw : t.settings}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifications((p) => !p)} className="relative rounded-xl border border-zinc-300 bg-white px-3 py-2">
              🔔
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-rose-600 px-1 text-[10px] text-white">{unreadCount}</span>}
            </button>
            <button onClick={logout} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-bold text-rose-700">{t.logout}</button>
          </div>
        </header>

        {showNotifications && (
          <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3">
            <p className="mb-2 font-bold">{t.notifications}</p>
            {notifications.length === 0 ? (
              <p className="text-sm text-zinc-500">{t.noNotifications}</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className={`rounded-lg border p-2 ${n.read ? "border-zinc-200" : "border-blue-200 bg-blue-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-sm text-zinc-600">{n.message}</p>
                        <p className="text-xs text-zinc-500">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1">
                        {!n.read && <button className="rounded bg-blue-600 px-2 py-1 text-xs text-white" onClick={() => void handleMarkRead(n)}>✓</button>}
                        <button className="rounded bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => void handleDeleteNotification(n)}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(route !== "home" || tab !== "home") && (
          <section className="mb-4 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white">
            <p className="text-sm opacity-80">{t.balance}</p>
            <p className="text-5xl font-black">{formatAmount(balance)} {t.tnd}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/20 p-3 text-center">
                <p className="text-2xl font-bold">{formatAmount(totalDeposit)}</p>
                <p className="text-sm">{t.totalDeposit}</p>
              </div>
              <div className="rounded-xl bg-white/20 p-3 text-center">
                <p className="text-2xl font-bold">{formatAmount(todayProfit)}</p>
                <p className="text-sm">{t.todayProfit}</p>
              </div>
            </div>
          </section>
        )}

        {route === "home" && pendingCount > 0 && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-700">{pendingCount} {t.pending}</div>}

        {route === "home" && tab === "home" && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-blue-700">TECAI</h2>
                  <p className="text-zinc-500">استثمار ذكي بروبوتات TECAI</p>
                </div>
                <img src={BRAND_THUMB} alt="TECAI" className="h-16 w-16 rounded-2xl object-cover" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button className="w-full overflow-hidden rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-semibold md:text-base" dir="ltr" title={currentEmail}>
                <span className="block truncate">{currentEmail}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <button onClick={() => setTab("team")} className="rounded-2xl bg-white p-3 shadow-sm border border-zinc-200">👥<div className="mt-1">الفريق</div></button>
              <button onClick={() => setRoute("withdraw")} className="rounded-2xl bg-white p-3 shadow-sm border border-zinc-200">👛<div className="mt-1">{t.withdraw}</div></button>
              <button onClick={() => setRoute("deposit")} className="rounded-2xl bg-white p-3 shadow-sm border border-zinc-200">💳<div className="mt-1">{t.deposit}</div></button>
              <button className="rounded-2xl bg-white p-3 shadow-sm border border-zinc-200">⬇️<div className="mt-1">التطبيق</div></button>
              <button onClick={openTelegramHelp} className="rounded-2xl bg-white p-3 shadow-sm border border-zinc-200">❓<div className="mt-1">مساعدة</div></button>
              <button className="rounded-2xl bg-white p-3 shadow-sm border border-zinc-200">🌐<div className="mt-1">الموقع الرسمي</div></button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="min-h-[132px] rounded-2xl border border-blue-300 bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-sm">
                <p dir="ltr" className="font-extrabold leading-tight tracking-tight text-[clamp(1.15rem,5.2vw,1.75rem)]" style={{ unicodeBidi: "plaintext" }}>
                  <span className="inline-block w-full text-center font-mono">{formatStatAmount(totalDeposit)}</span>
                </p>
                <p className="mt-2 text-white/90">{t.totalDeposit}</p>
              </div>
              <div className="min-h-[132px] rounded-2xl border border-blue-300 bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-sm">
                <p dir="ltr" className="font-extrabold leading-tight tracking-tight text-[clamp(1.15rem,5.2vw,1.75rem)]" style={{ unicodeBidi: "plaintext" }}>
                  <span className="inline-block w-full text-center font-mono">+{formatStatAmount(todayProfit)}</span>
                </p>
                <p className="mt-2 text-white/90">{t.todayProfit}</p>
              </div>
              <div className="min-h-[132px] rounded-2xl border border-blue-300 bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-sm">
                <p dir="ltr" className="font-extrabold leading-tight tracking-tight text-[clamp(1.15rem,5.2vw,1.75rem)]" style={{ unicodeBidi: "plaintext" }}>
                  <span className="inline-block w-full text-center font-mono">{formatStatAmount(balance)}</span>
                </p>
                <p className="mt-2 text-white/90">{t.balance}</p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white">
              <img src={HOME_SLIDER_IMAGES[homeSliderIndex]} alt="Robots slider" className="h-48 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
                {HOME_SLIDER_IMAGES.map((_, idx) => (
                  <button
                    key={`slide-dot-${idx}`}
                    type="button"
                    onClick={() => setHomeSliderIndex(idx)}
                    className={`h-2 rounded-full transition-all ${homeSliderIndex === idx ? "w-6 bg-white" : "w-2 bg-white/60"}`}
                    aria-label={`slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {route === "deposit" && (
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
            <p className="font-bold">{t.deposit}</p>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <p>1) الحد الأدنى: 30 د.ت أو 10 USD حسب الطريقة.</p>
              <p>2) يصل الرصيد بعد مراجعة الإدارة والموافقة.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "TRC20", label: "TRC20" },
                { key: "BEP20", label: "BEP20" },
                { key: "D17", label: "D17" },
                { key: "Flouci", label: "Flouci" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setDepositMethod(m.key)}
                  className={`rounded-lg border px-3 py-2 text-sm ${depositMethod === m.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-300"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder={t.amount} className="w-full rounded-lg border border-zinc-300 px-3 py-2" />
            {depositDestination && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="mb-1 font-semibold text-blue-700">رقم/عنوان الإيداع</p>
                <p className="break-all font-mono text-blue-900">{depositDestination}</p>
                <button
                  onClick={() => void navigator.clipboard.writeText(depositDestination)}
                  className="mt-2 rounded-md border border-blue-300 bg-white px-3 py-1 text-xs text-blue-700"
                >
                  نسخ
                </button>
              </div>
            )}
            <label className="block rounded-lg border border-dashed border-zinc-300 p-3 text-sm">
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setDepositFile(e.target.files?.[0] || null)} />
              {depositFile ? depositFile.name : t.chooseFile}
            </label>
            <button onClick={() => void handleDeposit()} className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white">{t.submitDeposit}</button>
          </div>
        )}

        {route === "withdraw" && (
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
            <p className="font-bold">{t.withdraw}</p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>1) الحد الأدنى: 10 د.ت أو 5 USD حسب الطريقة.</p>
              <p>2) رسوم الخدمة: 20% لكل عملية.</p>
              <p>3) السحب متاح من الإثنين إلى الجمعة، 10:00 - 18:00.</p>
              <p>4) تتم المراجعة والموافقة خلال 48 ساعة.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Bank", "D17", "Flouci", "USDT-TRC20"].map((m) => (
                <button
                  key={m}
                  onClick={() => setWithdrawMethod(m)}
                  className={`rounded-lg border px-3 py-2 text-sm ${withdrawMethod === m ? "border-zinc-900 bg-zinc-100 font-semibold" : "border-zinc-300"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder={t.amount} className="w-full rounded-lg border border-zinc-300 px-3 py-2" />
            <input value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} placeholder="Address / Account" className="w-full rounded-lg border border-zinc-300 px-3 py-2" />
            <div className="relative">
              <input
                type={showWithdrawPayPassword ? "text" : "password"}
                value={withdrawPayPassword}
                onChange={(e) => setWithdrawPayPassword(e.target.value)}
                placeholder={t.payPassword}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 pe-10"
              />
              <button
                type="button"
                onClick={() => setShowWithdrawPayPassword((p) => !p)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500"
              >
                <EyeIcon open={showWithdrawPayPassword} />
              </button>
            </div>
            <button onClick={() => void handleWithdraw()} className="w-full rounded-lg bg-zinc-900 py-2.5 font-semibold text-white">
              {t.submitWithdraw}
            </button>
          </div>
        )}

        {route === "home" && tab === "products" && (
          <div className="space-y-3">
            {PRODUCTS.map((p) => (
              <div key={p.code} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-black">{p.code}</p>
                  <p className="text-sm">{p.validityDays} days</p>
                </div>
                <img src={p.image} alt={p.code} className="mt-3 h-32 w-full rounded-lg object-cover" />
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <p>Cost: {formatAmount(p.price)} {t.tnd}</p>
                  <p>Daily: {formatAmount(p.dailyIncome)} {t.tnd}</p>
                  <p>Total: {formatAmount(p.totalIncome)} {t.tnd}</p>
                </div>
                <button onClick={() => void handleBuy(p)} className="mt-3 w-full rounded-lg bg-zinc-900 py-2 text-white">{t.buy}</button>
              </div>
            ))}
          </div>
        )}

        {route === "home" && tab === "devices" && (
          <div className="space-y-3">
            {devices.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-white p-3">No devices</p>
            ) : (
              devices.map((d) => {
                const purchased = new Date(d.purchasedAt).getTime();
                const end = purchased + d.validityDays * PAYOUT_MS;
                const now = Date.now();
                const progress = Math.min(100, Math.max(0, ((now - purchased) / (d.validityDays * PAYOUT_MS)) * 100));
                const isFinished = now >= end || d.earnedAmount >= d.totalIncome;
                const remaining = Math.max(0, d.totalIncome - d.earnedAmount);
                const barWidth = isFinished ? 100 : Math.max(3, progress);
                return (
                  <div key={d.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold">{d.planCode}</p>
                      <p className={`text-xs font-semibold ${isFinished ? "text-zinc-500" : "text-blue-700"}`}>
                        {isFinished ? "مكتمل" : "قيد التشغيل"}
                      </p>
                    </div>
                    <img src={d.image} alt={d.planCode} className="mb-2 h-28 w-full rounded-lg object-cover" />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p>السعر: {formatAmount(d.planPrice)} {t.tnd}</p>
                      <p>الربح اليومي: {formatAmount(d.dailyIncome)} {t.tnd}</p>
                      <p>الأرباح المحصلة: {formatAmount(d.earnedAmount)} {t.tnd}</p>
                      <p>الأرباح المتبقية: {formatAmount(remaining)} {t.tnd}</p>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">تاريخ الانتهاء: {new Date(end).toLocaleDateString()}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div className="h-full bg-blue-600 transition-all" style={{ width: `${barWidth}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">نسبة الإنجاز: {progress.toFixed(1)}%</p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {route === "home" && tab === "team" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="mb-2 font-bold">رابط الإحالة الخاص بك</p>
              <p className="break-all rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-sm">{referralLink}</p>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(referralLink);
                  setNotice(lang === "ar" ? "تم نسخ الرابط" : "Link copied");
                }}
                className="mt-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                نسخ الرابط
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="mb-2 font-bold">أعضاء الفريق المدعوون</p>
              {invitedUsers.length === 0 ? (
                <p className="text-sm text-zinc-500">لا يوجد أعضاء بعد.</p>
              ) : (
                <div className="space-y-2">
                  {invitedUsers.map((u) => (
                    <div key={u.email} className="rounded-lg border border-zinc-200 p-2 text-sm">
                      <p className="font-semibold">{u.email}</p>
                      <p className="text-xs text-zinc-500">{u.created_at ? new Date(u.created_at).toLocaleString() : ""}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
                امتياز الإحالة: تحصل على 5% من كل عملية إيداع مقبولة لأعضاء فريقك.
              </p>
            </div>
          </div>
        )}

        {route === "home" && tab === "profile" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="mb-3 text-sm font-semibold" dir="ltr">{currentEmail}</p>
              {!profiles[currentEmail]?.payPassword ? (
                <>
                  <p className="mb-2 text-sm font-semibold">{t.createPayFirst}</p>
                  <div className="relative mb-2">
                    <input
                      type={showNewPayPassword ? "text" : "password"}
                      value={newPayPassword}
                      onChange={(e) => setNewPayPassword(e.target.value)}
                      placeholder={t.newPayPassword}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-2 pe-10"
                    />
                    <button type="button" onClick={() => setShowNewPayPassword((p) => !p)} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500">
                      <EyeIcon open={showNewPayPassword} />
                    </button>
                  </div>
                  <div className="relative mb-2">
                    <input
                      type={showConfirmNewPayPassword ? "text" : "password"}
                      value={confirmNewPayPassword}
                      onChange={(e) => setConfirmNewPayPassword(e.target.value)}
                      placeholder={t.confirmPayPassword}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-2 pe-10"
                    />
                    <button type="button" onClick={() => setShowConfirmNewPayPassword((p) => !p)} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500">
                      <EyeIcon open={showConfirmNewPayPassword} />
                    </button>
                  </div>
                  <button onClick={handleCreatePayPassword} className="w-full rounded-lg bg-zinc-900 py-2 text-white">
                    {t.savePay}
                  </button>
                </>
              ) : (
                <button onClick={() => setRoute("settings")} className="w-full rounded-lg border border-zinc-300 py-2 font-semibold">
                  {t.openSettings}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="mb-2 font-bold">{t.txHistory}</p>
              {txs.length === 0 ? (
                <p className="text-sm text-zinc-500">{t.noTx}</p>
              ) : (
                <div className="space-y-2">
                  {txs.map((tx) => (
                    <div key={tx.id} className="rounded-lg border border-zinc-200 p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>{tx.type === "deposit" ? t.deposit : t.withdraw}</span>
                        <span className={tx.status === "approved" ? "text-emerald-600" : tx.status === "rejected" ? "text-rose-600" : "text-amber-600"}>
                          {tx.status === "pending" ? t.pending : tx.status === "approved" ? t.approved : t.rejected}
                        </span>
                      </div>
                      <p>{formatAmount(tx.amount)} {t.tnd} - {tx.method}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {route === "settings" && (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-sm font-semibold">{t.settings}</p>
            <div className="relative">
              <input
                type={showCurrentPayPassword ? "text" : "password"}
                value={currentPayPassword}
                onChange={(e) => setCurrentPayPassword(e.target.value)}
                placeholder={t.currentPayPassword}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 pe-10"
              />
              <button type="button" onClick={() => setShowCurrentPayPassword((p) => !p)} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500">
                <EyeIcon open={showCurrentPayPassword} />
              </button>
            </div>
            <div className="relative">
              <input
                type={showNewPayPassword ? "text" : "password"}
                value={newPayPassword}
                onChange={(e) => setNewPayPassword(e.target.value)}
                placeholder={t.newPayPassword}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 pe-10"
              />
              <button type="button" onClick={() => setShowNewPayPassword((p) => !p)} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500">
                <EyeIcon open={showNewPayPassword} />
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirmNewPayPassword ? "text" : "password"}
                value={confirmNewPayPassword}
                onChange={(e) => setConfirmNewPayPassword(e.target.value)}
                placeholder={t.confirmPayPassword}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 pe-10"
              />
              <button type="button" onClick={() => setShowConfirmNewPayPassword((p) => !p)} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500">
                <EyeIcon open={showConfirmNewPayPassword} />
              </button>
            </div>
            <button onClick={handleChangePayPassword} className="w-full rounded-lg bg-zinc-900 py-2 text-white">
              {t.savePay}
            </button>
          </div>
        )}

        {notice && <p className="mt-4 rounded-xl bg-blue-50 p-2 text-center text-sm text-blue-700">{notice}</p>}
      </main>

      {route === "home" && (
      <nav className="fixed bottom-0 left-1/2 grid w-full max-w-4xl -translate-x-1/2 grid-cols-5 border-t border-zinc-200 bg-white py-2 text-center text-sm">
        <button className={tab === "home" ? "font-bold" : "text-zinc-500"} onClick={() => setTab("home")}>{t.home}</button>
        <button className={tab === "products" ? "font-bold" : "text-zinc-500"} onClick={() => setTab("products")}>{t.products}</button>
        <button className={tab === "devices" ? "font-bold" : "text-zinc-500"} onClick={() => setTab("devices")}>{t.devices}</button>
        <button className={tab === "team" ? "font-bold" : "text-zinc-500"} onClick={() => setTab("team")}>الفريق</button>
        <button className={tab === "profile" ? "font-bold" : "text-zinc-500"} onClick={() => setTab("profile")}>{t.profile}</button>
      </nav>
      )}

      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setShowWelcomeModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900">{t.welcomeTitle}</h3>
            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              <p>{t.welcomeLine1}</p>
              <p>{t.welcomeLine2}</p>
              <p>{t.welcomeLine3}</p>
              <p>{t.welcomeLine4}</p>
            </div>
            <button onClick={() => setShowWelcomeModal(false)} className="mt-4 w-full rounded-lg bg-zinc-900 py-2 text-white">
              {t.close}
            </button>
          </div>
        </div>
      )}

      {actionDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setActionDialog({ open: false, title: "", message: "" })}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">{actionDialog.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{actionDialog.message}</p>
            <button
              onClick={() => setActionDialog({ open: false, title: "", message: "" })}
              className="mt-4 w-full rounded-lg bg-zinc-900 py-2 text-white"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}