#!/usr/bin/env node
/**
 * 零依赖构建脚本
 *
 * 将 src/ 下的多文件源码按清单顺序拼装为单个油猴脚本：
 *   - dist/enhance.user.js   正式产物（安装/发布使用）
 *   - enhance.js             根目录副本，兼容历史安装链接
 *
 * 用法：npm run build
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

/**
 * ── 源码清单 ────────────────────────────────────────────────
 * 现阶段各文件共享同一个函数作用域（与迁移前的单文件等价），
 * 因此**顺序不可随意调整**：被依赖的定义必须排在调用者之前。
 * 后续若将各文件改造为独立模块，此约束即可解除。
 */
const SOURCES = [
    // 模块一：核心增强
    'core/config.js',            // 配置项、数据源镜像、培养方案版本适配
    'core/logging.js',           // 日志面板 UI 与 Logger
    'core/cache.js',             // 本地缓存管理
    'core/bootstrap.js',         // 日志延迟初始化、推广横幅初始化
    'ui/modal.js',               // 统一弹窗
    'ui/drag.js',                // 拖拽能力
    'ui/window.js',              // 统一窗口能力（拖动 / 缩放 / 记忆）
    'core/qiangzhi.js',          // 强智科技页面检测
    'core/networkNotice.js',     // 校园网访问限制提示
    'ui/promoBanner.js',         // 梨课程推荐提示
    'core/dataSource.js',        // 远程数据加载与课程映射构建
    'ui/creditsPanel.js',        // 学分统计悬浮窗
    'core/courseEnhance.js',     // 表格增强（大纲/类别标签）
    'core/loginKeepAlive.js',    // 登录状态保活
    'core/main.js',              // 入口 init
    // 模块二：自动评教
    'evaluate/consts.js',        // 常量、日志、通用工具
    'evaluate/evaluateCore.js',  // 评分核心逻辑
    'evaluate/style.js',         // 评教面板样式
    'evaluate/panel.js',         // 面板骨架
    'evaluate/findPage.js',      // 评教类别入口页
    'evaluate/listPage.js',      // 课程列表页
    'evaluate/editPage.js'       // 课程评价页
];

/** 样式文件（编写顺序即注入顺序；theme 必须排在 base 之前） */
const STYLES = [
    'ui/theme.css',
    'ui/base.css'
];

const BUILD_NOTE = [
    '/**',
    ' * ⚠️ 本文件由 build.js 自动生成，请勿直接修改。',
    ' * 源码位于 src/ 目录，修改后请执行：npm run build',
    ' */'
].join('\n');

function buildStyleBlock() {
    if (!STYLES.length) return '';
    const cssText = STYLES
        .map(file => {
            const full = path.join(SRC, file);
            if (!fs.existsSync(full)) {
                console.warn(`⚠️  样式文件不存在，已跳过：src/${file}`);
                return '';
            }
            // 同样规范化换行，保证跨平台构建结果一致
            return fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
        })
        .join('\n\n');

    if (!cssText.trim()) return '';

    return [
        '// ===== 以下内容由 src/**/*.css 自动注入 =====',
        '(function () {',
        `    const njustCssText = ${JSON.stringify(cssText)};`,
        '    const styleEl = document.createElement("style");',
        '    styleEl.id = "njust-injected-style";',
        '    styleEl.textContent = njustCssText;',
        '    (document.head || document.documentElement).appendChild(styleEl);',
        '})();',
        ''
    ].join('\n');
}

function build() {
    const metaPath = path.join(SRC, 'meta.txt');
    if (!fs.existsSync(metaPath)) throw new Error('缺少 src/meta.txt（userscript 头）');
    const meta = fs.readFileSync(metaPath, 'utf8').replace(/\s+$/, '\n');

    const chunks = [meta, BUILD_NOTE];
    const styleBlock = buildStyleBlock();
    if (styleBlock) chunks.push(styleBlock);

    for (const file of SOURCES) {
        const full = path.join(SRC, file);
        if (!fs.existsSync(full)) throw new Error(`缺少源文件：src/${file}`);
        const body = fs.readFileSync(full, 'utf8').replace(/\s+$/, '\n');
        chunks.push(`// ===== src/${file} ${'='.repeat(Math.max(0, 60 - file.length))}\n${body}`);
    }

    // 统一换行符为 LF：保证 Windows / Linux 下构建出的字节完全一致，
    // 否则 CI 的「产物同步校验」会因 CRLF 差异误报
    const output = chunks.join('\n').replace(/\r\n/g, '\n');

    fs.mkdirSync(DIST, { recursive: true });
    fs.writeFileSync(path.join(DIST, 'enhance.user.js'), output, 'utf8');
    // 根目录副本：兼容 greasyfork / raw 链接等历史安装来源
    fs.writeFileSync(path.join(ROOT, 'enhance.js'), output, 'utf8');

    return output;
}

try {
    const output = build();
    const lineCount = output.split('\n').length;
    console.log('✅ 构建完成');
    console.log(`   dist/enhance.user.js  ${lineCount} 行  ${(Buffer.byteLength(output) / 1024).toFixed(1)} KB`);
    console.log('   enhance.js            根目录副本（兼容旧安装链接）');
} catch (e) {
    console.error('❌ 构建失败：', e.message);
    process.exit(1);
}
