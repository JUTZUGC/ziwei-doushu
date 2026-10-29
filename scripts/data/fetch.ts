/**
 * 下载并导入官方 v4.0 解读数据集
 *
 * 用法：
 *   npm run data:fetch -- --years 1990,1991
 *   npm run data:fetch -- --all
 */

import { fetchAndImportYear, isValidYear } from '../../lib/ziwei/dataset-fetch';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

function fail(msg: string): never {
  console.error(`[data:fetch] ${msg}`);
  process.exit(1);
}

async function main() {
  const all = has('--all');
  const yearsArg = arg('--years') ?? process.argv.slice(2).find((s) => /^\d{4}(,\d{4})*$/.test(s));
  let years: number[] = [];
  if (all) {
    years = Array.from({ length: 77 }, (_, i) => 1950 + i);
  } else if (yearsArg) {
    years = yearsArg.split(',').map((s) => Number(s.trim())).filter(isValidYear);
  }
  if (!years.length) fail('请用 --years 1990,1991 指定年份，或 --all 下载全部年份');

  console.log(`[data:fetch] 目标年份：${years.join(', ')}`);
  for (const year of years) {
    console.log(`\n[${year}]`);
    try {
      const r = await fetchAndImportYear(year);
      console.log(`  下载 ${(r.bytes / 1024 / 1024).toFixed(1)} MB，校验通过`);
      console.log(`  导入 ${r.imported} 张命盘`);
      console.log(`  数据库：${r.database}`);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }
  console.log('\n完成。');
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
