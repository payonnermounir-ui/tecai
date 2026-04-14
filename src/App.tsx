import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { loadSupabaseState, saveSupabaseState, type SupabaseState } from "./lib/supabaseState";

// ... (جميع تعريفات الأنواع (type Lang, AuthMode, Role, etc.) تبقى كما هي) ...
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

// ... (جميع الثوابت (ADMIN_PHONE, DICT, ROBOT_PRODUCTS, etc.) تبقى كما هي) ...
const ADMIN_PHONE = "55810112";
const ADMIN_PASSWORD = "TECAI@2026";
const ADMIN_PHONE_WITH_CODE = "+21655810112";
const COUNTRY_CODES = ["+216", "+20", "+966", "+971", "+86", "+1"];
const REFERRAL_DEPOSIT_RATE = 0.05;
const REFERRAL_PROFIT_RATE = 0.025;
const DAILY_DEVICE_PROFIT_RATE = 0.03;
const WITHDRAW_SERVICE_FEE_RATE = 0.2;

// ... (EyeIcon, DESTINATIONS, DEPOSIT_RULES, etc.) ...
function EyeIcon({ closed = false }: { closed?: boolean }) { /* ... */ }
const DESTINATIONS: Record<DepositChannel, string> = { /* ... */ };
const DICT = { /* ... */ };
const DEPOSIT_RULES: Record<Lang, string[]> = { /* ... */ };
const WITHDRAW_RULES: Record<Lang, string[]> = { /* ... */ };
const ROBOT_PRODUCTS = [ /* ... */ ];
const INTRO_CONTENT: Record<Lang, { title: string; lines: string[] }> = { /* ... */ };
const DEVICE_PAYOUT_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ... (جميع الدوال المساعدة (getDeviceLifecycle, formatAmount, createUniqueId, etc.) تبقى كما هي) ...
function getDeviceLifecycle(device: OwnedDevice, nowMs: number) { /* ... */ }
function formatAmount(value: number) { /* ... */ }
function formatPlanNumber(value: number) { /* ... */ }
function loadJson<T>(key: string, fallback: T): T { /* ... */ } // قد نحتاجها للغة فقط
function normalizePhone(value: string) { /* ... */ }
function buildAuthEmail(phone: string) { /* ... */ }
function isAlreadyRegisteredAuthError(message: string) { /* ... */ }
function parseReferralFromLocation() { /* ... */ }
function createUniqueId(prefix: string) { /* ... */ }
function parseAmountInput(value: string) { /* ... */ }
function formatDuration(ms: number) { /* ... */ }
function fileToDataUrl(file: File): Promise<string> { /* ... */ }
function normalizeProofUrl(raw?: string) { /* ... */ }
function isImageProofUrl(value: string) { /* ... */ }
function isPdfProofUrl(value: string) { /* ... */ }


export default function App() {
  // --- State Definitions ---
  const [lang, setLang] = useState<Lang>(() => loadJson<Lang>("tecai:lang", "ar"));
  const [session, setSession] = useState<Session>(null);
  const [accounts, setAccounts] = useState<Record<string, UserAccount>>({});
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [devices, setDevices] = useState<OwnedDevice[]>([]);
  const [profitRecords, setProfitRecords] = useState<ProfitRecord[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const accountsRef = useRef(accounts);
  const saveTimeoutRef = useRef<number | null>(null);

  // --- UI State (Routing, Forms, etc.) ---
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
  const [pendingReferralPhone, setPendingReferralPhone] = useState<string>("");

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


  // --- Helper Functions for Cloud Sync ---
  const syncToCloud = async (newState: Partial<SupabaseState>) => {
    if (!isSupabaseConfigured) return;
    // We need the current full state to update only the changed parts.
    // To keep it simple, we'll save the entire relevant state every time.
    const fullState: SupabaseState = {
      lang,
      session: null, // Never sync session
      accounts,
      balances,
      txs,
      devices,
      profitRecords,
      ...newState,
    };
    await saveSupabaseState(fullState);
  };

  // Generic state setter that triggers cloud sync
  const setAndSync = async <T,>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T | ((prev: T) => T),
    syncFields: keyof SupabaseState
  ) => {
    let newValue: T;
    setter((prev) => {
      newValue = value instanceof Function ? value(prev) : value;
      return newValue;
    });
    // Use a timeout to batch rapid updates
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      syncToCloud({ [syncFields]: newValue });
    }, 500);
  };

  // --- Data Loading on Mount ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const remoteState = await loadSupabaseState();
        if (remoteState) {
          setLang(remoteState.lang ?? "ar");
          setAccounts(remoteState.accounts ?? {});
          setBalances(remoteState.balances ?? {});
          setTxs(remoteState.txs ?? []);
          setDevices(remoteState.devices ?? []);
          setProfitRecords(remoteState.profitRecords ?? []);
        } else {
          // Initialize empty state if nothing in cloud
          setAccounts({});
          setBalances({});
          setTxs([]);
          setDevices([]);
          setProfitRecords([]);
        }
      } catch (error) {
        console.error("Failed to load data from Supabase:", error);
        setNotice("Failed to load data. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Session Management (Supabase Auth) ---
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      const phoneFromAuth = normalizePhone(String(authSession?.user?.user_metadata?.phone ?? ""));
      if (phoneFromAuth) {
        setSession({ role: "user", phone: phoneFromAuth });
      } else {
        setSession(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      const phoneFromAuth = normalizePhone(String(authSession?.user?.user_metadata?.phone ?? ""));
      if (phoneFromAuth) {
        setSession({ role: "user", phone: phoneFromAuth });
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // --- Update accountsRef when accounts change ---
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  // --- Language persistence (keep in localStorage for simplicity) ---
  useEffect(() => {
    localStorage.setItem("tecai:lang", JSON.stringify(lang));
  }, [lang]);

  // --- Referral link handling ---
  useEffect(() => {
    const incomingRef = parseReferralFromLocation();
    if (!incomingRef || incomingRef === ADMIN_PHONE || incomingRef === ADMIN_PHONE_WITH_CODE) return;
    setPendingReferralPhone((prev) => (prev || incomingRef));
  }, []);

  // --- Clock for real-time updates ---
  useEffect(() => {
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // --- Device Payout Logic (same as before, but uses setAndSync) ---
  useEffect(() => {
    async function processDevicePayouts() {
      const now = Date.now();
      const creditedRecords: ProfitRecord[] = [];
      const referralBonusTxs: Transaction[] = [];
      let devicesChanged = false;
      let newDevices = [...devices];
      let newBalances = { ...balances };
      let newProfitRecords = [...profitRecords];
      let newTxs = [...txs];

      for (let i = 0; i < newDevices.length; i++) {
        const device = newDevices[i];
        const { effectiveNow } = getDeviceLifecycle(device, now);
        const payoutBase = new Date(device.lastPayoutAt ?? device.purchasedAt).getTime();
        const elapsed = effectiveNow - payoutBase;
        const cycles = Math.floor(elapsed / DEVICE_PAYOUT_INTERVAL_MS);
        if (cycles <= 0) continue;

        devicesChanged = true;
        const earnedSoFar = device.earnedAmount ?? 0;
        const remaining = Math.max(0, Number((device.totalIncome - earnedSoFar).toFixed(4)));
        const rawPayout = Number((cycles * device.dailyIncome).toFixed(4));
        const payoutAmount = Number(Math.min(rawPayout, remaining).toFixed(4));

        if (payoutAmount > 0) {
          const newRecord: ProfitRecord = {
            id: createUniqueId(`pr_${device.id}`),
            phone: device.phone,
            deviceId: device.id,
            amount: payoutAmount,
            cycles,
            createdAt: new Date(now).toISOString(),
          };
          creditedRecords.push(newRecord);
          newProfitRecords = [newRecord, ...newProfitRecords];
          
          // Update balance
          newBalances[device.phone] = Number(((newBalances[device.phone] ?? 0) + payoutAmount).toFixed(4));

          // Referral profit bonus
          const inviterPhone = accountsRef.current[device.phone]?.referredBy;
          if (inviterPhone && inviterPhone !== device.phone) {
            const referralProfitBonus = Number((payoutAmount * REFERRAL_PROFIT_RATE).toFixed(4));
            if (referralProfitBonus > 0) {
              newBalances[inviterPhone] = Number(((newBalances[inviterPhone] ?? 0) + referralProfitBonus).toFixed(4));
              referralBonusTxs.push({
                id: createUniqueId("tx_ref_profit"),
                phone: inviterPhone,
                type: "deposit",
                amount: referralProfitBonus,
                method: "Referral 2.5% profit bonus",
                status: "approved",
                payoutDetails: `From ${device.phone}`,
                createdAt: new Date(now).toISOString(),
              });
            }
          }
        }

        newDevices[i] = {
          ...device,
          earnedAmount: Number((earnedSoFar + (payoutAmount > 0 ? payoutAmount : 0)).toFixed(4)),
          lastPayoutAt: new Date(Math.min(effectiveNow, payoutBase + cycles * DEVICE_PAYOUT_INTERVAL_MS)).toISOString(),
        };
      }

      if (creditedRecords.length > 0) {
        newTxs = [...referralBonusTxs, ...newTxs];
        setDevices(newDevices);
        setBalances(newBalances);
        setProfitRecords(newProfitRecords);
        setTxs(newTxs);
        
        // Sync to cloud after state updates
        await syncToCloud({ devices: newDevices, balances: newBalances, profitRecords: newProfitRecords, txs: newTxs });
      }
    }

    processDevicePayouts();
    const intervalId = setInterval(processDevicePayouts, 60_000);
    return () => clearInterval(intervalId);
  }, [devices, balances, profitRecords, txs]);

  // --- Sync to cloud whenever core data changes (debounced) ---
  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => {
      syncToCloud({ accounts, balances, txs, devices, profitRecords, lang });
    }, 1000);
    return () => clearTimeout(handler);
  }, [accounts, balances, txs, devices, profitRecords, lang, isLoading]);

  // --- Other side effects (intro, notice timeout, etc.) ---
  useEffect(() => {
    if (session?.role === "user") {
      setIntroOpen(true);
    } else {
      setIntroOpen(false);
    }
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    resetWithdrawForm();
  }, [session?.phone]);

  // --- Helper functions for state updates with cloud sync ---
  const updateAccounts = async (newAccounts: Record<string, UserAccount> | ((prev: Record<string, UserAccount>) => Record<string, UserAccount>)) => {
    let updated: Record<string, UserAccount>;
    setAccounts(prev => {
      updated = typeof newAccounts === 'function' ? newAccounts(prev) : newAccounts;
      return updated;
    });
    await syncToCloud({ accounts: updated! });
  };

  const updateBalances = async (newBalances: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    let updated: Record<string, number>;
    setBalances(prev => {
      updated = typeof newBalances === 'function' ? newBalances(prev) : newBalances;
      return updated;
    });
    await syncToCloud({ balances: updated! });
  };

  const updateTxs = async (newTxs: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    let updated: Transaction[];
    setTxs(prev => {
      updated = typeof newTxs === 'function' ? newTxs(prev) : newTxs;
      return updated;
    });
    await syncToCloud({ txs: updated! });
  };

  const updateDevices = async (newDevices: OwnedDevice[] | ((prev: OwnedDevice[]) => OwnedDevice[])) => {
    let updated: OwnedDevice[];
    setDevices(prev => {
      updated = typeof newDevices === 'function' ? newDevices(prev) : newDevices;
      return updated;
    });
    await syncToCloud({ devices: updated! });
  };

  const updateProfitRecords = async (newProfitRecords: ProfitRecord[] | ((prev: ProfitRecord[]) => ProfitRecord[])) => {
    let updated: ProfitRecord[];
    setProfitRecords(prev => {
      updated = typeof newProfitRecords === 'function' ? newProfitRecords(prev) : newProfitRecords;
      return updated;
    });
    await syncToCloud({ profitRecords: updated! });
  };


  // --- Authentication Handlers ---
  const getFullPhone = () => `${countryCode}${phoneInput.trim()}`;

  const onUserAuthSubmit = async () => {
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

      await updateAccounts({
        ...accounts,
        [fullPhone]: { loginPassword: password, channels: [], referredBy },
      });
      await updateBalances({ ...balances, [fullPhone]: balances[fullPhone] ?? 0 });
      
      setNotice(t.accountCreated);
      setPendingReferralPhone("");
      setAuthMode("login");
      resetAuthFields();
      return;
    }

    // Login
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
      await updateAccounts({
        ...accounts,
        [fullPhone]: { loginPassword: password, channels: [] },
      });
      await updateBalances({ ...balances, [fullPhone]: balances[fullPhone] ?? 0 });
    }

    setSession({ role: "user", phone: fullPhone });
    setRoute("home");
    setMainTab("home");
    resetAuthFields();
  };

  const onAdminLogin = () => {
    const normalizedAdminPhone = normalizePhone(adminPhone);
    const isAdminPhone = normalizedAdminPhone === ADMIN_PHONE || normalizedAdminPhone === ADMIN_PHONE_WITH_CODE;
    if (!isAdminPhone || adminPass !== ADMIN_PASSWORD) {
      setNotice(t.adminCredentialsWrong);
      return;
    }
    setSession({ role: "admin", phone: ADMIN_PHONE });
    setAdminPass("");
  };

  const logout = async () => {
    if (session?.role === "user" && isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setRoute("home");
    setMainTab("home");
    setAuthMode("login");
    setIntroOpen(false);
    setShowSheet(false);
    setReviewDialogOpen(false);
    setProofPreviewUrl("");
    resetWithdrawForm();
  };

  // --- Business Logic Handlers (Deposit, Withdraw, etc.) ---
  const submitDeposit = async () => {
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

    const newTx: Transaction = {
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
    await updateTxs([newTx, ...txs]);
    setDepositAmount("");
    setDepositReceipt(null);
    setReviewDialogOpen(true);
  };

  const submitWithdraw = async () => {
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

    const newTx: Transaction = {
      id: createUniqueId("tx"),
      phone: currentPhone,
      type: "withdraw",
      amount,
      method,
      payoutDetails,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await updateTxs([newTx, ...txs]);
    resetWithdrawForm();
    setReviewDialogOpen(true);
  };

  const saveWithdrawalChannel = async () => {
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

    const currentUserAccount = accounts[currentPhone] as UserAccount;
    const updatedAccount = {
      ...currentUserAccount,
      channels: [...(currentUserAccount?.channels ?? []), nextChannel],
    };
    await updateAccounts({
      ...accounts,
      [currentPhone]: updatedAccount,
    });

    setSelectedChannelId(nextChannel.id);
    setBindName("");
    setBindPhone("");
    setBindAccount("");
    setRoute("withdraw");
    setNotice(t.channelAdded);
  };

  const savePaymentPassword = async () => {
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

    await updateAccounts({
      ...accounts,
      [currentPhone]: {
        ...(accounts[currentPhone] as UserAccount),
        paymentPassword: newPayPassword,
      },
    });
    setOldPayPassword("");
    setNewPayPassword("");
    setConfirmPayPassword("");
    setNotice(t.passwordSaved);
  };

  const updateTxStatus = async (txId: string, next: "approved" | "rejected") => {
    const target = txs.find((x) => x.id === txId);
    if (!target || target.status !== "pending") return;

    const updatedTxs = txs.map((x) => (x.id === txId ? { ...x, status: next } : x));
    await updateTxs(updatedTxs);

    if (next === "approved") {
      const referralBonusTxs: Transaction[] = [];
      let newBalances = { ...balances };
      
      const before = newBalances[target.phone] ?? 0;
      const after = target.type === "deposit" ? before + target.amount : Math.max(0, before - target.amount);
      newBalances[target.phone] = after;

      if (target.type === "deposit") {
        const inviterPhone = accounts[target.phone]?.referredBy;
        if (inviterPhone && inviterPhone !== target.phone) {
          const referralBonus = Number((target.amount * REFERRAL_DEPOSIT_RATE).toFixed(4));
          if (referralBonus > 0) {
            newBalances[inviterPhone] = Number(((newBalances[inviterPhone] ?? 0) + referralBonus).toFixed(4));
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

      await updateBalances(newBalances);
      if (referralBonusTxs.length > 0) {
        await updateTxs([...referralBonusTxs, ...updatedTxs]);
      }
    }
  };

  const activateProductPlan = async (plan: (typeof ROBOT_PRODUCTS)[number]) => {
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

    const newBalance = Math.max(0, (balances[currentPhone] ?? 0) - plan.price);
    await updateBalances({ ...balances, [currentPhone]: newBalance });
    await updateDevices([nextDevice, ...devices]);
    setNotice(t.boughtSuccess);
    setRoute("devices");
  };

  // --- Reset Helpers ---
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

  // --- Render Helpers ---
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
    [withdrawChannels, selectedChannelId]
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

  function statusLabel(status: Transaction["status"]) { /* ... */ }
  function typeLabel(type: Transaction["type"]) { /* ... */ }
  function openTelegramHelp() { /* ... */ }
  function openProofPreview(rawUrl?: string) { /* ... */ }
  function openUserTab(tab: MainTab) { /* ... */ }

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-t-transparent"></div>
          <p className="text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  // --- Render Logic (No Session) ---
  if (!session) {
    const showAdmin = window.location.hash === "#admin";
    return (
      // ... (نفس JSX السابق لقسم تسجيل الدخول) ...
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

  // --- Render Logic (Admin Session) ---
  if (session.role === "admin") {
    const pending = txs.filter((x) => x.status === "pending");
    return (
      // ... (نفس JSX السابق للوحة تحكم الأدمن) ...
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

  // --- Render Logic (User Session) ---
  return (
    // ... (نفس JSX السابق لقسم المستخدم، مع استبدال دوال التحديث القديمة بالجديدة مثل updateAccounts, updateBalances, etc.) ...
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
