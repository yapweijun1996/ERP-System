import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const reportPath = process.argv[2];
if (!reportPath) throw new Error('Usage: node scripts/import-i18n-hardcodes.mjs <browser-report.json>');

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const assetDir = path.resolve('web/public/assets');
const uiSource = readdirSync(assetDir)
  .filter((filename) => filename.endsWith('.js'))
  .filter((filename) => !filename.startsWith('data-') && !filename.includes('adapter') && filename !== 'sales-data.js')
  .map((filename) => readFileSync(path.join(assetDir, filename), 'utf8'))
  .join('\n');
const exclusions = new Set([
  'CNC Milling Machine', 'Demo Sales', 'Demo QA', 'Kwame Mensah',
  'Depreciation Expense', 'Fabrication 50% complete',
  'Aria', 'Slate', 'Forest', 'Sunset', 'Royal', 'Amber',
  'English', 'Bahasa Melayu', '日本語', 'Tiếng Việt', 'PGlite', 'PGlite demo',
]);
const machineCode = /^(?:[a-z][a-z0-9_]*\.)+[a-z0-9_]+$/;
const forcedSystem = [
  'Dimension result exceeded the released tolerance.',
  'Verify fixture and review the measurement process.',
  'The signed-in account is not linked to an active employee in this company.',
  'ERP workspace is ready',
  'Your Singapore company workspace is available.',
  'Inventory below reorder point',
  'SG-WIDGET requires replenishment planning.',
  'Purchase order approval required',
  'PO-0001 is waiting for your review.',
  'Value & forecast',
  'Deal value (SGD)',
  'Lands in the Lead column of the pipeline.',
  'Txn View',
  'realtime',
  'No payments recorded yet — invoice is open in Accounts Receivable (due 2024-06-30).',
  '0% paid · due 2024-06-30 (Net 30).',
  'due 2024-06-30.',
  'now ago',
  'today ago',
  '1 receipts',
  '3 orders',
  '1 lines',
  '3 requisitions',
  '2 suppliers',
  'No GRN',
  'work_order',
  'goods_receipt',
  'sales_order',
  'purchase_order',
  'sales_invoice',
  'journal_entry',
  'pending_approval',
];
const candidates = [...new Set([...report.hardcoded.map((item) => item.value), ...forcedSystem])]
  .filter((value) => uiSource.includes(value))
  .filter((value) => !exclusions.has(value) && !machineCode.test(value))
  .filter((value) => !/<\/?[a-z][^>]*>/i.test(value));
for (const value of forcedSystem) if (!candidates.includes(value)) candidates.push(value);

const packs = Object.fromEntries(['en', 'ms', 'zh', 'ja', 'vi'].map((code) => {
  const filename = path.join(assetDir, 'i18n', `${code}.json`);
  return [code, { filename, data: JSON.parse(readFileSync(filename, 'utf8')) }];
}));
const shared = {
  en: { 'common.breadcrumb': 'Breadcrumb', 'common.profileImage': '{name} profile image', 'inv.asAtNote': 'As at {date} · Standard cost · All warehouses', 'inv.firstRows': 'First 100 rows per resource', 'route.new-stock-adjustment': 'New Stock Adjustment' },
  ms: { 'common.breadcrumb': 'Jejak navigasi', 'common.profileImage': 'Imej profil {name}', 'inv.asAtNote': 'Setakat {date} · Kos standard · Semua gudang', 'inv.firstRows': '100 baris pertama bagi setiap sumber', 'route.new-stock-adjustment': 'Pelarasan Stok Baharu' },
  zh: { 'common.breadcrumb': '面包屑导航', 'common.profileImage': '{name} 的头像', 'inv.asAtNote': '截至 {date} · 标准成本 · 所有仓库', 'inv.firstRows': '每项资源前 100 行', 'route.new-stock-adjustment': '新建库存调整' },
  ja: { 'common.breadcrumb': 'パンくずリスト', 'common.profileImage': '{name} のプロフィール画像', 'inv.asAtNote': '{date} 時点 · 標準原価 · 全倉庫', 'inv.firstRows': 'リソースごとの先頭100行', 'route.new-stock-adjustment': '新規在庫調整' },
  vi: { 'common.breadcrumb': 'Điều hướng phân cấp', 'common.profileImage': 'Ảnh hồ sơ của {name}', 'inv.asAtNote': 'Tính đến {date} · Chi phí tiêu chuẩn · Tất cả kho', 'inv.firstRows': '100 dòng đầu tiên cho mỗi tài nguyên', 'route.new-stock-adjustment': 'Điều chỉnh tồn kho mới' },
};
for (const [code, values] of Object.entries(shared)) Object.assign(packs[code].data, values);

let added = 0;
for (const value of candidates) {
  if (Object.values(packs.en.data).includes(value)) continue;
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 16);
  const key = `legacy.${hash}`;
  for (const pack of Object.values(packs)) pack.data[key] = value;
  added += 1;
}
for (const { filename, data } of Object.values(packs)) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([left], [right]) => left.localeCompare(right)));
  writeFileSync(filename, `${JSON.stringify(sorted, null, 2)}\n`);
}
console.log(`Imported ${added} hardcoded system strings into canonical locale resources.`);
