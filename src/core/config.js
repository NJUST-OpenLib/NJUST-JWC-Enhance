// ================================================================
//  【模块一】核心增强功能模块
//  职责：数据抓取、课程信息增强（大纲/类别）、学分统计、登录保活
//  设计模式：单例对象（Singleton）组织各子系统
// ================================================================
(function () {
    'use strict';

    /**
     * ── 数据源镜像配置 ─────────────────────────────────────────────
     * 采用多节点冗余设计，解决部分节点在大规模访问时的稳定性问题。
     * 优先级顺序：官方主站 > jsDelivr 加速 > jsDelivr 备用 > GitHub Raw。
     */

    // 选修课类别数据源（JSON 格式）
    const CATEGORY_URL_TEMPLATES = [
        'https://enhance.njust.store/data/xxk.json',
        'https://enhance.njust.wiki/data/xxk.json',                                                               // 官方主节点
        'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json',                        // jsDelivr 全球加速
        'https://testingcf.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json',                    // jsDelivr Cloudflare
        'https://raw.githubusercontent.com/NJUST-OpenLib/NJUST-JWC-Enhance/refs/heads/main/data/xxk.json'             // GitHub 原始文件（备用）
    ];

    /**
     * ── 多版本培养方案支持 ───────────────────────────────────────────
     * 教务处每 4 年更新一次通识课分类口径，各年级需按入学当年的方案统计类别学分。
     * 脚本依据学号自动判断入学年份，加载对应版本的数据文件；也支持手动指定。
     */

    // 培养方案版本 → 数据文件名（2026 版即默认的 xxk.json）
    const XXK_VERSION_FILES = {
        '2018': 'xxk_2018.json',
        '2022': 'xxk_2022.json',
        '2026': 'xxk.json'
    };

    // 入学年份 → 培养方案版本（倒序匹配；学校若调整适用口径请修改此处）
    const PLAN_VERSION_RULES = [
        { since: 2026, version: '2026' },
        { since: 2022, version: '2022' },
        { since: 0, version: '2018' }
    ];

    const KEY_XXK_VERSION = 'njust_xxk_version';       // 手动指定的口径版本（优先级最高）
    const KEY_XXK_YEAR = 'njust_xxk_enroll_year';      // 缓存的入学年份
    const KEY_XXK_STUDENT = 'njust_xxk_student_mask';  // 缓存的脱敏学号

    /**
     * 识别当前登录者的学号与入学年份
     * 学号规则（如 922110800724）：9=本科生，22=2022 级，108=自动化学院，其后为院内流水号
     * 主框架页顶部节点 [id$="divLoginName"] 形如「张三(922110800724)」
     */
    function detectEnrollment() {
        try {
            const cachedYear = parseInt(localStorage.getItem(KEY_XXK_YEAR) || '', 10);
            if (cachedYear) {
                return { year: cachedYear, student: localStorage.getItem(KEY_XXK_STUDENT) || '' };
            }

            const nameNodes = document.querySelectorAll('[id$="divLoginName"], .Nsb_top_menu_nc');
            let idNumber = '';
            for (const node of nameNodes) {
                const matched = (node.textContent || '').match(/(\d{9,15})/);
                if (matched) { idNumber = matched[1]; break; }
            }
            if (!idNumber) return null;

            // 第 2-3 位为入学年份后两位
            const yearPart = idNumber.length >= 10 ? idNumber.slice(1, 3) : '';
            const year = parseInt(yearPart, 10) + 2000;
            if (!yearPart || year < 2008 || year > new Date().getFullYear() + 1) return null;

            // 脱敏：保留前 6 位
            const masked = idNumber.slice(0, 6) + '*'.repeat(Math.max(idNumber.length - 6, 0));
            localStorage.setItem(KEY_XXK_YEAR, String(year));
            localStorage.setItem(KEY_XXK_STUDENT, masked);
            Logger.info(`识别到学号 ${masked}，推断入学年份 ${year}`);
            return { year, student: masked };
        } catch (e) {
            Logger.warn('学号识别失败:', e);
            return null;
        }
    }

    /**
     * 解析当前应使用的分类口径
     * 优先级：手动指定 > 学号自动识别 > 默认 2026 版
     */
    function resolveCategoryVersion() {
        try {
            const manual = localStorage.getItem(KEY_XXK_VERSION);
            if (manual && XXK_VERSION_FILES[manual]) {
                return { version: manual, source: 'manual' };
            }
            const info = detectEnrollment();
            if (info) {
                const rule = PLAN_VERSION_RULES.find(r => info.year >= r.since);
                if (rule) return { version: rule.version, source: 'auto', year: info.year, student: info.student };
            }
        } catch (e) {
            Logger.warn('解析分类口径失败:', e);
        }
        return { version: '2026', source: 'default' };
    }

    /** 按指定口径生成分类数据源地址列表 */
    function getCategoryURLs(version) {
        const file = XXK_VERSION_FILES[version] || XXK_VERSION_FILES['2026'];
        return CATEGORY_URL_TEMPLATES.map(url => url.replace('xxk.json', file));
    }

    /** 口径来源的中文描述，供日志与界面显示 */
    function describeVersionSource(info) {
        if (info.source === 'manual') return '手动指定';
        if (info.source === 'auto') return `学号自动识别 · ${info.year} 级`;
        return '默认 · 最新方案';
    }

    // 课程大纲索引数据源（包含课程代码到 jx02id 的映射）
    const OUTLINE_URLS = [
        'https://enhance.njust.store/data/kcdg.json',
        'https://enhance.njust.wiki/data/kcdg.json',                                                               // 官方主节点
        'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/kcdg.json',                        // jsDelivr 全球加速
        'https://testingcf.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/kcdg.json',                    // jsDelivr Cloudflare
        'https://raw.githubusercontent.com/NJUST-OpenLib/NJUST-JWC-Enhance/refs/heads/main/data/kcdg.json'             // GitHub 原始文件（备用）
    ];

    /**
     * ── 全局配置选项 ───────────────────────────────────────────────
     */
    const UI_CONFIG = {
        showNotifications: true // 是否允许弹出系统级通知（目前主要通过 LogPanel 反馈）
    };

    /**
     * ── 调试系统配置 ───────────────────────────────────────────────
     * enabled: 开启后会向控制台和日志面板输出详细过程
     * level: 4(DEBUG), 3(INFO), 2(WARN), 1(ERROR)
     */
    const DEBUG_CONFIG = {
        enabled: true,
        level: 3,
        showCache: true // 是否在日志中详细记录缓存的存取动作
    };

    /**
     * ── 缓存系统配置 ───────────────────────────────────────────────
     * 使用 localStorage 存储远程 JSON 数据，减少重复的网络请求，提升页面加载速度。
     */
    const CACHE_CONFIG = {
        enabled: true,
        ttl: 86400,                   // 缓存有效期：（单位：秒）
        prefix: 'njust_jwc_enhance_'  // 本脚本专用的缓存键名前缀
    };

    /**
     * ── 日志面板 UI 系统 ────────────────────────────────────────────
     * 这是一个右下角的悬浮面板，用于实时展示脚本运行状态，取代了侵入式的 Toast 弹窗。
     * 特性：
     * 1. 队列化处理：确保在 DOM 准备好之前产生的日志不会丢失。
     * 2. 标题栏滚动：标题栏会循环展示最新的日志摘要，5秒后自动复位。
     * 3. 级别过滤：支持在展开状态下通过下拉菜单过滤日志级别。
     */
