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
  if (value.startsWith("data:application/pdf")) return value;
  if (value.startsWith("blob:")) return value;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  return "";
}

function isImageProofUrl(value: string) {
  const lower = value.toLowerCase();
  return lower.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lower);
}

function isPdfProofUrl(value: string) {
  const lower = value.toLowerCase();
  return lower.startsWith("data:application/pdf") || /\.pdf(\?|$)/.test(lower);
}

// ==================== دوال Supabase الجديدة ====================

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
    hourlyRate: row.hourly_rate,
    lastPayoutAt: row.last_payout_at,
  }));
}

async function fetchUserBalance(phone: string): Promise<number> {
  if (!supabase) return 0;
  
  const { data, error } = await supabase
    .from('wallets')
    .select('balance')
    .eq('phone', phone)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching balance:', error);
  }
  
  return data?.balance ?? 0;
}

async function updateUserBalance(phone: string, newBalance: number): Promise<boolean> {
  if (!supabase) return false;
  
  const { data: existing } = await supabase
    .from('wallets')
    .select('phone')
    .eq('phone', phone)
    .single();
    
  if (existing) {
    const { error } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('phone', phone);
    if (error) {
      console.error('Error updating balance:', error);
      return false;
    }
  } else {
    const { error } = await supabase
      .from('wallets')
      .insert({ phone: phone, balance: newBalance });
    if (error) {
      console.error('Error inserting balance:', error);
      return false;
    }
  }
  return true;
}

async function saveDeviceToSupabase(device: OwnedDevice): Promise<boolean> {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('devices')
    .insert({
      id: device.id,
      phone: device.phone,
      plan_code: device.planCode,
      plan_price: device.planPrice,
      daily_income: device.dailyIncome,
      total_income: device.totalIncome,
      validity_days: device.validityDays,
      image: device.image,
      purchased_at: device.purchasedAt,
      earned_amount: device.earnedAmount,
      last_payout_at: device.lastPayoutAt,
    });
    
  if (error) {
    console.error('Error saving device:', error);
    return false;
  }
  return true;
}

async function updateDeviceEarnings(deviceId: string, earnedAmount: number, lastPayoutAt: string): Promise<void> {
  if (!supabase) return;
  
  await supabase
    .from('devices')
    .update({ earned_amount: earnedAmount, last_payout_at: lastPayoutAt })
    .eq('id', deviceId);
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => loadJson<Lang>("tecai:lang", "ar"));
  const [session, setSession] = useState<Session>(() => loadJson<Session>("tecai:session", null));
  const [accounts, setAccounts] = useState<Record<string, UserAccount>>(() => loadJson("tecai:accounts", {}));
  const [balances, setBalances] = useState<Record<string, number>>(() => loadJson("tecai:balances", {}));
  const [txs, setTxs] = useState<Transaction[]>(() => loadJson("tecai:txs", []));
  const [devices, setDevices] = useState<OwnedDevice[]>(() => loadJson("tecai:devices", []));
  const [profitRecords, setProfitRecords] = useState<ProfitRecord[]>(() => loadJson("tecai:profit-records", []));
  const [clockNow, setClockNow] = useState(() => Date.now());
  const hasLoadedCloudRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const [route, setRoute] = useState<Route>("home");
  const [mainTab, setMainTab] = useState<MainTab>("home");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [notice, setNotice] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const [productMode, setProductMode] = useState<"onSale" | "preSale">("onSale");

  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [phoneInput, setPhoneInput] = useState("");
  const [password, setPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthConfirmPassword, setShowAuthConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingReferralPhone, setPendingReferralPhone] = useState<string>(() => loadJson("tecai:pending-ref", ""));

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
        const remoteState = await loadSupabaseState();
        if (!remoteState || cancelled) {
          hasLoadedCloudRef.current = true;
          return;
        }

        setLang(remoteState.lang ?? "ar");
        setAccounts((remoteState.accounts as Record<string, UserAccount>) ?? {});
        setBalances(remoteState.balances ?? {});
        setTxs((remoteState.txs as Transaction[]) ?? []);
        setDevices((remoteState.devices as OwnedDevice[]) ?? []);
        setProfitRecords((remoteState.profitRecords as ProfitRecord[]) ?? []);
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

    const applyAuthSession = (authSession: { user?: { user_metadata?: { phone?: string } } } | null) => {
      const phoneFromAuth = normalizePhone(String(authSession?.user?.user_metadata?.phone ?? ""));
      if (phoneFromAuth) {
        setSession((prev) => (prev?.role === "admin" ? prev : { role: "user", phone: phoneFromAuth }));
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
  useEffect(() => localStorage.setItem("tecai:pending-ref", JSON.stringify(pendingReferralPhone)), [pendingReferralPhone]);

  useEffect(() => {
    const incomingRef = parseReferralFromLocation();
    if (!incomingRef || incomingRef === ADMIN_PHONE || incomingRef === ADMIN_PHONE_WITH_CODE) return;
    setPendingReferralPhone((prev) => (prev || incomingRef));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !hasLoadedCloudRef.current) return;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveSupabaseState({
        lang,
        session: null,
        accounts,
        balances,
        txs,
        devices,
        profitRecords,
      }).catch(() => {
        // Keep local data if remote sync fails.
      });
    }, 600);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [lang, session, accounts, balances, txs, devices, profitRecords]);

  useEffect(() => {
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // تحميل البيانات من Supabase عند تسجيل الدخول
  useEffect(() => {
    if (session?.role === "user" && session.phone && supabase) {
      fetchUserDevices(session.phone).then(remoteDevices => {
        if (remoteDevices.length > 0) {
          setDevices(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            const newDevices = remoteDevices.filter(d => !existingIds.has(d.id));
            return [...newDevices, ...prev];
          });
        }
      });
      
      fetchUserBalance(session.phone).then(remoteBalance => {
        if (remoteBalance > 0 || balances[session.phone] !== remoteBalance) {
          setBalances(prev => ({ ...prev, [session.phone]: remoteBalance }));
        }
      });
    }
  }, [session]);

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

          if (payoutAmount <= 0) {
            const newLastPayout = new Date(Math.min(effectiveNow, payoutBase + cycles * DEVICE_PAYOUT_INTERVAL_MS)).toISOString();
            updateDeviceEarnings(device.id, earnedSoFar, newLastPayout);
            return {
              ...device,
              lastPayoutAt: newLastPayout,
            };
          }

          if (payoutAmount > 0) {
              creditedRecords.push({
                id: createUniqueId(`pr_${device.id}`),
              phone: device.phone,
              deviceId: device.id,
              amount: payoutAmount,
              cycles,
              createdAt: new Date(now).toISOString(),
            });
          }

          const newEarnedAmount = Number((earnedSoFar + payoutAmount).toFixed(4));
          const newLastPayout = new Date(Math.min(effectiveNow, payoutBase + cycles * DEVICE_PAYOUT_INTERVAL_MS)).toISOString();
          updateDeviceEarnings(device.id, newEarnedAmount, newLastPayout);

          return {
            ...device,
            earnedAmount: newEarnedAmount,
            lastPayoutAt: newLastPayout,
          };
        });

        return changed ? nextDevices : prevDevices;
      });

      if (creditedRecords.length === 0) return;

      setProfitRecords((prev) => [...creditedRecords, ...prev]);
      setBalances((prev) => {
        const next = { ...prev };
        for (const record of creditedRecords) {
          next[record.phone] = Number(((next[record.phone] ?? 0) + record.amount).toFixed(4));
          updateUserBalance(record.phone, next[record.phone]);

          const inviterPhone = accountsRef.current[record.phone]?.referredBy;
          if (inviterPhone && inviterPhone !== record.phone) {
            const referralProfitBonus = Number((record.amount * REFERRAL_PROFIT_RATE).toFixed(4));
            if (referralProfitBonus > 0) {
              next[inviterPhone] = Number(((next[inviterPhone] ?? 0) + referralProfitBonus).toFixed(4));
              updateUserBalance(inviterPhone, next[inviterPhone]);
              referralBonusTxs.push({
                id: createUniqueId("tx_ref_profit"),
                phone: inviterPhone,
                type: "deposit",
                amount: referralProfitBonus,
                method: "Referral 2.5% profit bonus",
                status: "approved",
                payoutDetails: `From ${record.phone}`,
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
  }, [session]);

  useEffect(() => {
    resetWithdrawForm();
  }, [session?.phone]);

  const isAdminPath = window.location.hash === "#admin";
  const t = DICT[lang];
  const isRtl = lang === "ar";
  const currentPhone = session?.phone ?? "";
  const currentAccount = currentPhone ? accounts[currentPhone] : undefined;
  const balance = balances[currentPhone] ?? 0;
  const pendingCount = txs.filter((x) => x.phone === currentPhone && x.status === "pending").length;
  const depositDestination = DESTINATIONS[depositChannel];
  const withdrawChannels = currentAccount?.channels ?? [];
  const userDevices = devices.filter((device) => device.phone === currentPhone);

  const selectedChannel = useMemo(
    () => withdrawChannels.find((x) => x.id === selectedChannelId),
    [withdrawChannels, selectedChannelId],
  );

  const approvedDepositTotal = txs
    .filter((x) => x.phone === currentPhone && x.type === "deposit" && x.status === "approved")
    .reduce((sum, x) => sum + x.amount, 0);

  const userProfitRecords = profitRecords.filter((record) => record.phone === currentPhone);
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

  const userTxs = txs.filter((x) => x.phone === currentPhone);
  const referralLink = `${window.location.origin}?ref=${encodeURIComponent(currentPhone)}`;
  const teamCount = Object.entries(accounts).filter(([, account]) => account.referredBy === currentPhone).length;
  const referralDepositBonusTotal = txs
    .filter((tx) => tx.phone === currentPhone && tx.status === "approved" && tx.method === "Referral 5% deposit bonus")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const referralProfitBonusTotal = txs
    .filter((tx) => tx.phone === currentPhone && tx.status === "approved" && tx.method === "Referral 2.5% profit bonus")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const referralBonusTotal = txs
    .filter((tx) => tx.phone === currentPhone && tx.status === "approved" && tx.method.startsWith("Referral "))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const withdrawableAmountNow = Math.max(0, Number((balance ?? 0).toFixed(4)));
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
    setPhoneInput("");
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

  function getFullPhone() {
    return `${countryCode}${phoneInput.trim()}`;
  }

  async function onUserAuthSubmit() {
    const fullPhone = getFullPhone();
    const normalizedPhone = normalizePhone(fullPhone);
    if (!phoneInput.trim() || phoneInput.trim().length < 6) {
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
      if (accounts[fullPhone]) {
        setNotice(t.phoneExists);
        return;
      }

      if (isSupabaseConfigured && supabase) {
        const email = buildAuthEmail(fullPhone);
        const signUpRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { phone: fullPhone },
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

      const normalizedRef = normalizePhone(pendingReferralPhone);
      const referralOwner = Object.keys(accounts).find((phone) => normalizePhone(phone) === normalizedRef);
      const referredBy = referralOwner && referralOwner !== fullPhone ? referralOwner : undefined;

      setAccounts((prev) => ({
        ...prev,
        [fullPhone]: { loginPassword: password, channels: [], referredBy },
      }));
      setBalances((prev) => ({ ...prev, [fullPhone]: prev[fullPhone] ?? 0 }));
      setNotice(t.accountCreated);
      setPendingReferralPhone("");
      setAuthMode("login");
      resetAuthFields();
      return;
    }

    const isAdminPhone = normalizedPhone === ADMIN_PHONE || normalizedPhone === ADMIN_PHONE_WITH_CODE;
    if (isAdminPhone && password === ADMIN_PASSWORD) {
      setSession({ role: "admin", phone: ADMIN_PHONE });
      setRoute("home");
      setMainTab("home");
      resetAuthFields();
      return;
    }

    const account = accounts[fullPhone];

    if (isSupabaseConfigured && supabase) {
      const email = buildAuthEmail(fullPhone);
      let signInRes = await supabase.auth.signInWithPassword({ email, password });

      if (signInRes.error && account?.loginPassword === password) {
        const signUpRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { phone: fullPhone },
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
        [fullPhone]: { loginPassword: password, channels: [] },
      }));
      setBalances((prev) => ({ ...prev, [fullPhone]: prev[fullPhone] ?? 0 }));
    }

    setSession({ role: "user", phone: fullPhone });
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
    setSession({ role: "admin", phone: ADMIN_PHONE });
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

  useEffect(() => {
    if (session?.role !== "admin") {
      setProofPreviewUrl("");
    }
  }, [session]);

  function openTelegramHelp() {
    const telegramUrl = "https://t.me/tecaipro";
    const popup = window.open(telegramUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = telegramUrl;
    }
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
      phone: currentPhone,
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
      payoutDetails = `${selectedChannel.holderName} | ${selectedChannel.accountNumber} | ${selectedChannel.phone}`;
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
      phone: currentPhone,
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
      phone: bindPhone.trim(),
      accountNumber: bindAccount.trim(),
    };

    setAccounts((prev) => ({
      ...prev,
      [currentPhone]: {
        ...(prev[currentPhone] as UserAccount),
        channels: [...(prev[currentPhone]?.channels ?? []), nextChannel],
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
    const acc = accounts[currentPhone];
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
      [currentPhone]: {
        ...(prev[currentPhone] as UserAccount),
        paymentPassword: newPayPassword,
      },
    }));
    setOldPayPassword("");
    setNewPayPassword("");
    setConfirmPayPassword("");
    setNotice(t.passwordSaved);
  }

  function updateTxStatus(txId: string, next: "approved" | "rejected") {
    const target = txs.find((x) => x.id === txId);
    if (!target || target.status !== "pending") return;

    setTxs((prev) => prev.map((x) => (x.id === txId ? { ...x, status: next } : x)));

    if (next === "approved") {
      const referralBonusTxs: Transaction[] = [];
      setBalances((prev) => {
        const before = prev[target.phone] ?? 0;
        const after = target.type === "deposit" ? before + target.amount : Math.max(0, before - target.amount);
        const nextBalances = { ...prev, [target.phone]: after };
        updateUserBalance(target.phone, after);

        if (target.type === "deposit") {
          const inviterPhone = accounts[target.phone]?.referredBy;
          if (inviterPhone && inviterPhone !== target.phone) {
            const referralBonus = Number((target.amount * REFERRAL_DEPOSIT_RATE).toFixed(4));
            if (referralBonus > 0) {
              nextBalances[inviterPhone] = Number(((nextBalances[inviterPhone] ?? 0) + referralBonus).toFixed(4));
              updateUserBalance(inviterPhone, nextBalances[inviterPhone]);
              referralBonusTxs.push({
                id: createUniqueId("tx_ref_dep"),
                phone: inviterPhone,
                type: "deposit",
                amount: referralBonus,
                method: "Referral 5% deposit bonus",
                status: "approved",
                payoutDetails: `From ${target.phone}`,
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

    const newBalance = Math.max(0, balance - plan.price);
    setBalances((prev) => ({ ...prev, [currentPhone]: newBalance }));
    updateUserBalance(currentPhone, newBalance);
    
    saveDeviceToSupabase(nextDevice).then(success => {
      if (success) {
        setDevices((prev) => [nextDevice, ...prev]);
        setNotice(t.boughtSuccess);
        setRoute("devices");
      } else {
        setBalances((prev) => ({ ...prev, [currentPhone]: balance }));
        setNotice("حدث خطأ في شراء الجهاز، حاول مرة أخرى");
      }
    });
  }

  if (!session) {
    const showAdmin = isAdminPath;
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="relative min-h-screen text-zinc-900">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-tecai.jpg')" }}
        />
        <div className="absolute inset-0 bg-zinc-900/45" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-sm items-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl border border-white/60 bg-white/95 p-4 shadow-xl backdrop-blur-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-zinc-500">{showAdmin ? t.adminLogin : t.userLogin}</p>
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs">
                <option value="ar">AR</option>
                <option value="en">EN</option>
                <option value="zh">中文</option>
              </select>
            </div>

            <div className="mb-3 rounded-xl border border-zinc-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-3">
              <h1 className="bg-gradient-to-r from-sky-600 to-indigo-700 bg-clip-text text-3xl font-extrabold tracking-wide text-transparent">{DICT[lang].appName}</h1>
              <p className="mt-1 text-xs text-zinc-600">{t.brandTagline}</p>
            </div>

            {showAdmin ? (
              <div className="space-y-2.5">
                <input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm" placeholder={t.phone} />
                <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm" placeholder={t.password} />
                <button onClick={onAdminLogin} className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm text-white">{t.login}</button>
                <button
                  onClick={() => {
                    window.location.hash = "";
                    setNotice("");
                  }}
                  className="w-full rounded-lg border border-zinc-300 py-2.5 text-sm"
                >
                  {t.backToUser}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-[95px_1fr] gap-2">
                  <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="rounded-lg border border-zinc-300 px-2 py-2.5 text-sm">
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                  <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm" placeholder={t.phoneHint} />
                </div>
                <div className="relative">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 pe-11 text-sm"
                    placeholder={t.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((prev) => !prev)}
                    className="absolute inset-y-0 end-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600"
                    aria-label={showAuthPassword ? t.hidePassword : t.showPassword}
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
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 pe-11 text-sm"
                      placeholder={t.confirmPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 end-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600"
                      aria-label={showAuthConfirmPassword ? t.hidePassword : t.showPassword}
                    >
                      <EyeIcon closed={showAuthConfirmPassword} />
                    </button>
                  </div>
                )}
                <button onClick={onUserAuthSubmit} className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm text-white">{authMode === "login" ? t.login : t.createAccount}</button>
                <button onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))} className="w-full rounded-lg border border-zinc-300 py-2.5 text-sm">
                  {authMode === "login" ? t.register : t.login}
                </button>
              </div>
            )}

            {notice && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">{notice}</div>}
          </motion.div>
        </div>
      </div>
    );
  }

  if (session.role === "admin") {
    const pending = txs.filter((x) => x.status === "pending");
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-zinc-100 text-zinc-900">
        <main className="mx-auto w-full max-w-sm px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-bold">{t.pendingOps}</h1>
            <button onClick={logout} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs">{t.logout}</button>
          </div>

          {pending.length === 0 && <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">{t.noPending}</p>}

          <div className="space-y-2">
            {pending.map((tx) => (
              <div key={tx.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">{typeLabel(tx.type)}</span>
                  <span className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleString()}</span>
                </div>
                <p>{t.phone}: {tx.phone}</p>
                <p>{t.amount}: {formatAmount(tx.amount)} {t.tnd}</p>
                <p>{t.channel}: {tx.method}</p>
                {tx.receiptName && (
                  <div className="mt-1">
                    <p>{t.uploadProof}: {tx.receiptName}</p>
                    {tx.receiptDataUrl && (
                      <button onClick={() => openProofPreview(tx.receiptDataUrl)} className="mt-1 rounded-md border border-zinc-300 px-2 py-1 text-xs">
                        {t.viewProof}
                      </button>
                    )}
                  </div>
                )}
                {tx.payoutDetails && <p className="break-words">{tx.payoutDetails}</p>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => updateTxStatus(tx.id, "approved")} className="rounded-lg bg-emerald-600 py-2 text-xs text-white">{t.approve}</button>
                  <button onClick={() => updateTxStatus(tx.id, "rejected")} className="rounded-lg bg-rose-600 py-2 text-xs text-white">{t.reject}</button>
                </div>
              </div>
            ))}
          </div>
        </main>

        <AnimatePresence>
          {proofPreviewUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
              onClick={() => setProofPreviewUrl("")}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl bg-white p-3"
                onClick={(e) => e.stopPropagation()}
              >
                {isImageProofUrl(proofPreviewUrl) ? (
                  <img src={proofPreviewUrl} alt="proof" className="max-h-[70vh] w-full rounded-lg object-contain" />
                ) : isPdfProofUrl(proofPreviewUrl) || proofPreviewUrl.startsWith("http") || proofPreviewUrl.startsWith("blob:") ? (
                  <iframe src={proofPreviewUrl} title="proof" className="h-[70vh] w-full rounded-lg" />
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{t.proofUnavailable}</div>
                )}
                <button onClick={() => setProofPreviewUrl("")} className="mt-3 w-full rounded-lg border border-zinc-300 py-2 text-sm">{t.close}</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-zinc-100 text-zinc-900">
      <main className="mx-auto min-h-screen w-full max-w-sm pb-20">
        <header className="flex items-center justify-between px-4 py-3">
          {route !== "home" ? (
            <button onClick={() => setRoute("home")} className="text-xl">←</button>
          ) : (
            <div className="w-5" />
          )}
          <h1 className="text-2xl font-semibold">
            {route === "home"
              ? ""
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
          <button onClick={logout} className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px]">{t.logout}</button>
        </header>

        {notice && <div className="mx-4 mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">{notice}</div>}

        <AnimatePresence mode="wait">
          {route === "home" && (
            <motion.section key={`home-${mainTab}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4 px-4">
              {mainTab === "home" && (
                <>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <img src="/images/hero-tecai.jpg" alt="TECAI" className="h-9 w-9 rounded-lg object-cover" />
                      <div>
                        <h2 className="bg-gradient-to-r from-sky-600 to-indigo-700 bg-clip-text text-xl font-extrabold leading-none text-transparent">{DICT[lang].appName}</h2>
                        <p className="mt-1 text-[11px] text-zinc-500">{t.brandTagline}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">TE</div>
                      <div>
                        <p className="text-xl font-bold leading-none">{session.phone}</p>
                        <span className="mt-1 inline-block rounded-full border border-amber-300 px-2 text-xs text-amber-700">VIP1</span>
                      </div>
                    </div>
                    <button className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm">{t.dailyCheckIn}</button>
                  </div>

                  <img src="/images/hero-tecai.jpg" alt="TECAI banner" className="h-44 w-full rounded-2xl object-cover" />

                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <button onClick={() => setRoute("deposit")} className="rounded-lg py-1.5">💳<div>{t.deposit}</div></button>
                    <button onClick={() => setRoute("withdraw")} className="rounded-lg py-1.5">👛<div>{t.withdraw}</div></button>
                    <button className="rounded-lg py-1.5">✉️<div>{t.lottery}</div></button>
                    <button className="rounded-lg py-1.5">🌐<div>{t.officialSite}</div></button>
                    <button onClick={openTelegramHelp} className="rounded-lg py-1.5">❓<div>{t.help}</div></button>
                    <button className="rounded-lg py-1.5">⬇️<div>{t.app}</div></button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-xl border border-zinc-300 bg-white p-2.5">
                      <p className="font-semibold">{formatAmount(balance)} {t.tnd}</p>
                      <p className="mt-1 text-zinc-500">{t.accountBalance}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-300 bg-white p-2.5">
                      <p className="font-semibold">{formatAmount(todayProfit)} {t.tnd}</p>
                      <p className="mt-1 text-zinc-500">{t.todayProfit}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-300 bg-white p-2.5">
                      <p className="font-semibold">{formatAmount(approvedDepositTotal)} {t.tnd}</p>
                      <p className="mt-1 text-zinc-500">{t.totalDeposit}</p>
                    </div>
                  </div>

                  {pendingCount > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{pendingCount} {t.pendingLabel}</div>}

                  <img src="/images/robot-3200.png" alt="TECAI robots" className="h-40 w-full rounded-xl object-cover" />
                </>
              )}

              {mainTab === "products" && (
                <div className="space-y-3">
                  <button onClick={() => setRoute("devices")} className="w-full rounded-lg border border-zinc-300 bg-white py-2 text-sm font-medium">
                    {t.myDevices}
                  </button>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-center gap-2 text-xl font-bold">
                      <img src="/images/hero-tecai.jpg" alt="TECAI" className="h-7 w-7 rounded object-cover" />
                      <span>{DICT[lang].appName}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 text-center text-sm">
                    <button
                      onClick={() => setProductMode("onSale")}
                      className={`border-b-2 py-2 ${productMode === "onSale" ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-400"}`}
                    >
                      {t.onSaleNow}
                    </button>
                    <button
                      onClick={() => setProductMode("preSale")}
                      className={`border-b-2 py-2 ${productMode === "preSale" ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-400"}`}
                    >
                      {t.preSale}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {productMode === "onSale" && ROBOT_PRODUCTS.map((item) => (
                      <div key={item.code} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                        <p className="text-2xl font-bold leading-none">{item.code}</p>
                        <div className="mt-2 grid grid-cols-[88px_1fr] gap-3">
                          <img src={item.image} alt={item.code} className="h-28 w-20 self-center rounded object-cover" />
                          <div className="space-y-0.5 text-[20px] leading-9">
                            <p>{t.planCost}: {formatPlanNumber(item.price)} {t.currencyLong}</p>
                            <p>{t.dailyIncomeLabel}: {formatPlanNumber(item.dailyIncome)} {t.currencyLong}</p>
                            <p>{t.totalIncomeLabel}: {formatPlanNumber(item.totalIncome)} {t.currencyLong}</p>
                            <p>{t.validityPeriod}: {t.daysCount}{item.validityDays}</p>
                            <p>{t.quantityLabel}: {t.unlimitedQty}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-4xl font-bold leading-none text-rose-700">
                            {formatPlanNumber(item.price)}
                            <span className="ms-1 text-lg">{t.currencyLong}</span>
                          </p>
                          <button
                            onClick={() => activateProductPlan(item)}
                            className="min-w-28 rounded-xl bg-zinc-800 px-8 py-2.5 text-xl text-white"
                          >
                            {t.buy}
                          </button>
                        </div>
                      </div>
                    ))}

                    {productMode === "preSale" && userDevices.length === 0 && (
                      <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-500">{t.preSaleEmpty}</p>
                    )}

                    {productMode === "preSale" && userDevices.map((device) => {
                      const { endAtMs } = getDeviceLifecycle(device, clockNow);
                      const remainingProfit = Math.max(0, Number((device.totalIncome - (device.earnedAmount ?? 0)).toFixed(4)));
                      const isFinished = remainingProfit <= 0 || clockNow >= endAtMs;
                      return (
                        <div key={device.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center justify-between">
                            <p className="text-2xl font-bold leading-none">{device.planCode}</p>
                            <span className={`text-xs ${isFinished ? "text-zinc-500" : "text-emerald-600"}`}>{isFinished ? t.finished : t.runningNow}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-[88px_1fr] gap-3">
                            <img src={device.image} alt={device.planCode} className="h-28 w-20 self-center rounded object-cover" />
                            <div className="space-y-0.5 text-[20px] leading-9">
                              <p>{t.planCost}: {formatPlanNumber(device.planPrice)} {t.currencyLong}</p>
                              <p>{t.dailyIncomeLabel}: {formatPlanNumber(device.dailyIncome)} {t.currencyLong}</p>
                              <p>{t.totalIncomeLabel}: {formatPlanNumber(device.totalIncome)} {t.currencyLong}</p>
                              <p>{t.validityPeriod}: {t.daysCount}{device.validityDays}</p>
                              <p>{t.purchasedAt}: {new Date(device.purchasedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-700">{t.remainingProfit}: {formatAmount(remainingProfit)} {t.tnd}</p>
                            <button onClick={() => setRoute("devices")} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white">{t.myDevices}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {mainTab === "team" && (
                <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                  <p className="font-semibold">{t.referral}</p>
                  <p className="break-all rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">{referralLink}</p>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(referralLink);
                      setNotice(t.copied);
                    }}
                    className="w-full rounded-lg border border-zinc-300 py-2 text-xs"
                  >
                    {t.copy}
                  </button>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                      <p className="font-semibold">{teamCount}</p>
                      <p className="text-zinc-500">{t.team}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                      <p className="font-semibold">{formatAmount(referralBonusTotal)} {t.tnd}</p>
                      <p className="text-zinc-500">{t.referralBonus}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                      <p className="font-semibold">{formatAmount(referralDepositBonusTotal)} {t.tnd}</p>
                      <p className="text-zinc-500">{t.referralDepositIncome}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                      <p className="font-semibold">{formatAmount(referralProfitBonusTotal)} {t.tnd}</p>
                      <p className="text-zinc-500">{t.referralProfitIncome}</p>
                    </div>
                  </div>
                </div>
              )}

              {mainTab === "profile" && (
                <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                  <p>{t.phone}: {session.phone}</p>
                  <button onClick={() => setRoute("settings")} className="w-full rounded-lg border border-zinc-300 py-2">{t.payPassSettings}</button>
                  <button onClick={() => setRoute("devices")} className="w-full rounded-lg border border-zinc-300 py-2">{t.myDevices}</button>
                  <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="w-full rounded-lg border border-zinc-300 px-3 py-2">
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                  </select>

                  <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                    <p className="mb-2 font-semibold">{t.referralIncomeDetails}</p>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-lg border border-zinc-200 bg-white p-2">
                        <p className="font-semibold text-emerald-700">+{formatAmount(referralDepositBonusTotal)} {t.tnd}</p>
                        <p className="text-zinc-500">{t.referralDepositIncome}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-white p-2">
                        <p className="font-semibold text-emerald-700">+{formatAmount(referralProfitBonusTotal)} {t.tnd}</p>
                        <p className="text-zinc-500">{t.referralProfitIncome}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                    <p className="mb-2 font-semibold">{t.txHistory}</p>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {([
                        ["all", t.filterAll],
                        ["deposit", t.filterDeposit],
                        ["withdraw", t.filterWithdraw],
                        ["pending", t.filterPending],
                        ["approved", t.filterApproved],
                        ["rejected", t.filterRejected],
                      ] as [TxFilter, string][]).map(([filterKey, label]) => (
                        <button
                          key={filterKey}
                          onClick={() => setTxFilter(filterKey)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${
                            txFilter === filterKey
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 bg-white text-zinc-600"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {filteredUserTxs.length === 0 && <p className="text-xs text-zinc-500">{t.noTx}</p>}
                    <div className="space-y-2">
                      {filteredUserTxs.map((tx) => (
                        <div key={tx.id} className="rounded-lg border border-zinc-200 bg-white p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{typeLabel(tx.type)}</span>
                            <span className={tx.status === "approved" ? "text-emerald-600" : tx.status === "rejected" ? "text-rose-600" : "text-amber-600"}>
                              {statusLabel(tx.status)}
                            </span>
                          </div>
                          <p className="mt-1">{formatAmount(tx.amount)} {t.tnd} - {tx.method}</p>
                          <p className="text-zinc-500">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                    <p className="mb-2 font-semibold">{t.autoProfitHistory}</p>
                    {userProfitRecords.length === 0 && <p className="text-xs text-zinc-500">{t.noAutoProfit}</p>}
                    <div className="space-y-2">
                      {userProfitRecords.slice(0, 10).map((record) => (
                        <div key={record.id} className="rounded-lg border border-zinc-200 bg-white p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-700">{t.autoProfitTag}</span>
                            <span className="font-semibold text-emerald-700">+{formatAmount(record.amount)} {t.tnd}</span>
                          </div>
                          <p className="text-zinc-500">{new Date(record.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {route === "deposit" && (
            <motion.section key="deposit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 px-4">
              <div className="mx-auto h-40 w-40 rounded-xl border border-zinc-200 bg-white p-2">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(depositDestination)}`} alt="qr" className="h-full w-full rounded-lg object-contain" />
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-2">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm">
                  <span className="truncate">{depositDestination}</span>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(depositDestination);
                      setNotice(t.copied);
                    }}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-white"
                  >
                    {t.copy}
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-semibold">| {t.depositChannels}</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {(["TRC20", "BEP20", "D17", "Flouci", "Bank"] as DepositChannel[]).map((channel) => (
                  <button
                    key={channel}
                    onClick={() => setDepositChannel(channel)}
                    className={`rounded-lg border px-2 py-2 ${depositChannel === channel ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white"}`}
                  >
                    {channel === "TRC20" ? "TRC20-USDT" : channel === "BEP20" ? "BEP20-USDT" : channel}
                  </button>
                ))}
              </div>

              <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder={t.amount} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm" />

              <label className="block rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-3 text-sm">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setDepositReceipt(e.target.files?.[0] ?? null)}
                />
                <span className="font-medium">{t.uploadProof}</span>
                <span className="mt-1 block text-xs text-zinc-500">{depositReceipt ? depositReceipt.name : t.chooseFile}</span>
              </label>

              <button onClick={submitDeposit} className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm text-white">{t.confirmDeposit}</button>

              <h3 className="text-xl font-semibold text-zinc-700">{t.depositInstructions}</h3>
              <div className="space-y-1 text-sm leading-7">
                {DEPOSIT_RULES[lang].map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </motion.section>
          )}

          {route === "withdraw" && (
            <motion.section key="withdraw" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 px-4">
              <div className="grid grid-cols-2 border-b border-zinc-300 text-center text-lg">
                <button onClick={() => setWithdrawType("bank")} className={`border-b-2 py-2 ${withdrawType === "bank" ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-400"}`}>{t.bankCard}</button>
                <button onClick={() => setWithdrawType("usdt")} className={`border-b-2 py-2 ${withdrawType === "usdt" ? "border-zinc-900 font-semibold" : "border-transparent text-zinc-400"}`}>USDT</button>
              </div>

              <p className="text-center text-4xl font-bold">{formatAmount(balance)} {t.tnd}</p>
              <p className="-mt-2 text-center text-xl">{t.accountBalance}</p>
              <div className="-mt-1 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <p>{t.withdrawableProfit}: <span className="font-semibold">{formatAmount(withdrawableAmountNow)} {t.tnd}</span></p>
                <button
                  onClick={() => setWithdrawAmount(withdrawableAmountNow > 0 ? String(withdrawableAmountNow) : "")}
                  className="rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs"
                >
                  {t.useMaxProfit}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-xl border border-zinc-200 bg-white px-2 py-2">
                  <p className="text-zinc-500">{t.accountBalance}</p>
                  <p className="mt-1 font-semibold text-zinc-900">{formatAmount(balance)} {t.tnd}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white px-2 py-2">
                  <p className="text-zinc-500">{t.todayProfit}</p>
                  <p className="mt-1 font-semibold text-emerald-700">{formatAmount(todayProfit)} {t.tnd}</p>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between text-base">
                  <span>{t.tnd}</span>
                  <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder={t.amount} className="w-44 bg-transparent text-zinc-500 outline-none" />
                </div>
                <div className="border-t border-zinc-200 pt-2 text-sm">
                  <span>
                    {withdrawType === "bank" ? t.serviceFeeBank : t.serviceFeeUsdt}
                    {validWithdrawAmount > 0 ? ` (${formatAmount(withdrawServiceFeeAmount)} ${withdrawType === "bank" ? t.tnd : "USDT"})` : ""}
                  </span>
                  <span className="ms-3">
                    {t.expectedArrival}: {formatAmount(withdrawExpectedAmount)} {withdrawType === "bank" ? t.tnd : "USDT"}
                  </span>
                </div>
              </div>

              {withdrawType === "bank" ? (
                <>
                  <button onClick={() => setShowSheet(true)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-right text-base">
                    {selectedChannel ? `${selectedChannel.provider} - ${selectedChannel.accountNumber}` : t.selectWithdrawChannel}
                  </button>
                  <input type="password" value={paymentPasswordInput} onChange={(e) => setPaymentPasswordInput(e.target.value)} placeholder={t.withdrawPassword} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(["TRC20", "BEP20"] as WithdrawNetwork[]).map((network) => (
                      <button key={network} onClick={() => setWithdrawNetwork(network)} className={`rounded-lg border px-3 py-2 ${withdrawNetwork === network ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white"}`}>{network}</button>
                    ))}
                  </div>
                  <input value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} placeholder={t.withdrawAddress} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" />
                  <input type="password" value={paymentPasswordInput} onChange={(e) => setPaymentPasswordInput(e.target.value)} placeholder={t.withdrawPassword} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" />
                </>
              )}

              <button onClick={submitWithdraw} className="mx-auto block w-3/4 rounded-xl bg-zinc-700 py-2.5 text-base text-white">{t.withdrawBtn}</button>

              <h3 className="text-2xl font-semibold">| {t.withdrawInstructions}</h3>
              <div className="space-y-1 text-sm leading-7">
                {WITHDRAW_RULES[lang].map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </motion.section>
          )}

          {route === "bind-bank" && (
            <motion.section key="bind-bank" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 px-4">
              <label className="block text-lg font-semibold">{t.channel}</label>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {(["Bank", "D17", "Flouci"] as WithdrawProvider[]).map((provider) => (
                  <button key={provider} onClick={() => setBindProvider(provider)} className={`rounded-lg border px-2 py-2 ${bindProvider === provider ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white"}`}>{provider}</button>
                ))}
              </div>
              <label className="block text-lg font-semibold">{t.name}</label>
              <input value={bindName} onChange={(e) => setBindName(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" placeholder={t.nameHint} />
              <label className="block text-lg font-semibold">{t.phone}</label>
              <input value={bindPhone} onChange={(e) => setBindPhone(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" placeholder={t.phoneHint} />
              <label className="block text-lg font-semibold">{t.accountNumber}</label>
              <input value={bindAccount} onChange={(e) => setBindAccount(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" placeholder={t.accountHint} />
              <button onClick={saveWithdrawalChannel} className="mx-auto mt-5 block w-3/4 rounded-xl bg-zinc-700 py-2.5 text-base text-white">{t.save}</button>
            </motion.section>
          )}

          {route === "devices" && (
            <motion.section key="devices" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 px-4">
              <h3 className="text-base font-semibold">{t.myDevicesTitle}</h3>
              {userDevices.length === 0 && (
                <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-500">{t.noDevices}</p>
              )}
              <div className="space-y-2">
                {userDevices.map((device) => {
                  const { purchasedAtMs, endAtMs, effectiveNow } = getDeviceLifecycle(device, clockNow);
                  const elapsed = effectiveNow - purchasedAtMs;
                  const totalDurationMs = Math.max(1, Number(device.validityDays || 0) * DEVICE_PAYOUT_INTERVAL_MS);
                  const progressRatio = Math.min(1, Math.max(0, elapsed / totalDurationMs));
                  const progressPercent = Number((progressRatio * 100).toFixed(1));
                  const progressBarWidth = progressPercent > 0 && progressPercent < 1 ? 1 : progressPercent;
                  const liveProfitValue = Math.min(device.totalIncome, Number((progressRatio * device.totalIncome).toFixed(4)));
                  const earnedProfit = Number((device.earnedAmount ?? 0).toFixed(4));
                  const remainingProfit = Math.max(0, Number((device.totalIncome - earnedProfit).toFixed(4)));
                  const isFinished = remainingProfit <= 0 || clockNow >= endAtMs;
                  return (
                    <div key={device.id} className="rounded-xl border border-zinc-200 bg-white p-2.5">
                      <div className="flex items-start gap-2">
                        <img src={device.image} alt={`device ${device.planPrice}`} className="h-14 w-14 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{device.planCode} - {device.planPrice} {t.tnd}</p>
                            <span className={`text-xs ${isFinished ? "text-zinc-500" : "text-emerald-600"}`}>{isFinished ? t.finished : t.runningNow}</span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-600">{t.purchasedAt}: {new Date(device.purchasedAt).toLocaleString()}</p>
                          <p className="text-xs text-zinc-600">{t.runTime}: {formatDuration(elapsed)}</p>
                           <p className="text-xs text-zinc-600">{t.dailyIncomeLabel}: {formatAmount(device.dailyIncome)} {t.tnd}</p>
                           <p className="font-medium text-zinc-800">{t.liveProfit}: {formatAmount(liveProfitValue)} {t.tnd}</p>
                           <p className="text-xs text-zinc-600">{t.earnedProfit}: {formatAmount(earnedProfit)} {t.tnd}</p>
                           <p className="text-xs text-zinc-600">{t.remainingProfit}: {formatAmount(remainingProfit)} {t.tnd}</p>
                            <div className="mt-1">
                              <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                                <span>{t.completionRate}</span>
                                <span>{progressPercent}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                                <div
                                  className={`h-full rounded-full ${isFinished ? "bg-zinc-500" : "bg-blue-600"}`}
                                  style={{ width: `${isFinished ? 100 : progressBarWidth}%` }}
                                />
                              </div>
                            </div>
                           <p className="text-xs text-zinc-600">{t.expiresAt}: {new Date(endAtMs).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {route === "settings" && (
            <motion.section key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 px-4">
              <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-600">{t.settingsHint}</p>
              {currentAccount?.paymentPassword && <input type="password" value={oldPayPassword} onChange={(e) => setOldPayPassword(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" placeholder={t.currentPassword} />}
              <input type="password" value={newPayPassword} onChange={(e) => setNewPayPassword(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" placeholder={t.newPassword} />
              <input type="password" value={confirmPayPassword} onChange={(e) => setConfirmPayPassword(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base" placeholder={t.confirmNewPassword} />
              <button onClick={savePaymentPassword} className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm text-white">{t.savePayPassword}</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {route === "home" && (
        <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-sm -translate-x-1/2 grid-cols-4 border-t border-zinc-200 bg-white py-1 text-center text-sm">
          <button onClick={() => openUserTab("home")} className={`py-2 ${mainTab === "home" ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{t.home}</button>
          <button onClick={() => openUserTab("products")} className={`py-2 ${mainTab === "products" ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{t.products}</button>
          <button onClick={() => openUserTab("team")} className={`py-2 ${mainTab === "team" ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{t.team}</button>
          <button onClick={() => openUserTab("profile")} className={`py-2 ${mainTab === "profile" ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{t.profile}</button>
        </nav>
      )}

      <AnimatePresence>
        {introOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-4"
            onClick={() => setIntroOpen(false)}
          >
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-white p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{INTRO_CONTENT[lang].title}</h3>
              <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                {INTRO_CONTENT[lang].lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <button onClick={() => setIntroOpen(false)} className="mt-4 w-full rounded-lg bg-zinc-900 py-2 text-sm text-white">
                {t.ok}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSheet && route === "withdraw" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/45"
            onClick={() => setShowSheet(false)}
          >
            <motion.div
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              exit={{ y: 120 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="absolute bottom-0 left-1/2 w-full max-w-sm -translate-x-1/2 rounded-t-3xl bg-white p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowSheet(false);
                  setRoute("bind-bank");
                }}
                className="mb-3 w-full rounded-xl border border-zinc-300 py-3 text-sm"
              >
                {t.addChannel}
              </button>

              <div className="space-y-2">
                {withdrawChannels.length === 0 && <p className="text-center text-sm text-zinc-500">{t.noChannels}</p>}
                {withdrawChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => {
                      setSelectedChannelId(channel.id);
                      setShowSheet(false);
                    }}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-right text-sm"
                  >
                    <span className="font-semibold">{channel.provider}</span> - {channel.accountNumber}
                  </button>
                ))}
              </div>
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
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4"
            onClick={() => setReviewDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-xs rounded-2xl bg-white p-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{t.reviewPopupTitle}</h3>
              <p className="mt-2 text-sm text-zinc-600">{t.reviewNotice}</p>
              <button onClick={() => setReviewDialogOpen(false)} className="mt-4 w-full rounded-lg bg-zinc-900 py-2 text-sm text-white">{t.ok}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {proofPreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={() => setProofPreviewUrl("")}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-white p-3"
              onClick={(e) => e.stopPropagation()}
            >
              {isImageProofUrl(proofPreviewUrl) ? (
                <img src={proofPreviewUrl} alt="proof" className="max-h-[70vh] w-full rounded-lg object-contain" />
              ) : isPdfProofUrl(proofPreviewUrl) || proofPreviewUrl.startsWith("http") || proofPreviewUrl.startsWith("blob:") ? (
                <iframe src={proofPreviewUrl} title="proof" className="h-[70vh] w-full rounded-lg" />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{t.proofUnavailable}</div>
              )}
              <button onClick={() => setProofPreviewUrl("")} className="mt-3 w-full rounded-lg border border-zinc-300 py-2 text-sm">{t.close}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
