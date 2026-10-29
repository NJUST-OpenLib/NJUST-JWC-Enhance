// ==UserScript==
// @name         南理工教务增强助手 V2 | 支持自动评教
// @namespace    http://tampermonkey.net/
// @version      2.0.1.4
// @description  在合适的地方显示课程大纲、选修课类别及选修课学分情况，并自动刷新登录状态。同时支持自动评教与批量提交。
// @match        http://202.119.81.112/*
// @match        http://bkjw.njust.edu.cn/*
// @match        http://202.119.81.112:9080/*
// @match        http://202.119.81.113:9080/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      jsdelivr.net
// @connect      njust.wiki
// @author       Light
// @license      MIT
// @supportURL   https://github.com/NJUST-OpenLib/NJUST-JWC-Enhance
// ==/UserScript==

/**
 * ⚠️ 本文件由 build.js 自动生成，请勿直接修改。
 * 源码位于 src/ 目录，修改后请执行：npm run build
 */
// ===== src/core/config.js ==============================================
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

// ===== src/core/logging.js =============================================
    const LogPanelUI = {
        container: null,    // 外部容器 DOM
        body: null,         // 日志行容器 DOM
        initialized: false, // 初始化状态标志
        queue: [],          // 预初始化消息队列
        _statusQueue: [],   // 标题栏待播放队列
        _statusPlaying: false, // 标题栏是否正在播放动画

        /**
         * 初始化面板 DOM 并注入样式
         */
        init() {
            if (this.initialized || !document.body) return;

            const style = document.createElement('style');
            style.textContent = `
                /* 面板主样式 */
                #njust-enhance-log {
                    position: fixed; bottom: 0; right: 20px; width: 380px;
                    background: #fff; border: 1px solid #e2e8f0; border-bottom: none;
                    border-radius: 10px 10px 0 0; box-shadow: 0 -2px 15px rgba(0,0,0,0.08);
                    z-index: 10001; font-family: 'SFMono-Regular', Consolas, monospace;
                    display: flex; flex-direction: column; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                #njust-enhance-log.minimized { transform: translateY(calc(100% - 38px)); }

                /* 标题栏样式 */
                #njust-enhance-log-hd {
                    padding: 10px 15px; background: #f7fafc; border-bottom: 1px solid #e2e8f0;
                    cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                    border-radius: 10px 10px 0 0; user-select: none; gap: 10px;
                }
                #njust-enhance-log-hd b { font-size: 13px; color: #2d3748; display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
                #nel-status-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; }

                /* 日志列表样式 */
                #njust-enhance-log-body {
                    height: 220px; overflow-y: auto; background: #fdfdfd; font-size: 11px;
                    padding: 4px 0; scroll-behavior: smooth;
                }
                .nel-btn { font-size: 11px; color: #718096; background: #edf2f7; padding: 2px 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .nel-btn:hover { background: #e2e8f0; color: #2d3748; }
                .nel-clear { background: rgba(245, 101, 101, 0.05); color: #c53030; }
                .nel-clear:hover { background: rgba(245, 101, 101, 0.15); color: #c53030; }

                /* 日志行与分级颜色 */
                .nel-line { padding: 3px 12px; border-bottom: 1px solid rgba(226, 232, 240, 0.4); display: flex; gap: 8px; align-items: flex-start; }
                .nel-line:hover { background: #f7fafc; }
                .nel-ts { color: #a0aec0; flex-shrink: 0; min-width: 55px; user-select: none; }
                .nel-lvl { font-weight: bold; flex-shrink: 0; min-width: 42px; text-align: center; font-size: 10px; }
                .nel-msg { color: #4a5568; word-break: break-all; flex: 1; line-height: 1.5; }

                .nel-error { border-left: 3px solid #e53e3e; background: rgba(229, 62, 62, 0.02); } .nel-error .nel-lvl { color: #e53e3e; }
                .nel-warn { border-left: 3px solid #dd6b20; background: rgba(221, 107, 32, 0.02); } .nel-warn .nel-lvl { color: #dd6b20; }
                .nel-success { border-left: 3px solid #38a169; background: rgba(56, 161, 105, 0.02); } .nel-success .nel-lvl { color: #38a169; }
                .nel-info { border-left: 3px solid #3182ce; } .nel-info .nel-lvl { color: #3182ce; }
                .nel-debug { border-left: 3px solid #9f7aea; color: #718096; } .nel-debug .nel-lvl { color: #9f7aea; }
            `;
            document.head.appendChild(style);

            this.container = document.createElement('div');
            this.container.id = 'njust-enhance-log';
            this.container.className = 'minimized';
            this.container.innerHTML = `
                <div id="njust-enhance-log-hd">
                    <b><span id="nel-status-text">南理工教务增强助手 V2</span></b>
                    <span id="nel-clear-btn" class="nel-btn nel-clear" title="清空日志">清空</span>
                    <span id="njust-log-toggle" class="nel-btn">展开 ▴</span>
                </div>
                <div id="njust-enhance-log-body"></div>
            `;
            document.body.appendChild(this.container);
            this.body = this.container.querySelector('#njust-enhance-log-body');

            this.initialized = true;

            // 绑定交互事件
            this.container.querySelector('#njust-enhance-log-hd').onclick = (e) => {
                if (e.target.id === 'nel-clear-btn') return;
                const isMin = this.container.classList.toggle('minimized');
                this.container.querySelector('#njust-log-toggle').textContent = isMin ? '展开 ▴' : '折叠 ▾';
            };

            this.container.querySelector('#nel-clear-btn').onclick = (e) => {
                e.stopPropagation();
                if (this.body) this.body.innerHTML = '';
                const statusText = this.container.querySelector('#nel-status-text');
                if (statusText) statusText.textContent = '日志已清空';
                // 清空时也清空标题栏队列
                this._statusQueue = [];
                this._statusPlaying = false;
            };

            // 处理初始化前的缓存消息
            if (this.queue.length > 0) {
                this.queue.forEach(item => this.add(item.level, item.msg));
                this.queue = [];
            }
        },

        /**
         * 向面板添加一条新日志
         * @param {string} level - 级别: error, warn, success, info, debug
         * @param {string} msg - 日志内容
         */
        add(level, msg) {
            if (!this.initialized) {
                this.init();
                if (!this.initialized) {
                    this.queue.push({ level, msg });
                    return;
                }
            }
            if (!this.body) return;

            const labels = { error: '[ERR]', warn: '[WRN]', success: '[OK ]', info: '[INF]', debug: '[DBG]' };
            const lvlLabel = labels[level] || '[INF]';
            const ts = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const line = document.createElement('div');
            line.className = `nel-line nel-${level}`;
            line.innerHTML = `<span class="nel-ts">[${ts}]</span><span class="nel-lvl">${lvlLabel}</span><span class="nel-msg">${this.esc(msg)}</span>`;

            this.body.appendChild(line);
            // 限制最大行数，防止页面过重
            if (this.body.children.length > 200) this.body.removeChild(this.body.firstChild);
            this.body.scrollTop = this.body.scrollHeight;

            // 加入标题栏滚动显示队列
            this._statusQueue.push({ msg, level });
            if (!this._statusPlaying) {
                this._playStatusQueue();
            }
        },

        /**
         * 标题栏消息队列播放器
         */
        _playStatusQueue() {
            if (this._statusQueue.length === 0) {
                this._statusPlaying = false;
                // 恢复默认状态文字
                const statusText = this.container && this.container.querySelector('#nel-status-text');
                if (statusText) {
                    statusText.textContent = '南理工教务增强助手 V2';
                    statusText.style.color = '#2d3748';
                }
                return;
            }
            this._statusPlaying = true;
            const { msg, level } = this._statusQueue.shift();
            const statusText = this.container && this.container.querySelector('#nel-status-text');
            if (statusText) {
                const colors = { error: '#e53e3e', warn: '#dd6b20', success: '#38a169', info: '#3182ce', debug: '#718096' };
                statusText.textContent = msg;
                statusText.style.color = colors[level] || '#2d3748';
            }
            // 每 300ms 切换下一条，形成滚动感
            setTimeout(() => { this._playStatusQueue(); }, 300);
        },

        esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    };

    /**
     * ── 调试系统 ────────────────────────────────────────────────────
     * 统一的日志入口，负责格式化输出并同步到 LogPanelUI。
     */
    const Logger = {
        LEVELS: { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 },

        log(level, message, ...args) {
            if (!DEBUG_CONFIG.enabled || level > DEBUG_CONFIG.level) return;

            const timestamp = new Date().toLocaleTimeString();
            const levelNames = ['', 'error', 'warn', 'info', 'debug'];
            const lvlName = levelNames[level] || 'info';

            // 控制台原生输出
            console.log(`[${timestamp}] [南理工教务助手]`, message, ...args);

            // 格式化对象参数，使其在 UI 面板中可见
            let displayMessage = message;
            if (args.length > 0) {
                const formattedArgs = args.map(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                        try {
                            return JSON.stringify(arg, null, 1)
                                .replace(/^{|}$/g, '')
                                .replace(/"/g, '')
                                .replace(/\n/g, ' ');
                        } catch (e) { return '[Object]'; }
                    }
                    return String(arg);
                }).join(' ');
                displayMessage += ' ' + formattedArgs;
            }

            // 同步到 UI 面板
            LogPanelUI.add(lvlName, displayMessage);
        },

        error(message, ...args) { this.log(this.LEVELS.ERROR, message, ...args); },
        warn(message, ...args) { this.log(this.LEVELS.WARN, message, ...args); },
        info(message, ...args) { this.log(this.LEVELS.INFO, message, ...args); },
        debug(message, ...args) { this.log(this.LEVELS.DEBUG, message, ...args); }
    };

    /**
     * ── 缓存系统 ────────────────────────────────────────────────────
     * 负责远程 JSON 数据在本地 localStorage 的存取、过期判断及统计。
     */

// ===== src/core/cache.js ===============================================
    const CacheManager = {
        /**
         * 生成 URL 对应的哈希键名
         */
        getKey(url) {
            return CACHE_CONFIG.prefix + btoa(unescape(encodeURIComponent(url))).replace(/[^a-zA-Z0-9]/g, '');
        },

        /**
         * 存入缓存
         */
        set(url, data) {
            if (!CACHE_CONFIG.enabled) return false;
            try {
                const cacheData = {
                    data,
                    timestamp: Date.now(),
                    ttl: CACHE_CONFIG.ttl * 1000,
                    url
                };
                localStorage.setItem(this.getKey(url), JSON.stringify(cacheData));
                if (DEBUG_CONFIG.showCache) Logger.info(`💾 缓存已保存: ${url}`);
                return true;
            } catch (e) {
                Logger.error('缓存保存失败: ', e);
                return false;
            }
        },

        /**
         * 读取缓存（包含过期校验）
         */
        get(url) {
            if (!CACHE_CONFIG.enabled) return null;
            try {
                const key = this.getKey(url);
                const cached = localStorage.getItem(key);
                if (!cached) {
                    if (DEBUG_CONFIG.showCache) Logger.debug(`缓存未命中: ${url}`);
                    return null;
                }
                const cacheData = JSON.parse(cached);
                const now = Date.now();
                // 过期判断
                if (now - cacheData.timestamp > cacheData.ttl) {
                    localStorage.removeItem(key);
                    if (DEBUG_CONFIG.showCache) Logger.warn(`⏰ 缓存已过期: ${url}`);
                    return null;
                }
                const age = ((now - cacheData.timestamp) / 1000).toFixed(1);
                const remaining = ((cacheData.ttl - (now - cacheData.timestamp)) / 1000).toFixed(1);
                if (DEBUG_CONFIG.showCache) Logger.info(`✅ 缓存命中: ${url} (已缓存${age}s，剩余${remaining}s)`);
                return cacheData.data;
            } catch (e) {
                Logger.error('缓存读取失败: ', e);
                return null;
            }
        },

        /**
         * 清空本脚本产生的所有缓存
         */
        clear() {
            try {
                const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_CONFIG.prefix));
                keys.forEach(k => localStorage.removeItem(k));
                Logger.info(`已清除 ${keys.length} 个缓存项`);
                return keys.length;
            } catch (e) {
                Logger.error('清除缓存失败: ', e);
                return 0;
            }
        },

        /**
         * 获取缓存占用情况统计
         */
        getStats() {
            try {
                const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_CONFIG.prefix));
                let totalSize = 0, validCount = 0, expiredCount = 0;
                const now = Date.now();
                keys.forEach(k => {
                    try {
                        const cached = localStorage.getItem(k);
                        totalSize += cached.length;
                        const d = JSON.parse(cached);
                        (now - d.timestamp > d.ttl) ? expiredCount++ : validCount++;
                    } catch (e) { expiredCount++; }
                });
                return { total: keys.length, valid: validCount, expired: expiredCount, size: totalSize };
            } catch (e) {
                Logger.error('获取缓存统计失败: ', e);
                return { total: 0, valid: 0, expired: 0, size: 0 };
            }
        }
    };

    // fix④: 彻底移除与 LogPanelUI 职责重叠的 StatusNotifier，
    //        原代码中该系统的调用已被注释，直接删除其定义以消除冗余。

// ===== src/core/bootstrap.js ===========================================
    // ==================== 延迟初始化日志 ====================
    function initializeLogging() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeLogging);
            return;
        }
        setTimeout(() => {
            try {
                Logger.info('南理工教务增强助手已启动', {
                    debug: DEBUG_CONFIG.enabled ? `Level ${DEBUG_CONFIG.level}` : '关闭',
                    cache: CACHE_CONFIG.enabled ? `TTL ${CACHE_CONFIG.ttl}s` : '关闭'
                });
                if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.showCache) {
                    const stats = CacheManager.getStats();
                    Logger.info(`缓存统计: 总${stats.total} 有效${stats.valid} 过期${stats.expired} ${(stats.size / 1024).toFixed(1)}KB`);
                }
            } catch (e) {
                console.error('初始化日志失败: ', e);
            }
        }, 100);
    }

    initializeLogging();

    // 早期初始化推广信息（在数据加载之前显示）
    function initializePromoBanner() {
        const tryShow = () => {
            // 检查是否已存在
            if (document.getElementById('njust-promo-line')) return true;

            // 检查两种版权信息结构
            const footer = document.getElementById('Footer1_divCopyright');
            const copyrightLink = document.querySelector('a.copyright[href*="qzdatasoft"]');

            if (footer || (copyrightLink && copyrightLink.parentElement)) {
                showPromoBanner();
                return true;
            }
            return false;
        };

        // 隐藏无法使用的二维码图片
        const hideUnusedElements = () => {
            const uselessImg = document.querySelector('img[src*="appewm.png"]');
            if (uselessImg) {
                uselessImg.style.display = 'none';
            }
        };

        // 尝试立即显示和隐藏
        if (tryShow()) {
            hideUnusedElements();
            return;
        }

        // 如果目标元素还不存在，监听 DOM 变化
        const observer = new MutationObserver(() => {
            if (tryShow()) {
                hideUnusedElements();
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // 5 秒后停止监听（防止内存泄漏）
        setTimeout(() => observer.disconnect(), 5000);
    }

    initializePromoBanner();

    let courseCategoryMap = {};
    let courseOutlineMap = {};

// ===== src/ui/modal.js =================================================
    // ==================== 统一弹窗 ====================
    function createUnifiedModal(title, content, type = 'info') {
        const existingModal = document.getElementById('njustAssistantModal');
        if (existingModal) existingModal.remove();

        const container = document.createElement('div');
        container.id = 'njustAssistantModal';

        // Apple 风格主题色彩配置
        const themeConfig = {
            warning: { accent: '#FF9500', accentLight: 'rgba(255,149,0,0.12)' },
            success: { accent: '#34C759', accentLight: 'rgba(52,199,89,0.12)' },
            info: { accent: '#007AFF', accentLight: 'rgba(0,122,255,0.12)' }
        };
        const theme = themeConfig[type] || themeConfig.info;

        container.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: #ffffff;
            border: none; border-radius: 20px; padding: 0;
            box-shadow: 0 24px 80px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.08);
            z-index: 10000; min-width: 340px; max-width: 460px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
            overflow: hidden; animation: njustFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        container.innerHTML = `
            <div id="dragHandle" style="padding: 24px 28px 20px 28px; cursor: move;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <div style="font-size: 20px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.3px;">
                        ${title}
                    </div>
                    <button id="closeModalBtn" style="
                        width: 28px; height: 28px; border-radius: 50%;
                        border: none; background: #f5f5f7;
                        cursor: pointer; display: flex; align-items: center;
                        justify-content: center; color: #86868b;
                        font-size: 16px; transition: all 0.15s;
                        margin-left: 16px; flex-shrink: 0;
                    ">×</button>
                </div>
                <div style="color: #424245; font-size: 14px; line-height: 1.65; font-weight: 400;">
                    ${content}
                </div>
            </div>
            <div style="padding: 16px 28px 22px 28px; background: #f5f5f7; border-top: 1px solid #e5e5ea;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <a href="https://enhance.njust.wiki" target="_blank"
                        style="color: ${theme.accent}; text-decoration: none; font-weight: 500; font-size: 14px;">
                        查看使用说明
                    </a>
                </div>
                <div style="
                    padding: 12px 14px;
                    background: ${theme.accentLight}; border-radius: 10px;
                ">
                    <div style="font-size: 12px; color: #424245; line-height: 1.5;">
                        <strong style="color: ${theme.accent};">免责声明</strong> — 本工具仅供学习交流，数据仅供参考。请以教务处官网信息为准，使用本工具产生的任何后果由用户自行承担。
                    </div>
                </div>
            </div>
        `;

        if (!document.getElementById('njustAssistantStyles')) {
            const style = document.createElement('style');
            style.id = 'njustAssistantStyles';
            style.textContent = `
                @keyframes njustFadeIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                #closeModalBtn:hover { background: #e8e8ed; color: #1d1d1f; }
            `;
            document.head.appendChild(style);
        }

        addDragFunctionality(container);
        document.body.appendChild(container);

        // 绑定关闭按钮事件
        const closeBtn = container.querySelector('#closeModalBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => container.remove());
        }

        return container;
    }

// ===== src/ui/drag.js ==================================================
    // ==================== 拖动功能 ====================
    // fix②: 使用 getBoundingClientRect 获取视觉位置，修复折叠动画后拖拽跳位问题
    function addDragFunctionality(container) {
        let isDragging = false;
        let mouseStartX, mouseStartY, elemStartX, elemStartY;

        const dragHandle = container.querySelector('#dragHandle');

        function dragStart(e) {
            const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
            if (e.target === dragHandle || dragHandle.contains(e.target)) {
                // 读取当前视觉位置（考虑 transform 的影响）
                const rect = container.getBoundingClientRect();
                elemStartX = rect.left;
                elemStartY = rect.top;
                mouseStartX = clientX;
                mouseStartY = clientY;
                isDragging = true;
                e.preventDefault();
            }
        }

        function drag(e) {
            if (!isDragging) return;
            e.preventDefault();
            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            const newLeft = elemStartX + (clientX - mouseStartX);
            const newTop = elemStartY + (clientY - mouseStartY);
            container.style.transform = 'none';  // 清除动画 transform
            container.style.left = newLeft + 'px';
            container.style.top = newTop + 'px';
            // 若原来用 translate(-50%,-50%) 定位，拖动后改为绝对位置
            container.style.margin = '0';
        }

        function dragEnd() { isDragging = false; }

        dragHandle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        dragHandle.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd, { passive: false });
    }

// ===== src/core/qiangzhi.js ============================================
    // ==================== 检测强智科技页面 ====================
    function checkQiangzhiPage() {
        try {
            const pageTitle = document.title || '';
            if (pageTitle.includes('强智科技教务系统概念版')) {
                Logger.warn('检测到强智科技概念版页面，显示登录引导');
                const content = `
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 15px; font-weight: 500; color: #1d1d1f; margin-bottom: 10px;">
                            当前页面无法登录
                        </div>
                        <div style="font-size: 14px; color: #424245; line-height: 1.6;">
                            这是强智科技教务系统概念版，仅供展示，不提供登录功能。请前往以下入口登录教务系统。
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <a href="http://202.119.81.113:8080/" target="_blank" style="
                            display: flex; align-items: center; justify-content: center;
                            background: #007AFF; color: white;
                            padding: 13px 20px; text-decoration: none; border-radius: 12px;
                            font-weight: 500; font-size: 15px; text-align: center;
                            transition: background 0.15s;"
                            onmouseover="this.style.background='#0066d6'" onmouseout="this.style.background='#007AFF'">
                            教务处登录入口
                            <span style="margin-left: 8px; font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 6px;">推荐</span>
                        </a>
                        <a href="https://www.njust.edu.cn/" target="_blank" style="
                            display: block; background: #f5f5f7; color: #1d1d1f;
                            padding: 13px 20px; text-decoration: none; border-radius: 12px;
                            font-weight: 500; font-size: 15px; text-align: center;
                            border: 1px solid #d2d2d7; transition: background 0.15s;"
                            onmouseover="this.style.background='#e8e8ed'" onmouseout="this.style.background='#f5f5f7'">
                            智慧理工登录入口
                        </a>
                    </div>
                    <div style="margin-top: 18px; padding: 14px; background: #f5f5f7; border-radius: 10px;">
                        <div style="font-size: 13px; color: #424245; line-height: 1.6;">
                            <strong style="color: #1d1d1f;">温馨提示</strong><br>
                            验证码区分大小写，通常为小写字母。如遇登录问题，建议使用教务处入口。
                        </div>
                    </div>
                `;
                try { createUnifiedModal('南理工教务增强助手 V2', content, 'warning'); }
                catch (e) { Logger.error('创建强智科技页面提示弹窗失败:', e); }
                return true;
            }
            return false;
        } catch (e) {
            Logger.error('检测强智科技页面失败:', e);
            return false;
        }
    }

// ===== src/ui/promoBanner.js ===========================================
    // ==================== 梨课程推荐提示 ====================
    function showPromoBanner() {
        // 检查是否已存在
        if (document.getElementById('njust-promo-line')) return;

        // 查找底部版权信息区域（支持两种页面结构）
        let insertTarget = null;
        let isLoginPage = false;

        // 1. 登录后的页面：Footer1_divCopyright
        const footer = document.getElementById('Footer1_divCopyright');
        if (footer) {
            insertTarget = footer;
        }

        // 2. 登录页面：包含 class="copyright" 的 td 元素
        if (!insertTarget) {
            const copyrightLink = document.querySelector('a.copyright[href*="qzdatasoft"]');
            if (copyrightLink && copyrightLink.parentElement && copyrightLink.parentElement.tagName === 'TD') {
                insertTarget = copyrightLink.parentElement;
                isLoginPage = true;
            }
        }

        if (!insertTarget) return;

        // 创建推荐文本行（纯文本样式，与页面风格融合）
        const promoLine = document.createElement('div');
        promoLine.id = 'njust-promo-line';
        if (!isLoginPage) {
            promoLine.className = 'Nsb_pw';
        }
        promoLine.style.cssText = `
            padding: 8px 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
        `;

        promoLine.innerHTML = `
            <strong>推荐：</strong>尝试最新开发，支持本科生/研究生的 <strong>梨课程</strong>。
            可以在<a href="https://github.com/simpleClover/NJUSTSchedule/releases/latest" target="_blank"
                style="color: #007bff; text-decoration: none;">GitHub 下载</a> 或
            <a href="https://course-cdn.njust.store/?dir=/NJUSTSchedule/releases/download" target="_blank"
                style="color: #007bff; text-decoration: none;">CDN 下载</a>
            <span style="font-size: 11px; color: #888;">(Android/HarmonyOS)</span>，IOS/PC 用户也可使用
            <a href="https://Course.njust.store" target="_blank"
                style="color: #007bff; text-decoration: none;">网页版</a>。

        `;

        // 在目标元素上方插入
        insertTarget.parentNode.insertBefore(promoLine, insertTarget);
    }

// ===== src/core/dataSource.js ==========================================
    // ==================== 数据加载（智能切源）====================
    // fix⑤: 无论第几个数据源成功，均进行缓存；缓存读取也遍历所有 URL
    function loadJSONWithFallback(urls) {
        return new Promise((resolve, reject) => {
            const urlArray = Array.isArray(urls) ? urls : [urls];
            const fileName = urlArray[0].includes('xxk') ? '选修课分类' : '课程大纲';

            Logger.info(`开始加载 ${fileName}，共 ${urlArray.length} 个数据源`);

            // fix⑤: 先遍历所有 URL，尝试从缓存中命中任意一个
            for (const url of urlArray) {
                const cachedData = CacheManager.get(url);
                if (cachedData) {
                    Logger.info(`从缓存读取 ${fileName} 成功 (${url})`);
                    resolve(cachedData);
                    return;
                }
            }

            // 缓存全部未命中，依次请求网络
            let currentIndex = 0;

            function tryNextUrl() {
                if (currentIndex >= urlArray.length) {
                    Logger.error(`${fileName} 所有数据源均不可用`);
                    reject(new Error(`所有数据源都不可用: ${fileName}`));
                    return;
                }

                const currentUrl = urlArray[currentIndex++];
                Logger.info(`尝试数据源 ${currentIndex}/${urlArray.length}: ${currentUrl}`);
                const startTime = Date.now();

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: currentUrl,
                    timeout: 10000,
                    onload(response) {
                        const loadTime = Date.now() - startTime;
                        try {
                            const json = JSON.parse(response.responseText);
                            // fix⑤: 无论哪个数据源成功，均以该 URL 为键进行缓存
                            const cached = CacheManager.set(currentUrl, json);
                            Logger.info(
                                `数据源 ${currentIndex} 请求成功 (${loadTime}ms, ${response.responseText.length}B, 缓存${cached ? '已保存' : '失败'})`
                            );
                            resolve(json);
                        } catch (e) {
                            Logger.error(`JSON 解析失败: ${currentUrl}`, e);
                            tryNextUrl();
                        }
                    },
                    onerror() {
                        Logger.warn(`数据源 ${currentIndex} 请求失败 (${Date.now() - startTime}ms): ${currentUrl}`);
                        tryNextUrl();
                    },
                    ontimeout() {
                        Logger.warn(`数据源 ${currentIndex} 请求超时: ${currentUrl}`);
                        tryNextUrl();
                    }
                });
            }

            tryNextUrl();
        });
    }

    function loadJSON(url) {
        return loadJSONWithFallback(Array.isArray(url) ? url : [url]);
    }

    // ==================== 构建课程映射 ====================
    function buildCourseMaps(categoryList, outlineList) {
        try {
            let categoryCount = 0, outlineCount = 0;

            if (Array.isArray(categoryList)) {
                categoryList.forEach(item => {
                    try {
                        if (item && item.course_code && item.category) {
                            courseCategoryMap[item.course_code.trim()] = item.category;
                            categoryCount++;
                        }
                    } catch (e) { Logger.warn('处理分类数据项时出错:', e); }
                });
            } else {
                Logger.warn('分类数据不是数组格式:', typeof categoryList);
            }

            if (Array.isArray(outlineList)) {
                outlineList.forEach(item => {
                    try {
                        if (item && item.course_code && item.id) {
                            courseOutlineMap[item.course_code.trim()] = item.id;
                            outlineCount++;
                        }
                    } catch (e) { Logger.warn('处理大纲数据项时出错:', e); }
                });
            } else {
                Logger.warn('大纲数据不是数组格式:', typeof outlineList);
            }

            Logger.info(`课程映射构建完成: 选修课类别 ${categoryCount} 条，课程大纲 ${outlineCount} 条`);
        } catch (e) {
            Logger.error('构建课程映射表失败:', e);
            if (typeof courseCategoryMap !== 'object') courseCategoryMap = {};
            if (typeof courseOutlineMap !== 'object') courseOutlineMap = {};
        }
    }

// ===== src/ui/creditsPanel.js ==========================================
    // ==================== 学分统计悬浮窗 ====================
    function createCreditSummaryWindow() {
        try {
            const container = document.createElement('div');
            container.id = 'creditSummaryWindow';
            container.style.cssText = `
                position: fixed; top: 40px; right: 40px;
                background: #fff; border: 1px solid #e0e0e0; border-radius: 14px;
                padding: 0; box-shadow: 0 8px 32px rgba(0,0,0,0.13);
                z-index: 9999; min-width: 420px; max-width: 520px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
            `;

            container.innerHTML = `
                <div id="creditDragHandle" style="
                    background: #f5f6fa; padding: 14px 22px; cursor: move;
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid #e0e0e0;">
                    <div style="color: #333; font-weight: 600; font-size: 17px; letter-spacing: 1px;">
                        🎓 南理工教务增强助手 V2
                    </div>
                    <span id="creditCloseBtn" style="cursor: pointer; color: #888; font-size: 18px;
                        padding: 2px 8px; border-radius: 4px; transition: background-color 0.2s;">✕</span>
                </div>
                <div style="background: #fff; padding: 18px 22px 10px 22px; max-height: 540px; overflow-y: auto;">
                    <div id="creditSummary"></div>
                    <div id="xxkVersionBar" style="margin-top: 14px; padding: 9px 12px; background: #f0f7ff;
                        border: 1px solid #d6e6ff; border-radius: 8px; font-size: 13px; color: #33557a;
                        display: flex; align-items: center;">
                        <span id="xxkVersionText">📦 分类口径：加载中…</span>
                        <select id="xxkVersionSelect" title="选择学分统计所依据的培养方案版本"
                            style="margin-left: auto; font-size: 12px; padding: 2px 6px; border: 1px solid #c9d8ea;
                            border-radius: 6px; background: #fff; color: #33557a;">
                            <option value="">按学号自动</option>
                            <option value="2018">2018 版</option>
                            <option value="2022">2022 版</option>
                            <option value="2026">2026 版</option>
                        </select>
                    </div>
                    <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid #e0e0e0;
                        font-size: 13px; color: #888; line-height: 1.6; text-align: left;">
                        <li>对照个人培养方案核实具体修课要求</li>
                        <li>选修课类别统计仅包含已知分类的通识教育选修课</li>
                        <li>课程分类信息可能随时更新，请以教务处最新通知为准</li>
                        <div style="margin-bottom: 8px;">
                            <span>请查看 <a href="https://enhance.njust.wiki" target="_blank"
                                style="color: #007bff; text-decoration: none;">增强助手官网</a> 获取使用说明</span>
                        </div>
                    </div>
                </div>
            `;

            // fix②: 学分窗拖拽也使用修正后的 addDragFunctionality
            // 注意：该容器的拖拽句柄 id 为 creditDragHandle，与 addDragFunctionality 查找 #dragHandle 不符，
            // 故在此单独实现，逻辑与修正后的 addDragFunctionality 一致
            let isDragging = false;
            let mouseStartX, mouseStartY, elemStartX, elemStartY;
            const dragHandle = container.querySelector('#creditDragHandle');

            if (dragHandle) {
                const dragStart = (e) => {
                    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
                    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
                    if (e.target === dragHandle || dragHandle.contains(e.target)) {
                        const rect = container.getBoundingClientRect();
                        elemStartX = rect.left;
                        elemStartY = rect.top;
                        mouseStartX = clientX;
                        mouseStartY = clientY;
                        isDragging = true;
                        e.preventDefault();
                    }
                };
                const drag = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
                    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
                    container.style.right = 'auto';
                    container.style.left = (elemStartX + clientX - mouseStartX) + 'px';
                    container.style.top = (elemStartY + clientY - mouseStartY) + 'px';
                };
                const dragEnd = () => { isDragging = false; };

                dragHandle.addEventListener('mousedown', dragStart);
                document.addEventListener('mousemove', drag);
                document.addEventListener('mouseup', dragEnd);
                dragHandle.addEventListener('touchstart', dragStart, { passive: false });
                document.addEventListener('touchmove', drag, { passive: false });
                document.addEventListener('touchend', dragEnd, { passive: false });
            }

            document.body.appendChild(container);

            // 绑定关闭按钮事件
            const creditCloseBtn = container.querySelector('#creditCloseBtn');
            if (creditCloseBtn) {
                creditCloseBtn.addEventListener('click', () => container.remove());
                creditCloseBtn.addEventListener('mouseenter', () => creditCloseBtn.style.backgroundColor = '#e0e0e0');
                creditCloseBtn.addEventListener('mouseleave', () => creditCloseBtn.style.backgroundColor = 'transparent');
            }

            // 培养方案口径显示与手动切换
            try {
                const versionText = container.querySelector('#xxkVersionText');
                const versionSelect = container.querySelector('#xxkVersionSelect');
                const info = resolveCategoryVersion();
                if (versionText) {
                    versionText.textContent = `📦 分类口径：${info.version} 版（${describeVersionSource(info)}）`;
                }
                if (versionSelect) {
                    versionSelect.value = localStorage.getItem(KEY_XXK_VERSION) || '';
                    versionSelect.addEventListener('change', () => {
                        const value = versionSelect.value;
                        if (value) localStorage.setItem(KEY_XXK_VERSION, value);
                        else localStorage.removeItem(KEY_XXK_VERSION);
                        CacheManager.clear();
                        Logger.info(`分类口径已切换为「${value || '按学号自动'}」，正在重新加载数据`);
                        setTimeout(() => location.reload(), 300);
                    });
                }
            } catch (e) {
                Logger.warn('渲染分类口径控件失败:', e);
            }

            Logger.debug('学分统计弹窗创建完成');
            return container;
        } catch (e) {
            Logger.error('创建学分统计弹窗失败:', e);
            return null;
        }
    }

    // ==================== 学分统计更新 ====================
    function updateCreditSummary() {
        try {
            const creditSummaryDiv = document.getElementById('creditSummary');
            if (!creditSummaryDiv) { Logger.warn('未找到学分统计容器'); return; }

            const creditsByType = {};
            const creditsByCategory = {};
            const tables = document.querySelectorAll('table');

            tables.forEach(table => {
                table.querySelectorAll('tr').forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length < 11) return;
                    const courseCode = tds[2].textContent.trim();
                    const credit = parseFloat(tds[6].textContent) || 0;
                    const courseType = tds[10].textContent.trim();

                    const categoryDiv = tds[2].querySelector('[data-category-inserted]');
                    let category = null;
                    if (categoryDiv) {
                        category = categoryDiv.textContent.trim() || null;
                    }

                    if (courseType) {
                        if (!creditsByType[courseType]) creditsByType[courseType] = { credits: 0, count: 0 };
                        creditsByType[courseType].credits += credit;
                        creditsByType[courseType].count++;
                    }
                    if (category) {
                        if (!creditsByCategory[category]) creditsByCategory[category] = { credits: 0, count: 0 };
                        creditsByCategory[category].credits += credit;
                        creditsByCategory[category].count++;
                    }
                });
            });

            const totalCreditsByType = Object.values(creditsByType).reduce((s, d) => s + d.credits, 0);
            const totalCountByType = Object.values(creditsByType).reduce((s, d) => s + d.count, 0);
            const totalCreditsByCategory = Object.values(creditsByCategory).reduce((s, d) => s + d.credits, 0);
            const totalCountByCategory = Object.values(creditsByCategory).reduce((s, d) => s + d.count, 0);

            let summaryHTML = `<div style="border-bottom: 1px solid #e0e0e0; margin-bottom: 12px; padding-bottom: 10px;">`;
            summaryHTML += `<div style="margin-bottom: 8px; font-size: 15px; color: #222; font-weight: 600;">📊 按课程性质统计</div>`;
            summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; background: #f7f7fa; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px;">
                <span style="color: #007bff; font-weight: 600; font-size: 13px;">总计</span>
                <span style="font-weight: 600; color: #007bff; font-size: 13px;">${totalCreditsByType.toFixed(1)} 学分</span>
                <span style="color: #007bff; font-weight: 600; font-size: 13px;">${totalCountByType} 门</span>
            </div><div style="display: grid; gap: 2px;">`;
            for (const [type, data] of Object.entries(creditsByType)) {
                summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                    <span style="color: #444; font-size: 13px;">${type}</span>
                    <span style="color: #333; font-size: 13px;">${data.credits.toFixed(1)} 学分</span>
                    <span style="color: #888; font-size: 13px;">${data.count} 门</span>
                </div>`;
            }
            summaryHTML += `</div></div>`;

            if (Object.keys(creditsByCategory).length > 0) {
                summaryHTML += `<div style="margin-top: 16px;">`;
                summaryHTML += `<div style="margin-bottom: 8px; font-size: 15px; color: #222; font-weight: 600;">🏷️ 按选修课类别统计</div>`;
                summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; background: #f7f7fa; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px;">
                    <span style="color: #007bff; font-weight: 600; font-size: 13px;">总计</span>
                    <span style="font-weight: 600; color: #007bff; font-size: 13px;">${totalCreditsByCategory.toFixed(1)} 学分</span>
                    <span style="color: #007bff; font-weight: 600; font-size: 13px;">${totalCountByCategory} 门</span>
                </div><div style="display: grid; gap: 2px;">`;
                for (const [category, data] of Object.entries(creditsByCategory)) {
                    summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                        <span style="color: #444; font-size: 13px;">${category}</span>
                        <span style="color: #333; font-size: 13px;">${data.credits.toFixed(1)} 学分</span>
                        <span style="color: #888; font-size: 13px;">${data.count} 门</span>
                    </div>`;
                }
                summaryHTML += `</div></div>`;
            }

            creditSummaryDiv.innerHTML = summaryHTML || '暂无数据';
            Logger.debug('学分统计更新完成');
        } catch (e) {
            Logger.error('更新学分统计失败:', e);
            const el = document.getElementById('creditSummary');
            if (el) el.innerHTML = '<div style="color:#dc3545;padding:10px;text-align:center;">❌ 学分统计更新失败</div>';
        }
    }

    /**
     * ── 课程信息增强核心逻辑 ───────────────────────────────────────
     * 负责解析教务系统的表格 DOM，并根据映射表插入大纲链接、选修课类别等信息。
     */

// ===== src/core/courseEnhance.js =======================================
    function processAllTables() {
        try {
            const tables = document.querySelectorAll('table');
            // 页面类型识别
            const isGradePage = window.location.pathname.includes('/njlgdx/kscj/cjcx_list');
            const isSchedulePage = window.location.pathname.includes('xskb_list.do') &&
                document.title.includes('学期理论课表');
            const isSmartCampus = window.location.href.includes('bkjw.njust.edu.cn');

            let processedTables = 0, processedRows = 0, enhancedCourses = 0;

            tables.forEach(table => {
                try {
                    // 课表页面只处理 id 为 dataList 的主表格
                    if (isSchedulePage && table.id !== 'dataList') return;
                    const rows = table.querySelectorAll('tr');
                    processedTables++;

                    rows.forEach(row => {
                        try {
                            const tds = row.querySelectorAll('td');
                            if (tds.length < 3) return; // 略过非数据行
                            processedRows++;

                            let courseCodeTd, courseCode;

                            // 不同页面的课程代码提取逻辑差异化处理
                            if (isGradePage) {
                                courseCodeTd = tds[2];
                                courseCode = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                            } else if (isSchedulePage) {
                                courseCodeTd = tds[1];
                                courseCode = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                            } else {
                                // 通用逻辑：提取形如 "课程名<br>课程代码" 的结构
                                courseCodeTd = tds[1];
                                if (courseCodeTd && courseCodeTd.innerHTML) {
                                    const parts = courseCodeTd.innerHTML.split('<br>');
                                    if (parts.length === 2) courseCode = parts[1].trim();
                                    else return;
                                } else return;
                            }

                            if (!courseCode) return;
                            let courseEnhanced = false;

                            // 1. 插入选修课类别（如：人文素养、自然科学等）
                            try {
                                if (courseCodeTd && !courseCodeTd.querySelector('[data-category-inserted]')) {
                                    const category = courseCategoryMap[courseCode];
                                    if (category) {
                                        const catDiv = document.createElement('div');
                                        catDiv.setAttribute('data-category-inserted', '1');
                                        catDiv.style.color = '#28a745';
                                        catDiv.style.fontWeight = 'bold';
                                        catDiv.style.marginTop = '4px';
                                        catDiv.textContent = category;
                                        courseCodeTd.appendChild(catDiv);
                                        courseEnhanced = true;
                                    }
                                }
                            } catch (e) { Logger.warn('添加课程类别时出错:', e); }

                            // 2. 插入老师说明（将 <td> 的 title 属性显性化）
                            try {
                                if (!isGradePage && !isSchedulePage && courseCodeTd &&
                                    courseCodeTd.title && !courseCodeTd.querySelector('[data-title-inserted]')) {
                                    const titleDiv = document.createElement('div');
                                    titleDiv.setAttribute('data-title-inserted', '1');
                                    titleDiv.style.color = '#666';
                                    titleDiv.style.fontSize = '13px';
                                    titleDiv.style.marginTop = '4px';
                                    titleDiv.style.fontStyle = 'italic';
                                    titleDiv.textContent = `📌 老师说明: ${courseCodeTd.title}`;
                                    courseCodeTd.appendChild(titleDiv);
                                    courseEnhanced = true;
                                }
                            } catch (e) { Logger.warn('添加老师说明时出错:', e); }

                            // 3. 插入教学大纲链接
                            try {
                                if (courseCodeTd && !courseCodeTd.querySelector('[data-outline-inserted]')) {
                                    const outlineDiv = document.createElement('div');
                                    outlineDiv.setAttribute('data-outline-inserted', '1');
                                    outlineDiv.style.marginTop = '4px';

                                    if (isSmartCampus) {
                                        // 智慧理工平台因跨域和权限限制，无法直接预览官网大纲
                                        outlineDiv.textContent = '⚠️ 课程大纲功能受限';
                                        outlineDiv.style.color = '#ff9800';
                                        outlineDiv.style.fontWeight = 'bold';
                                        outlineDiv.style.cursor = 'pointer';
                                        outlineDiv.title = '当前使用智慧理工平台，课程大纲功能受限。请访问教务处官网获取完整功能';
                                    } else {
                                        const realId = courseOutlineMap[courseCode];
                                        if (realId) {
                                            const link = document.createElement('a');
                                            // 拼接教务处官网预览链接
                                            link.href = `http://202.119.81.112:8080/kcxxAction.do?method=kcdgView&jx02id=${realId}&isentering=0`;
                                            link.textContent = '📘 查看课程大纲';
                                            link.target = '_blank';
                                            link.style.color = '#0077cc';
                                            outlineDiv.appendChild(link);
                                        } else {
                                            outlineDiv.textContent = '❌ 无大纲信息';
                                            outlineDiv.style.color = 'gray';
                                        }
                                    }
                                    courseCodeTd.appendChild(outlineDiv);
                                    courseEnhanced = true;
                                }
                            } catch (e) { Logger.warn('添加课程大纲链接时出错:', e); }

                            if (courseEnhanced) enhancedCourses++;
                        } catch (e) { Logger.warn('处理表格行时出错:', e); }
                    });
                } catch (e) { Logger.warn('处理表格时出错:', e); }
            });

            Logger.info(`表格处理完成: ${processedTables}个表格, ${processedRows}行, 增强${enhancedCourses}门课程`);

            // 成绩页面额外执行学分实时汇总
            if (isGradePage) updateCreditSummary();
        } catch (e) {
            Logger.error('处理页面表格失败:', e);
        }
    }

    /**
     * ── 登录保活与自动修复系统 ───────────────────────────────────────
     * 解决教务系统频繁掉线、重复登录导致的报错页面。
     */

// ===== src/core/loginKeepAlive.js ======================================
    function checkLoginErrorAndRefresh() {
        try {
            const pageTitle = document.title || '';
            const pageContent = document.body ? document.body.textContent : '';
            // 匹配典型的教务处报错关键词
            const isLoginError = pageTitle.includes('出错页面') &&
                (pageContent.includes('您登录后过长时间没有操作') ||
                    pageContent.includes('您的用户名已经在别处登录') ||
                    pageContent.includes('请重新输入帐号，密码后，继续操作'));

            if (isLoginError) {
                Logger.warn('检测到登录超时或重复登录错误页面，正在自动刷新...');
                performLoginRefresh(true);
                return true;
            }
            return false;
        } catch (e) {
            Logger.error('检测登录错误页面失败:', e);
            return false;
        }
    }

    /**
     * 执行静默登录刷新
     * 原理：通过一个隐藏的 iframe 请求教务系统的一个轻量级页面，利用浏览器自动携带的 Cookie 维持/刷新 Session。
     */
    function performLoginRefresh(forceRefresh = false) {
        const currentUrl = window.location.href;
        try {
            let baseUrl;
            if (currentUrl.includes('njlgdx/')) {
                baseUrl = currentUrl.substring(0, currentUrl.indexOf('njlgdx/'));
            } else {
                const urlObj = new URL(currentUrl);
                baseUrl = `${urlObj.protocol}//${urlObj.host}/`;
            }
            // 使用“课程大纲查询”作为刷新页面（权限要求低且加载快）
            const refreshUrl = baseUrl + 'njlgdx/pyfa/kcdgxz';
            Logger.info('使用隐藏 iframe 刷新登录状态:', refreshUrl);

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;visibility:hidden;border:none;';
            iframe.src = refreshUrl;

            iframe.onload = () => {
                Logger.info('登录状态刷新请求完成');
                setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1000);
            };
            iframe.onerror = () => {
                Logger.warn('登录状态刷新请求失败');
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                if (forceRefresh) Logger.error('登录状态刷新失败，请手动重新点击选课中心 - 课程总库');
            };

            document.body.appendChild(iframe);
            // 10秒兜底清理，防止网络挂起
            setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 10000);
        } catch (e) {
            Logger.error('自动刷新登录状态失败:', e);
        }
    }

    /**
     * 定时自动保活逻辑
     * 策略：仅在主框架页面执行，且 5 分钟内不重复触发。
     */
    function autoRefreshLoginStatus() {
        try {
            const currentUrl = window.location.href;
            if (!currentUrl.includes('njlgdx/framework/main.jsp')) return;

            const lastRefreshKey = 'njust_last_login_refresh';
            const lastRefreshTime = localStorage.getItem(lastRefreshKey);
            const now = Date.now();
            const refreshInterval = 5 * 60 * 1000; // 5分钟间隔

            if (lastRefreshTime && (now - parseInt(lastRefreshTime)) < refreshInterval) {
                Logger.debug('距上次刷新不足5分钟，跳过');
                return;
            }

            // 更新最后刷新时间戳
            localStorage.setItem(lastRefreshKey, now.toString());

            // fix⑦: 使用 BroadcastChannel 通知其他同源标签页同步刷新时间，避免多标签页并发请求
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('njust_login_refresh');
                bc.postMessage({ type: 'refreshing', ts: now });
                bc.close();
            }

            Logger.info('检测到主框架页面，开始刷新登录状态');
            performLoginRefresh(false);
        } catch (e) {
            Logger.error('自动刷新登录状态检查失败:', e);
        }
    }

    /**
     * ── 脚本入口初始化 ──────────────────────────────────────────────
     */

// ===== src/core/main.js ================================================
    async function init() {
        try {
            Logger.info('开始执行主要逻辑');

            // 强智概念版拦截
            if (checkQiangzhiPage()) {
                Logger.info('强智科技页面检测完成，脚本退出');
                return;
            }

            const currentUrl = window.location.href;
            const isSmartCampus = currentUrl.includes('bkjw.njust.edu.cn');
            if (isSmartCampus) {
                Logger.warn('检测到智慧理工平台，课程大纲功能将受限');
            }

            // 1. 登录保活与状态检查
            autoRefreshLoginStatus();
            checkLoginErrorAndRefresh();

            // 2. 加载远程配置数据（按学号对应的入学年份自适应培养方案口径）
            Logger.info('开始加载数据');
            const versionInfo = resolveCategoryVersion();
            Logger.info(`选修课分类口径：${versionInfo.version} 版（${describeVersionSource(versionInfo)}）`);
            const [categoryData, outlineData] = await Promise.all([
                loadJSON(getCategoryURLs(versionInfo.version)),
                loadJSON(OUTLINE_URLS)
            ]);

            // 3. 构建索引并执行初次处理
            Logger.info('数据加载完成，构建映射表');
            buildCourseMaps(categoryData, outlineData);

            if (window.location.pathname.includes('/njlgdx/kscj/cjcx_list')) {
                createCreditSummaryWindow();
            }

            processAllTables();

            /**
             * 4. 动态监听系统
             * 解决教务系统通过 AJAX 异步切换页面（如点击菜单）导致脚本失效的问题。
             */
            let isProcessing = false;
            const observer = new MutationObserver((mutations) => {
                try {
                    if (isProcessing) return;

                    const hasRelevantChanges = mutations.some(mutation => {
                        try {
                            if (mutation.type !== 'childList') return false;
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                                // 忽略脚本自己插入的 DOM
                                if (node.hasAttribute &&
                                    (node.hasAttribute('data-category-inserted') ||
                                        node.hasAttribute('data-title-inserted') ||
                                        node.hasAttribute('data-outline-inserted'))) {
                                    return false;
                                }
                                // 只关注表格类变更
                                if (node.tagName === 'TABLE' || node.tagName === 'TR' || node.tagName === 'TD') {
                                    return true;
                                }
                            }
                            return false;
                        } catch (e) {
                            Logger.warn('检查页面变化时出错:', e);
                            return false;
                        }
                    });

                    if (hasRelevantChanges && !checkQiangzhiPage()) {
                        isProcessing = true;
                        try {
                            processAllTables();
                        } catch (e) {
                            Logger.error('重新处理表格失败:', e);
                        } finally {
                            // 节流处理，防止频繁触发
                            setTimeout(() => { isProcessing = false; }, 100);
                        }
                    }
                } catch (e) {
                    Logger.error('MutationObserver 回调执行失败:', e);
                    isProcessing = false;
                }
            });

            try {
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (e) {
                Logger.error('启动页面变化监听器失败:', e);
            }

            Logger.info('南理工教务增强助手加载成功！');
        } catch (err) {
            Logger.error('初始化失败:', err);
        }
    }

    // 延迟 1 秒执行初始化，确保教务系统原始 JS 框架加载完成
    setTimeout(init, 1000);

    // 暴露 Logger 到全局，供模块二使用
    window.__NJUST_LOGGER__ = Logger;
})();

// ===== src/evaluate/consts.js ==========================================
// ================================================================
//  【模块二】自动评教助手 V1
//  功能：自动填分、批量保存、批量提交、分值实时预览
//  适用页面：学生评教入口 (xspj_find.do)、课程列表 (xspj_list.do)、评价详情 (xspj_edit.do)
// ================================================================

(function () {
    'use strict';

    // ── 常量定义 ─────────────────────────────────────────────────────
    // 存储键名，用于跨页面同步状态
    const KEY_STORE = 'njust_eval_v1_store';    // 核心存储：课程状态、评分选项等
    const KEY_RUNNING = 'njust_eval_running';     // 全局标志：是否处于“开始评价并保存”流水线中
    const KEY_BUSY = 'njust_eval_busy';        // 互斥锁：防止多个窗口同时执行保存操作
    const KEY_QUEUE = 'njust_eval_queue';       // 队列：待处理的类别 URL 列表
    const KEY_CURLIST = 'njust_eval_curlist';     // 当前正在处理的类别 URL
    const KEY_LOG = 'njust_eval_log';         // 日志存储
    const KEY_LOGLVL = 'njust_eval_loglvl';      // 日志显示等级过滤
    const KEY_SUBQUEUE = 'njust_eval_subqueue';    // 待提交课程的 URL 队列
    const KEY_SUBRUN = 'njust_eval_subrun';      // 全局标志：是否处于“提交已评课程”流水线中
    const KEY_SUBBSY = 'njust_eval_subbsy';      // 互斥锁：防止多个窗口同时执行提交操作

    // URL 参数，用于传递指令给详情页
    const PARAM_AUTO = 'isAutoEval';             // 详情页接收后执行自动填分+保存
    const PARAM_SUBMIT = 'isAutoSubmit';           // 详情页接收后执行自动提交
    const MAX_LOG = 300;                      // 日志最大保留条数

    // ── 日志系统 ─────────────────────────────────────────────────────
    // 日志级别与 UI 映射
    const LOG_LEVELS = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
    const LOG_LABELS = { debug: 'DBG', info: 'INF', success: 'OK ', warn: 'WRN', error: 'ERR' };
    const LOG_ICONS = { debug: '🔍', info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };

    // 日志持久化与读取
    const loadLogs = () => JSON.parse(localStorage.getItem(KEY_LOG) || '[]');
    const clearLogs = () => { localStorage.removeItem(KEY_LOG); renderLogPanel(); };
    const getMinLevel = () => { const s = localStorage.getItem(KEY_LOGLVL); return (s && LOG_LEVELS[s] !== undefined) ? s : 'info'; };
    const setMinLevel = (l) => { localStorage.setItem(KEY_LOGLVL, l); renderLogPanel(); };

    /**
     * 推送新日志并更新面板
     * 同时输出到模块一的 LogPanelUI（如果存在）
     */
    const pushLog = (msg, level = 'info') => {
        const logs = loadLogs();
        logs.push({ ts: new Date().toTimeString().slice(0, 8), msg, level });
        if (logs.length > MAX_LOG) logs.splice(0, logs.length - MAX_LOG);
        localStorage.setItem(KEY_LOG, JSON.stringify(logs));
        renderLogPanel();

        // 同步输出到模块一的日志面板
        if (window.__NJUST_LOGGER__) {
            const levelMap = { debug: 4, info: 3, success: 3, warn: 2, error: 1 };
            const loggerLevel = levelMap[level] || 3;
            window.__NJUST_LOGGER__.log(loggerLevel, `[评教] ${msg}`);
        }
    };
    const logInfo = (m) => pushLog(m, 'info');
    const logSuccess = (m) => pushLog(m, 'success');
    const logError = (m) => pushLog(m, 'error');

    /**
     * 渲染控制面板底部的日志区域（已简化，日志现在显示在模块一的面板中）
     */
    const renderLogPanel = () => {
        // 日志现在统一显示在模块一的 LogPanelUI 中
        // 此函数仅用于内部状态更新，不再渲染独立的日志区块
    };

    // ── 通用工具函数 ──────────────────────────────────────────────────
    // HTML 转义防止 XSS
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 解析 URL 参数
    const qp = (url, key) => {
        try { return new URL(url, location.origin).searchParams.get(key) || ''; }
        catch { return url.match(new RegExp(`[?&]${key}=([^&]+)`))?.[1] || ''; }
    };

    // 生成课程唯一 Key (课程ID + 教师ID)
    const courseKey = (url) => { const cid = qp(url, 'jx02id'), tid = qp(url, 'jg0101id'); return cid && tid ? `${cid}__${tid}` : null; };
    const appendParam = (url, key, val) => url + (url.includes('?') ? '&' : '?') + key + '=' + val;
    const withAuto = (url, val) => appendParam(url, PARAM_AUTO, val);
    const withSubmit = (url) => appendParam(url, PARAM_SUBMIT, 'true');
    const roundFloat = (n) => Math.round(n * 1e9) / 1e9; // 解决浮点数精度误差

    // 快捷访问 LocalStorage
    const loadStore = () => JSON.parse(localStorage.getItem(KEY_STORE) || '{}');
    const saveStore = (v) => localStorage.setItem(KEY_STORE, JSON.stringify(v));
    const loadQueue = () => JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
    const saveQueue = (q) => localStorage.setItem(KEY_QUEUE, JSON.stringify(q));
    const loadSubQueue = () => JSON.parse(localStorage.getItem(KEY_SUBQUEUE) || '[]');
    const saveSubQueue = (q) => localStorage.setItem(KEY_SUBQUEUE, JSON.stringify(q));

    /**
     * 在控制面板预览当前存储的课程状态
     */
    const renderStoragePanel = () => {
        const el = document.getElementById('v80-storage-pre');
        if (el) el.textContent = JSON.stringify(loadStore(), null, 2);
    };

// ===== src/evaluate/evaluateCore.js ====================================
    // ── 评价页面核心逻辑 ──────────────────────────────────────────────
    /**
     * 收集当前评价页面的所有评分组 (Radio) 及其对应的分值
     */
    const collectGroups = () => {
        const groups = {};
        document.querySelectorAll('input[type="radio"]').forEach(r => {
            if (!groups[r.name]) groups[r.name] = [];
            const idx = r.id.split('_')[1];
            // 查找隐藏域中的分值 (pj0601fz_...)
            const fzEl = document.getElementsByName(`pj0601fz_${idx}_${r.value}`)[0];
            groups[r.name].push({ el: r, score: fzEl ? parseFloat(fzEl.value) || 0 : 0 });
        });
        const gkeys = Object.keys(groups);
        // 按分值从高到低排序，方便策略选择
        gkeys.forEach(k => groups[k].sort((a, b) => b.score - a.score));
        return { gkeys, groups };
    };

    /**
     * 寻找最适合进行分值扰动的题目索引
     * 原则：分值差距最小的题目，扰动对总分影响最小
     */
    const findPerturbIdx = (gkeys, groups) => {
        let minDelta = Infinity, perturbIdx = -1;
        gkeys.forEach((k, i) => {
            const opts = groups[k];
            if (opts.length < 2) return;
            const delta = roundFloat(opts[0].score - opts[1].score);
            if (delta < minDelta) { minDelta = delta; perturbIdx = i; }
        });
        return perturbIdx;
    };

    /**
     * 计算当前页面已勾选选项的总分
     */
    const calcCurrentTotal = (gkeys, groups) => {
        let total = 0;
        gkeys.forEach(k => { const chosen = groups[k].find(o => o.el.checked); if (chosen) total += chosen.score; });
        return roundFloat(total);
    };

    /**
     * 在详情页每个选项后标注具体分值，方便人工微调
     */
    const ensureValueFields = () => {
        const { gkeys, groups } = collectGroups();
        gkeys.forEach(k => {
            groups[k].forEach(({ el, score }) => {
                const idx = el.id.split('_')[1];
                const fzEl = document.getElementsByName(`pj0601fz_${idx}_${el.value}`)[0];
                if (!fzEl) return;
                let next = fzEl.nextElementSibling;
                if (next && next.classList && next.classList.contains('v80-value-chip')) return;
                const chip = document.createElement('span');
                chip.className = 'v80-value-chip';
                chip.textContent = `[${score}分]`;
                fzEl.insertAdjacentElement('afterend', chip);
            });
        });
    };

    /**
     * 应用评分策略并勾选 Radio
     * strategy: highest (最高分), high (次高), mid (中分), low (低分)
     * 策略中包含“选项去重”逻辑：即在保证总分尽量高的前提下，在某一道题上选择非最高分，避免全满分被系统拦截
     */
    const applyStrategy = (strategy, gkeys, groups) => {
        const perturbIdx = findPerturbIdx(gkeys, groups);
        let total = 0;
        gkeys.forEach((k, i) => {
            const opts = groups[k], len = opts.length;
            let pick;
            if (strategy === 'highest') {
                // 最高分策略：在扰动项选次高，其余全选最高
                pick = (i === perturbIdx && len >= 2) ? 1 : 0;
            } else if (strategy === 'high') {
                pick = len < 2 ? 0 : (i === perturbIdx) ? 0 : 1;
            } else if (strategy === 'mid') {
                const midIdx = Math.floor((len - 1) / 2);
                pick = (i === perturbIdx && len >= 2) ? (midIdx > 0 ? midIdx - 1 : midIdx + 1) : midIdx;
            } else if (strategy === 'low') {
                pick = (i === perturbIdx && len >= 2) ? len - 2 : len - 1;
            }
            const chosen = opts[Math.min(pick, len - 1)];
            if (chosen) { chosen.el.checked = true; total += chosen.score; }
        });
        return roundFloat(total);
    };

// ===== src/evaluate/style.js ===========================================
    // ── 样式注入 ──────────────────────────────────────────────────────
    const injectCSS = () => {
        if (document.getElementById('v80-style')) return;
        const style = document.createElement('style');
        style.id = 'v80-style';
        style.textContent = `
            /* 控制面板主容器 */
            #v80-panel {
                position: fixed; top: 20px; right: 20px; width: 490px;
                background: #fff; border-radius: 10px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.10);
                z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex; flex-direction: column; border: 1px solid #e2e8f0;
                max-height: 90vh; overflow: hidden;
                transition: transform 0.25s ease; font-size: 13px; color: #2d3748;
            }
            #v80-panel.wide { width: 640px; }
            #v80-header {
                padding: 11px 14px; background: #f7fafc; border-bottom: 1px solid #e2e8f0;
                cursor: move; display: flex; align-items: center; gap: 8px; user-select: none; flex-shrink: 0;
            }
            #v80-header b { flex: 1; font-size: 14px; color: #2d3748; }
            #v80-action-bar { padding: 10px 14px 8px; border-bottom: 1px solid #edf2f7; background: #fff; flex-shrink: 0; }
            #v80-submit-hint { font-size: 11px; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; display: none; line-height: 1.6; }
            #v80-submit-hint.visible { display: block; }
            .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 7px; }
            #v80-body { padding: 10px 14px; overflow-y: auto; flex: 1; }

            /* 列表项卡片样式 */
            .entry-card, .ci { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 7px; border: 1px solid #e2e8f0; margin-bottom: 7px; background: #f7fafc; }
            .ci { padding: 8px 10px; margin-bottom: 6px; border-color: #edf2f7; }
            .entry-label, .ci-name { flex: 1; font-weight: 500; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ci-teacher { color: #718096; white-space: nowrap; }
            .ci-zpf { color: #276749; font-size: 11px; background: #f0fff4; padding: 1px 7px; border-radius: 8px; border: 1px solid #c6f6d5; white-space: nowrap; }

            /* 状态标签 */
            .entry-st-done, .st-submitted { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; white-space: nowrap; }
            .entry-st-wait, .st-wait { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fffaf0; color: #c05621; border: 1px solid #feebc8; white-space: nowrap; }
            .entry-st-run { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .st-can-submit { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fefcbf; color: #744210; border: 1px solid #f6e05e; white-space: nowrap; }
            .st-none { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #edf2f7; color: #718096; border: 1px solid #e2e8f0; white-space: nowrap; }

            /* 按钮 */
            .vb { padding: 6px 13px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
            .vb-primary { background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .vb-green { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
            .vb-yellow { background: #fefcbf; color: #744210; border: 1px solid #f6e05e; }
            .vb-outline { background: #fff; color: #4a5568; border: 1px solid #cbd5e0; }
            .vb-danger { background: #fff; color: #c53030; border: 1px solid #fed7d7; }
            .vb-mini { padding: 3px 9px; font-size: 11px; }
            .vb:disabled { opacity: 0.45; cursor: not-allowed; }

            /* 可折叠区块样式 */
            .v80-section { flex-shrink: 0; border-top: 1px solid #edf2f7; }
            .v80-sec-hd { padding: 7px 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; background: #f7fafc; }
            .v80-sec-hd .lbl { font-size: 11px; color: #4a5568; font-weight: 600; flex: 1; }
            .v80-sec-hd .arr { font-size: 13px; color: #a0aec0; }
            .v80-sec-body { display: none; }
            .v80-sec-body.open { display: block; }

            /* Storage 预览样式 */
            #v80-storage-pre { max-height: 200px; overflow-y: auto; padding: 4px 10px; font-size: 11px; line-height: 1.6; font-family: 'SFMono-Regular', Consolas, monospace; background: #f7fafc; }
            .v80-value-chip { display: inline-block; margin-left: 6px; font-size: 11px; color: #4a5568; }
        `;
        document.head.appendChild(style);
    };

// ===== src/evaluate/panel.js ===========================================
    // ── 面板构建 ──────────────────────────────────────────────────────
    /**
     * 创建并注入控制面板 DOM
     */
    const buildPanel = (titleHtml, actionBarHtml, bodyHtml) => {
        injectCSS();
        const panel = document.createElement('div');
        panel.id = 'v80-panel';
        panel.innerHTML = `
            <div id="v80-header">
                <b>${titleHtml}</b>
                <span id="v80-close-btn" style="cursor:pointer;color:#718096;font-size:16px;padding:2px 8px;border-radius:4px;transition:background 0.2s;margin-left:8px;" title="关闭">✕</span>
            </div>
            <div id="v80-action-bar">${actionBarHtml}</div>
            <div id="v80-body">${bodyHtml}</div>
            <div class="v80-section">
                <div class="v80-sec-hd" id="store-hd">
                    <span class="lbl">🗄 Storage 原始数据</span>
                    <span class="arr" id="store-arr">▾</span>
                </div>
                <div class="v80-sec-body" id="store-body">
                    <pre id="v80-storage-pre"></pre>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // 关闭按钮
        const closeBtn = document.getElementById('v80-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.remove();
            });
            closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = '#e2e8f0');
            closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = 'transparent');
        }
        // 存储预览区块折叠
        const storeBody = document.getElementById('store-body'), storeArr = document.getElementById('store-arr');
        document.getElementById('store-hd').onclick = () => { storeBody.classList.toggle('open'); storeArr.textContent = storeBody.classList.contains('open') ? '▴' : '▾'; if (storeBody.classList.contains('open')) renderStoragePanel(); };

        // 面板拖拽逻辑 (修正 transform 带来的坐标偏移问题)
        let drag = false, mouseStartX = 0, mouseStartY = 0, elemStartX = 0, elemStartY = 0;
        document.getElementById('v80-header').onmousedown = (e) => {
            if (e.target.id === 'v80-close-btn') return;
            const rect = panel.getBoundingClientRect();
            elemStartX = rect.left; elemStartY = rect.top;
            mouseStartX = e.clientX; mouseStartY = e.clientY;
            drag = true;
        };
        document.onmousemove = (e) => {
            if (!drag) return;
            panel.style.left = (elemStartX + e.clientX - mouseStartX) + 'px';
            panel.style.top = (elemStartY + e.clientY - mouseStartY) + 'px';
            panel.style.right = 'auto';
        };
        document.onmouseup = () => { drag = false; };

        return panel;
    };

// ===== src/evaluate/findPage.js ========================================
    // ── FIND 页面 (评教类别入口页) ────────────────────────────────────
    if (location.href.includes('xspj_find.do')) {
        /**
         * 扫描页面中所有的评价入口（如理论课程、实验课程等）
         */
        const scanEntries = () => {
            const anchors = document.querySelectorAll('a[href*="xspj_list.do"]');
            const found = [];
            anchors.forEach(a => {
                const href = a.getAttribute('href');
                const label = a.textContent.trim() || a.title || href;
                const abs = href.startsWith('http') ? href : location.origin + href;
                found.push({ label, url: abs });
            });
            return found;
        };

        buildPanel(
            '🎓 南理工教务增强助手 V2',
            `
                <div id="v80-usage" style="font-size:13px;line-height:1.75;padding:14px 16px;border:1px solid #cbd5e0;border-radius:10px;background:#f7fafc;color:#2d3748;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
                    <div style="font-weight:800;margin-bottom:8px;font-size:14px;">新手使用指南</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <div>① 点击下方任一入口，进入该"类别"的课程列表页。</div>
                        <div>② 在课程列表页，勾选要自动处理的课程（默认全部勾选）。</div>
                        <div>③ 点击"开始评价并保存"，系统会依次打开勾选课程的评价页，自动填分并保存。</div>
                        <div>④ 保存后课程显示"待提交"，点击"提交已评课程"可批量提交。</div>
                        <div>⑤ "是否提交=是"的课程视为已完成，不会再进行任何自动操作。</div>
                        <div style="color:#FF6347;font-weight:700;">重要：用户必须自行点击"确认"弹窗确认！</div>
                        <div style="color:#FF6347;font-weight:700;">出现问题可使用“重置缓存（清除状态）”按钮重置进度</div>
                        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e0;display:flex;align-items:center;">
                            <span style="flex:1;color:#4a5568;font-size:12px;">查看更多使用说明请点击>>>>></span>
                            <a href="https://enhance.njust.wiki" target="_blank" class="vb vb-outline vb-mini" style="text-decoration:none;">增强助手官网</a>
                        </div>
                    </div>
                </div>
            `,
            `<div id="entry-list"></div>`
        );
        // 初始化布局调整
        (function () { const p = document.getElementById('v80-panel'); if (p) p.classList.add('wide'); })();

        /**
         * 渲染各类别入口的卡片及完成进度
         */
        const renderEntries = () => {
            const entries = scanEntries(), store = loadStore();
            const curList = localStorage.getItem(KEY_CURLIST) || '';
            const running = localStorage.getItem(KEY_RUNNING) === 'true';
            const box = document.getElementById('entry-list');
            if (!box) return;
            box.innerHTML = '';
            entries.forEach(entry => {
                const pj01 = qp(entry.url, 'pj01id');
                // 从存储中筛选属于该类别的课程
                const related = Object.values(store).filter(c => c.url && qp(c.url, 'pj01id') === pj01);
                const doneN = related.filter(c => c.done).length;
                const totalN = related.length;
                const isCur = running && curList && entry.url.includes(qp(curList, 'pj01id'));
                const allDone = totalN > 0 && doneN === totalN;
                const card = document.createElement('div');
                card.className = 'entry-card';
                card.innerHTML = `<span class="entry-label">${esc(entry.label)}</span>` +
                    (totalN ? `<span class="entry-count">${doneN}/${totalN}</span>` : '') +
                    `<span class="${isCur ? 'entry-st-run' : allDone ? 'entry-st-done' : 'entry-st-wait'}">${isCur ? '▶ 运行中' : allDone ? '✓ 已完成' : '等待中'}</span>` +
                    `<button class="vb vb-outline vb-mini entry-enter-btn" data-url="${esc(entry.url)}">进入</button>`;
                box.appendChild(card);
            });

            // 绑定"进入"按钮点击事件
            box.querySelectorAll('.entry-enter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const url = btn.getAttribute('data-url');
                    if (url) window.location.href = url;
                });
            });
        };

        window.addEventListener('storage', () => { renderEntries(); });
        renderEntries();
    }

// ===== src/evaluate/listPage.js ========================================
    // ── LIST 页面 (课程列表页) ────────────────────────────────────────
    if (location.href.includes('xspj_list.do')) {
        buildPanel(
            '🎓 南理工教务增强助手 V2',
            `
                <div id="v80-submit-hint"></div>
                <div class="btn-row">
                    <button id="start-btn" class="vb vb-primary" style="flex:2">开始评价并保存</button>
                    <button id="submit-all-btn" class="vb vb-yellow" style="flex:2" disabled>提交已评课程</button>
                </div>
                <div class="btn-row">
                    <button id="reset-btn" class="vb vb-outline" style="flex:1">重置缓存（清除状态）</button>
                    <button id="clear-log-btn" class="vb vb-danger" style="flex:1">清空日志</button>
                </div>
                <div class="btn-row">
                    <a href="https://enhance.njust.wiki" target="_blank" class="vb vb-outline vb-mini" style="text-decoration:none;flex:1;text-align:center;">🔗 点击前往增强助手官网</a>
                </div>
            `,
            `<div id="course-list"></div>`
        );

        /**
         * 解析当前页面的课程表格，提取课程信息和状态
         */
        const parseRows = () => {
            const rows = document.querySelectorAll('#dataList tr:not(:first-child)'), result = [];
            rows.forEach(row => {
                if (row.cells.length < 7) return;
                const a = row.querySelector('a[href*="openWindow"]');
                if (!a) return;
                const rawUrl = a.getAttribute('href').match(/'([^']+)'/)?.[1];
                if (!rawUrl) return;
                result.push({
                    key: courseKey(rawUrl), rawUrl,
                    name: row.cells[2]?.innerText.trim() || '',
                    teacher: row.cells[3]?.innerText.trim() || '',
                    zpf: qp(rawUrl, 'zpf'),
                    evaluated: row.cells[5]?.innerText.trim() === '是',
                    submitted: row.cells[6]?.innerText.trim() === '是'
                });
            });
            return result;
        };

        /**
         * 更新“批量提交”按钮的状态和提示文字
         */
        const updateSubmitBtn = () => {
            const btn = document.getElementById('submit-all-btn'), hint = document.getElementById('v80-submit-hint');
            if (!btn) return;
            const store = loadStore();
            const canSubmit = parseRows().filter(c => {
                const info = store[c.key];
                return (c.evaluated || (info && info.done)) && !c.submitted && (info ? info.auto !== false : true);
            });
            if (canSubmit.length > 0) {
                btn.disabled = false; hint.className = 'visible';
                hint.innerHTML = `<b>${canSubmit.length}</b> 门课程可提交（已评价且未提交且选中）：` + canSubmit.map(c => `<br>　· ${esc(c.name)}`).join('');
            } else { btn.disabled = true; hint.className = ''; hint.innerHTML = ''; }
        };

        /**
         * 渲染课程列表，包含勾选框和实时状态标签
         */
        const renderList = () => {
            const store = loadStore(), courses = parseRows(), box = document.getElementById('course-list');
            if (!box) return;
            box.innerHTML = '';
            courses.forEach(c => {
                // 初始化存储项
                if (!store[c.key]) store[c.key] = { auto: true, done: false, name: c.name, teacher: c.teacher, zpf: c.zpf, url: c.rawUrl, pj01id: qp(c.rawUrl, 'pj01id') };
                if (c.submitted) store[c.key].done = true;
                const info = store[c.key];
                let stClass, stLabel;
                if (c.submitted) { stClass = 'st-submitted'; stLabel = '已提交'; }
                else if (info.auto !== false) { if (c.evaluated || info.done) { stClass = 'st-can-submit'; stLabel = '待提交'; } else { stClass = 'st-wait'; stLabel = '待评价'; } }
                else { stClass = 'st-none'; stLabel = '不操作'; }

                const el = document.createElement('div');
                el.className = 'ci';
                el.innerHTML = `<input type="checkbox" class="course-ck" data-key="${c.key}" ${info.auto ? 'checked' : ''} ${c.submitted ? 'disabled' : ''}>` +
                    `<span class="ci-name" title="${esc(c.name)}">${esc(c.name)}</span>` +
                    `<span class="ci-teacher">${esc(c.teacher)}</span>` +
                    (c.zpf ? `<span class="ci-zpf">${esc(c.zpf)}分</span>` : '') +
                    `<span class="${stClass}">${stLabel}</span>` +
                    `<button class="vb vb-outline vb-mini course-view-btn" data-url="${esc(c.rawUrl)}">查看</button>`;
                box.appendChild(el);
            });
            // 绑定勾选框事件，更新存储
            document.querySelectorAll('.course-ck').forEach(ck => {
                ck.onchange = (e) => { const k = e.target.getAttribute('data-key'); store[k].auto = e.target.checked; saveStore(store); updateSubmitBtn(); setTimeout(() => renderList(), 0); };
            });
            // 绑定"查看"按钮点击事件
            box.querySelectorAll('.course-view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = btn.getAttribute('data-url');
                    if (url) window.open(url, '_blank', 'width=1200,height=800');
                });
            });
            saveStore(store);
            updateSubmitBtn();
        };

        /**
         * “自动评价并保存”流水线的调度器
         */
        const execNext = () => {
            if (localStorage.getItem(KEY_RUNNING) !== 'true') return;
            if (localStorage.getItem(KEY_BUSY) === 'true') return; // 等待当前窗口保存完毕
            const store = loadStore(), curPj01 = qp(location.href, 'pj01id');
            // 查找属于当前类别且未完成的待评价课程
            const pending = Object.keys(store).filter(k => { const c = store[k]; return c.auto && !c.done && (!curPj01 || qp(c.url, 'pj01id') === curPj01); });
            if (pending.length > 0) {
                const c = store[pending[0]];
                localStorage.setItem(KEY_BUSY, 'true'); // 上锁
                logInfo(`▶ 正在保存：${c.name}`);
                window.open(withAuto(c.url, 'true'), '_blank', 'width=1200,height=800');
            } else {
                // 当前类别处理完毕，检查跨类别队列
                const queue = loadQueue();
                if (queue.length > 0) { const next = queue.shift(); saveQueue(queue); localStorage.setItem(KEY_CURLIST, next); localStorage.setItem(KEY_BUSY, 'false'); setTimeout(() => { location.href = next; }, 800); }
                else { localStorage.setItem(KEY_RUNNING, 'false'); localStorage.setItem(KEY_BUSY, 'false'); logSuccess('🎉 所有类别评价已全部完成！'); renderList(); alert('🎉全部评价已完成！'); }
            }
        };

        /**
         * “自动提交”流水线的调度器
         */
        const execNextSubmit = () => {
            if (localStorage.getItem(KEY_SUBRUN) !== 'true') return;
            if (localStorage.getItem(KEY_SUBBSY) === 'true') return;
            const queue = loadSubQueue();
            if (queue.length === 0) { localStorage.setItem(KEY_SUBRUN, 'false'); localStorage.setItem(KEY_SUBBSY, 'false'); logSuccess('🎉 所有勾选课程提交完毕！'); setTimeout(() => location.reload(), 800); return; }
            const nextUrl = queue.shift(); saveSubQueue(queue); localStorage.setItem(KEY_SUBBSY, 'true');
            const submitStore = loadStore(), submitKey = courseKey(nextUrl), submitInfo = submitKey ? submitStore[submitKey] : null;
            logInfo(`▶ 正在提交：${submitInfo ? submitInfo.name + '（' + submitInfo.teacher + '）' : nextUrl}`);
            window.open(nextUrl, '_blank', 'width=1200,height=800');
        };

        // 按钮点击事件绑定
        document.getElementById('start-btn').onclick = () => { localStorage.setItem(KEY_RUNNING, 'true'); localStorage.setItem(KEY_BUSY, 'false'); renderList(); execNext(); };
        document.getElementById('submit-all-btn').onclick = () => {
            const store = loadStore(), toSubmit = parseRows().filter(c => { const info = store[c.key]; return (c.evaluated || (info && info.done)) && !c.submitted && (info ? info.auto !== false : true); });
            if (toSubmit.length === 0) return;
            if (!confirm(`即将提交以下 ${toSubmit.length} 门课程：\n` + toSubmit.map(c => `· ${c.name}（${c.teacher}）`).join('\n') + '\n\n确认继续？')) return;
            const queue = toSubmit.map(c => withSubmit(c.rawUrl)); saveSubQueue(queue); localStorage.setItem(KEY_SUBRUN, 'true'); localStorage.setItem(KEY_SUBBSY, 'false'); execNextSubmit();
        };
        document.getElementById('reset-btn').onclick = () => { if (confirm('重置所有缓存？')) { [KEY_STORE, KEY_RUNNING, KEY_BUSY, KEY_QUEUE, KEY_CURLIST, KEY_SUBQUEUE, KEY_SUBRUN, KEY_SUBBSY].forEach(k => localStorage.removeItem(k)); location.reload(); } };
        document.getElementById('clear-log-btn').onclick = () => clearLogs();

        // 跨页面状态监听：当其他窗口修改了 busy 标志或完成状态时，本页面及时响应并触发下一步
        window.addEventListener('storage', (e) => {
            if ([KEY_STORE, KEY_BUSY, KEY_RUNNING].includes(e.key)) { renderList(); if (e.key === KEY_BUSY && e.newValue === 'false' && localStorage.getItem(KEY_RUNNING) === 'true') setTimeout(execNext, 800); }
            if (e.key === KEY_SUBBSY && e.newValue === 'false' && localStorage.getItem(KEY_SUBRUN) === 'true') setTimeout(execNextSubmit, 800);
        });

        renderList();
        // 自动恢复执行：若页面刷新时流水线正在运行，则继续
        if (localStorage.getItem(KEY_RUNNING) === 'true' && localStorage.getItem(KEY_BUSY) !== 'true') setTimeout(execNext, 1200);
        if (localStorage.getItem(KEY_SUBRUN) === 'true' && localStorage.getItem(KEY_SUBBSY) !== 'true') setTimeout(execNextSubmit, 1200);
    }

// ===== src/evaluate/editPage.js ========================================
    // ── EDIT 页面 (具体课程评价页) ────────────────────────────────────
    if (location.href.includes('xspj_edit.do')) {
        const params = new URLSearchParams(location.search);
        const isAutoSave = params.get(PARAM_AUTO) === 'true';
        const isAutoSub = params.get(PARAM_SUBMIT) === 'true';
        const isManual = !isAutoSave && !isAutoSub;

        // 手动模式：注入顶栏快捷填分工具
        if (isManual) {
            const initManual = () => {
                injectCSS();
                const { gkeys, groups } = collectGroups();
                if (gkeys.length === 0) return;
                ensureValueFields();

                const bar = document.createElement('div');
                bar.id = 'v80-manual-bar';
                bar.style.cssText = 'position:sticky;top:0;left:0;width:100%;z-index:99999;box-sizing:border-box;background:#ebf8ff;border-bottom:2px solid #90cdf4;color:#2c5282;padding:10px 18px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.08);';
                bar.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span style="font-weight:700;font-size:13px;">🎓 南理工教务增强助手 V2</span>
                    <span style="font-size:11px;padding:2px 9px;border-radius:7px;background:#edf2f7;color:#718096;border:1px solid #cbd5e0;">手动模式</span>
                    <span style="font-size:12px;color:#4a5568;">快捷填分：</span>
                    <button id="v8-fill-highest" class="vb vb-outline vb-mini">最高分</button>
                    <button id="v8-fill-high"    class="vb vb-outline vb-mini">中高分</button>
                    <button id="v8-fill-mid"     class="vb vb-outline vb-mini">中分</button>
                    <button id="v8-fill-low"     class="vb vb-outline vb-mini">低分</button>
                    <span id="v8-score-display" style="font-size:18px;font-weight:800;color:#2d3748;padding:4px 10px;border-radius:6px;background:#f7fafc;border:1px solid #e2e8f0;margin-left:4px;">未填写</span>
                </div>
                <div id="v8-manual-hint" style="margin-top:7px;font-size:11px;color:#718096;display:none;">已自动填写，请确认无误后手动点击页面上的「保存」或「提交」按钮。</div>`;
                document.body.prepend(bar);

                const scoreDisplay = document.getElementById('v8-score-display');
                const manualHint = document.getElementById('v8-manual-hint');
                const refreshScore = () => {
                    const { gkeys: gk2, groups: gr2 } = collectGroups();
                    const total = calcCurrentTotal(gk2, gr2);
                    const answered = gk2.filter(k => gr2[k].some(o => o.el.checked)).length;
                    scoreDisplay.textContent = answered === 0 ? '未填写' : `总分 ${total} (${answered}/${gk2.length}题)`;
                    scoreDisplay.style.color = '#276749';
                };
                const strategies = [
                    { id: 'v8-fill-highest', s: 'highest', label: '最高分' },
                    { id: 'v8-fill-high', s: 'high', label: '中高分' },
                    { id: 'v8-fill-mid', s: 'mid', label: '中分' },
                    { id: 'v8-fill-low', s: 'low', label: '低分' }
                ];
                strategies.forEach(({ id, s, label }) => {
                    document.getElementById(id).addEventListener('click', () => {
                        const { gkeys: gk2, groups: gr2 } = collectGroups();
                        const total = applyStrategy(s, gk2, gr2);
                        scoreDisplay.textContent = `当前 ${total} 分（${label}）`;
                        scoreDisplay.style.color = '#276749';
                        manualHint.style.display = 'block';
                    });
                });
                document.querySelectorAll('input[type="radio"]').forEach(r => r.addEventListener('change', refreshScore));
                refreshScore();
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initManual, 300));
            else setTimeout(initManual, 300);
            return;
        }

        // 自动模式（保存或提交）
        injectCSS();
        const bgColor = isAutoSub ? '#f0fff4' : '#ebf8ff';
        const bdColor = isAutoSub ? '#9ae6b4' : '#90cdf4';
        const textColor = isAutoSub ? '#276749' : '#2c5282';
        const modeName = isAutoSub ? '✅ 提交模式' : '💾 保存模式';

        const bar = document.createElement('div');
        bar.style.cssText = `position:sticky;top:0;left:0;width:100%;z-index:99999;box-sizing:border-box;background:${bgColor};color:${textColor};border-bottom:2px solid ${bdColor};box-shadow:0 2px 8px rgba(0,0,0,0.08);font-family:sans-serif;`;
        bar.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 20px;">
            <span style="font-weight:700;font-size:13px;">🎓 南理工教务增强助手 V2</span>
            <span style="font-size:11px;padding:2px 10px;border-radius:8px;background:rgba(255,255,255,0.5);border:1px solid ${bdColor};">${modeName}</span>
            <span id="edit-tag" style="font-size:11px;padding:2px 10px;border-radius:8px;background:rgba(0,0,0,0.06);border:1px solid ${bdColor};">初始化...</span>
            <span id="v8-total-display" style="font-size:17px;font-weight:800;color:${textColor};padding:1px 10px;border-radius:6px;border:1px solid ${bdColor};background:#fff;">总分 0</span>
            <button id="stop-btn" style="margin-left:auto;background:#fff;border:1px solid ${bdColor};padding:4px 12px;border-radius:5px;font-weight:700;cursor:pointer;font-size:12px;">停止</button>
        </div>
        <div style="height:1px;background:${bdColor};opacity:0.4;margin:0 20px;"></div>
        <div id="v8-confirm-attn" style="display:flex;align-items:center;gap:6px;padding:5px 20px 8px;font-size:12px;font-weight:500;color:#2c5282;opacity:0.9;">请确认评分无误后，手动点击浏览器弹出的「确认」按钮</div>`;
        document.body.prepend(bar);

        const tag = document.getElementById('edit-tag');
        const editLog = (msg, level = 'info') => { tag.textContent = msg; pushLog('[edit] ' + msg, level); };
        let stopped = false;
        document.getElementById('stop-btn').onclick = () => { stopped = true; editLog('已停止'); document.getElementById('stop-btn').style.display = 'none'; };

        // 执行自动提交逻辑
        if (isAutoSub) {
            setTimeout(() => {
                const key = courseKey(location.href), store = loadStore();
                editLog('准备提交...');
                if (stopped) return;

                // 提交模式下也要计算并显示当前总分
                const { gkeys, groups } = collectGroups();
                const total = calcCurrentTotal(gkeys, groups);
                const totalDisplay = document.getElementById('v8-total-display');
                if (totalDisplay) totalDisplay.textContent = `总分 ${total}`;

                ensureValueFields();

                const doSubmit = () => {
                    const tj = document.getElementById('tj');
                    if (!tj) { localStorage.setItem(KEY_SUBBSY, 'false'); setTimeout(() => window.close(), 1000); return; }
                    try {
                        // 调用教务系统原生的提交函数
                        unsafeWindow.saveData(tj, '1');
                        if (key && store[key]) { store[key].done = true; saveStore(store); }
                        editLog('已提交！', 'success');
                    } catch (err) {
                        logError(err.message);
                        editLog('提交出错，请手动操作', 'error');
                    }
                    // 释放互斥锁并关闭窗口
                    setTimeout(() => { localStorage.setItem(KEY_SUBBSY, 'false'); setTimeout(() => window.close(), 300); }, 800);
                };

                let tries = 0;
                const poll = setInterval(() => {
                    tries++;
                    if (document.getElementById('tj') || tries > 10) { clearInterval(poll); doSubmit(); }
                }, 500);
            }, 800);
        } else {
            // 执行自动填分并保存逻辑
            setTimeout(() => {
                const key = courseKey(location.href), store = loadStore();
                const { gkeys, groups } = collectGroups();
                ensureValueFields();
                const total = applyStrategy('highest', gkeys, groups);
                document.getElementById('v8-total-display').textContent = `总分 ${total}`;
                if (key && store[key]) { store[key].done = true; saveStore(store); }
                if (stopped) return;
                editLog('填写完成，即将保存');
                setTimeout(() => {
                    if (stopped) return;
                    const bc = document.getElementById('bc'); // 保存按钮
                    if (bc) try { unsafeWindow.saveData(bc, '0'); } catch (err) { logError(err.message); }
                    // 释放互斥锁并关闭窗口
                    setTimeout(() => { localStorage.setItem(KEY_BUSY, 'false'); setTimeout(() => window.close(), 300); }, 600);
                }, 1000);
            }, 800);
        }
    }
})();
