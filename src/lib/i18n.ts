import type { AppTab, Language } from "../types";

type Dictionary = {
  appName: string;
  tagline: string;
  balance: string;
  dailyProfit: string;
  totalProfit: string;
  quickActions: string;
  deposit: string;
  withdraw: string;
  team: string;
  app: string;
  help: string;
  officialSite: string;
  amount: string;
  paymentMethod: string;
  submitDeposit: string;
  submitWithdraw: string;
  depositPlans: string;
  depositRules: string;
  minDepositRule: string;
  underMinRule: string;
  postDepositRule: string;
  policyRule: string;
  liabilityRule: string;
  withdrawalHistory: string;
  profitSystemTitle: string;
  profitSystemDesc: string;
  referralTitle: string;
  referralDesc: string;
  teamMembers: string;
  referralRate: string;
  copyLink: string;
  copied: string;
  dashboard: string;
  admin: string;
  users: string;
  pendingTransactions: string;
  approve: string;
  reject: string;
  notifications: string;
  send: string;
  adjustBalance: string;
  language: string;
  theme: string;
  dark: string;
  light: string;
  tabLabel: Record<AppTab, string>;
};

export const dictionary: Record<Language, Dictionary> = {
  ar: {
    appName: "TECAI",
    tagline: "منصة أرباح يومية ذكية وسهلة الاستخدام",
    balance: "الرصيد",
    dailyProfit: "أرباح اليوم",
    totalProfit: "إجمالي الأرباح",
    quickActions: "الإجراءات السريعة",
    deposit: "إيداع",
    withdraw: "سحب",
    team: "الفريق",
    app: "التطبيق",
    help: "مساعدة",
    officialSite: "الموقع الرسمي",
    amount: "المبلغ",
    paymentMethod: "وسيلة الدفع",
    submitDeposit: "إرسال طلب الإيداع",
    submitWithdraw: "إرسال طلب السحب",
    depositPlans: "خطط الإيداع",
    depositRules: "تعليمات الإيداع",
    minDepositRule: "الحد الأدنى للإيداع 30",
    underMinRule: "أي إيداع أقل من 30 لا يتم معالجته",
    postDepositRule: "بعد كل عملية إيداع يجب إرسال معلومات العملية لتحديث الرصيد",
    policyRule: "يجب الالتزام بقواعد المنصة لتجنب الخسارة",
    liabilityRule: "المنصة غير مسؤولة عن الأخطاء الناتجة عن إدخال معلومات خاطئة",
    withdrawalHistory: "سجل السحب",
    profitSystemTitle: "نظام الأرباح",
    profitSystemDesc: "أرباح يومية تلقائية حسب خطة المستخدم مع عرض مباشر داخل التطبيق",
    referralTitle: "نظام الإحالة",
    referralDesc: "احصل على نسبة من أرباح الأصدقاء عبر رابط الدعوة الخاص بك",
    teamMembers: "عدد أعضاء الفريق",
    referralRate: "نسبة الإحالة",
    copyLink: "نسخ الرابط",
    copied: "تم النسخ",
    dashboard: "الصفحة الرئيسية",
    admin: "لوحة الإدارة",
    users: "المستخدمون",
    pendingTransactions: "الطلبات المعلقة",
    approve: "موافقة",
    reject: "رفض",
    notifications: "الإشعارات",
    send: "إرسال",
    adjustBalance: "تعديل الرصيد",
    language: "اللغة",
    theme: "المظهر",
    dark: "داكن",
    light: "فاتح",
    tabLabel: {
      dashboard: "الرئيسية",
      deposit: "الإيداع",
      withdraw: "السحب",
      team: "الفريق",
      admin: "الإدارة",
    },
  },
  en: {
    appName: "TECAI",
    tagline: "Smart daily profit platform with a clean mobile-first experience",
    balance: "Balance",
    dailyProfit: "Daily Profit",
    totalProfit: "Total Profit",
    quickActions: "Quick Actions",
    deposit: "Deposit",
    withdraw: "Withdraw",
    team: "Team",
    app: "App",
    help: "Help",
    officialSite: "Official Site",
    amount: "Amount",
    paymentMethod: "Payment Method",
    submitDeposit: "Submit Deposit",
    submitWithdraw: "Submit Withdrawal",
    depositPlans: "Deposit Plans",
    depositRules: "Deposit Instructions",
    minDepositRule: "Minimum deposit is 30",
    underMinRule: "Any deposit under 30 will not be processed",
    postDepositRule: "After each deposit, submit transaction details to update balance",
    policyRule: "Follow platform rules to avoid loss",
    liabilityRule: "The platform is not responsible for errors from incorrect data input",
    withdrawalHistory: "Withdrawal History",
    profitSystemTitle: "Profit System",
    profitSystemDesc: "Automatic daily earnings based on your selected plan",
    referralTitle: "Affiliate System",
    referralDesc: "Share your private invitation link and earn referral percentage",
    teamMembers: "Team Members",
    referralRate: "Referral Rate",
    copyLink: "Copy Link",
    copied: "Copied",
    dashboard: "Dashboard",
    admin: "Admin Panel",
    users: "Users",
    pendingTransactions: "Pending Requests",
    approve: "Approve",
    reject: "Reject",
    notifications: "Notifications",
    send: "Send",
    adjustBalance: "Adjust Balance",
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    tabLabel: {
      dashboard: "Home",
      deposit: "Deposit",
      withdraw: "Withdraw",
      team: "Team",
      admin: "Admin",
    },
  },
  zh: {
    appName: "TECAI",
    tagline: "智能每日收益平台，简洁易用",
    balance: "余额",
    dailyProfit: "每日收益",
    totalProfit: "累计收益",
    quickActions: "快捷操作",
    deposit: "充值",
    withdraw: "提现",
    team: "团队",
    app: "应用",
    help: "帮助",
    officialSite: "官方网站",
    amount: "金额",
    paymentMethod: "支付方式",
    submitDeposit: "提交充值",
    submitWithdraw: "提交提现",
    depositPlans: "充值方案",
    depositRules: "充值说明",
    minDepositRule: "最低充值金额为 30",
    underMinRule: "低于 30 的充值将不被处理",
    postDepositRule: "每次充值后需提交交易信息以更新余额",
    policyRule: "请遵守平台规则以避免损失",
    liabilityRule: "因错误填写信息造成的损失平台不负责",
    withdrawalHistory: "提现记录",
    profitSystemTitle: "收益系统",
    profitSystemDesc: "根据用户方案自动生成每日收益并实时展示",
    referralTitle: "邀请系统",
    referralDesc: "分享专属邀请链接并获得好友收益分成",
    teamMembers: "团队成员",
    referralRate: "邀请比例",
    copyLink: "复制链接",
    copied: "已复制",
    dashboard: "首页",
    admin: "管理后台",
    users: "用户",
    pendingTransactions: "待处理请求",
    approve: "通过",
    reject: "拒绝",
    notifications: "通知",
    send: "发送",
    adjustBalance: "调整余额",
    language: "语言",
    theme: "主题",
    dark: "深色",
    light: "浅色",
    tabLabel: {
      dashboard: "主页",
      deposit: "充值",
      withdraw: "提现",
      team: "团队",
      admin: "管理",
    },
  },
};
