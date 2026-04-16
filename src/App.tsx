import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { loadSupabaseState, saveSupabaseState } from "./lib/supabaseState";

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
  hourlyRate?: number;
  lastPayoutAt?: string;
};

type ProfitRecord = {
  id: string;
  phone: string;
  deviceId: string;
  amount: number;
  cycles: number;
  createdAt: string;
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

const ADMIN_PHONE = "55810112";
const ADMIN_PASSWORD = "TECAI@2026";
const ADMIN_PHONE_WITH_CODE = "+21655810112";
const COUNTRY_CODES = ["+216", "+20", "+966", "+971", "+86", "+1"];
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
    phone: "رقم الهاتف",
    phoneHint: "أدخل رقم الهاتف",
    countryCode: "كود البلد",
    password: "كلمة المرور",
    showPassword: "إظهار",
    hidePassword: "إخفاء",
    confirmPassword: "تأكيد كلمة المرور",
    badCredentials: "بيانات الدخول غير صحيحة",
    phoneExists: "رقم الهاتف مسجل بالفعل",
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
    phone: "Phone",
    phoneHint: "Enter phone number",
    countryCode: "Country code",
    password: "Password",
    showPassword: "Show",
    hidePassword: "Hide",
    confirmPassword: "Confirm password",
    badCredentials: "Invalid credentials",
    phoneExists: "Phone already exists",
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
    buyNeedBalance: "Insufficient balance. Redirected to deposit page.",
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
    phone: "手机号",
    phoneHint: "输入手机号",
    countryCode: "国家区号",
    password: "密码",
    showPassword: "显示",
    hidePassword: "隐藏",
    confirmPassword: "确认密码",
    badCredentials: "登录信息错误",
    phoneExists: "手机号已存在",
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
  { code: "A1", price: 30, validityDays: 100, image: "/images/robot-30.png" },
  { code: "A2", price: 80, validityDays: 100, image: "/images/robot-80.png" },
  { code: "A3", price: 230, validityDays: 120, image: "/images/robot-230.png" },
  { code: "A4", price: 580, validityDays: 120, image: "/images/robot-580.png" },
  { code: "A5", price: 1400, validityDays: 150, image: "/images/robot-1400.png" },
  { code: "A6", price: 3200, validityDays: 150, image: "/images/robot-3200.png" },
  { code: "A7", price: 7500, validityDays: 180, image: "/images/robot-plan-1.png" },
  { code: "A8", price: 18000, validityDays: 180, image: "/images/robot-plan-2.png" },
  { code: "A9", price: 42000, validityDays: 230, image: "/images/robot-plan-3.png" },
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
  // Keep lifecycle math stable even if a legacy row has a missing/invalid purchasedAt date.
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

function buildAuthEmail(phone: string) {
  const compact = normalizePhone(phone).replace(/[^0-9+]/g, "");
  const safeLocalPart = compact.replace(/\+/g, "");
  return `u${safeLocalPart}@tecai.app`;
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

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
