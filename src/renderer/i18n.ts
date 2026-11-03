/** Lightweight, evidence-driven Bangla → English renderer translation layer. */
import { call } from './api';

export type Language = 'bn' | 'en';

const STORAGE_KEY = 'merqo.language';
const BN_TO_EN: Record<string, string> = {
  প্রধান: 'Main',
  'পণ্য ও স্টক': 'Products & Stock',
  লেনদেন: 'Transactions',
  'বিশ্লেষণ ও সিস্টেম': 'Analytics & System',
  ড্যাশবোর্ড: 'Dashboard',
  'নতুন সেল (POS)': 'New Sale (POS)',
  পণ্য: 'Products',
  'ক্যাটাগরি ও ব্র্যান্ড': 'Categories & brands',
  ইনভেন্টরি: 'Inventory',
  ক্রয়: 'Purchases',
  'বিক্রয় / রিটার্ন': 'Sales / Returns',
  'গ্রাহক ও বাকি': 'Customers & Dues',
  সরবরাহকারী: 'Supplier',
  খরচ: 'Expenses',
  'ক্যাশ ও অ্যাকাউন্ট': 'Cash & Accounts',
  'রিপোর্ট ও এক্সপোর্ট': 'Reports & Export',
  'ব্যাকআপ ও রিস্টোর': 'Backup & Restore',
  'ব্যবহারকারী ও RBAC': 'Users & RBAC',
  'অডিট লগ': 'Audit log',
  নোটিফিকেশন: 'Notifications',
  সেটিংস: 'Settings',
  সম্পর্কে: 'About',
  সাইডবার: 'Sidebar',
  'সাইডবার সংকুচিত': 'Collapse sidebar',
  'ব্যবসা ব্যবস্থাপনা': 'Business Management',
  'অফলাইন · স্থানীয়': 'Offline · Local',
  'ডাটাবেজ অখণ্ডতা যাচাই প্রয়োজন': 'Database integrity check required',
  'সব পড়া': 'Mark all read',
  'সব দেখুন': 'View all',
  'কোনো অপঠিত বিজ্ঞপ্তি নেই।': 'No unread notifications.',
  ব্যবহারকারী: 'User',
  ইউজারনেম: 'Username',
  ভূমিকা: 'Role',
  লগআউট: 'Logout',
  'পাসওয়ার্ড পরিবর্তন': 'Change password',
  'পুরনো পাসওয়ার্ড': 'Current password',
  'নতুন পাসওয়ার্ড': 'New password',
  'নতুন পাসওয়ার্ড নিশ্চিত': 'Confirm new password',
  'নতুন পাসওয়ার্ড দুটি মিলছে না।': 'New passwords do not match.',
  'পাসওয়ার্ড পরিবর্তন হয়েছে।': 'Password changed.',
  'পরিবর্তন করুন': 'Change',
  বাতিল: 'Cancelled',
  'আবার চেষ্টা করুন': 'Try again',
  'অ্যাপ শুরু করা যায়নি': 'Application could not start',
  'MERQO লোড হচ্ছে…': 'MERQO is loading…',
  'স্থানীয় ডাটাবেজ ও লাইসেন্স যাচাই করা হচ্ছে': 'Checking local database and licence',
  'MERQO অ্যাক্টিভেশন': 'MERQO Activation',
  'আজীবন লাইসেন্স · সম্পূর্ণ অফলাইন · কোনো ইন্টারনেট প্রয়োজন নেই':
    'Lifetime licence · fully offline · no internet required',
  'লাইসেন্স ফাইল / অ্যাক্টিভেশন ডাটা': 'Licence file / activation data',
  'ব্যবসার নাম (ঐচ্ছিক, লাইসেন্সের সাথে মিলতে হবে)': 'Business name (optional, must match licence)',
  'এখানে .merqolic ফাইলের বিষয়বস্তু পেস্ট করুন অথবা ফাইল বেছে নিন':
    'Paste the .merqolic file contents here or choose a file',
  'উদা: মেসার্স রহিম ট্রেডার্স': 'e.g. Messrs Rahim Traders',
  'ফাইল বেছে নিন': 'Choose file',
  'ডেভেলপমেন্ট লাইসেন্স': 'Development licence',
  'ডিভাইস তথ্য': 'Device info',
  'অ্যাক্টিভেট করুন': 'Activate',
  'যাচাই করা হচ্ছে…': 'Verifying…',
  'লাইসেন্স ফাইল বা অ্যাক্টিভেশন ডাটা দিন।': 'Provide a licence file or activation data.',
  'লাইসেন্স ফাইল যোগ হয়েছে।': 'Licence file added.',
  'ডেভেলপমেন্ট লাইসেন্স পাওয়া যায়নি।': 'Development licence not found.',
  'ডেভেলপমেন্ট লাইসেন্স লোড হয়েছে (শুধুমাত্র প্রিভিউয়ের জন্য)।': 'Development licence loaded (preview only).',
  'অ্যাক্টিভেশন সফল হয়েছে।': 'Activation successful.',
  'ডিভাইস তথ্য সংরক্ষিত হয়েছে।': 'Device information saved.',
  স্বাগতম: 'Welcome',
  'আপনার অ্যাকাউন্ট দিয়ে লগইন করুন': 'Sign in with your account',
  লগইন: 'Login',
  'লগইন হচ্ছে…': 'Signing in…',
  'প্রথমবারের সেটআপ': 'First-time setup',
  'মাত্র তিনটি ধাপে আপনার ব্যবসা শুরু করুন': 'Start your business in three steps',
  'ব্যবসার নাম *': 'Business name *',
  ফোন: 'Phone',
  ঠিকানা: 'Address',
  ইমেইল: 'Email',
  'রিসিট ফুটার': 'Receipt footer',
  'অ্যাডমিনের পুরো নাম': 'Admin full name',
  'ইউজারনাম *': 'Username *',
  'পাসওয়ার্ড * (কমপক্ষে ৮ অক্ষর)': 'Password * (at least 8 characters)',
  'পাসওয়ার্ড নিশ্চিত করুন *': 'Confirm password *',
  'পাসওয়ার্ড দুটি মিলছে না।': 'Passwords do not match.',
  'ব্যবসার নাম দিন।': 'Enter the business name.',
  মুদ্রা: 'Currency',
  ভাষা: 'Language',
  'বাংলা (Bangla)': 'বাংলা (Bangla)',
  English: 'English',
  'সেটআপ শেষ হলে অ্যাপটি স্থানীয় ডাটাবেজ তৈরি করবে, প্রথম অ্যাডমিন অ্যাকাউন্ট সংরক্ষণ করবে এবং ড্যাশবোর্ড খুলবে। কোনো নমুনা পণ্য বা কৃত্রিম ব্যবসায়িক তথ্য যোগ করা হবে না।':
    'After setup the app creates the local database, saves the first admin account and opens the dashboard. No sample products or fake business data are added.',
  পেছনে: 'Back',
  পরবর্তী: 'Next',
  'সেটআপ সম্পন্ন করুন': 'Finish setup',
  'সেটআপ হচ্ছে…': 'Setting up…',
  'যোগ করুন': 'Add',
  নতুন: 'New',
  সম্পাদনা: 'Edit',
  মুছুন: 'Delete',
  সংরক্ষণ: 'Save',
  'সংরক্ষণ করুন': 'Save',
  খুঁজুন: 'Search',
  রিফ্রেশ: 'Refresh',
  প্রিন্ট: 'Print',
  এক্সপোর্ট: 'Export',
  ইমপোর্ট: 'Import',
  'বন্ধ করুন': 'Close',
  হ্যাঁ: 'Yes',
  না: 'No',
  'ঠিক আছে': 'OK',
  কপি: 'Copy',
  দেখুন: 'View',
  বিবরণ: 'Details',
  পরিমাণ: 'Quantity',
  'একক মূল্য': 'Unit price',
  মোট: 'Total',
  সর্বমোট: 'Grand total',
  তারিখ: 'Date',
  ধরন: 'Type',
  নোট: 'Note',
  কারণ: 'Reason',
  কাজ: 'Action',
  অ্যাকশন: 'Action',
  অবস্থা: 'Status',
  কোড: 'Code',
  নাম: 'Name',
  স্ট্যাটাস: 'Status',
  সফল: 'Success',
  ব্যর্থ: 'Failed',
  সম্পন্ন: 'Completed',
  সক্রিয়: 'Active',
  নিষ্ক্রিয়: 'Inactive',
  'লোড হচ্ছে…': 'Loading…',
  'কোনো তথ্য পাওয়া যায়নি।': 'No records found.',
  'কাজটি সম্পন্ন করা যায়নি।': 'The operation could not be completed.',
  'আপডেট সফল হয়েছে।': 'Updated successfully.',
  'সেটিংস সংরক্ষিত হয়েছে।': 'Settings saved.',
  'সব বিজ্ঞপ্তি পড়া হয়েছে।': 'All notifications marked read.',
  'আজকের বিক্রয়': 'Today’s sales',
  'আজকের ক্রয়': 'Today’s purchases',
  'মোট আয়': 'Total revenue',
  'মোট খরচ': 'Total expenses',
  'মোট লাভ': 'Gross profit',
  'নিট লাভ': 'Net profit',
  'মোট পণ্য': 'Total products',
  'কম স্টক': 'Low stock',
  স্টকআউট: 'Out of stock',
  'কম স্টক / স্টকআউট': 'Low stock / Out of stock',
  'গ্রাহক বাকি': 'Customer dues',
  'সরবরাহকারী বাকি': 'Supplier dues',
  'সাম্প্রতিক লেনদেন': 'Recent transactions',
  'বিক্রয় প্রবণতা': 'Sales trend',
  'ক্রয় প্রবণতা': 'Purchase trend',
  'দ্রুত কাজ': 'Quick actions',
  'এই সময়ে কোনো বিক্রয় নেই।': 'No sales in this period.',
  'এখনো বিক্রয় তথ্য নেই।': 'No sales data yet.',
  'কম স্টকের সতর্কতা': 'Low-stock alerts',
  'কম স্টকের পণ্য': 'Low-stock products',
  'পণ্যের নাম (বাংলা/English)': 'Product name (Bangla/English)',
  'নাম (English)': 'Name (English)',
  'English নাম': 'English name',
  ক্যাটাগরি: 'Category',
  'ক্যাটাগরি *': 'Category *',
  'ক্যাটাগরি ও সাবক্যাটাগরি (প্যারেন্ট নির্বাচন করুন)': 'Categories & subcategories (select parent)',
  ব্র্যান্ড: 'Brand',
  একক: 'Unit',
  'ক্রয়মূল্য (৳)': 'Purchase price (৳)',
  'বিক্রয়মূল্য (৳)': 'Selling price (৳)',
  'পাইকারি মূল্য (৳)': 'Wholesale price (৳)',
  'ওপেনিং স্টক': 'Opening stock',
  'ন্যূনতম স্টক': 'Minimum stock',
  বারকোড: 'Barcode',
  SKU: 'SKU',
  'ওপেনিং ব্যালেন্স (৳)': 'Opening balance (৳)',
  'কোনো পণ্য পাওয়া যায়নি।': 'No products found.',
  'ক্যাটাগরি, সাবক্যাটাগরি, ব্র্যান্ড, একক ও রূপান্তর':
    'Categories, subcategories, brands, units and conversions',
  'ইনভেন্টরি / স্টক': 'Inventory / Stock',
  'ক্যাটালগ ব্যবস্থাপনা': 'Catalogue management',
  'ওয়েটেড-অ্যাভারেজ কস্ট, স্টক মুভমেন্ট ও সতর্কতা': 'Weighted-average cost, stock movements and alerts',
  'স্টক ইন': 'Stock in',
  'স্টক আউট': 'Stock out',
  'স্টক অ্যাডজাস্টমেন্ট': 'Stock adjustment',
  'স্টক হিস্ট্রি': 'Stock history',
  'স্টক মুভমেন্ট': 'Stock movement',
  'ইনভেন্টরি ভ্যালুয়েশন': 'Inventory valuation',
  'ম্যানুয়াল অ্যাডজাস্টমেন্টের কারণ': 'Reason for manual adjustment',
  'পণ্যের নাম, কোড বা বারকোড…': 'Product name, code or barcode…',
  'কার্ট খালি। বাম দিক থেকে পণ্য বেছে নিন।': 'Cart is empty. Choose a product on the left.',
  'কোনো হোল্ড করা সেল নেই।': 'No held sales.',
  ছাড়: 'Discount',
  পরিশোধ: 'Paid',
  বাকি: 'Due',
  সাবটোটাল: 'Subtotal',
  'গ্র্যান্ড টোটাল': 'Grand total',
  নগদ: 'Cash',
  অন্যান্য: 'Other',
  কাস্টম: 'Custom',
  হোল্ড: 'Hold',
  রিজিউম: 'Resume',
  চেকআউট: 'Checkout',
  'রিসিট প্রিন্ট': 'Print receipt',
  'বিক্রয় সংরক্ষণ': 'Save sale',
  'ক্রয় সংরক্ষণ': 'Save purchase',
  'ক্রয় রিটার্ন সম্পন্ন হয়েছে।': 'Purchase return completed.',
  'আংশিক রিটার্ন': 'Partial return',
  'সম্পূর্ণ রিটার্ন': 'Full return',
  'অতিরিক্ত খরচ (পরিবহন ইত্যাদি)': 'Additional cost (transport etc.)',
  'অতিরিক্ত খরচ': 'Additional cost',
  গ্রাহক: 'Customer',
  'ওয়াক-ইন কাস্টমার': 'Walk-in customer',
  'গ্রাহক তথ্য': 'Customer information',
  'সরবরাহকারী তথ্য': 'Supplier information',
  'বাকি আদায়': 'Due collection',
  'আংশিক পেমেন্ট': 'Partial payment',
  'পূর্ণ পেমেন্ট': 'Full payment',
  'পেমেন্ট হিস্ট্রি': 'Payment history',
  লেজার: 'Ledger',
  স্টেটমেন্ট: 'Statement',
  আয়: 'Income',
  ব্যয়: 'Expense',
  'প্রবেশ (আয়)': 'Inflow (income)',
  'প্রস্থান (খরচ/উত্তলন)': 'Outflow (expense/withdrawal)',
  'অন্যান্য আয়': 'Other income',
  'অন্যান্য খরচ': 'Other expense',
  'নগদ উত্তোলন': 'Cash withdrawal',
  'গণনা করা নগদ (৳) *': 'Counted cash (৳) *',
  'অ্যাকাউন্ট *': 'Account *',
  'অ্যাকাউন্টের নাম': 'Account name',
  'খরচের ক্যাটাগরি': 'Expense category',
  বর্ণনা: 'Description',
  'পেমেন্ট মেথড': 'Payment method',
  ওপেনিং: 'Opening',
  'আর্থিক সারাংশ': 'Financial summary',
  'নগদ প্রবাহ': 'Cash flow',
  রিকনসিলেশন: 'Reconciliation',
  'সমন্বয় যাচাই': 'Reconcile',
  রিপোর্ট: 'Report',
  'দৈনিক বিক্রয়': 'Daily sales',
  'সাপ্তাহিক বিক্রয়': 'Weekly sales',
  'মাসিক বিক্রয়': 'Monthly sales',
  'কাস্টম তারিখ': 'Custom date range',
  'লাভ-ক্ষতি': 'Profit & loss',
  'সেরা বিক্রিত পণ্য': 'Best-selling products',
  'CSV ইমপোর্ট': 'CSV import',
  CSV: 'CSV',
  Excel: 'Excel',
  PDF: 'PDF',
  HTML: 'HTML',
  'সর্বমোট সারি': 'Total rows',
  'MERQO ব্যাকআপ': 'MERQO Backup',
  'ব্যাকআপ তৈরি করুন': 'Create backup',
  যাচাই: 'Verify',
  রিস্টোর: 'Restore',
  'নিরাপত্তা ব্যাকআপ': 'Safety backup',
  'ব্যাকআপ ইতিহাস': 'Backup history',
  'এনক্রিপশন পাসফ্রেজ': 'Encryption passphrase',
  'খালি রাখলে এনক্রিপশন হবে না': 'Leave empty for no encryption',
  'ডিফল্ট: ব্যবহারকারীর ডাটা ফোল্ডার': 'Default: user data folder',
  'ব্যবহারকারী তৈরি করুন': 'Create user',
  'অনুমতি ম্যাট্রিক্স': 'Permission matrix',
  'ভূমিকা ও অনুমতি': 'Roles & permissions',
  অ্যাক্টর: 'Actor',
  সময়: 'Time',
  ব্যবসা: 'Business',
  'মুদ্রা ও সংখ্যা': 'Currency & numbers',
  'ভ্যাট / কর': 'VAT / Tax',
  'রিসিট ও প্রিন্টার': 'Receipt & printer',
  শর্টকাট: 'Shortcuts',
  'ব্যবসার তথ্য, মুদ্রা, বাংলা সংখ্যা, ভ্যাট, রিসিট, ব্যাকআপ, প্রিন্টার ও শর্টকাট':
    'Business profile, currency, Bangla digits, VAT, receipt, backup, printer and shortcuts',
  'বাংলা সংখ্যা': 'Bangla digits',
  '০১২… হ্যাঁ (বাংলা)': '০১২… Yes (Bangla)',
  'বাংলা ও English ইনপুট, ইন্টিজার পয়সা, WAL ডাটাবেজ, Ed25519 লাইসেন্স, ২৮ রিপোর্ট, তাপীয় রিসিট।':
    'Bangla and English input, integer paisa, WAL database, Ed25519 licence, 28 reports, thermal receipts.',
  প্রতিষ্ঠাতা: 'Founder',
  ফন্ট: 'Font',
  সংস্করণ: 'Version',
  বিল্ড: 'Build',
  'লাইসেন্স স্ট্যাটাস': 'Licence status',
  'MERQO পণ্য লোগো': 'MERQO product logo',
  আকার: 'Size',
  'ব্যবসার নাম': 'Business name',
  'ব্যবসার প্রোফাইল': 'Business profile',
  'ব্যবসার তথ্য': 'Business information',
  'বিক্রয় ও মুনাফার ধারা': 'Sales & profit trend',
  'নির্বাচিত সময়কাল': 'Selected period',
  'এক ক্লিকে শুরু করুন': 'Start with one click',
  'নতুন সেল': 'New sale',
  'প্রোডাক্ট যোগ': 'Add product',
  'নতুন ক্রয়': 'New purchase',
  'রিপোর্ট দেখুন': 'View report',
  'কম স্টক সতর্কতা': 'Low-stock alerts',
  'কোনো সতর্কতা নেই।': 'No alerts.',
  'সর্বাধিক বিক্রিত পণ্য': 'Best-selling products',
  'সাম্প্রতিক কার্যকলাপ': 'Recent activity',
  'মোট বিক্রয়': 'Total sales',
  'মোট ক্রয়': 'Total purchases',
  'মোট মুনাফা': 'Gross profit',
  'নিট মুনাফা': 'Net profit',
  'খরচ ও অন্যান্য আয় বাদ দিয়ে': 'After expenses and other income',
  'নগদ / ব্যাংক / MFS': 'Cash / Bank / MFS',
  '০ টি লেনদেন': '0 transactions',
  'শুভ দুপুর। আজকের ব্যবসার সারাংশ নিচে দেখুন।': 'Good afternoon. Today’s business summary is below.',
  'ঠিকানা / ট্রেড লাইসেন্স নম্বর': 'Address / Trade licence number',
  'ভ্যাট / ট্রেড লাইসেন্স নম্বর': 'VAT / Trade licence number',
};

const PATTERNS: [RegExp, string][] = [
  [/মোট\s+([\d০-৯]+)\s+টি পণ্য/g, 'Total $1 products'],
  [/মোট\s+([\d০-৯]+)\s+টি/g, 'Total $1 items'],
  [/সর্বমোট\s*([\d৳,.০-৯]+)/g, 'Grand total $1'],
  [/বাকি\s*([\d৳,.০-৯]+)/g, 'Due $1'],
  [/পরিশোধ\s*([\d৳,.০-৯]+)/g, 'Paid $1'],
];

const ENTRIES = Object.entries(BN_TO_EN).sort((a, b) => b[0].length - a[0].length);
const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const REPLACERS: [RegExp, string][] = ENTRIES.map(([bn, en]) => [
  new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${bn.replace(ESCAPE_RE, '\\$&')}(?![\\p{L}\\p{N}\\p{M}])`, 'gu'),
  en,
]);
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SELECTOR = [
  'button',
  'label',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'option',
  '.nav-group',
  '.nav-item span',
  '.card-title',
  '.sub',
  '.field > span',
  '.badge',
  '.tab',
  '.greeting',
  '.business',
  '.brand-sub',
  '.small',
  '.muted',
  '.hint',
  '.title',
  '.desc',
  '.auth-title',
  '.auth-sub',
  '.kpi-label',
  '.toast',
  '.step',
  '.list-item',
  '.breadcrumb',
].join(',');

let current: Language = 'bn';
let observer: MutationObserver | null = null;
let applying = false;
let initialized = false;

export function getLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}

function translateText(input: string): string {
  let out = input;
  for (const [re, en] of REPLACERS) out = out.replace(re, en);
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  // A partial phrase translation that leaves Bangla beside newly introduced
  // English is worse than leaving the original Bangla intact. Accept the
  // candidate only when it is fully English, fully Bangla, or the source
  // already mixed scripts (e.g. a user-entered business name).
  const sourceMixed = /[A-Za-z]/.test(input);
  const candidateMixed = /[A-Za-z]/.test(out) && /[\u0980-\u09FF]/.test(out);
  if (!sourceMixed && candidateMixed) return input;
  return out;
}

function translateNode(node: Node): void {
  if (node.nodeType !== Node.TEXT_NODE) return;
  const parent = node.parentElement;
  if (!parent || parent.closest('script,style,[data-no-i18n]')) return;
  if (!parent.closest(SELECTOR)) return;
  const text = node.nodeValue ?? '';
  if (!/[\u0980-\u09FF]/.test(text)) return;
  const next = translateText(text);
  if (next !== text) node.nodeValue = next;
}

function translateAttributes(root: ParentNode): void {
  for (const el of root.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) {
    for (const attr of ATTRS) {
      const value = el.getAttribute(attr);
      if (!value || !/[\u0980-\u09FF]/.test(value)) continue;
      const next = translateText(value);
      if (next !== value) el.setAttribute(attr, next);
    }
  }
}

function translateDocument(): void {
  if (applying || current !== 'en') return;
  applying = true;
  try {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      translateNode(node);
      node = walker.nextNode();
    }
    translateAttributes(document);
  } finally {
    applying = false;
  }
}

function scheduleTranslation(): void {
  if (current !== 'en' || applying) return;
  window.requestAnimationFrame(translateDocument);
}

function activate(lang: Language): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage may be unavailable; backend setting still applies */
  }
  document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  if (lang === 'en') {
    translateDocument();
    if (!observer) {
      observer = new MutationObserver(scheduleTranslation);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  } else if (observer) {
    observer.disconnect();
    observer = null;
  }
}

export function initI18n(): void {
  if (initialized) return;
  initialized = true;
  const saved = getLanguage();
  if (saved === 'en') activate('en');
  else document.documentElement.lang = 'bn';
  window.addEventListener('merqo:languagechange', (event) => {
    const detail = (event as CustomEvent<Language>).detail;
    if (detail === 'en') activate('en');
  });
}

/** Persist the choice, notify the renderer, and reload so React restores original Bangla. */
export async function setLanguage(lang: Language, reload = true): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  try {
    await call('settings.set', { key: 'language', value: lang });
  } catch {
    /* before login the local preview choice still applies */
  }
  if (lang === 'en') {
    window.dispatchEvent(new CustomEvent('merqo:languagechange', { detail: lang }));
  }
  if (reload) window.setTimeout(() => window.location.reload(), 60);
}

/** After login, align the local choice with the persisted business setting. */
export async function syncLanguageFromSettings(): Promise<void> {
  try {
    const out = await call<{ value?: unknown }>('settings.get', { key: 'language' });
    const lang: Language = String(out.value) === 'en' ? 'en' : 'bn';
    if (lang !== getLanguage()) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* ignore */
      }
      window.location.reload();
    } else if (lang === 'en') {
      activate('en');
    }
  } catch {
    /* settings.view may be unavailable; keep the local choice */
  }
}
