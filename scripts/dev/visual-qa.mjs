/**
 * Real renderer visual QA in headless Chromium.
 * Uses the npm-bundled Chromium from @sparticuz/chromium and playwright-core.
 * Starts an isolated Vite preview, performs first-run activation/setup through
 * the actual UI, visits every navigation page at four desktop sizes, checks
 * overflow, Bangla font loading, keyboard focus, accessible button names and
 * the Bangla/English language switch, then writes screenshots and a JSON report.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import chromiumBinary, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

const OUT = resolve('docs/visual-qa');
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const NAV = [
  'ড্যাশবোর্ড',
  'নতুন সেল (POS)',
  'পণ্য',
  'ক্যাটাগরি ও ব্র্যান্ড',
  'ইনভেন্টরি',
  'ক্রয়',
  'বিক্রয় / রিটার্ন',
  'গ্রাহক ও বাকি',
  'সরবরাহকারী',
  'খরচ',
  'ক্যাশ ও অ্যাকাউন্ট',
  'রিপোর্ট ও এক্সপোর্ট',
  'ব্যাকআপ ও রিস্টোর',
  'ব্যবহারকারী ও RBAC',
  'অডিট লগ',
  'নোটিফিকেশন',
  'সেটিংস',
  'সম্পর্কে',
];
const ENGLISH_PROBES = [
  'Dashboard',
  'New Sale (POS)',
  'Products',
  'Categories & brands',
  'Inventory',
  'Purchases',
  'Sales / Returns',
  'Customers & Dues',
  'Supplier',
  'Expenses',
  'Cash & Accounts',
  'Reports & Export',
  'Backup & Restore',
  'Users & RBAC',
  'Audit log',
  'Notifications',
  'Settings',
  'About',
];

function freePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address()?.port ?? 0;
      srv.close(() => resolvePort(port));
    });
  });
}

async function waitForHealth(base, timeoutMs = 40_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Preview did not become healthy at ${base}`);
}

async function prepareChromium() {
  const require = createRequire(import.meta.url);
  const entry = require.resolve('@sparticuz/chromium');
  const binDir = resolve(dirname(entry), '../bin');
  await inflate(join(binDir, 'al2023.tar.br'));
  setupLambdaEnvironment(join(tmpdir(), 'al2023', 'lib'));
  return chromiumBinary.executablePath();
}

async function domChecks(page) {
  return page.evaluate(() => {
    const bangla = /[\u0980-\u09FF]/;
    const buttons = [...document.querySelectorAll('button')];
    const unnamed = buttons.filter((b) => {
      const name =
        (b.textContent ?? '').trim() || b.getAttribute('aria-label') || b.getAttribute('title') || '';
      return !name && !b.disabled;
    }).length;
    const overflowing = [
      ...document.querySelectorAll('.card, .table-wrap, table, .form-grid, .auth-card'),
    ].filter((el) => el.scrollWidth > el.clientWidth + 3).length;
    const focusable = [...document.querySelectorAll('button, input, select, textarea, a[href]')].filter(
      (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
    ).length;
    const banglaNodes = [
      ...document.querySelectorAll('h1,h2,h3,button,label,th,.card-title,.nav-group'),
    ].filter((el) => bangla.test(el.textContent ?? '')).length;
    return {
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      overflowingContainers: overflowing,
      unnamedButtons: unnamed,
      focusableElements: focusable,
      banglaTextNodes: banglaNodes,
      fontLoaded: document.fonts.check('14px "Noto Sans Bengali"'),
      title: document.title,
    };
  });
}

async function focusCheck(page) {
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { ok: false, tag: 'none' };
    const style = getComputedStyle(el);
    const ok = style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    return { ok, tag: el.tagName, outline: style.outlineStyle, shadow: style.boxShadow };
  });
}

async function fillSetup(page) {
  await page.getByRole('button', { name: 'ডেভেলপমেন্ট লাইসেন্স' }).click();
  await page.getByRole('button', { name: 'অ্যাক্টিভেট করুন' }).click();
  await page.getByText('প্রথমবারের সেটআপ').waitFor({ timeout: 15_000 });

  await page.getByLabel('ব্যবসার নাম *').fill('MERQO ভিজ্যুয়াল QA');
  await page.getByLabel('ফোন').fill('01700000000');
  await page.getByLabel('ঠিকানা').fill('ঢাকা, বাংলাদেশ');
  await page.getByLabel('ইমেইল').fill('qa@merqo.local');
  await page.getByLabel('রিসিট ফুটার').fill('ধন্যবাদ! আবার আসুন।');
  await page.getByRole('button', { name: 'পরবর্তী' }).click();

  await page.getByLabel('অ্যাডমিনের পুরো নাম').fill('ভিজ্যুয়াল অ্যাডমিন');
  await page.getByLabel('ইউজারনাম *').fill('visualadmin');
  await page.getByLabel('পাসওয়ার্ড * (কমপক্ষে ৮ অক্ষর)').fill('VisualQA123!');
  await page.getByLabel('পাসওয়ার্ড নিশ্চিত করুন *').fill('VisualQA123!');
  await page.getByRole('button', { name: 'পরবর্তী' }).click();
  await page.getByRole('button', { name: 'সেটআপ সম্পন্ন করুন' }).click();
  try {
    await page.waitForSelector('.app-shell', { timeout: 15_000 });
  } catch (err) {
    const body = await page
      .locator('body')
      .innerText()
      .catch(() => '(no body)');
    writeFileSync(join(OUT, 'setup-error.txt'), body);
    await page.screenshot({ path: join(OUT, 'setup-error.png') }).catch(() => {});
    throw new Error(`Setup did not reach shell. Body:\n${body.slice(0, 2000)}\n${String(err)}`);
  }
}

async function main() {
  execFileSync(process.execPath, ['scripts/dev/ensure-dev-license.mjs'], { stdio: 'inherit' });
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const dataDir = join(tmpdir(), `merqo-visual-qa-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  const server = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, MERQO_DATA_DIR: dataDir, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let serverLog = '';
  server.stdout?.on('data', (d) => (serverLog += String(d)));
  server.stderr?.on('data', (d) => (serverLog += String(d)));
  const stopServer = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  };

  let browser;
  const report = {
    generatedAt: new Date().toISOString(),
    base,
    viewports: [],
    pages: [],
    language: {},
    consoleErrors: [],
    screenshots: [],
    errors: [],
  };
  try {
    await waitForHealth(base);
    const executablePath = await prepareChromium();
    browser = await playwright.launch({
      executablePath,
      args: chromiumBinary.args,
      headless: true,
    });
    const context = await browser.newContext({ locale: 'bn-BD', deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => report.consoleErrors.push(`pageerror: ${err.message}`));
    await page.setViewportSize(VIEWPORTS[0]);
    await page.goto(base, { waitUntil: 'networkidle' });
    await fillSetup(page);

    // All navigation pages at the reference desktop size.
    for (const label of NAV) {
      await page.getByRole('button', { name: label, exact: true }).first().click();
      await page.waitForTimeout(180);
      const checks = await domChecks(page);
      report.pages.push({ label, ...checks });
      if (checks.horizontalOverflow > 2 || checks.unnamedButtons > 0) {
        report.errors.push(
          `${label}: overflow=${checks.horizontalOverflow} unnamed=${checks.unnamedButtons}`,
        );
      }
    }
    await page.getByRole('button', { name: 'ড্যাশবোর্ড', exact: true }).first().click();

    // Four viewport sizes on the dashboard and POS.
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(220);
      const checks = await domChecks(page);
      const focus = await focusCheck(page);
      const shot = join(OUT, `dashboard-${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      report.screenshots.push(shot);
      report.viewports.push({ ...vp, ...checks, focus });
      if (checks.horizontalOverflow > 2 || !checks.fontLoaded || !focus.ok) {
        report.errors.push(
          `viewport ${vp.width}x${vp.height}: overflow=${checks.horizontalOverflow} font=${checks.fontLoaded} focus=${focus.ok}`,
        );
      }
    }
    await page.setViewportSize(VIEWPORTS[0]);
    await page.getByRole('button', { name: 'নতুন সেল (POS)', exact: true }).first().click();
    await page.waitForTimeout(250);
    const posShot = join(OUT, 'pos-1280x720.png');
    await page.screenshot({ path: posShot, fullPage: false });
    report.screenshots.push(posShot);

    // English language switch through the real top-bar control.
    await page.getByRole('button', { name: /EN/ }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const enText = await page.locator('body').innerText();
    writeFileSync(join(OUT, 'english-body.txt'), enText);
    const navLabels = await page.locator('nav .nav-item span').allInnerTexts();
    writeFileSync(join(OUT, 'english-nav.txt'), JSON.stringify(navLabels, null, 2));
    const enHits = ENGLISH_PROBES.filter((t) => navLabels.includes(t));
    const navBengali = navLabels.filter((label) => /[\u0980-\u09FF]/.test(label));
    const corruptionDetected = /[\u0980-\u09FF][A-Za-z]|[A-Za-z][\u0980-\u09FF]/.test(enText);
    report.language = {
      htmlLang: await page.evaluate(() => document.documentElement.lang),
      navLabels,
      englishProbes: ENGLISH_PROBES.length,
      englishHits: enHits.length,
      navBengali,
      corruptionDetected,
      samples: enHits,
      note: 'Bangla remains the primary language; English coverage is dictionary-based and partial.',
    };
    if (enHits.length < 16)
      report.errors.push(`English switch translated only ${enHits.length}/18 nav labels`);
    if (navBengali.length) report.errors.push(`English switch left ${navBengali.length} Bangla nav labels`);
    if (corruptionDetected)
      report.errors.push('English switch produced adjacent Bangla/Latin text corruption');
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await page.waitForTimeout(250);
    const enShot = join(OUT, 'settings-english-1280x720.png');
    await page.screenshot({ path: enShot, fullPage: false });
    report.screenshots.push(enShot);
    await page.getByRole('button', { name: /BN/ }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    const bnText = await page.locator('body').innerText();
    const bnNav = await page.locator('nav .nav-item span').allInnerTexts();
    report.language.banglaRestored = bnText.includes('ড্যাশবোর্ড') && bnNav.includes('সেটিংস');
    if (!report.language.banglaRestored) report.errors.push('Bangla was not restored after BN toggle');

    if (report.consoleErrors.length) report.errors.push(`console errors: ${report.consoleErrors.length}`);
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(
      `[visual-qa] viewports=${report.viewports.length} pages=${report.pages.length} screenshots=${report.screenshots.length}`,
    );
    console.log(
      `[visual-qa] English probes ${report.language.englishHits}/${report.language.englishProbes}; Bangla restored=${report.language.banglaRestored}`,
    );
    if (report.errors.length) {
      for (const e of report.errors) console.error(`[visual-qa] FAIL ${e}`);
      process.exitCode = 1;
    } else {
      console.log('[visual-qa] PASS — no overflow, unnamed controls, missing focus, font or console errors');
    }
  } catch (err) {
    report.errors.push(String(err?.stack ?? err));
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.error('[visual-qa] ERROR', err);
    if (serverLog) console.error(serverLog.slice(-4000));
    process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => {});
    stopServer();
  }
}

await main();
