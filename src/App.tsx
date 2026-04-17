import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  getBalance,
  getTransactions,
  getDevices,
  getProfits,
  createNotification as createNotificationInDb,
  markNotificationAsRead as markNotifReadInDb,
  deleteNotification as deleteNotifInDb,
} from "./lib/supabaseState";

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
  email: string;
  planCode: string;
  planPrice: number;
  dailyIncome: number;
  totalIncome: number;
  validityDays: number;
  image: string;
  purchasedAt: string;
  earnedAmount?: number;
  hourlyRate?: number;
  lastPayoutAt?: string;
};

type ProfitRecord = {
  id: string;
  email: string;
  deviceId: string;
  amount: number;
  cycles: number;
  createdAt: string;
};

type Session = { role: Role; email: string } | null;

type WithdrawalChannel = {
  id: string;
  provider: WithdrawProvider;
  holderName: string;
  email: string;
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
  email: string;
  type: "deposit" | "withdraw";
  amount: number;
  method: string;
  status: "pending" | "approved" | "rejected";
  payoutDetails?: string;
  receiptName?: string;
  receiptDataUrl?: string;
  createdAt: string;
};

type Notification = {
  id: string;
  email: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const ADMIN_PHONE = "55810112";
const ADMIN_PASSWORD = "TECAI@2026";
const ADMIN_PHONE_WITH_CODE = "+21655810112";
const REFERRAL_DEPOSIT_RATE = 0.05;
const REFERRAL_PROFIT_RATE = 0.025;
const DAILY_DEVICE_PROFIT_RATE = 0.03;
const WITHDRAW_SERVICE_FEE_RATE = 0.2;

function EyeIcon({ closed = false }: { closed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      {closed ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c6.5 0 10 8 10 8a18.1 18.1 0 0 1-4 5.1" />
          <path d="M6.6 6.7A18.5 18.5 0 0 0 2 12s3.5 8 10 8a10.4 10.4 0 0 0 4.4-1" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

const DESTINATIONS: Record<DepositChannel, string> = {
  TRC20: "TXLsHureixQs123XNcyzSWZ8edH6yTxS67",
  BEP20: "0x0bcb69e95e45c419b17182a5f2f2bbadca7c9c75",
  D17: "55810112",
  Flouci: "55810112",
  Bank: "Contact support for bank transfer details",
};

const DICT = {
  ar: {
    appName: "TECAI",
    login: "دخول",
    register: "تسجيل",
    createAccount: "إنشاء حساب",
    phone: "البريد الإلكتروني",
    phoneHint: "أدخل البريد الإلكتروني",
    countryCode: "كود البلد",
    password: "كلمة المرور",
    showPassword: "إظهار",
    hidePassword: "إخفاء",
    confirmPassword: "تأكيد كلمة المرور",
    badCredentials: "بيانات الدخول غير صحيحة",
    phoneExists: "البريد الإلكتروني مسجل بالفعل",
    passwordShort: "كلمة المرور قصيرة",
    passwordMismatch: "تأكيد كلمة المرور غير مطابق",
    accountCreated: "تم إنشاء الحساب بنجاح",
    adminLogin: "دخول الإدارة",
    userLogin: "دخول المستخدم",
    adminCredentialsWrong: "بيانات الأدمن غير صحيحة",
    home: "الرئيسية",
    products: "المنتج",
    team: "الفريق",
    profile: "أنا",
    deposit: "إيداع",
    withdraw: "سحب",
    lottery: "اليانصيب",
    officialSite: "الموقع الرسمي",
    help: "مساعدة",
    app: "التطبيق",
    dailyCheckIn: "تسجيل يومي",
    accountBalance: "رصيد الحساب",
    todayProfit: "أرباح اليوم",
    autoProfitHistory: "سجل أرباح الأجهزة",
    noAutoProfit: "لا توجد أرباح أجهزة حتى الآن.",
    autoProfitTag: "ربح أجهزة تلقائي",
    totalDeposit: "إجمالي الإيداع",
    pendingLabel: "عملية قيد المراجعة",
    noProducts: "لا توجد منتجات مفعلة حاليا.",
    referral: "رابط الإحالة",
    referralBonus: "مكافآت الإحالة",
    referralIncomeDetails: "دخل الإحالة",
    referralDepositIncome: "مكافآت الإيداع 5%",
    referralProfitIncome: "مكافآت أرباح 2.5%",
    brandTagline: "استثمار ذكي بروبوتات TECAI",
    payPassSettings: "إعدادات كلمة سر السحب",
    logout: "خروج",
    language: "اللغة",
    depositChannels: "قنوات الإيداع",
    amount: "المبلغ",
    uploadProof: "قم بتحميل إيصال الإيداع",
    chooseFile: "اختر صورة أو PDF",
    confirmDeposit: "تأكيد الإيداع",
    depositInstructions: "تعليمات الإيداع",
    reviewNotice: "تم إرسال العملية وهي الآن قيد المراجعة من الإدارة.",
    reviewPopupTitle: "تم إرسال الطلب",
    ok: "حسنا",
    minDeposit: "الحد الأدنى للإيداع هو 1 USDT",
    proofRequired: "يرجى رفع إثبات الإيداع",
    proofUnavailable: "تعذر عرض الإثبات. يرجى إعادة رفع الإيصال في طلب جديد.",
    copy: "نسخ",
    copied: "تم النسخ",
    bankCard: "بطاقة بنكية",
    serviceFeeBank: "رسوم الخدمة: 20%",
    serviceFeeUsdt: "رسوم الخدمة: 20%",
    expectedArrival: "المبلغ المتوقع الوصول",
    expectedBank: "المبلغ المتوقع الوصول 0.00 دينار تونسي",
    expectedUsdt: "USD المبلغ المتوقع الوصول 0.00",
    selectWithdrawChannel: "اختر قناة السحب",
    withdrawPassword: "كلمة مرور الدفع",
    withdrawAddress: "يرجى إدخال عنوان السحب",
    withdrawBtn: "سحب",
    minWithdraw: "الحد الأدنى للسحب هو 2 USDT",
    noBalance: "الرصيد غير كاف",
    withdrawableProfit: "المتاح للسحب",
    withdrawProfitsOnly: "الرصيد غير كاف",
    useMaxProfit: "استخدم كامل الرصيد",
    needPayPassword: "يرجى إنشاء كلمة سر السحب من صفحة الإعدادات",
    payPasswordRequired: "يرجى إدخال كلمة سر السحب",
    payPasswordWrong: "كلمة سر السحب غير صحيحة",
    chooseWithdrawChannel: "يرجى اختيار قناة سحب",
    withdrawInstructions: "تعليمات السحب",
    addChannel: "إضافة قناة",
    noChannels: "لا توجد قنوات مضافة بعد.",
    bindBank: "ربط البطاقة البنكية",
    channel: "القناة",
    name: "الاسم",
    nameHint: "يرجى إدخال الاسم",
    accountNumber: "رقم البطاقة البنكية",
    accountHint: "يرجى إدخال رقم البطاقة البنكية",
    save: "تأكيد",
    allFieldsRequired: "يرجى تعبئة جميع الحقول",
    channelAdded: "تمت إضافة قناة السحب بنجاح",
    settings: "الإعدادات",
    settingsHint: "هذه الصفحة لإنشاء أو تغيير كلمة سر السحب.",
    currentPassword: "كلمة السر الحالية",
    newPassword: "كلمة السر الجديدة",
    confirmNewPassword: "تأكيد كلمة السر الجديدة",
    savePayPassword: "حفظ كلمة سر السحب",
    passwordSaved: "تم حفظ كلمة سر السحب",
    currentPasswordWrong: "كلمة السر الحالية غير صحيحة",
    pendingOps: "طلبات العمليات المعلقة",
    noPending: "لا يوجد طلبات حاليا.",
    approve: "قبول",
    reject: "رفض",
    backToUser: "العودة لتسجيل المستخدم",
    tnd: "د.ت",
    txHistory: "سجل العمليات المالية",
    noTx: "لا توجد عمليات حتى الآن.",
    statusPending: "قيد المراجعة",
    statusApproved: "مقبول",
    statusRejected: "مرفوض",
    typeDeposit: "إيداع",
    typeWithdraw: "سحب",
    viewProof: "عرض إثبات الإيداع",
    close: "إغلاق",
    filterAll: "الكل",
    filterDeposit: "الإيداع",
    filterWithdraw: "السحب",
    filterPending: "قيد المراجعة",
    filterApproved: "مقبول",
    filterRejected: "مرفوض",
    robotPlans: "خطط الروبوت",
    robotPlansHint: "مبلغ الإيداع (الحد الأدنى للإيداع: 30 د.ت)",
    activatePlan: "تفعيل الخطة",
    myDevices: "أجهزتي",
    myDevicesTitle: "الأجهزة المفعلة",
    runningNow: "قيد التشغيل المباشر",
    purchasedAt: "تاريخ الشراء",
    runTime: "مدة التشغيل",
    liveProfit: "الربح المباشر",
    earnedProfit: "الأرباح المحصلة",
    remainingProfit: "الأرباح المتبقية",
    expiresAt: "تاريخ الانتهاء",
    completionRate: "نسبة الإنجاز",
    finished: "مكتمل",
    noDevices: "لا توجد أجهزة مفعلة بعد.",
    buyAndRun: "شراء وتشغيل",
    boughtSuccess: "تم شراء الجهاز وبدأ التشغيل.",
    buyNeedBalance: "رصيدك غير كاف. تم تحويلك إلى صفحة الإيداع.",
    onSaleNow: "مباع حاليا",
    preSale: "قيد البيع المسبق",
    preSaleEmpty: "لا توجد أجهزة تم شراؤها بعد.",
    planCost: "التكلفة",
    dailyIncomeLabel: "الدخل اليومي",
    totalIncomeLabel: "إجمالي الدخل",
    validityPeriod: "فترة الصلاحية",
    daysCount: "عدد الأيام",
    quantityLabel: "كمية المنتج",
    unlimitedQty: "غير محدود بالعدد",
    buy: "شراء",
    currencyLong: "دينار تونسي",
  },
  en: {
    appName: "TECAI",
    login: "Login",
    register: "Register",
    createAccount: "Create account",
    phone: "Email",
    phoneHint: "Enter email address",
    countryCode: "Country code",
    password: "Password",
    showPassword: "Show",
    hidePassword: "Hide",
    confirmPassword: "Confirm password",
    badCredentials: "Invalid credentials",
    phoneExists: "Email already exists",
    passwordShort: "Password is too short",
    passwordMismatch: "Passwords do not match",
    accountCreated: "Account created successfully",
    adminLogin: "Admin login",
    userLogin: "User login",
    adminCredentialsWrong: "Invalid admin credentials",
    home: "Home",
    products: "Products",
    team: "Team",
    profile: "Me",
    deposit: "Deposit",
    withdraw: "Withdraw",
    lottery: "Lottery",
    officialSite: "Official site",
    help: "Help",
    app: "App",
    dailyCheckIn: "Daily check-in",
    accountBalance: "Account balance",
    todayProfit: "Today profit",
    autoProfitHistory: "Device profit history",
    noAutoProfit: "No device profit records yet.",
    autoProfitTag: "Automatic device profit",
    totalDeposit: "Total deposit",
    pendingLabel: "pending request(s)",
    noProducts: "No active products yet.",
    referral: "Referral link",
    referralBonus: "Referral bonus",
    referralIncomeDetails: "Referral income",
    referralDepositIncome: "Deposit bonuses 5%",
    referralProfitIncome: "Profit bonuses 2.5%",
    brandTagline: "Smart investing with TECAI robots",
    payPassSettings: "Withdrawal password settings",
    logout: "Logout",
    language: "Language",
    depositChannels: "Deposit channels",
    amount: "Amount",
    uploadProof: "Upload deposit proof",
    chooseFile: "Choose image or PDF",
    confirmDeposit: "Confirm deposit",
    depositInstructions: "Deposit instructions",
    reviewNotice: "Request submitted. Waiting for admin review.",
    reviewPopupTitle: "Request submitted",
    ok: "OK",
    minDeposit: "Minimum deposit is 1 USDT",
    proofRequired: "Please upload deposit proof",
    proofUnavailable: "Cannot preview this proof. Please re-upload receipt in a new request.",
    copy: "Copy",
    copied: "Copied",
    bankCard: "Bank card",
    serviceFeeBank: "Service fee: 20%",
    serviceFeeUsdt: "Service fee: 20%",
    expectedArrival: "Expected arrival",
    expectedBank: "Expected arrival: 0.00 TND",
    expectedUsdt: "Expected arrival: 0.00 USD",
    selectWithdrawChannel: "Select withdrawal channel",
    withdrawPassword: "Payment password",
    withdrawAddress: "Enter withdrawal address",
    withdrawBtn: "Withdraw",
    minWithdraw: "Minimum withdrawal is 2 USDT",
    noBalance: "Insufficient balance",
    withdrawableProfit: "Available to withdraw",
    withdrawProfitsOnly: "Insufficient balance",
    useMaxProfit: "Use full balance",
    needPayPassword: "Please create withdrawal password in settings",
    payPasswordRequired: "Enter withdrawal password",
    payPasswordWrong: "Wrong withdrawal password",
    chooseWithdrawChannel: "Please choose withdrawal channel",
    withdrawInstructions: "Withdrawal instructions",
    addChannel: "Add channel",
    noChannels: "No channels yet.",
    bindBank: "Bind bank card",
    channel: "Channel",
    name: "Name",
    nameHint: "Enter name",
    accountNumber: "Card/account number",
    accountHint: "Enter card/account number",
    save: "Save",
    allFieldsRequired: "Please fill all fields",
    channelAdded: "Withdrawal channel added",
    settings: "Settings",
    settingsHint: "Create or change your withdrawal password.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmNewPassword: "Confirm new password",
    savePayPassword: "Save withdrawal password",
    passwordSaved: "Password saved",
    currentPasswordWrong: "Current password is wrong",
    pendingOps: "Pending operations",
    noPending: "No pending requests.",
    approve: "Approve",
    reject: "Reject",
    backToUser: "Back to user login",
    tnd: "TND",
    txHistory: "Financial history",
    noTx: "No transactions yet.",
    statusPending: "Pending",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    typeDeposit: "Deposit",
    typeWithdraw: "Withdraw",
    viewProof: "View deposit proof",
    close: "Close",
    filterAll: "All",
    filterDeposit: "Deposit",
    filterWithdraw: "Withdraw",
    filterPending: "Pending",
    filterApproved: "Approved",
    filterRejected: "Rejected",
    robotPlans: "Robot plans",
    robotPlansHint: "Deposit amount (minimum deposit: 30 TND)",
    activatePlan: "Activate plan",
    myDevices: "My devices",
    myDevicesTitle: "Active devices",
    runningNow: "Running live",
    purchasedAt: "Purchased at",
    runTime: "Run time",
    liveProfit: "Live profit",
    earnedProfit: "Earned profit",
    remainingProfit: "Remaining profit",
    expiresAt: "Expires at",
    completionRate: "Completion",
    finished: "Completed",
    noDevices: "No active devices yet.",
    buyAndRun: "Buy and run",
    boughtSuccess: "Device purchased and started.",
    buyNeedBalance: "Insufficient balance. Redirected to download page.",
    onSaleNow: "On sale now",
    preSale: "Pre-sale",
    preSaleEmpty: "No purchased devices yet.",
    planCost: "Cost",
    dailyIncomeLabel: "Daily income",
    totalIncomeLabel: "Total income",
    validityPeriod: "Validity period",
    daysCount: "Days",
    quantityLabel: "Quantity",
    unlimitedQty: "Unlimited",
    buy: "Buy",
    currencyLong: "Tunisian Dinar",
  },
  zh: {
    appName: "TECAI",
    login: "登录",
    register: "注册",
    createAccount: "创建账户",
    phone: "邮箱",
    phoneHint: "输入邮箱",
    countryCode: "国家区号",
    password: "密码",
    showPassword: "显示",
    hidePassword: "隐藏",
    confirmPassword: "确认密码",
    badCredentials: "登录信息错误",
    phoneExists: "邮箱已存在",
    passwordShort: "密码太短",
    passwordMismatch: "两次密码不一致",
    accountCreated: "账户创建成功",
    adminLogin: "管理员登录",
    userLogin: "用户登录",
    adminCredentialsWrong: "管理员信息错误",
    home: "首页",
    products: "产品",
    team: "团队",
    profile: "我的",
    deposit: "充值",
    withdraw: "提现",
    lottery: "抽奖",
    officialSite: "官网",
    help: "帮助",
    app: "应用",
    dailyCheckIn: "每日签到",
    accountBalance: "账户余额",
    todayProfit: "今日收益",
    autoProfitHistory: "设备收益记录",
    noAutoProfit: "暂无设备收益记录。",
    autoProfitTag: "设备自动收益",
    totalDeposit: "累计充值",
    pendingLabel: "笔审核中",
    noProducts: "暂无产品。",
    referral: "邀请链接",
    referralBonus: "邀请奖励",
    referralIncomeDetails: "邀请收入",
    referralDepositIncome: "充值奖励 5%",
    referralProfitIncome: "收益奖励 2.5%",
    brandTagline: "TECAI 智能机器人投资",
    payPassSettings: "提现密码设置",
    logout: "退出",
    language: "语言",
    depositChannels: "充值渠道",
    amount: "金额",
    uploadProof: "上传充值凭证",
    chooseFile: "选择图片或PDF",
    confirmDeposit: "确认充值",
    depositInstructions: "充值说明",
    reviewNotice: "申请已提交，等待管理员审核。",
    reviewPopupTitle: "申请已提交",
    ok: "确定",
    minDeposit: "最低充值为 1 USDT",
    proofRequired: "请上传充值凭证",
    proofUnavailable: "无法预览该凭证，请在新申请中重新上传。",
    copy: "复制",
    copied: "已复制",
    bankCard: "银行卡",
    serviceFeeBank: "服务费: 20%",
    serviceFeeUsdt: "服务费: 20%",
    expectedArrival: "预计到账",
    expectedBank: "预计到账: 0.00 TND",
    expectedUsdt: "预计到账: 0.00 USD",
    selectWithdrawChannel: "选择提现渠道",
    withdrawPassword: "支付密码",
    withdrawAddress: "输入提现地址",
    withdrawBtn: "提现",
    minWithdraw: "最低提现为 2 USDT",
    noBalance: "余额不足",
    withdrawableProfit: "可提现余额",
    withdrawProfitsOnly: "余额不足",
    useMaxProfit: "使用全部余额",
    needPayPassword: "请先在设置里创建提现密码",
    payPasswordRequired: "请输入提现密码",
    payPasswordWrong: "提现密码错误",
    chooseWithdrawChannel: "请选择提现渠道",
    withdrawInstructions: "提现说明",
    addChannel: "添加渠道",
    noChannels: "暂无渠道。",
    bindBank: "绑定银行卡",
    channel: "渠道",
    name: "姓名",
    nameHint: "请输入姓名",
    accountNumber: "银行卡/账户",
    accountHint: "请输入银行卡/账户",
    save: "确认",
    allFieldsRequired: "请填写所有字段",
    channelAdded: "提现渠道添加成功",
    settings: "设置",
    settingsHint: "在此页面创建或修改提现密码。",
    currentPassword: "当前密码",
    newPassword: "新密码",
    confirmNewPassword: "确认新密码",
    savePayPassword: "保存提现密码",
    passwordSaved: "密码保存成功",
    currentPasswordWrong: "当前密码错误",
    pendingOps: "待处理请求",
    noPending: "暂无请求。",
    approve: "通过",
    reject: "拒绝",
    backToUser: "返回用户登录",
    tnd: "TND",
    txHistory: "资金记录",
    noTx: "暂无记录。",
    statusPending: "审核中",
    statusApproved: "已通过",
    statusRejected: "已拒绝",
    typeDeposit: "充值",
    typeWithdraw: "提现",
    viewProof: "查看充值凭证",
    close: "关闭",
    filterAll: "全部",
    filterDeposit: "充值",
    filterWithdraw: "提现",
    filterPending: "审核中",
    filterApproved: "已通过",
    filterRejected: "已拒绝",
    robotPlans: "机器人计划",
    robotPlansHint: "充值金额（最低充值：30 TND）",
    activatePlan: "激活计划",
    myDevices: "我的设备",
    myDevicesTitle: "已激活设备",
    runningNow: "实时运行中",
    purchasedAt: "购买时间",
    runTime: "运行时长",
    liveProfit: "实时收益",
    earnedProfit: "已到账收益",
    remainingProfit: "剩余收益",
    expiresAt: "到期时间",
    completionRate: "完成进度",
    finished: "已完成",
    noDevices: "暂无激活设备。",
    buyAndRun: "购买并运行",
    boughtSuccess: "设备购买成功并已启动。",
    buyNeedBalance: "余额不足，已跳转到充值页面。",
    onSaleNow: "在售中",
    preSale: "预售中",
    preSaleEmpty: "暂无已购买设备。",
    planCost: "成本",
    dailyIncomeLabel: "日收益",
    totalIncomeLabel: "总收益",
    validityPeriod: "有效期",
    daysCount: "天数",
    quantityLabel: "数量",
    unlimitedQty: "不限",
    buy: "购买",
    currencyLong: "突尼斯第纳尔",
  },
} as const;

const DEPOSIT_RULES: Record<Lang, string[]> = {
  ar: [
    "1: الحد الأدنى للإيداع هو 1 USDT، أي إيداع أقل من 1 لن تتم معالجته.",
    "2: سعر الصرف ثابت (1 USDT = 3.4 تند).",
    "3: قبل كل عملية إيداع، يرجى الحصول على أحدث عنوان إيداع لتجنب تأخير أو فقدان الأموال.",
    "4: عند الإيداع USDT (TRC20-BEP20)، يرجى اختيار شبكة التحويل الصحيحة، وإلا فلن يصل الرصيد.",
    "5: بعد اكتمال التحويل سيتم إضافة الرصيد تلقائيا بعد المراجعة.",
  ],
  en: [
    "1: Minimum deposit is 1 USDT. Deposits below 1 are not processed.",
    "2: Exchange rate is fixed (1 USDT = 3.4 TND).",
    "3: Always use the latest deposit address before sending funds.",
    "4: Choose the correct USDT network (TRC20/BEP20), otherwise funds may not arrive.",
    "5: After transfer completion, your request stays pending until admin review.",
  ],
  zh: [
    "1: 最低充值为 1 USDT，低于 1 不处理。",
    "2: 汇率固定 (1 USDT = 3.4 TND)。",
    "3: 每次充值前请使用最新地址，避免延迟或丢失。",
    "4: 充值USDT时请选择正确网络(TRC20/BEP20)。",
    "5: 转账完成后将进入审核，管理员通过后更新余额。",
  ],
};

const WITHDRAW_RULES: Record<Lang, string[]> = {
  ar: [
    "1: يمكن سحب يوميا من الساعة 9:00 إلى 17:00، مرة واحدة فقط في اليوم.",
    "2: الحد الأدنى لمبلغ السحب في كل مرة هو [2USDT].",
    "3: يتم فرض رسوم خدمة بنسبة 20% على كل عملية سحب.",
    "4: بعد تقديم طلب السحب، سيتم وصول الأموال خلال 48 ساعة.",
    "5: إذا فشل السحب، يرجى التحقق من صحة عنوان محفظتك، ثم أعد التقديم.",
    "6: لتفعيل وظيفة السحب، يجب عليك إجراء إيداع واحد على الأقل.",
  ],
  en: [
    "1: Withdrawals are available daily from 09:00 to 17:00, once per day.",
    "2: Minimum withdrawal amount is 2 USDT.",
    "3: A 20% service fee applies to each withdrawal.",
    "4: Funds are expected within 48 hours after submission.",
    "5: If withdrawal fails, verify your destination address and submit again.",
    "6: At least one deposit is required to activate withdrawal.",
  ],
  zh: [
    "1: 每日 09:00-17:00 可提现，每天一次。",
    "2: 最低提现金额为 2 USDT。",
    "3: 每笔提现收取 20% 服务费。",
    "4: 提交后预计 48 小时内到账。",
    "5: 若失败，请检查提现地址后重新提交。",
    "6: 至少完成一次充值后才能提现。",
  ],
};

const ROBOT_PRODUCTS = [
  { code: "A1", price: 30, validityDays: 100, image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=200" },
  { code: "A2", price: 80, validityDays: 100, image: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&q=80&w=200" },
  { code: "A3", price: 230, validityDays: 120, image: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&q=80&w=200" },
  { code: "A4", price: 580, validityDays: 120, image: "https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&q=80&w=200" },
  { code: "A5", price: 1400, validityDays: 150, image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=200" },
  { code: "A6", price: 3200, validityDays: 150, image: "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&q=80&w=200" },
  { code: "A7", price: 7500, validityDays: 180, image: "https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&q=80&w=200" },
  { code: "A8", price: 18000, validityDays: 180, image: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=200" },
  { code: "A9", price: 42000, validityDays: 230, image: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&q=80&w=200" },
].map((plan) => {
  const dailyIncome = Number((plan.price * DAILY_DEVICE_PROFIT_RATE).toFixed(4));
  return {
    ...plan,
    dailyIncome,
    totalIncome: Number((dailyIncome * plan.validityDays).toFixed(4)),
  };
});

const INTRO_CONTENT: Record<Lang, { title: string; lines: string[] }> = {
  ar: {
    title: "كيف يعمل التطبيق",
    lines: [
      "1. قم بالتسجيل ثم اختر خطة روبوت من صفحة المنتج.",
      "2. إذا كان الرصيد غير كاف، أرسل طلب إيداع مع إثبات التحويل.",
      "3. بعد تقديم السحب أو الإيداع تظهر الحالة: قيد المراجعة حتى موافقة الإدارة.",
      "4. يمكنك متابعة كل العمليات من صفحة أنا > سجل العمليات المالية.",
    ],
  },
  en: {
    title: "How The App Works",
    lines: [
      "1. Register, then choose a robot plan from the Products page.",
      "2. If your balance is low, submit a deposit request with transfer proof.",
      "3. Deposit and withdrawal requests stay pending until admin approval.",
      "4. Track all operations from Me > Financial history.",
    ],
  },
  zh: {
    title: "应用使用说明",
    lines: [
      "1. 注册后，在产品页选择机器人计划。",
      "2. 余额不足时，上传转账凭证并提交充值申请。",
      "3. 充值和提现提交后会显示审核中，等待管理员处理。",
      "4. 在我的 > 资金记录中可查看全部进度。",
    ],
  },
};

const DEVICE_PAYOUT_INTERVAL_MS = 24 * 60 * 60 * 1000;

function getDeviceLifecycle(device: OwnedDevice, nowMs: number) {
  const parsedPurchasedAtMs = new Date(device.purchasedAt).getTime();
  const purchasedAtMs = Number.isFinite(parsedPurchasedAtMs) ? parsedPurchasedAtMs : nowMs;
  const validDays = Math.max(1, Number(device.validityDays || 0));
  const endAtMs = purchasedAtMs + validDays * DEVICE_PAYOUT_INTERVAL_MS;
  const effectiveNow = Math.min(nowMs, endAtMs);
  return { purchasedAtMs, endAtMs, effectiveNow };
}

function formatAmount(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatPlanNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(value);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function isAlreadyRegisteredAuthError(message: string) {
  const value = message.toLowerCase();
  return value.includes("already") || value.includes("registered") || value.includes("exists");
}

function parseReferralFromLocation() {
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("ref");
    if (fromQuery) return normalizePhone(fromQuery);

    const inviteMatch = window.location.pathname.match(/\/invite\/([^/?#]+)/i);
    if (inviteMatch?.[1]) {
      return normalizePhone(decodeURIComponent(inviteMatch[1]));
    }
  } catch {
    return "";
  }
  return "";
}

function createUniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseAmountInput(value: string) {
  const normalized = value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/,/g, ".")
    .trim();
  return Number(normalized);
}



function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file_read_error"));
    reader.readAsDataURL(file);
  });
}

function normalizeProofUrl(raw?: string) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("data:application/pdf")) return value;
  if (value.startsWith("blob:")) return value;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  return "";
}

function isImageProofUrl(value: string) {
  const lower = value.toLowerCase();
  return lower.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lower);
}



export default function App() {
  const [lang, setLang] = useState<Lang>(() => loadJson<Lang>("tecai:lang", "ar"));
  const [session, setSession] = useState<Session>(() => loadJson<Session>("tecai:session", null));
  const [accounts, setAccounts] = useState<Record<string, UserAccount>>(() => loadJson("tecai:accounts", {}));
  const [balances, setBalances] = useState<Record<string, number>>(() => loadJson("tecai:balances", {}));
  const [txs, setTxs] = useState<Transaction[]>(() => loadJson("tecai:txs", []));
  const [devices, setDevices] = useState<OwnedDevice[]>(() => loadJson("tecai:devices", []));
  const [profitRecords, setProfitRecords] = useState<ProfitRecord[]>(() => loadJson("tecai:profit-records", []));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadJson("tecai:notifications", []));
  const [clockNow, setClockNow] = useState(() => Date.now());
  const hasLoadedCloudRef = useRef(false);

  const [route, setRoute] = useState<Route>("home");
  const [mainTab, setMainTab] = useState<MainTab>("home");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const [productMode, setProductMode] = useState<"onSale" | "preSale">("onSale");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [selectedUserEmail, setSelectedUserEmail] = useState("");

  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthConfirmPassword, setShowAuthConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingReferralEmail, setPendingReferralEmail] = useState<string>(() => loadJson("tecai:pending-ref", ""));

  const [adminPhone, setAdminPhone] = useState(ADMIN_PHONE);
  const [adminPass, setAdminPass] = useState("");

  const [depositChannel, setDepositChannel] = useState<DepositChannel>("TRC20");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReceipt, setDepositReceipt] = useState<File | null>(null);

  const [withdrawType, setWithdrawType] = useState<WithdrawType>("bank");
  const [withdrawNetwork, setWithdrawNetwork] = useState<WithdrawNetwork>("TRC20");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [paymentPasswordInput, setPaymentPasswordInput] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [showSheet, setShowSheet] = useState(false);

  const [bindProvider, setBindProvider] = useState<WithdrawProvider>("Bank");
  const [bindName, setBindName] = useState("");
  const [bindPhone, setBindPhone] = useState("");
  const [bindAccount, setBindAccount] = useState("");

  const [oldPayPassword, setOldPayPassword] = useState("");
  const [newPayPassword, setNewPayPassword] = useState("");
  const [confirmPayPassword, setConfirmPayPassword] = useState("");
  const accountsRef = useRef(accounts);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapFromSupabase() {
      if (!isSupabaseConfigured) {
        hasLoadedCloudRef.current = true;
        return;
      }

      try {
        // Load data from separate tables when user is logged in
        const currentSession = JSON.parse(localStorage.getItem("tecai:session") || "null");
        if (currentSession?.role === "user" && currentSession?.email) {
          const [balancesData, txsData, devicesData, profitsData] = await Promise.all([
            getBalance(currentSession.email),
            getTransactions(currentSession.email),
            getDevices(currentSession.email),
            getProfits(currentSession.email),
          ]);
          
          if (balancesData) {
            setBalances(prev => ({ ...prev, [currentSession.email]: balancesData.balance }));
          }
          if (txsData) {
            setTxs(txsData.map(tx => ({
              ...tx,
              phone: tx.email,
              receiptName: tx.receipt_url?.split('/').pop(),
            })));
          }
          if (devicesData) {
            setDevices(devicesData.map(d => ({
              ...d,
              email: d.email,
              planCode: d.plan_code,
              planPrice: d.plan_price,
              dailyIncome: d.daily_income,
              totalIncome: d.total_income,
              validityDays: d.validity_days,
              purchasedAt: d.purchased_at,
              earnedAmount: d.earned_amount,
              lastPayoutAt: d.last_payout_at,
              image: `/images/robot-${d.plan_price}.png`,
            })));
          }
          if (profitsData) {
            setProfitRecords(profitsData.map(p => ({
              ...p,
              email: p.email,
              deviceId: p.device_id,
              createdAt: p.created_at,
            })));
          }
        }
      } catch {
        // App continues on local storage when cloud sync is unavailable.
      } finally {
        if (!cancelled) hasLoadedCloudRef.current = true;
      }
    }

    void bootstrapFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const applyAuthSession = (authSession: any) => {
      const emailFromAuth = authSession?.user?.email ?? "";
      if (emailFromAuth) {
        setSession((prev) => (prev?.role === "admin" ? prev : { role: "user", email: emailFromAuth }));
      } else {
        setSession((prev) => (prev?.role === "admin" ? prev : null));
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      applyAuthSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      applyAuthSession(authSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => localStorage.setItem("tecai:lang", JSON.stringify(lang)), [lang]);
  useEffect(() => localStorage.setItem("tecai:session", JSON.stringify(session)), [session]);
  useEffect(() => localStorage.setItem("tecai:accounts", JSON.stringify(accounts)), [accounts]);
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);
  useEffect(() => localStorage.setItem("tecai:balances", JSON.stringify(balances)), [balances]);
  useEffect(() => localStorage.setItem("tecai:txs", JSON.stringify(txs)), [txs]);
  useEffect(() => localStorage.setItem("tecai:devices", JSON.stringify(devices)), [devices]);
  useEffect(() => localStorage.setItem("tecai:profit-records", JSON.stringify(profitRecords)), [profitRecords]);
  useEffect(() => localStorage.setItem("tecai:notifications", JSON.stringify(notifications)), [notifications]);
  useEffect(() => localStorage.setItem("tecai:pending-ref", JSON.stringify(pendingReferralEmail)), [pendingReferralEmail]);

  useEffect(() => {
    const incomingRef = parseReferralFromLocation();
    if (!incomingRef || incomingRef === ADMIN_PHONE || incomingRef === ADMIN_PHONE_WITH_CODE) return;
    setPendingReferralEmail((prev) => (prev || incomingRef));
  }, []);

  // Data is now saved directly to Supabase tables on each operation

  useEffect(() => {
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function processDevicePayouts() {
      const now = Date.now();
      const creditedRecords: ProfitRecord[] = [];
      const referralBonusTxs: Transaction[] = [];

      setDevices((prevDevices) => {
        let changed = false;
        const nextDevices = prevDevices.map((device) => {
          const { effectiveNow } = getDeviceLifecycle(device, now);
          const payoutBase = new Date(device.lastPayoutAt ?? device.purchasedAt).getTime();
          const elapsed = effectiveNow - payoutBase;
          const cycles = Math.floor(elapsed / DEVICE_PAYOUT_INTERVAL_MS);
          if (cycles <= 0) return device;

          changed = true;
          const earnedSoFar = device.earnedAmount ?? 0;
          const remaining = Math.max(0, Number((device.totalIncome - earnedSoFar).toFixed(4)));
          const rawPayout = Number((cycles * device.dailyIncome).toFixed(4));
          const payoutAmount = Number(Math.min(rawPayout, remaining).toFixed(4));

          if (payoutAmount > 0) {
              creditedRecords.push({
                id: createUniqueId(`pr_${device.id}`),
              email: device.email,
              deviceId: device.id,
              amount: payoutAmount,
              cycles,
              createdAt: new Date(now).toISOString(),
            });
          }

          return {
            ...device,
            earnedAmount: Number((earnedSoFar + payoutAmount).toFixed(4)),
            lastPayoutAt: new Date(Math.min(effectiveNow, payoutBase + cycles * DEVICE_PAYOUT_INTERVAL_MS)).toISOString(),
          };
        });

        return changed ? nextDevices : prevDevices;
      });

      if (creditedRecords.length === 0) return;

      setProfitRecords((prev) => [...creditedRecords, ...prev]);
      setBalances((prev) => {
        const next = { ...prev };
        for (const record of creditedRecords) {
          next[record.email] = Number(((next[record.email] ?? 0) + record.amount).toFixed(4));

          const inviterEmail = accountsRef.current[record.email]?.referredBy;
          if (inviterEmail && inviterEmail !== record.email) {
            const referralProfitBonus = Number((record.amount * REFERRAL_PROFIT_RATE).toFixed(4));
            if (referralProfitBonus > 0) {
              next[inviterEmail] = Number(((next[inviterEmail] ?? 0) + referralProfitBonus).toFixed(4));
              referralBonusTxs.push({
                id: createUniqueId("tx_ref_profit"),
                email: inviterEmail,
                type: "deposit",
                amount: referralProfitBonus,
                method: "Referral 2.5% profit bonus",
                status: "approved",
                payoutDetails: `From ${record.email}`,
                createdAt: new Date(now).toISOString(),
              });
            }
          }
        }
        return next;
      });

      if (referralBonusTxs.length > 0) {
        setTxs((prev) => [...referralBonusTxs, ...prev]);
      }
    }

    processDevicePayouts();
    const id = window.setInterval(processDevicePayouts, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (session?.role === "user") {
      setIntroOpen(true);
    } else {
      setIntroOpen(false);
    }
  }, [session?.role]);

  const isAdminPath = window.location.hash === "#admin";
  const t = DICT[lang];
  const isRtl = lang === "ar";
  const currentEmail = session?.email ?? "";
  const currentAccount = currentEmail ? accounts[currentEmail] : undefined;
  const balance = balances[currentEmail] ?? 0;
  const pendingCount = txs.filter((x) => x.email === currentEmail && x.status === "pending").length;
  const depositDestination = DESTINATIONS[depositChannel];
  const withdrawChannels = currentAccount?.channels ?? [];
  const userDevices = devices.filter((device) => device.email === currentEmail);

  const selectedChannel = useMemo(
    () => withdrawChannels.find((x) => x.id === selectedChannelId),
    [withdrawChannels, selectedChannelId],
  );

  const approvedDepositTotal = txs
    .filter((x) => x.email === currentEmail && x.type === "deposit" && x.status === "approved")
    .reduce((sum, x) => sum + x.amount, 0);

  const userProfitRecords = profitRecords.filter((record) => record.email === currentEmail);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const todayProfitFromRecords = userProfitRecords
    .filter((record) => new Date(record.createdAt).getTime() >= startOfToday.getTime())
    .reduce((sum, record) => sum + record.amount, 0);
  const todayLiveUncreditedProfit = userDevices.reduce((sum, device) => {
    const { purchasedAtMs, effectiveNow } = getDeviceLifecycle(device, clockNow);
    const payoutBaseMs = new Date(device.lastPayoutAt ?? device.purchasedAt).getTime();
    const accrualStartMs = Math.max(startOfTodayMs, purchasedAtMs, Number.isFinite(payoutBaseMs) ? payoutBaseMs : purchasedAtMs);
    const elapsedMs = Math.max(0, effectiveNow - accrualStartMs);
    if (elapsedMs <= 0) return sum;

    const rawLiveProfit = (elapsedMs / DEVICE_PAYOUT_INTERVAL_MS) * Number(device.dailyIncome || 0);
    const earnedSoFar = Number(device.earnedAmount ?? 0);
    const remaining = Math.max(0, Number(device.totalIncome || 0) - earnedSoFar);
    const safeLiveProfit = Math.min(rawLiveProfit, remaining);
    return sum + (Number.isFinite(safeLiveProfit) ? safeLiveProfit : 0);
  }, 0);
  const todayProfit = Number((todayProfitFromRecords + todayLiveUncreditedProfit).toFixed(4));

  const userTxs = txs.filter((x) => x.email === currentEmail);
  const referralLink = `${window.location.origin}?ref=${encodeURIComponent(currentEmail)}`;
  const teamCount = Object.entries(accounts).filter(([, account]) => account.referredBy === currentEmail).length;
  const referralDepositBonusTotal = txs
    .filter((tx) => tx.email === currentEmail && tx.status === "approved" && tx.method === "Referral 5% deposit bonus")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const referralBonusTotal = txs
    .filter((tx) => tx.email === currentEmail && tx.status === "approved" && tx.method.startsWith("Referral "))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const withdrawAmountValue = parseAmountInput(withdrawAmount);
  const validWithdrawAmount = Number.isFinite(withdrawAmountValue) && withdrawAmountValue > 0 ? withdrawAmountValue : 0;
  const withdrawServiceFeeAmount = Number((validWithdrawAmount * WITHDRAW_SERVICE_FEE_RATE).toFixed(4));
  const withdrawExpectedAmount = Number(Math.max(0, validWithdrawAmount - withdrawServiceFeeAmount).toFixed(4));
  const filteredUserTxs = useMemo(() => {
    if (txFilter === "all") return userTxs;
    if (txFilter === "deposit") return userTxs.filter((x) => x.type === "deposit");
    if (txFilter === "withdraw") return userTxs.filter((x) => x.type === "withdraw");
    return userTxs.filter((x) => x.status === txFilter);
  }, [txFilter, userTxs]);

  function statusLabel(status: Transaction["status"]) {
    if (status === "approved") return t.statusApproved;
    if (status === "rejected") return t.statusRejected;
    return t.statusPending;
  }

  function typeLabel(type: Transaction["type"]) {
    return type === "deposit" ? t.typeDeposit : t.typeWithdraw;
  }

  function resetAuthFields() {
    setEmailInput("");
    setPassword("");
    setConfirmPassword("");
    setShowAuthPassword(false);
    setShowAuthConfirmPassword(false);
  }

  function resetWithdrawForm() {
    setWithdrawType("bank");
    setWithdrawNetwork("TRC20");
    setWithdrawAmount("");
    setWithdrawAddress("");
    setPaymentPasswordInput("");
    setSelectedChannelId("");
    setShowSheet(false);
  }

  async function onUserAuthSubmit() {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setNotice(t.badCredentials);
      return;
    }

    if (authMode === "register") {
      if (password.length < 4) {
        setNotice(t.passwordShort);
        return;
      }
      if (password !== confirmPassword) {
        setNotice(t.passwordMismatch);
        return;
      }
      if (accounts[email]) {
        setNotice(t.phoneExists);
        return;
      }

      if (isSupabaseConfigured && supabase) {
        const signUpRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { email },
          },
        });

        if (signUpRes.error) {
          if (isAlreadyRegisteredAuthError(signUpRes.error.message)) {
            setNotice(t.phoneExists);
          } else {
            setNotice(signUpRes.error.message || t.badCredentials);
          }
          return;
        }

        const signInRes = await supabase.auth.signInWithPassword({ email, password });
        if (signInRes.error) {
          setNotice(signInRes.error.message || t.badCredentials);
          return;
        }
      }

      const normalizedRef = pendingReferralEmail.trim().toLowerCase();
      const referralOwner = Object.keys(accounts).find((accEmail) => accEmail.toLowerCase() === normalizedRef);
      const referredBy = referralOwner && referralOwner !== email ? referralOwner : undefined;

      setAccounts((prev) => ({
        ...prev,
        [email]: { loginPassword: password, channels: [], referredBy },
      }));
      setBalances((prev) => ({ ...prev, [email]: prev[email] ?? 0 }));
      setNotice(t.accountCreated);
      setPendingReferralEmail("");
      setAuthMode("login");
      resetAuthFields();
      return;
    }

    const isAdmin = email === ADMIN_PHONE || email === ADMIN_PHONE_WITH_CODE || (email === "admin@tecai.app");
    if (isAdmin && password === ADMIN_PASSWORD) {
      setSession({ role: "admin", email: "admin@tecai.app" });
      setRoute("home");
      setMainTab("home");
      resetAuthFields();
      return;
    }

    const account = accounts[email];

    if (isSupabaseConfigured && supabase) {
      let signInRes = await supabase.auth.signInWithPassword({ email, password });

      if (signInRes.error && account?.loginPassword === password) {
        const signUpRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { email },
          },
        });

        if (!signUpRes.error || isAlreadyRegisteredAuthError(signUpRes.error.message)) {
          signInRes = await supabase.auth.signInWithPassword({ email, password });
        }
      }

      if (signInRes.error) {
        setNotice(t.badCredentials);
        return;
      }
    } else if (!account || account.loginPassword !== password) {
      setNotice(t.badCredentials);
      return;
    }

    if (!account) {
      setAccounts((prev) => ({
        ...prev,
        [email]: { loginPassword: password, channels: [] },
      }));
      setBalances((prev) => ({ ...prev, [email]: prev[email] ?? 0 }));
    }

    setSession({ role: "user", email });
    setRoute("home");
    setMainTab("home");
    resetAuthFields();
  }

  function onAdminLogin() {
    const normalizedAdminPhone = normalizePhone(adminPhone);
    const isAdminPhone = normalizedAdminPhone === ADMIN_PHONE || normalizedAdminPhone === ADMIN_PHONE_WITH_CODE;
    if (!isAdminPhone || adminPass !== ADMIN_PASSWORD) {
      setNotice(t.adminCredentialsWrong);
      return;
    }
    setSession({ role: "admin", email: "admin@tecai.app" });
    setAdminPass("");
  }

  function logout() {
    if (session?.role === "user" && isSupabaseConfigured && supabase) {
      void supabase.auth.signOut();
    }
    setSession(null);
    localStorage.setItem("tecai:session", JSON.stringify(null));
    setRoute("home");
    setMainTab("home");
    setAuthMode("login");
    setIntroOpen(false);
    setShowSheet(false);
    setReviewDialogOpen(false);
    setProofPreviewUrl("");
    resetWithdrawForm();
  }

  function openTelegramHelp() {
    const telegramUrl = "https://t.me/tecaipro";
    window.open(telegramUrl, "_blank", "noopener,noreferrer");
  }

  function openProofPreview(rawUrl?: string) {
    const safeUrl = normalizeProofUrl(rawUrl);
    if (!safeUrl) {
      setNotice(t.proofUnavailable);
      return;
    }
    setProofPreviewUrl(safeUrl);
  }

  async function submitDeposit() {
    const amount = parseAmountInput(depositAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      setNotice(t.minDeposit);
      return;
    }
    if (!depositReceipt) {
      setNotice(t.proofRequired);
      return;
    }

    let receiptDataUrl = "";
    try {
      receiptDataUrl = await fileToDataUrl(depositReceipt);
    } catch {
      setNotice(t.proofRequired);
      return;
    }

    const tx: Transaction = {
      id: createUniqueId("tx"),
      email: currentEmail,
      type: "deposit",
      amount,
      method: depositChannel,
      status: "pending",
      receiptName: depositReceipt.name,
      receiptDataUrl,
      createdAt: new Date().toISOString(),
    };
    setTxs((prev) => [tx, ...prev]);
    setDepositAmount("");
    setDepositReceipt(null);
    setReviewDialogOpen(true);
  }

  function submitWithdraw() {
    const amount = parseAmountInput(withdrawAmount);
    if (!Number.isFinite(amount) || amount < 2) {
      setNotice(t.minWithdraw);
      return;
    }
    if (amount > balance) {
      setNotice(t.withdrawProfitsOnly);
      return;
    }
    if (!currentAccount?.paymentPassword) {
      setNotice(t.needPayPassword);
      return;
    }
    if (!paymentPasswordInput) {
      setNotice(t.payPasswordRequired);
      return;
    }
    if (currentAccount.paymentPassword !== paymentPasswordInput) {
      setNotice(t.payPasswordWrong);
      return;
    }

    let payoutDetails = "";
    let method = "";

    if (withdrawType === "bank") {
      if (!selectedChannel) {
        setNotice(t.chooseWithdrawChannel);
        return;
      }
      method = selectedChannel.provider;
      payoutDetails = `${selectedChannel.holderName} | ${selectedChannel.accountNumber} | ${selectedChannel.email}`;
    } else {
      if (!withdrawAddress.trim()) {
        setNotice(t.withdrawAddress);
        return;
      }
      method = `USDT-${withdrawNetwork}`;
      payoutDetails = withdrawAddress.trim();
    }

    const tx: Transaction = {
      id: createUniqueId("tx"),
      email: currentEmail,
      type: "withdraw",
      amount,
      method,
      payoutDetails,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setTxs((prev) => [tx, ...prev]);
    resetWithdrawForm();
    setReviewDialogOpen(true);
  }

  function saveWithdrawalChannel() {
    if (!bindName.trim() || !bindPhone.trim() || !bindAccount.trim()) {
      setNotice(t.allFieldsRequired);
      return;
    }
    const nextChannel: WithdrawalChannel = {
      id: createUniqueId("ch"),
      provider: bindProvider,
      holderName: bindName.trim(),
      email: bindPhone.trim(),
      accountNumber: bindAccount.trim(),
    };

    setAccounts((prev) => ({
      ...prev,
      [currentEmail]: {
        ...(prev[currentEmail] as UserAccount),
        channels: [...(prev[currentEmail]?.channels ?? []), nextChannel],
      },
    }));

    setSelectedChannelId(nextChannel.id);
    setBindName("");
    setBindPhone("");
    setBindAccount("");
    setRoute("withdraw");
    setNotice(t.channelAdded);
  }

  function savePaymentPassword() {
    const acc = accounts[currentEmail];
    if (!newPayPassword || !confirmPayPassword) {
      setNotice(t.allFieldsRequired);
      return;
    }
    if (newPayPassword.length < 4) {
      setNotice(t.passwordShort);
      return;
    }
    if (newPayPassword !== confirmPayPassword) {
      setNotice(t.passwordMismatch);
      return;
    }
    if (acc.paymentPassword && oldPayPassword !== acc.paymentPassword) {
      setNotice(t.currentPasswordWrong);
      return;
    }

    setAccounts((prev) => ({
      ...prev,
      [currentEmail]: {
        ...(prev[currentEmail] as UserAccount),
        paymentPassword: newPayPassword,
      },
    }));
    setOldPayPassword("");
    setNewPayPassword("");
    setConfirmPayPassword("");
    setNotice(t.passwordSaved);
  }

  async function sendNotification() {
    if (!selectedUserEmail || !notificationTitle || !notificationMessage) {
      setNotice("يرجى تعبئة جميع الحقول");
      return;
    }
    const newNotification: Notification = {
      id: createUniqueId("notif"),
      email: selectedUserEmail,
      title: notificationTitle,
      message: notificationMessage,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
    
    // Save to Supabase
    await createNotificationInDb({
      email: selectedUserEmail,
      title: notificationTitle,
      message: notificationMessage,
    });
    
    setSelectedUserEmail("");
    setNotificationTitle("");
    setNotificationMessage("");
    setNotice("تم إرسال الإشعار بنجاح");
  }

  async function deleteNotification(notifId: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    await deleteNotifInDb(notifId);
  }

  async function handleMarkNotificationAsRead(notifId: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
    await markNotifReadInDb(notifId);
  }

  const unreadNotificationsCount = notifications.filter(
    (n) => n.email === currentEmail && !n.read
  ).length;

  function updateTxStatus(txId: string, next: "approved" | "rejected") {
    const target = txs.find((x) => x.id === txId);
    if (!target || target.status !== "pending") return;

    setTxs((prev) => prev.map((x) => (x.id === txId ? { ...x, status: next } : x)));

    if (next === "approved") {
      const referralBonusTxs: Transaction[] = [];
      setBalances((prev) => {
        const before = prev[target.email] ?? 0;
        const after = target.type === "deposit" ? before + target.amount : Math.max(0, before - target.amount);
        const nextBalances = { ...prev, [target.email]: after };

        if (target.type === "deposit") {
          const inviterEmail = accounts[target.email]?.referredBy;
          if (inviterEmail && inviterEmail !== target.email) {
            const referralBonus = Number((target.amount * REFERRAL_DEPOSIT_RATE).toFixed(4));
            if (referralBonus > 0) {
              nextBalances[inviterEmail] = Number(((nextBalances[inviterEmail] ?? 0) + referralBonus).toFixed(4));
              referralBonusTxs.push({
                id: createUniqueId("tx_ref_dep"),
                email: inviterEmail,
                type: "deposit",
                amount: referralBonus,
                method: "Referral 5% deposit bonus",
                status: "approved",
                payoutDetails: `From ${target.email}`,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }

        return nextBalances;
      });

      if (referralBonusTxs.length > 0) {
        setTxs((prev) => [...referralBonusTxs, ...prev]);
      }
    }
  }

  function openUserTab(tab: MainTab) {
    setRoute("home");
    setMainTab(tab);
  }

  function activateProductPlan(plan: (typeof ROBOT_PRODUCTS)[number]) {
    if (balance < plan.price) {
      setDepositAmount(String(plan.price));
      setRoute("deposit");
      setNotice(t.buyNeedBalance);
      return;
    }

    const nextDevice: OwnedDevice = {
      id: createUniqueId("dv"),
      email: currentEmail,
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

    setBalances((prev) => ({
      ...prev,
      [currentEmail]: Math.max(0, (prev[currentEmail] ?? 0) - plan.price),
    }));
    setDevices((prev) => [nextDevice, ...prev]);
    setNotice(t.boughtSuccess);
    setRoute("devices");
  }

  if (!session) {
    const showAdmin = isAdminPath;
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="relative min-h-screen text-zinc-900">
        <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
        </div>
        
        <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-3xl border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">{showAdmin ? t.adminLogin : t.userLogin}</p>
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs outline-none">
                <option value="ar">AR</option>
                <option value="en">EN</option>
                <option value="zh">中文</option>
              </select>
            </div>

            <div className="mb-8 text-center">
              <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-5xl font-black tracking-tighter text-transparent">{DICT[lang].appName}</h1>
              <p className="mt-2 text-sm text-zinc-600">{t.brandTagline}</p>
            </div>

            {showAdmin ? (
              <div className="space-y-4">
                <input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500" placeholder={t.phone} />
                <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500" placeholder={t.password} />
                <button onClick={onAdminLogin} className="w-full rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-white shadow-lg transition-transform active:scale-95">{t.login}</button>
                <button
                  onClick={() => {
                    window.location.hash = "";
                    setNotice("");
                  }}
                  className="w-full rounded-2xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600"
                >
                  {t.backToUser}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder={t.phoneHint} />
                <div className="relative">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 pe-12 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((prev) => !prev)}
                    className="absolute inset-y-0 end-4 flex items-center text-zinc-400"
                  >
                    <EyeIcon closed={showAuthPassword} />
                  </button>
                </div>
                {authMode === "register" && (
                  <div className="relative">
                    <input
                      type={showAuthConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 pe-12 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t.confirmPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 end-4 flex items-center text-zinc-400"
                    >
                      <EyeIcon closed={showAuthConfirmPassword} />
                    </button>
                  </div>
                )}
                <button onClick={onUserAuthSubmit} className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95">{authMode === "login" ? t.login : t.createAccount}</button>
                <button onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))} className="w-full rounded-2xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600">
                  {authMode === "login" ? t.register : t.login}
                </button>
              </div>
            )}

            {notice && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">{notice}</div>}
          </motion.div>
        </div>
      </div>
    );
  }

  if (session.role === "admin") {
    const pending = txs.filter((x) => x.status === "pending");
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-zinc-50 text-zinc-900">
        <main className="mx-auto w-full max-w-3xl px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tight">{t.pendingOps}</h1>
            <button onClick={logout} className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95">{t.logout}</button>
          </div>

          {pending.length === 0 && <p className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-sm font-medium text-zinc-400">{t.noPending}</p>}

          <div className="space-y-4">
            {pending.map((tx) => (
              <div key={tx.id} className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${tx.type === 'deposit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {typeLabel(tx.type)}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(tx.createdAt).toLocaleString()}</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Email المستخدم</p>
                    <p className="text-sm font-black text-blue-700 break-all">{tx.email}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-500">{t.amount}:</p>
                    <p className="text-lg font-black text-blue-600">{formatAmount(tx.amount)} {t.tnd}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-500">{t.channel}:</p>
                    <p className="text-sm font-bold text-zinc-700">{tx.method}</p>
                  </div>
                </div>
                {tx.receiptName && (
                  <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                    <p className="text-xs font-bold text-zinc-500">{t.uploadProof}: {tx.receiptName}</p>
                    {tx.receiptDataUrl && (
                      <button onClick={() => openProofPreview(tx.receiptDataUrl)} className="mt-2 w-full rounded-xl bg-white py-2 text-xs font-bold shadow-sm ring-1 ring-zinc-200">
                        {t.viewProof}
                      </button>
                    )}
                  </div>
                )}
                {tx.payoutDetails && <p className="mt-2 break-words text-xs text-zinc-500 font-mono bg-zinc-50 p-2 rounded-lg">{tx.payoutDetails}</p>}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button onClick={() => updateTxStatus(tx.id, "approved")} className="rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform active:scale-95">{t.approve}</button>
                  <button onClick={() => updateTxStatus(tx.id, "rejected")} className="rounded-2xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition-transform active:scale-95">{t.reject}</button>
                </div>
              </div>
            ))}
          </div>

          {/* قسم إرسال الإشعارات */}
          <div className="mt-8">
            <h2 className="text-xl font-black tracking-tight mb-4">إرسال إشعار لمستخدم</h2>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">اختر المستخدم</label>
                <select
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium bg-zinc-50"
                >
                  <option value="">-- اختر مستخدم --</option>
                  {Object.keys(accounts).map((email) => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">عنوان الإشعار</label>
                <input
                  type="text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="مثال: عرض خاص، تذكير، إلخ..."
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium bg-zinc-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">نص الرسالة</label>
                <textarea
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  rows={4}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium bg-zinc-50 resize-none"
                />
              </div>
              <button
                onClick={sendNotification}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/30"
              >
                إرسال الإشعار
              </button>
            </div>
          </div>
        </main>

        <AnimatePresence>
          {proofPreviewUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
              onClick={() => setProofPreviewUrl("")}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl rounded-3xl bg-white p-4"
                onClick={(e) => e.stopPropagation()}
              >
                {isImageProofUrl(proofPreviewUrl) ? (
                  <img src={proofPreviewUrl} alt="proof" className="max-h-[80vh] w-full rounded-2xl object-contain" />
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <p className="text-sm font-bold text-amber-700">{t.proofUnavailable}</p>
                  </div>
                )}
                <button onClick={() => setProofPreviewUrl("")} className="mt-4 w-full rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-white">{t.close}</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto min-h-screen w-full max-w-xl pb-24 shadow-sm bg-white">
        <header className="flex items-center justify-between px-6 py-5 sticky top-0 bg-white/80 backdrop-blur-lg z-10">
          {route !== "home" ? (
            <button onClick={() => setRoute("home")} className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 text-xl font-bold">←</button>
          ) : (
            <div className="w-10" />
          )}
          <h1 className="text-xl font-black tracking-tight">
            {route === "home"
              ? DICT[lang].appName
              : route === "deposit"
                ? t.deposit
                : route === "withdraw"
                  ? t.withdraw
                  : route === "bind-bank"
                    ? t.bindBank
                    : route === "devices"
                      ? t.myDevices
                      : t.settings}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-zinc-700">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
            <button onClick={logout} className="px-4 py-2 rounded-full bg-red-50 text-red-600 font-bold text-sm border border-red-200 hover:bg-red-100">خروج</button>
          </div>
        </header>

        {notice && <div className="mx-6 mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">{notice}</div>}

        {/* قائمة الإشعارات */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-6 mb-4 rounded-3xl border border-zinc-200 bg-white shadow-xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">الإشعارات</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-white/80 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.filter((n) => n.email === currentEmail).length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-zinc-400">لا توجد إشعارات</p>
                  </div>
                ) : (
                  notifications
                    .filter((n) => n.email === currentEmail)
                    .map((notif) => (
                      <div
                        key={notif.id}
                        className={`border-b border-zinc-100 p-4 ${!notif.read ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-bold ${!notif.read ? 'text-blue-700' : 'text-zinc-800'}`}>
                                {notif.title}
                              </h4>
                              {!notif.read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-600 mt-1">{notif.message}</p>
                            <p className="text-xs text-zinc-400 mt-2">
                              {new Date(notif.createdAt).toLocaleString('ar-TN')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {!notif.read && (
                              <button
                                onClick={() => handleMarkNotificationAsRead(notif.id)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700"
                              >
                                تحديد كمقروء
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notif.id)}
                              className="text-xs font-bold text-red-600 hover:text-red-700"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {route === "home" && (
            <motion.section key={`home-${mainTab}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 px-6">
              {mainTab === "home" && (
                <>
                  <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-xl shadow-blue-500/20">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">{t.accountBalance}</p>
                        <h2 className="text-4xl font-black">{formatAmount(balance)} <span className="text-xl opacity-80">{t.tnd}</span></h2>
                      </div>
                      <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">TE</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-blue-100 uppercase mb-1">{t.todayProfit}</p>
                        <p className="text-xl font-black">+{formatAmount(todayProfit)}</p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-blue-100 uppercase mb-1">{t.totalDeposit}</p>
                        <p className="text-xl font-black">{formatAmount(approvedDepositTotal)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <button onClick={() => setRoute("deposit")} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shadow-sm">💳</div>
                      <span className="text-[11px] font-bold text-zinc-500">{t.deposit}</span>
                    </button>
                    <button onClick={() => setRoute("withdraw")} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shadow-sm">👛</div>
                      <span className="text-[11px] font-bold text-zinc-500">{t.withdraw}</span>
                    </button>
                    <button onClick={openTelegramHelp} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-sm">💬</div>
                      <span className="text-[11px] font-bold text-zinc-500">{t.help}</span>
                    </button>
                    <button onClick={() => setRoute("devices")} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-sm">🤖</div>
                      <span className="text-[11px] font-bold text-zinc-500">{t.myDevices}</span>
                    </button>
                  </div>

                  {pendingCount > 0 && <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <p className="text-xs font-bold text-amber-700">{pendingCount} {t.pendingLabel}</p>
                  </div>}

                  <div className="rounded-3xl overflow-hidden relative group">
                    <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800" alt="banner" className="w-full h-48 object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6">
                      <h3 className="text-white text-xl font-black mb-1">{t.brandTagline}</h3>
                      <p className="text-white/70 text-xs font-medium">Join 50,000+ active investors using AI</p>
                    </div>
                  </div>
                </>
              )}

              {mainTab === "products" && (
                <div className="space-y-6">
                  <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
                    <button
                      onClick={() => setProductMode("onSale")}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${productMode === "onSale" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
                    >
                      {t.onSaleNow}
                    </button>
                    <button
                      onClick={() => setProductMode("preSale")}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${productMode === "preSale" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
                    >
                      {t.preSale}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {productMode === "onSale" ? ROBOT_PRODUCTS.map((item) => (
                      <div key={item.code} className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex gap-5">
                          <img src={item.image} alt={item.code} className="h-32 w-28 rounded-2xl object-cover bg-zinc-100" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-xl font-black">{item.code}</h3>
                              <span className="text-[10px] font-black px-2 py-1 bg-blue-50 text-blue-600 rounded-full uppercase tracking-tighter">AI Robot</span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-2">
                              <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.dailyIncomeLabel}</p>
                                <p className="text-sm font-black text-emerald-600">+{formatAmount(item.dailyIncome)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.validityPeriod}</p>
                                <p className="text-sm font-black">{item.validityDays} {t.daysCount}</p>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="flex flex-col">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.planCost}</p>
                                <p className="text-2xl font-black text-zinc-900">{formatPlanNumber(item.price)} <span className="text-xs font-bold opacity-40">{t.tnd}</span></p>
                              </div>
                              <button
                                onClick={() => activateProductPlan(item)}
                                className="px-6 py-3 rounded-xl bg-zinc-900 text-white text-xs font-bold shadow-lg shadow-zinc-900/20 active:scale-95 transition-transform"
                              >
                                {t.buy}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : userDevices.length === 0 ? (
                      <div className="text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                        <p className="text-zinc-400 font-bold">{t.preSaleEmpty}</p>
                      </div>
                    ) : (
                      userDevices.map((device) => {
                        const { purchasedAtMs, endAtMs, effectiveNow } = getDeviceLifecycle(device, clockNow);
                        const elapsed = effectiveNow - purchasedAtMs;
                        const totalDurationMs = Math.max(1, Number(device.validityDays || 0) * DEVICE_PAYOUT_INTERVAL_MS);
                        const progressRatio = Math.min(1, Math.max(0, elapsed / totalDurationMs));
                        const progressPercent = Number((progressRatio * 100).toFixed(1));
                        const earnedProfit = Number((device.earnedAmount ?? 0).toFixed(4));
                        const remainingProfit = Math.max(0, Number((device.totalIncome - earnedProfit).toFixed(4)));
                        const isFinished = remainingProfit <= 0 || clockNow >= endAtMs;
                        return (
                          <div key={device.id} className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
                            <div className="flex gap-5">
                              <img src={device.image} alt={device.planCode} className="h-32 w-28 rounded-2xl object-cover bg-zinc-100" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-xl font-black">{device.planCode}</h3>
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${isFinished ? 'bg-zinc-100 text-zinc-500' : 'bg-emerald-50 text-emerald-600'}`}>{isFinished ? t.finished : t.runningNow}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-y-2">
                                  <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.dailyIncomeLabel}</p>
                                    <p className="text-sm font-black text-emerald-600">+{formatAmount(device.dailyIncome)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.earnedProfit}</p>
                                    <p className="text-sm font-black">{formatAmount(earnedProfit)} {t.tnd}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.remainingProfit}</p>
                                    <p className="text-sm font-black text-amber-600">{formatAmount(remainingProfit)} {t.tnd}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase">{t.completionRate}</p>
                                    <p className="text-sm font-black">{progressPercent}%</p>
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${isFinished ? 'bg-zinc-400' : 'bg-emerald-500'}`} style={{ width: `${isFinished ? 100 : progressPercent}%` }} />
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                  <p className="text-[10px] font-bold text-zinc-400">{t.purchasedAt}: {new Date(device.purchasedAt).toLocaleDateString()}</p>
                                  <p className="text-[10px] font-bold text-zinc-400">{t.expiresAt}: {new Date(endAtMs).toLocaleDateString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {mainTab === "team" && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-zinc-100 bg-white p-8 text-center shadow-sm">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">{t.referralBonus}</p>
                    <h2 className="text-5xl font-black text-indigo-600 mb-6">{formatAmount(referralBonusTotal)} <span className="text-xl opacity-40">{t.tnd}</span></h2>
                    
                    <div className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between gap-4 mb-4">
                      <p className="text-[10px] font-mono font-bold text-zinc-500 truncate">{referralLink}</p>
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(referralLink);
                          setNotice(t.copied);
                        }}
                        className="px-4 py-2 bg-white rounded-xl text-[10px] font-black shadow-sm"
                      >
                        {t.copy}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-white border border-zinc-100 p-4 text-center">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">{t.team}</p>
                      <p className="text-xl font-black">{teamCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-zinc-100 p-4 text-center col-span-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">{t.referralDepositIncome}</p>
                      <p className="text-xl font-black text-emerald-600">+{formatAmount(referralDepositBonusTotal)}</p>
                    </div>
                  </div>
                </div>
              )}

              {mainTab === "profile" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-6 bg-zinc-900 rounded-3xl text-white">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-black">U</div>
                    <div>
                      <h3 className="text-xl font-black">{session.email}</h3>
                      <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Level 1 Investor</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setRoute("settings")} className="p-4 bg-white border border-zinc-100 rounded-2xl text-left hover:bg-zinc-50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">⚙️</div>
                      <p className="text-xs font-bold">{t.payPassSettings}</p>
                    </button>
                    <button onClick={() => setRoute("devices")} className="p-4 bg-white border border-zinc-100 rounded-2xl text-left hover:bg-zinc-50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">🤖</div>
                      <p className="text-xs font-bold">{t.myDevices}</p>
                    </button>
                  </div>

                  <div className="rounded-3xl border border-zinc-100 bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <h3 className="font-black text-sm">{t.txHistory}</h3>
                      <select value={txFilter} onChange={(e) => setTxFilter(e.target.value as TxFilter)} className="text-[10px] font-bold bg-zinc-100 px-3 py-1.5 rounded-full outline-none">
                        <option value="all">{t.filterAll}</option>
                        <option value="deposit">{t.filterDeposit}</option>
                        <option value="withdraw">{t.filterWithdraw}</option>
                        <option value="pending">{t.filterPending}</option>
                        <option value="approved">{t.filterApproved}</option>
                        <option value="rejected">{t.filterRejected}</option>
                      </select>
                    </div>
                    <div className="p-4 space-y-3">
                      {filteredUserTxs.length === 0 ? (
                        <p className="text-center py-10 text-[10px] font-bold text-zinc-400">{t.noTx}</p>
                      ) : filteredUserTxs.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl">
                          <div>
                            <p className="text-xs font-black">{typeLabel(tx.type)}</p>
                            <p className="text-[10px] font-bold text-zinc-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-black ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {tx.type === 'deposit' ? '+' : '-'}{formatAmount(tx.amount)}
                            </p>
                            <p className={`text-[10px] font-bold ${tx.status === 'approved' ? 'text-emerald-500' : tx.status === 'rejected' ? 'text-rose-500' : 'text-amber-500'}`}>
                              {statusLabel(tx.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {route === "deposit" && (
            <motion.section key="deposit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 space-y-6">
              <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100 flex flex-col items-center">
                <div className="p-4 bg-white rounded-3xl shadow-sm mb-6">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(depositDestination)}`} alt="qr" className="w-40 h-40" />
                </div>
                <div className="w-full p-4 bg-white rounded-2xl flex items-center justify-between gap-4">
                  <p className="text-xs font-mono font-bold text-zinc-500 truncate">{depositDestination}</p>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(depositDestination);
                      setNotice(t.copied);
                    }}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black"
                  >
                    {t.copy}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">{t.depositChannels}</p>
                <div className="flex flex-wrap gap-2">
                  {(["TRC20", "BEP20", "D17", "Flouci"] as DepositChannel[]).map((channel) => (
                    <button
                      key={channel}
                      onClick={() => setDepositChannel(channel)}
                      className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all ${depositChannel === channel ? "bg-zinc-900 text-white shadow-lg" : "bg-zinc-100 text-zinc-500"}`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder={t.amount} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" />
                
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-200 rounded-3xl cursor-pointer hover:bg-zinc-50 transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setDepositReceipt(e.target.files?.[0] ?? null)} />
                  <span className="text-3xl mb-2">📸</span>
                  <span className="text-xs font-bold text-zinc-500">{depositReceipt ? depositReceipt.name : t.uploadProof}</span>
                </label>

                <button onClick={submitDeposit} className="w-full rounded-2xl bg-blue-600 py-5 text-sm font-black text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
                  {t.confirmDeposit}
                </button>
              </div>

              <div className="p-6 bg-zinc-50 rounded-3xl space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">{t.depositInstructions}</h3>
                <div className="space-y-2">
                  {DEPOSIT_RULES[lang].map((item) => (
                    <p key={item} className="text-[11px] font-bold text-zinc-600 leading-relaxed">• {item}</p>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {route === "withdraw" && (
            <motion.section key="withdraw" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 space-y-6">
              <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
                <button onClick={() => setWithdrawType("bank")} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${withdrawType === "bank" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>{t.bankCard}</button>
                <button onClick={() => setWithdrawType("usdt")} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${withdrawType === "usdt" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>USDT</button>
              </div>

              <div className="p-8 bg-zinc-900 rounded-3xl text-white text-center shadow-xl">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{t.withdrawableProfit}</p>
                <h2 className="text-4xl font-black mb-4">{formatAmount(balance)} <span className="text-xl opacity-40">{t.tnd}</span></h2>
                <button
                  onClick={() => setWithdrawAmount(String(balance))}
                  className="px-6 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-tighter"
                >
                  {t.useMaxProfit}
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-zinc-50 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                    <span className="text-xs font-black uppercase text-zinc-400">{t.amount}</span>
                    <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0.00" className="bg-transparent text-right text-xl font-black outline-none w-32" />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase">
                    <span>{t.expectedArrival}</span>
                    <span className="text-emerald-600">{formatAmount(withdrawExpectedAmount)} {withdrawType === 'bank' ? t.tnd : 'USDT'}</span>
                  </div>
                </div>

                {withdrawType === "bank" ? (
                  <>
                    <button onClick={() => setShowSheet(true)} className="w-full flex items-center justify-between px-6 py-5 bg-white border border-zinc-200 rounded-2xl text-sm font-black">
                      <span>{selectedChannel ? `${selectedChannel.provider} (${selectedChannel.accountNumber.slice(-4)})` : t.selectWithdrawChannel}</span>
                      <span className="text-zinc-400">→</span>
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      {(["TRC20", "BEP20"] as WithdrawNetwork[]).map((network) => (
                        <button key={network} onClick={() => setWithdrawNetwork(network)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${withdrawNetwork === network ? "bg-zinc-900 text-white shadow-lg" : "bg-zinc-100 text-zinc-500"}`}>{network}</button>
                      ))}
                    </div>
                    <input value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} placeholder={t.withdrawAddress} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" />
                  </div>
                )}
                
                <input type="password" value={paymentPasswordInput} onChange={(e) => setPaymentPasswordInput(e.target.value)} placeholder={t.withdrawPassword} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" />

                <button onClick={submitWithdraw} className="w-full rounded-2xl bg-zinc-900 py-5 text-sm font-black text-white shadow-lg active:scale-95 transition-transform">
                  {t.withdrawBtn}
                </button>
              </div>

              <div className="p-6 bg-zinc-50 rounded-3xl space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">{t.withdrawInstructions}</h3>
                <div className="space-y-2">
                  {WITHDRAW_RULES[lang].map((item) => (
                    <p key={item} className="text-[11px] font-bold text-zinc-600 leading-relaxed">• {item}</p>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {route === "bind-bank" && (
            <motion.section key="bind-bank" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">{t.channel}</p>
                <div className="flex gap-2">
                  {(["Bank", "D17", "Flouci"] as WithdrawProvider[]).map((provider) => (
                    <button key={provider} onClick={() => setBindProvider(provider)} className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all ${bindProvider === provider ? "bg-zinc-900 text-white shadow-lg" : "bg-zinc-100 text-zinc-500"}`}>{provider}</button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">{t.name}</p>
                  <input value={bindName} onChange={(e) => setBindName(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" placeholder={t.nameHint} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">{t.phone}</p>
                  <input value={bindPhone} onChange={(e) => setBindPhone(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" placeholder={t.phoneHint} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">{t.accountNumber}</p>
                  <input value={bindAccount} onChange={(e) => setBindAccount(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" placeholder={t.accountHint} />
                </div>
                
                <button onClick={saveWithdrawalChannel} className="w-full rounded-2xl bg-zinc-900 py-5 text-sm font-black text-white shadow-lg active:scale-95 transition-transform mt-6">
                  {t.save}
                </button>
              </div>
            </motion.section>
          )}

          {route === "devices" && (
            <motion.section key="devices" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 space-y-4">
              {userDevices.length === 0 ? (
                <div className="text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                  <p className="text-zinc-400 font-bold">{t.noDevices}</p>
                </div>
              ) : (
                userDevices.map((device) => {
                  const { purchasedAtMs, endAtMs, effectiveNow } = getDeviceLifecycle(device, clockNow);
                  const elapsed = effectiveNow - purchasedAtMs;
                  const totalDurationMs = Math.max(1, Number(device.validityDays || 0) * DEVICE_PAYOUT_INTERVAL_MS);
                  const progressRatio = Math.min(1, Math.max(0, elapsed / totalDurationMs));
                  const progress = Number((progressRatio * 100).toFixed(1));
                  const earnedProfit = Number((device.earnedAmount ?? 0).toFixed(4));
                  const liveProfit = Number((progressRatio * device.totalIncome).toFixed(4));
                  const isFinished = clockNow >= endAtMs || earnedProfit >= device.totalIncome;
                  
                  return (
                    <div key={device.id} className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
                      <div className="flex gap-5 mb-6">
                        <img src={device.image} alt="device" className="h-24 w-20 rounded-2xl object-cover bg-zinc-100" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-black">{device.planCode}</h3>
                            <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${isFinished ? 'bg-zinc-100 text-zinc-500' : 'bg-emerald-50 text-emerald-600 animate-pulse'}`}>
                              {isFinished ? t.finished : t.runningNow}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-zinc-400 uppercase">
                            <div>
                              <p>{t.dailyIncomeLabel}</p>
                              <p className="text-zinc-900">{formatAmount(device.dailyIncome)}</p>
                            </div>
                            <div>
                              <p>{t.totalIncomeLabel}</p>
                              <p className="text-zinc-900">{formatAmount(device.totalIncome)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase">
                            <span className="text-zinc-400">{t.completionRate}</span>
                            <span className="text-blue-600">{progress}%</span>
                          </div>
                          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.5 }}
                              className="h-full bg-blue-600 rounded-full"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <div className="p-3 bg-emerald-50 rounded-xl">
                            <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">{t.earnedProfit}</p>
                            <p className="text-xs font-black text-emerald-700">{formatAmount(earnedProfit)}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-xl">
                            <p className="text-[8px] font-bold text-blue-600 uppercase mb-1">الربح المباشر</p>
                            <p className="text-xs font-black text-blue-700">{formatAmount(liveProfit)}</p>
                          </div>
                          <div className="p-3 bg-zinc-50 rounded-xl">
                            <p className="text-[8px] font-bold text-zinc-400 uppercase mb-1">{t.remainingProfit}</p>
                            <p className="text-xs font-black text-zinc-900">{formatAmount(Math.max(0, device.totalIncome - earnedProfit))}</p>
                          </div>
                        </div>
                        <p className="text-[9px] font-bold text-zinc-400 text-center uppercase tracking-widest">
                          {t.expiresAt}: {new Date(endAtMs).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.section>
          )}

          {route === "settings" && (
            <motion.section key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 space-y-6">
              <div className="p-6 bg-zinc-50 rounded-3xl text-xs font-bold text-zinc-500 leading-relaxed">
                {t.settingsHint}
              </div>
              
              <div className="space-y-4">
                {currentAccount?.paymentPassword && (
                  <input type="password" value={oldPayPassword} onChange={(e) => setOldPayPassword(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" placeholder={t.currentPassword} />
                )}
                <input type="password" value={newPayPassword} onChange={(e) => setNewPayPassword(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" placeholder={t.newPassword} />
                <input type="password" value={confirmPayPassword} onChange={(e) => setConfirmPayPassword(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black outline-none" placeholder={t.confirmNewPassword} />
                
                <button onClick={savePaymentPassword} className="w-full rounded-2xl bg-zinc-900 py-5 text-sm font-black text-white shadow-lg active:scale-95 transition-transform mt-4">
                  {t.savePayPassword}
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {route === "home" && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/80 backdrop-blur-lg border-t border-zinc-100 px-6 py-4 flex justify-between items-center z-20">
          <button onClick={() => openUserTab("home")} className={`flex flex-col items-center gap-1 transition-all ${mainTab === "home" ? "text-blue-600 scale-110" : "text-zinc-400"}`}>
            <span className="text-xl">🏠</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">{t.home}</span>
          </button>
          <button onClick={() => openUserTab("products")} className={`flex flex-col items-center gap-1 transition-all ${mainTab === "products" ? "text-blue-600 scale-110" : "text-zinc-400"}`}>
            <span className="text-xl">🤖</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">{t.products}</span>
          </button>
          <button onClick={() => openUserTab("team")} className={`flex flex-col items-center gap-1 transition-all ${mainTab === "team" ? "text-blue-600 scale-110" : "text-zinc-400"}`}>
            <span className="text-xl">👥</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">{t.team}</span>
          </button>
          <button onClick={() => openUserTab("profile")} className={`flex flex-col items-center gap-1 transition-all ${mainTab === "profile" ? "text-blue-600 scale-110" : "text-zinc-400"}`}>
            <span className="text-xl">👤</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">{t.profile}</span>
          </button>
        </nav>
      )}

      <AnimatePresence>
        {introOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
            onClick={() => setIntroOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-black mb-4">{INTRO_CONTENT[lang].title}</h3>
              <div className="space-y-4 mb-8">
                {INTRO_CONTENT[lang].lines.map((line) => (
                  <p key={line} className="text-xs font-bold text-zinc-600 leading-relaxed">{line}</p>
                ))}
              </div>
              <button onClick={() => setIntroOpen(false)} className="w-full rounded-2xl bg-zinc-900 py-4 text-sm font-black text-white shadow-lg active:scale-95 transition-transform">
                {t.ok}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSheet(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 max-w-xl mx-auto rounded-t-[40px] bg-white p-8 pt-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-zinc-100 rounded-full mx-auto mb-8" />
              <h3 className="text-lg font-black mb-6">{t.selectWithdrawChannel}</h3>
              
              <div className="space-y-3 mb-8">
                {withdrawChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => {
                      setSelectedChannelId(channel.id);
                      setShowSheet(false);
                    }}
                    className="w-full flex items-center justify-between p-5 bg-zinc-50 rounded-2xl text-left border border-transparent hover:border-blue-600/20 transition-all"
                  >
                    <div>
                      <p className="text-sm font-black">{channel.provider}</p>
                      <p className="text-[10px] font-bold text-zinc-400">{channel.accountNumber}</p>
                    </div>
                    {selectedChannelId === channel.id && <span className="text-blue-600">✓</span>}
                  </button>
                ))}
                {withdrawChannels.length === 0 && <p className="text-center py-6 text-xs font-bold text-zinc-400">{t.noChannels}</p>}
              </div>

              <button
                onClick={() => {
                  setShowSheet(false);
                  setRoute("bind-bank");
                }}
                className="w-full py-5 rounded-2xl bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
              >
                + {t.addChannel}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
            onClick={() => setReviewDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs rounded-3xl bg-white p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl mb-4">⌛</div>
              <h3 className="text-xl font-black mb-2">{t.reviewPopupTitle}</h3>
              <p className="text-xs font-bold text-zinc-500 leading-relaxed mb-8">{t.reviewNotice}</p>
              <button onClick={() => setReviewDialogOpen(false)} className="w-full rounded-2xl bg-zinc-900 py-4 text-sm font-black text-white shadow-lg active:scale-95 transition-transform">
                {t.ok}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
