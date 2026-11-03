import React, { useState } from 'react';
import { KeyRound, LogIn, Upload, Download, Loader2, ShieldCheck } from 'lucide-react';
import logo from '../../../assets/icons/merqo.png';
import { api, call, devLicense, setToken, isElectron } from '../api';
import { Button, Field, Input, TextArea, useToast } from '../components';

export function AuthCard({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="auth-wrap">
      <div className={`card auth-card ${wide ? 'wide' : ''}`}>
        <img className="auth-logo" src={logo} alt="MERQO" />
        {children}
      </div>
    </div>
  );
}

export function Activation({ onActivated }: { onActivated: () => void }) {
  const [text, setText] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const choose = async () => {
    const out = await api.openTextFile('লাইসেন্স ফাইল বেছে নিন', [
      { name: 'MERQO লাইসেন্স', extensions: ['merqolic', 'json', 'txt'] },
    ]);
    if (out.ok && out.text) {
      setText(out.text);
      setError('');
      toast('লাইসেন্স ফাইল যোগ হয়েছে।', 'success');
    }
  };
  const loadDev = async () => {
    const t = await devLicense();
    if (!t) {
      toast('ডেভেলপমেন্ট লাইসেন্স পাওয়া যায়নি।', 'error');
      return;
    }
    setText(t);
    setError('');
    toast('ডেভেলপমেন্ট লাইসেন্স লোড হয়েছে (শুধুমাত্র প্রিভিউয়ের জন্য)।', 'info');
  };
  const activate = async () => {
    if (!text.trim()) {
      setError('লাইসেন্স ফাইল বা অ্যাক্টিভেশন ডাটা দিন।');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await call('license.activate', { text, businessName: businessName.trim() || undefined });
      toast('অ্যাক্টিভেশন সফল হয়েছে।', 'success');
      onActivated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportDevice = async () => {
    const info = await call<Record<string, unknown>>('license.deviceInfo');
    await api.saveBytes(
      btoa(unescape(encodeURIComponent(JSON.stringify(info, null, 2)))),
      'merqo-device-info.json',
    );
    toast('ডিভাইস তথ্য সংরক্ষিত হয়েছে।', 'success');
  };
  return (
    <AuthCard wide>
      <h1 className="auth-title">MERQO অ্যাক্টিভেশন</h1>
      <p className="auth-sub">আজীবন লাইসেন্স · সম্পূর্ণ অফলাইন · কোনো ইন্টারনেট প্রয়োজন নেই</p>
      <div className="steps">
        <span className="step active" />
        <span className="step" />
        <span className="step" />
      </div>
      <div className="form-grid">
        <Field label="ব্যবসার নাম (ঐচ্ছিক, লাইসেন্সের সাথে মিলতে হবে)" full>
          <Input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="উদা: মেসার্স রহিম ট্রেডার্স"
          />
        </Field>
        <Field label="লাইসেন্স ফাইল / অ্যাক্টিভেশন ডাটা" full>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="এখানে .merqolic ফাইলের বিষয়বস্তু পেস্ট করুন অথবা ফাইল বেছে নিন"
            style={{ minHeight: 120, fontFamily: 'monospace', fontSize: 11 }}
          />
        </Field>
      </div>
      {error ? (
        <div className="badge danger" style={{ marginTop: 12, whiteSpace: 'normal', display: 'block' }}>
          {error}
        </div>
      ) : null}
      <div className="row" style={{ marginTop: 18 }}>
        <Button icon={Upload} onClick={choose}>
          ফাইল বেছে নিন
        </Button>
        {!isElectron ? <Button onClick={loadDev}>ডেভেলপমেন্ট লাইসেন্স</Button> : null}
        <Button onClick={exportDevice} icon={Download}>
          ডিভাইস তথ্য
        </Button>
        <span style={{ flex: 1 }} />
        <Button variant="primary" icon={busy ? Loader2 : ShieldCheck} disabled={busy} onClick={activate}>
          {busy ? 'যাচাই করা হচ্ছে…' : 'অ্যাক্টিভেট করুন'}
        </Button>
      </div>
      <p className="small muted" style={{ marginTop: 16, lineHeight: 1.7 }}>
        <KeyRound size={13} style={{ verticalAlign: -2 }} /> লাইসেন্স Ed25519 স্বাক্ষর, পণ্য পরিচয়, ব্যবসার
        নাম ও ডিভাইস ফিঙ্গারপ্রিন্ট দ্বারা যাচাই করা হয়। কম্পিউটার পরিবর্তনের জন্য MERQO-র কাছ থেকে নতুন
        লাইসেন্স নিন।
      </p>
    </AuthCard>
  );
}

export function Login({ onLogin }: { onLogin: (actor: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const out = await call<{ token: string; actor: any }>('auth.login', { username, password });
      setToken(out.token);
      onLogin(out.actor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard>
      <h1 className="auth-title">স্বাগতম</h1>
      <p className="auth-sub">আপনার অ্যাকাউন্ট দিয়ে লগইন করুন</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 13 }}>
        <Field label="ইউজারনাম">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </Field>
        <Field label="পাসওয়ার্ড">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {error ? (
          <div className="badge danger" style={{ whiteSpace: 'normal', display: 'block' }}>
            {error}
          </div>
        ) : null}
        <Button
          variant="primary"
          icon={busy ? Loader2 : LogIn}
          disabled={busy}
          type="submit"
          style={{ marginTop: 6 }}
        >
          {busy ? 'লগইন হচ্ছে…' : 'লগইন'}
        </Button>
      </form>
    </AuthCard>
  );
}

export function Setup({ onDone }: { onDone: (actor: any) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    business_name: '',
    address: '',
    phone: '',
    email: '',
    invoice_footer: 'ধন্যবাদ! আবার আসুন।',
    fullName: '',
    username: '',
    password: '',
    confirm: '',
    currency: 'BDT',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const next = () => {
    setError('');
    setStep((s) => Math.min(2, s + 1));
  };
  const finish = async () => {
    if (form.password !== form.confirm) {
      setError('পাসওয়ার্ড দুটি মিলছে না।');
      return;
    }
    if (!form.business_name.trim()) {
      setError('ব্যবসার নাম দিন।');
      return;
    }
    setBusy(true);
    try {
      const out = await call<{ token: string; actor: any }>('bootstrap.setup', {
        business: {
          business_name: form.business_name,
          address: form.address,
          phone: form.phone,
          email: form.email,
          invoice_footer: form.invoice_footer,
        },
        fullName: form.fullName || 'অ্যাডমিন',
        username: form.username,
        password: form.password,
        settings: {
          currency: {
            code: form.currency,
            symbol: form.currency === 'BDT' ? '৳' : '$',
            position: 'before',
            decimals: 2,
          },
        },
      });
      setToken(out.token);
      onDone(out.actor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard wide>
      <h1 className="auth-title">প্রথমবারের সেটআপ</h1>
      <p className="auth-sub">মাত্র তিনটি ধাপে আপনার ব্যবসা শুরু করুন</p>
      <div className="steps">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`step ${i === step ? 'active' : ''}`} />
        ))}
      </div>
      {step === 0 ? (
        <div className="form-grid">
          <Field label="ব্যবসার নাম *">
            <Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
          </Field>
          <Field label="ফোন">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="ঠিকানা" full>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="ইমেইল">
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="রিসিট ফুটার">
            <Input value={form.invoice_footer} onChange={(e) => set('invoice_footer', e.target.value)} />
          </Field>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="form-grid">
          <Field label="অ্যাডমিনের পুরো নাম">
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </Field>
          <Field label="ইউজারনাম *">
            <Input
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="পাসওয়ার্ড * (কমপক্ষে ৮ অক্ষর)">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="পাসওয়ার্ড নিশ্চিত করুন *">
            <Input
              type="password"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="form-grid">
          <Field label="মুদ্রা">
            <select
              className="select"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              <option value="BDT">BDT — বাংলাদেশ টাকা (৳)</option>
              <option value="USD">USD — US Dollar ($)</option>
            </select>
          </Field>
          <Field label="ভাষা">
            <Input value="বাংলা (Bangla)" readOnly />
          </Field>
          <div className="full card card-pad small muted" style={{ lineHeight: 1.8 }}>
            সেটআপ শেষ হলে অ্যাপটি স্থানীয় ডাটাবেজ তৈরি করবে, প্রথম অ্যাডমিন অ্যাকাউন্ট সংরক্ষণ করবে এবং
            ড্যাশবোর্ড খুলবে। কোনো নমুনা পণ্য বা কৃত্রিম ব্যবসায়িক তথ্য যোগ করা হবে না।
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="badge danger" style={{ marginTop: 12, whiteSpace: 'normal', display: 'block' }}>
          {error}
        </div>
      ) : null}
      <div className="row" style={{ marginTop: 18 }}>
        {step > 0 ? <Button onClick={() => setStep((s) => s - 1)}>পেছনে</Button> : null}
        <span style={{ flex: 1 }} />
        {step < 2 ? (
          <Button variant="primary" onClick={next}>
            পরবর্তী
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={finish}>
            {busy ? 'সেটআপ হচ্ছে…' : 'সেটআপ সম্পন্ন করুন'}
          </Button>
        )}
      </div>
    </AuthCard>
  );
}
