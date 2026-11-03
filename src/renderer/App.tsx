import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Boxes,
  ShoppingBag,
  ReceiptText,
  Users,
  Truck,
  Wallet,
  CreditCard,
  FileBarChart,
  DatabaseBackup,
  ShieldCheck,
  Bell,
  Settings as SettingsIcon,
  Info,
  Menu,
  LogOut,
  KeyRound,
  ChevronDown,
  ScrollText,
  AlertCircle,
  Globe,
} from 'lucide-react';
import logo from '../../assets/icons/merqo.png';
import { call, getToken, clearToken } from './api';
import {
  Button,
  Card,
  Modal,
  Field,
  Input,
  Badge,
  useToast,
  ToastProvider,
  Loading,
  dateBn,
} from './components';
import { getLanguage, setLanguage, syncLanguageFromSettings, type Language } from './i18n';
import { Activation, Login, Setup } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Pos } from './pages/Pos';
import { Products, Catalogue, Inventory, Expenses } from './pages/Business';
import { Purchases, SalesHistory, Parties, Finance } from './pages/Transactions';
import { Reports, Backup, UsersPage, Notifications, SettingsPage, About } from './pages/System';

type IconType = React.ComponentType<{ size?: number; className?: string }>;
interface NavItem {
  key: string;
  label: string;
  icon: IconType;
  render: (navigate: (key: string) => void) => React.ReactNode;
}
interface NavGroup {
  group: string;
  items: NavItem[];
}
const navGroups: NavGroup[] = [
  {
    group: 'প্রধান',
    items: [
      {
        key: 'dashboard',
        label: 'ড্যাশবোর্ড',
        icon: LayoutDashboard,
        render: (navigate) => <Dashboard onNavigate={(key) => navigate(key)} />,
      },
      { key: 'pos', label: 'নতুন সেল (POS)', icon: ShoppingCart, render: () => <Pos /> },
    ],
  },
  {
    group: 'পণ্য ও স্টক',
    items: [
      { key: 'products', label: 'পণ্য', icon: Package, render: () => <Products /> },
      { key: 'catalogue', label: 'ক্যাটাগরি ও ব্র্যান্ড', icon: Tags, render: () => <Catalogue /> },
      { key: 'inventory', label: 'ইনভেন্টরি', icon: Boxes, render: () => <Inventory /> },
    ],
  },
  {
    group: 'লেনদেন',
    items: [
      { key: 'purchases', label: 'ক্রয়', icon: ShoppingBag, render: () => <Purchases /> },
      { key: 'sales', label: 'বিক্রয় / রিটার্ন', icon: ReceiptText, render: () => <SalesHistory /> },
      {
        key: 'customers',
        label: 'গ্রাহক ও বাকি',
        icon: Users,
        render: () => <Parties initialTab="customer" />,
      },
      { key: 'suppliers', label: 'সরবরাহকারী', icon: Truck, render: () => <Parties initialTab="supplier" /> },
      { key: 'expenses', label: 'খরচ', icon: CreditCard, render: () => <Expenses /> },
      { key: 'finance', label: 'ক্যাশ ও অ্যাকাউন্ট', icon: Wallet, render: () => <Finance /> },
    ],
  },
  {
    group: 'বিশ্লেষণ ও সিস্টেম',
    items: [
      { key: 'reports', label: 'রিপোর্ট ও এক্সপোর্ট', icon: FileBarChart, render: () => <Reports /> },
      { key: 'backup', label: 'ব্যাকআপ ও রিস্টোর', icon: DatabaseBackup, render: () => <Backup /> },
      { key: 'users', label: 'ব্যবহারকারী ও RBAC', icon: ShieldCheck, render: () => <UsersPage /> },
      { key: 'audit', label: 'অডিট লগ', icon: ScrollText, render: () => <UsersPage initialTab={2} /> },
      { key: 'notifications', label: 'নোটিফিকেশন', icon: Bell, render: () => <Notifications /> },
      { key: 'settings', label: 'সেটিংস', icon: SettingsIcon, render: () => <SettingsPage /> },
      { key: 'about', label: 'সম্পর্কে', icon: Info, render: () => <About /> },
    ],
  },
];
const allItems = navGroups.flatMap((g) => g.items);

function comboMatches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+').map((p) => p.trim());
  const key = (parts.pop() ?? '').toLowerCase();
  const needCtrl = parts.some((p) => p.toLowerCase() === 'ctrl');
  const needAlt = parts.some((p) => p.toLowerCase() === 'alt');
  const needShift = parts.some((p) => p.toLowerCase() === 'shift');
  return (
    e.key.toLowerCase() === key && e.ctrlKey === needCtrl && e.altKey === needAlt && e.shiftKey === needShift
  );
}

function Shell({ status, actor, onLogout }: { status: any; actor: any; onLogout: () => void }) {
  const toast = useToast();
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [shortcutMap, setShortcutMap] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<Language>(getLanguage());
  const navigate = useCallback((key: string) => {
    setPage(key);
    setBellOpen(false);
    setUserOpen(false);
  }, []);

  useEffect(() => {
    void call<any>('shortcuts.map')
      .then(setShortcutMap)
      .catch(() => {});
    void syncLanguageFromSettings();
  }, []);
  const loadNotifications = useCallback(() => {
    void call<any>('notification.list', { pageSize: 20 })
      .then((d) => setNotifications(d.rows ?? []))
      .catch(() => {});
    void call<any>('notification.unread')
      .then((d) => setUnread(Number(d.count ?? 0)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const [action, combo] of Object.entries(shortcutMap)) {
        if (!comboMatches(e, combo)) continue;
        if (action === 'dashboard') {
          e.preventDefault();
          navigate('dashboard');
        }
        if (action === 'products') {
          e.preventDefault();
          navigate('products');
        }
        if (action === 'reports') {
          e.preventDefault();
          navigate('reports');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutMap, navigate]);

  const active = allItems.find((i) => i.key === page) ?? allItems[0]!;
  const greeting = String(status?.greeting ?? 'স্বাগতম');
  const businessName = String(status?.business?.business_name ?? 'MERQO');
  const today = new Date().toLocaleDateString('bn-BD', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const markAll = async () => {
    try {
      await call('notification.markRead', { all: true });
      loadNotifications();
      toast('সব বিজ্ঞপ্তি পড়া হয়েছে।', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand-row">
          <img src={logo} alt="MERQO" />
          <div className="brand-text">
            <div className="brand-name">MERQO</div>
            <div className="brand-sub">ব্যবসা ব্যবস্থাপনা</div>
          </div>
        </div>
        <nav className="nav">
          {navGroups.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    title={item.label}
                    className={`nav-item ${page === item.key ? 'active' : ''}`}
                    onClick={() => navigate(item.key)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => setCollapsed((c) => !c)} title="সাইডবার">
            <Menu size={18} />
            <span>সাইডবার সংকুচিত</span>
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="greeting">
              {greeting} {today}
            </div>
            <div className="business">{businessName}</div>
          </div>
          <span className="spacer" />
          {!status?.integrity ? (
            <Badge tone="danger">ডাটাবেজ অখণ্ডতা যাচাই প্রয়োজন</Badge>
          ) : (
            <Badge tone="success">অফলাইন · স্থানীয়</Badge>
          )}
          <button
            className="btn"
            title={lang === 'bn' ? 'Switch to English' : 'বাংলায় ফিরুন'}
            onClick={() => {
              const next: Language = lang === 'bn' ? 'en' : 'bn';
              setLang(next);
              void setLanguage(next);
            }}
          >
            <Globe size={15} /> {lang === 'bn' ? 'EN' : 'BN'}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              title="নোটিফিকেশন"
              onClick={() => {
                setBellOpen((v) => !v);
                setUserOpen(false);
              }}
            >
              <Bell size={17} />
              {unread > 0 ? <span className="badge-dot">{unread}</span> : null}
            </button>
            {bellOpen ? (
              <Card
                className="card-pad"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 44,
                  width: 340,
                  zIndex: 50,
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div className="card-title">
                  নোটিফিকেশন{' '}
                  <span className="hint">
                    <Button size="sm" variant="ghost" onClick={() => void markAll()}>
                      সব পড়া
                    </Button>
                  </span>
                </div>
                <div className="list">
                  {notifications
                    .filter((n) => !n.read_at)
                    .slice(0, 6)
                    .map((n) => (
                      <div className="list-item" key={n.id}>
                        <AlertCircle size={15} />
                        <div className="grow">
                          <div className="title">{n.title}</div>
                          <div className="desc">{dateBn(n.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  {!notifications.some((n) => !n.read_at) ? (
                    <div className="small muted">কোনো অপঠিত বিজ্ঞপ্তি নেই।</div>
                  ) : null}
                </div>
                <Button size="sm" style={{ marginTop: 10 }} onClick={() => navigate('notifications')}>
                  সব দেখুন
                </Button>
              </Card>
            ) : null}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              className="btn"
              onClick={() => {
                setUserOpen((v) => !v);
                setBellOpen(false);
              }}
            >
              <ShieldCheck size={15} />
              {String(actor?.fullName ?? actor?.username ?? 'ব্যবহারকারী')} <ChevronDown size={14} />
            </button>
            {userOpen ? (
              <Card
                className="card-pad"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 44,
                  width: 230,
                  zIndex: 50,
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div className="small muted" style={{ marginBottom: 10 }}>
                  ইউজারনেম: {String(actor?.username ?? '')}
                  <br />
                  ভূমিকা: {String(actor?.roleId ?? '')}
                </div>
                <Button
                  style={{ width: '100%', marginBottom: 8 }}
                  icon={KeyRound}
                  onClick={() => {
                    setPasswordOpen(true);
                    setUserOpen(false);
                  }}
                >
                  পাসওয়ার্ড বদলান
                </Button>
                <Button style={{ width: '100%' }} variant="danger" icon={LogOut} onClick={onLogout}>
                  লগআউট
                </Button>
              </Card>
            ) : null}
          </div>
        </header>
        <main className="content" key={page}>
          {active.render(navigate)}
        </main>
      </div>
      <Modal
        open={passwordOpen}
        title="পাসওয়ার্ড পরিবর্তন"
        onClose={() => setPasswordOpen(false)}
        footer={
          <>
            <Button onClick={() => setPasswordOpen(false)}>বাতিল</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pw.newPassword !== pw.confirm) {
                  toast('নতুন পাসওয়ার্ড দুটি মিলছে না।', 'warning');
                  return;
                }
                void call('auth.changePassword', { oldPassword: pw.oldPassword, newPassword: pw.newPassword })
                  .then(() => {
                    toast('পাসওয়ার্ড পরিবর্তন হয়েছে।', 'success');
                    setPasswordOpen(false);
                    setPw({ oldPassword: '', newPassword: '', confirm: '' });
                  })
                  .catch((e: Error) => toast(e.message, 'error'));
              }}
            >
              পরিবর্তন করুন
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="পুরনো পাসওয়ার্ড" full>
            <Input
              type="password"
              value={pw.oldPassword}
              onChange={(e) => setPw((p) => ({ ...p, oldPassword: e.target.value }))}
            />
          </Field>
          <Field label="নতুন পাসওয়ার্ড" full>
            <Input
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
            />
          </Field>
          <Field label="নতুন পাসওয়ার্ড নিশ্চিত" full>
            <Input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState<'loading' | 'activation' | 'setup' | 'login' | 'app'>('loading');
  const [status, setStatus] = useState<any>(null);
  const [actor, setActor] = useState<any>(null);
  const [fatal, setFatal] = useState('');
  const refresh = useCallback(async () => {
    const st = await call<any>('bootstrap.status');
    setStatus(st);
    return st;
  }, []);
  useEffect(() => {
    void refresh()
      .then((st) => {
        if (st.needsActivation) {
          setStage('activation');
          return;
        }
        if (st.needsSetup) {
          setStage('setup');
          return;
        }
        if (getToken()) {
          void call<any>('auth.me')
            .then((a) => {
              setActor(a);
              setStage('app');
            })
            .catch(() => {
              clearToken();
              setStage('login');
            });
        } else setStage('login');
      })
      .catch((e: Error) => setFatal(e.message));
  }, [refresh]);
  const afterActivation = async () => {
    const st = await refresh();
    setStage(st.needsSetup ? 'setup' : 'login');
  };
  const afterLogin = async (a: any) => {
    setActor(a);
    await refresh();
    setStage('app');
  };
  const logout = async () => {
    try {
      await call('auth.logout');
    } catch {
      /* session may already be expired */
    }
    clearToken();
    setActor(null);
    setStage('login');
  };
  if (fatal)
    return (
      <div className="auth-wrap">
        <Card className="card-pad" style={{ maxWidth: 520 }}>
          <h2>অ্যাপ শুরু করা যায়নি</h2>
          <p className="muted">{fatal}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            আবার চেষ্টা করুন
          </Button>
        </Card>
      </div>
    );
  if (stage === 'loading')
    return (
      <div className="auth-wrap">
        <Card className="card-pad" style={{ width: 420, textAlign: 'center' }}>
          <img src={logo} alt="MERQO" style={{ width: 64, margin: '0 auto 12px' }} />
          <h3>MERQO লোড হচ্ছে…</h3>
          <p className="small muted">স্থানীয় ডাটাবেজ ও লাইসেন্স যাচাই করা হচ্ছে</p>
          <div style={{ marginTop: 16 }}>
            <Loading rows={3} />
          </div>
        </Card>
      </div>
    );
  if (stage === 'activation') return <Activation onActivated={() => void afterActivation()} />;
  if (stage === 'setup') return <Setup onDone={(a) => void afterLogin(a)} />;
  if (stage === 'login') return <Login onLogin={(a) => void afterLogin(a)} />;
  return <Shell status={status} actor={actor} onLogout={() => void logout()} />;
}
export function Root() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
