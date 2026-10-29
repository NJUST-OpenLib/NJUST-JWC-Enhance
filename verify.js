#!/usr/bin/env node
/**
 * 构建产物等价性检查
 *
 * 比对 dist/enhance.user.js 与基线脚本的行覆盖情况，确保迁移过程中没有丢失任何一行代码。
 * 用法：npm run verify -- [基线文件路径]，默认基线为 _baseline_enhance.js
 */
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist', 'enhance.user.js');
const basePath = process.argv[2] || path.join(__dirname, '_baseline_enhance.js');

if (!fs.existsSync(distPath)) {
    console.error('❌ 未找到构建产物，请先执行 npm run build');
    process.exit(1);
}
if (!fs.existsSync(basePath)) {
    console.error(`❌ 未找到基线文件：${path.basename(basePath)}`);
    process.exit(1);
}

const readLines = (p) => fs.readFileSync(p, 'utf8').split(/\r?\n/);
const distLines = readLines(distPath);
const baseLines = readLines(basePath);

const distSet = new Set(distLines.map(l => l.trim()));
const baseSet = new Set(baseLines.map(l => l.trim()));

// 基线中未被产物覆盖的行（排除 userscript 头，它已被迁移到 src/meta.txt）
const missing = [];
for (const line of baseLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\/\/ ==(\/)?UserScript==$|^\/\/ @\w+/.test(trimmed)) continue; // userscript 头
    if (!distSet.has(trimmed) && !missing.includes(trimmed)) missing.push(trimmed);
}

const added = [];
for (const line of distLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (baseSet.has(trimmed)) continue;
    if (/^\/\/ ==(\/)?UserScript==$|^\/\/ @\w+/.test(trimmed)) continue;
    if (!added.includes(trimmed)) added.push(trimmed);
}

console.log(`产物行数: ${distLines.length}    基线行数: ${baseLines.length}`);
console.log(`基线未覆盖行: ${missing.length}`);
missing.slice(0, 20).forEach(l => console.log('  - ' + l.slice(0, 100)));

console.log(`产物新增行: ${added.length}`);
added.slice(0, 20).forEach(l => console.log('  + ' + l.slice(0, 100)));

if (missing.length === 0) {
    console.log('\n✅ 等价性检查通过：基线代码行已全部出现在产物中');
    process.exit(0);
} else {
    console.log('\n❌ 存在未覆盖的代码行，请检查切片是否遗漏');
    process.exit(1);
}
