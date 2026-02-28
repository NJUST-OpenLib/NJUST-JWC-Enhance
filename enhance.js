// ==UserScript==
// @name         南理工教务增强助手 2.0
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  在合适的地方显示课程大纲、选修课类别及选修课学分情况，并自动刷新登录状态。同时支持评教自动填分与批量提交。
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

// ================================================================
//  【模块一】南理工教务增强助手 2.0
//  功能：课程大纲、选修课类别、学分统计、自动刷新登录状态
// ================================================================

// ==================== 远程数据源配置 ====================
// fix⑥: 将常量移入 IIFE 避免全局命名空间污染

(function () {
    'use strict';

    // ── 数据源配置（移至 IIFE 内部，避免全局污染）──────────────────
    const CATEGORY_URLS = [
        'https://enhance.njust.wiki/data/xxk.json',
        'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json',
        'https://testingcf.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json',
        'https://raw.githubusercontent.com/NJUST-OpenLib/NJUST-JWC-Enhance/refs/heads/main/data/xxk.json'
    ];

    const OUTLINE_URLS = [
        'https://enhance.njust.wiki/data/kcdg.json',
        'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/kcdg.json',
        'https://testingcf.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/kcdg.json',
        'https://raw.githubusercontent.com/NJUST-OpenLib/NJUST-JWC-Enhance/refs/heads/main/data/kcdg.json'
    ];

    // ==================== 配置选项 ====================
    const UI_CONFIG = {
        showNotifications: true
    };

    const DEBUG_CONFIG = {
        enabled: true,
        level: 4,
        showCache: true
    };

    const CACHE_CONFIG = {
        enabled: true,
        ttl: 86400,
        prefix: 'njust_jwc_enhance_'
    };

    // ==================== 日志面板 UI ====================
    // fix①②: 修复 initialized 提前置 true 导致 body 为 null 的问题；
    //         修复标题栏只显示部分日志的问题（队列式滚动显示）
    const LogPanelUI = {
        container: null,
        body: null,
        initialized: false,
        queue: [],
        // fix②: 用于标题栏滚动显示的队列
        _statusQueue: [],
        _statusPlaying: false,

        init() {
            if (this.initialized || !document.body) return;
            // fix①: 不在这里提前置 true，等 DOM 全部挂载后再置

            const style = document.createElement('style');
            style.textContent = `
                #njust-enhance-log {
                    position: fixed; bottom: 0; right: 20px; width: 380px;
                    background: #fff; border: 1px solid #e2e8f0; border-bottom: none;
                    border-radius: 10px 10px 0 0; box-shadow: 0 -2px 15px rgba(0,0,0,0.08);
                    z-index: 10001; font-family: 'SFMono-Regular', Consolas, monospace;
                    display: flex; flex-direction: column; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                #njust-enhance-log.minimized { transform: translateY(calc(100% - 38px)); }
                #njust-enhance-log-hd {
                    padding: 10px 15px; background: #f7fafc; border-bottom: 1px solid #e2e8f0;
                    cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                    border-radius: 10px 10px 0 0; user-select: none; gap: 10px;
                }
                #njust-enhance-log-hd b { font-size: 13px; color: #2d3748; display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
                #nel-status-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; transition: color 0.2s; }
                #njust-enhance-log-body {
                    height: 220px; overflow-y: auto; background: #fdfdfd; font-size: 11px;
                    padding: 4px 0; scroll-behavior: smooth;
                }
                .nel-btn { font-size: 11px; color: #718096; background: #edf2f7; padding: 2px 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .nel-btn:hover { background: #e2e8f0; color: #2d3748; }
                .nel-clear { background: rgba(245, 101, 101, 0.05); color: #c53030; }
                .nel-clear:hover { background: rgba(245, 101, 101, 0.15); color: #c53030; }
                .nel-line {
                    padding: 3px 12px; border-bottom: 1px solid rgba(226, 232, 240, 0.4);
                    display: flex; gap: 8px; align-items: flex-start; transition: background 0.1s;
                }
                .nel-line:hover { background: #f7fafc; }
                .nel-ts { color: #a0aec0; flex-shrink: 0; min-width: 55px; user-select: none; }
                .nel-lvl { font-weight: bold; flex-shrink: 0; min-width: 42px; text-align: center; font-size: 10px; }
                .nel-msg { color: #4a5568; word-break: break-all; flex: 1; line-height: 1.5; }
                .nel-error { border-left: 3px solid #e53e3e; background: rgba(229, 62, 62, 0.02); }
                .nel-error .nel-lvl { color: #e53e3e; }
                .nel-warn { border-left: 3px solid #dd6b20; background: rgba(221, 107, 32, 0.02); }
                .nel-warn .nel-lvl { color: #dd6b20; }
                .nel-success { border-left: 3px solid #38a169; background: rgba(56, 161, 105, 0.02); }
                .nel-success .nel-lvl { color: #38a169; }
                .nel-info { border-left: 3px solid #3182ce; }
                .nel-info .nel-lvl { color: #3182ce; }
                .nel-debug { border-left: 3px solid #9f7aea; color: #718096; }
                .nel-debug .nel-lvl { color: #9f7aea; }
            `;
            document.head.appendChild(style);

            this.container = document.createElement('div');
            this.container.id = 'njust-enhance-log';
            this.container.className = 'minimized';
            this.container.innerHTML = `
                <div id="njust-enhance-log-hd">
                    <b><span id="nel-status-text">南理工教务增强助手V2</span></b>
                    <span id="nel-clear-btn" class="nel-btn nel-clear" title="清空日志">清空</span>
                    <span id="njust-log-toggle" class="nel-btn">展开 ▴</span>
                </div>
                <div id="njust-enhance-log-body"></div>
            `;
            document.body.appendChild(this.container);
            this.body = this.container.querySelector('#njust-enhance-log-body');

            // fix①: DOM 完全挂载、this.body 已赋值后再置 initialized = true
            this.initialized = true;

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

            // 处理排队消息（此时 this.body 已确保可用）
            if (this.queue.length > 0) {
                this.queue.forEach(item => this.add(item.level, item.msg));
                this.queue = [];
            }
        },

        add(level, msg) {
            if (!this.initialized) {
                this.init();
                // init() 执行后若仍未初始化（body 尚不存在），则入队等待
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
            if (this.body.children.length > 200) this.body.removeChild(this.body.firstChild);
            this.body.scrollTop = this.body.scrollHeight;

            // fix②: 将消息加入标题栏显示队列，逐条滚动展示而非立即覆盖
            this._statusQueue.push({ msg, level });
            if (!this._statusPlaying) {
                this._playStatusQueue();
            }
        },

        // fix②: 队列式逐条播放标题栏状态，确保每条消息都被看到
        _playStatusQueue() {
            if (this._statusQueue.length === 0) {
                this._statusPlaying = false;
                // 队列耗尽后恢复默认状态
                const statusText = this.container && this.container.querySelector('#nel-status-text');
                if (statusText) {
                    statusText.textContent = '增强助手加载成功';
                    statusText.style.color = '#2d3748';
                    statusText.style.opacity = '0.7';
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
                statusText.style.opacity = '0.5';
                setTimeout(() => { statusText.style.opacity = '1'; }, 80);
            }
            // 每条消息显示 200ms 后展示下一条
            setTimeout(() => { this._playStatusQueue(); }, 200);
        },

        esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    };

    // ==================== 调试系统 ====================
    // fix④: 移除与 LogPanelUI 职责重叠的 StatusNotifier 调用，Logger 只对接 LogPanelUI
    const Logger = {
        LEVELS: { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 },

        log(level, message, ...args) {
            if (!DEBUG_CONFIG.enabled || level > DEBUG_CONFIG.level) return;

            const timestamp = new Date().toLocaleTimeString();
            const levelNames = ['', 'error', 'warn', 'info', 'debug'];
            const lvlName = levelNames[level] || 'info';

            console.log(`[${timestamp}] [南理工教务助手]`, message, ...args);

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

            LogPanelUI.add(lvlName, displayMessage);
        },

        error(message, ...args) { this.log(this.LEVELS.ERROR, message, ...args); },
        warn(message, ...args)  { this.log(this.LEVELS.WARN, message, ...args); },
        info(message, ...args)  { this.log(this.LEVELS.INFO, message, ...args); },
        debug(message, ...args) { this.log(this.LEVELS.DEBUG, message, ...args); }
    };

    // ==================== 缓存系统 ====================
    const CacheManager = {
        getKey(url) {
            return CACHE_CONFIG.prefix + btoa(unescape(encodeURIComponent(url))).replace(/[^a-zA-Z0-9]/g, '');
        },

        set(url, data) {
            if (!CACHE_CONFIG.enabled) return false;
            try {
                const cacheData = { data, timestamp: Date.now(), ttl: CACHE_CONFIG.ttl * 1000, url };
                localStorage.setItem(this.getKey(url), JSON.stringify(cacheData));
                if (DEBUG_CONFIG.showCache) {
                    Logger.info(`💾 缓存已保存: ${url}`);
                }
                return true;
            } catch (e) {
                Logger.error('缓存保存失败: ', e);
                return false;
            }
        },

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

    let courseCategoryMap = {};
    let courseOutlineMap = {};

    // ==================== 统一弹窗 ====================
    function createUnifiedModal(title, content, type = 'info') {
        const existingModal = document.getElementById('njustAssistantModal');
        if (existingModal) existingModal.remove();

        const container = document.createElement('div');
        container.id = 'njustAssistantModal';

        const gradientColor = {
            warning: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            success:  'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            info:     'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }[type] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

        container.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: ${gradientColor};
            border: none; border-radius: 15px; padding: 0;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000; min-width: 200px; max-width: 500px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden; animation: njustFadeIn 0.3s ease-out;
        `;

        container.innerHTML = `
            <div id="dragHandle" style="
                background: rgba(255,255,255,0.1); padding: 15px 20px; cursor: move;
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.2);">
                <div style="color: white; font-weight: bold; font-size: 18px;">🎓 ${title}</div>
                <span style="cursor: pointer; color: rgba(255,255,255,0.8); font-size: 18px;
                    padding: 2px 6px; border-radius: 4px; transition: background-color 0.2s;"
                    onclick="this.closest('div').parentElement.remove()"
                    onmouseover="this.style.backgroundColor='rgba(255,255,255,0.2)'"
                    onmouseout="this.style.backgroundColor='transparent'">✕</span>
            </div>
            <div style="background: white; padding: 25px;">
                ${content}
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;
                    font-size: 12px; color: #666; line-height: 1.4; text-align: center;">
                    <div style="margin-bottom: 8px;">
                        <strong>请查看
                        <a href="https://enhance.njust.wiki" target="_blank"
                            style="color: #007bff; text-decoration: none;">官方网站</a>
                        以获取使用说明</strong>
                    </div>
                    <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 5px;">⚠️ 免责声明</div>
                    <div>本工具仅为学习交流使用，数据仅供参考。</div>
                    <div>请以教务处官网信息为准，使用本工具产生的任何后果均由用户自行承担。</div>
                </div>
            </div>
        `;

        if (!document.getElementById('njustAssistantStyles')) {
            const style = document.createElement('style');
            style.id = 'njustAssistantStyles';
            // fix②: 避免与 LogPanelUI 的动画同名冲突，改用前缀 njustFadeIn
            style.textContent = `
                @keyframes njustFadeIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        addDragFunctionality(container);
        document.body.appendChild(container);
        return container;
    }

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
            const newTop  = elemStartY + (clientY - mouseStartY);
            container.style.transform = 'none';  // 清除动画 transform
            container.style.left = newLeft + 'px';
            container.style.top  = newTop  + 'px';
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

    // ==================== 检测强智科技页面 ====================
    function checkQiangzhiPage() {
        try {
            const pageTitle = document.title || '';
            if (pageTitle.includes('强智科技教务系统概念版')) {
                Logger.warn('检测到强智科技概念版页面，显示登录引导');
                const content = `
                    <div style="text-align: center; font-size: 16px; color: #333; margin-bottom: 20px; line-height: 1.6;">
                        <div style="font-size: 20px; margin-bottom: 15px;">🚫 该页面无法登录</div>
                        <div style="margin-top: 10px;">请转向以下正确的登录页面:</div>
                    </div>
                    <div style="text-align: center; margin: 20px 0;">
                        <div style="margin: 10px 0;">
                            <a href="https://www.njust.edu.cn/" target="_blank" style="
                                display: inline-block; background: #28a745; color: white;
                                padding: 12px 20px; text-decoration: none; border-radius: 8px;
                                margin: 5px; font-weight: bold;">
                                🏫 智慧理工登录页面
                            </a>
                        </div>
                        <div style="margin: 10px 0;">
                            <a href="http://202.119.81.113:8080/" target="_blank" style="
                                display: inline-block; background: #007bff; color: white;
                                padding: 12px 20px; text-decoration: none; border-radius: 8px;
                                margin: 5px; font-weight: bold;">
                                🔗 教务处登录页面
                            </a>
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px;
                        font-size: 14px; color: #666; text-align: center;">
                        💡 提示:<br>
                        强智科技教务系统概念版是无法登陆的。<br>
                        请使用上述链接跳转到正确的登录页面，<br>
                        登录后可正常使用教务系统功能<br>
                        验证码区分大小写，大部分情况下均为小写
                    </div>
                `;
                try { createUnifiedModal('南理工教务增强助手', content, 'warning'); }
                catch (e) { Logger.error('创建强智科技页面提示弹窗失败:', e); }
                return true;
            }
            return false;
        } catch (e) {
            Logger.error('检测强智科技页面失败:', e);
            return false;
        }
    }

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
                        🎓 南理工教务增强助手
                    </div>
                    <span style="cursor: pointer; color: #888; font-size: 18px;
                        padding: 2px 8px; border-radius: 4px; transition: background-color 0.2s;"
                        onclick="this.closest('div').parentElement.remove()"
                        onmouseover="this.style.backgroundColor='#e0e0e0'"
                        onmouseout="this.style.backgroundColor='transparent'">✕</span>
                </div>
                <div style="background: #fff; padding: 18px 22px 10px 22px; max-height: 540px; overflow-y: auto;">
                    <div id="creditSummary"></div>
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
                    container.style.top  = (elemStartY + clientY - mouseStartY) + 'px';
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
                    const credit     = parseFloat(tds[6].textContent) || 0;
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

            const totalCreditsByType     = Object.values(creditsByType).reduce((s, d) => s + d.credits, 0);
            const totalCountByType       = Object.values(creditsByType).reduce((s, d) => s + d.count, 0);
            const totalCreditsByCategory = Object.values(creditsByCategory).reduce((s, d) => s + d.credits, 0);
            const totalCountByCategory   = Object.values(creditsByCategory).reduce((s, d) => s + d.count, 0);

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

    // ==================== 处理页面表格 ====================
    function processAllTables() {
        try {
            const tables = document.querySelectorAll('table');
            const isGradePage    = window.location.pathname.includes('/njlgdx/kscj/cjcx_list');
            const isSchedulePage = window.location.pathname.includes('xskb_list.do') &&
                                   document.title.includes('学期理论课表');
            const isSmartCampus  = window.location.href.includes('bkjw.njust.edu.cn');

            let processedTables = 0, processedRows = 0, enhancedCourses = 0;

            tables.forEach(table => {
                try {
                    if (isSchedulePage && table.id !== 'dataList') return;
                    const rows = table.querySelectorAll('tr');
                    processedTables++;

                    rows.forEach(row => {
                        try {
                            const tds = row.querySelectorAll('td');
                            if (tds.length < 3) return;
                            processedRows++;

                            let courseCodeTd, courseCode;

                            if (isGradePage) {
                                courseCodeTd = tds[2];
                                courseCode   = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                            } else if (isSchedulePage) {
                                courseCodeTd = tds[1];
                                courseCode   = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                            } else {
                                courseCodeTd = tds[1];
                                if (courseCodeTd && courseCodeTd.innerHTML) {
                                    const parts = courseCodeTd.innerHTML.split('<br>');
                                    if (parts.length === 2) courseCode = parts[1].trim();
                                    else return;
                                } else return;
                            }

                            if (!courseCode) return;
                            let courseEnhanced = false;

                            // 插入类别
                            try {
                                if (courseCodeTd && !courseCodeTd.querySelector('[data-category-inserted]')) {
                                    const category = courseCategoryMap[courseCode];
                                    if (category) {
                                        const catDiv = document.createElement('div');
                                        catDiv.setAttribute('data-category-inserted', '1');
                                        catDiv.style.color      = '#28a745';
                                        catDiv.style.fontWeight = 'bold';
                                        catDiv.style.marginTop  = '4px';
                                        catDiv.textContent = category;
                                        courseCodeTd.appendChild(catDiv);
                                        courseEnhanced = true;
                                    }
                                }
                            } catch (e) { Logger.warn('添加课程类别时出错:', e); }

                            // 插入老师说明
                            try {
                                if (!isGradePage && !isSchedulePage && courseCodeTd &&
                                    courseCodeTd.title && !courseCodeTd.querySelector('[data-title-inserted]')) {
                                    const titleDiv = document.createElement('div');
                                    titleDiv.setAttribute('data-title-inserted', '1');
                                    titleDiv.style.color     = '#666';
                                    titleDiv.style.fontSize  = '13px';
                                    titleDiv.style.marginTop = '4px';
                                    titleDiv.style.fontStyle = 'italic';
                                    titleDiv.textContent = `📌 老师说明: ${courseCodeTd.title}`;
                                    courseCodeTd.appendChild(titleDiv);
                                    courseEnhanced = true;
                                }
                            } catch (e) { Logger.warn('添加老师说明时出错:', e); }

                            // 插入课程大纲链接
                            try {
                                if (courseCodeTd && !courseCodeTd.querySelector('[data-outline-inserted]')) {
                                    const outlineDiv = document.createElement('div');
                                    outlineDiv.setAttribute('data-outline-inserted', '1');
                                    outlineDiv.style.marginTop = '4px';

                                    if (isSmartCampus) {
                                        outlineDiv.textContent      = '⚠️ 课程大纲功能受限';
                                        outlineDiv.style.color      = '#ff9800';
                                        outlineDiv.style.fontWeight = 'bold';
                                        outlineDiv.style.cursor     = 'pointer';
                                        outlineDiv.title = '当前使用智慧理工平台，课程大纲功能受限。请访问教务处官网获取完整功能';
                                    } else {
                                        const realId = courseOutlineMap[courseCode];
                                        if (realId) {
                                            const link  = document.createElement('a');
                                            link.href   = `http://202.119.81.112:8080/kcxxAction.do?method=kcdgView&jx02id=${realId}&isentering=0`;
                                            link.textContent = '📘 查看课程大纲';
                                            link.target = '_blank';
                                            link.style.color = '#0077cc';
                                            outlineDiv.appendChild(link);
                                        } else {
                                            outlineDiv.textContent  = '❌ 无大纲信息';
                                            outlineDiv.style.color  = 'gray';
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

            if (isGradePage) updateCreditSummary();
        } catch (e) {
            Logger.error('处理页面表格失败:', e);
        }
    }

    // ==================== 登录状态检测与刷新 ====================
    function checkLoginErrorAndRefresh() {
        try {
            const pageTitle   = document.title || '';
            const pageContent = document.body ? document.body.textContent : '';
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
            setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 10000);
        } catch (e) {
            Logger.error('自动刷新登录状态失败:', e);
        }
    }

    // fix⑦: 多标签页并发防护：使用 BroadcastChannel 广播刷新事件，避免同时触发
    function autoRefreshLoginStatus() {
        try {
            const currentUrl = window.location.href;
            if (!currentUrl.includes('njlgdx/framework/main.jsp')) return;

            const lastRefreshKey = 'njust_last_login_refresh';
            const lastRefreshTime = localStorage.getItem(lastRefreshKey);
            const now = Date.now();
            const refreshInterval = 5 * 60 * 1000;

            if (lastRefreshTime && (now - parseInt(lastRefreshTime)) < refreshInterval) {
                Logger.debug('距上次刷新不足5分钟，跳过');
                return;
            }

            // fix⑦: 先写入时间戳（抢锁），再通过 BroadcastChannel 通知其他同源标签页
            localStorage.setItem(lastRefreshKey, now.toString());

            // 若浏览器支持 BroadcastChannel，通知其他标签页跳过刷新
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

    // ==================== 主初始化 ====================
    async function init() {
        try {
            Logger.info('开始执行主要逻辑');

            if (checkQiangzhiPage()) {
                Logger.info('强智科技页面检测完成，脚本退出');
                return;
            }

            const currentUrl    = window.location.href;
            const isSmartCampus = currentUrl.includes('bkjw.njust.edu.cn');
            if (isSmartCampus) {
                Logger.warn('检测到智慧理工平台，课程大纲功能将受限');
            }

            autoRefreshLoginStatus();
            checkLoginErrorAndRefresh();

            Logger.info('开始加载数据');
            const [categoryData, outlineData] = await Promise.all([
                loadJSON(CATEGORY_URLS),
                loadJSON(OUTLINE_URLS)
            ]);

            Logger.info('数据加载完成，构建映射表');
            buildCourseMaps(categoryData, outlineData);

            if (window.location.pathname.includes('/njlgdx/kscj/cjcx_list')) {
                createCreditSummaryWindow();
            }

            processAllTables();

            // fix③: 修正 MutationObserver 的 isProcessing 锁逻辑，
            //        在 finally 中同步重置（而非放在 setTimeout 里），
            //        并在 setTimeout 延迟中再次检查以确保 DOM 变更已完成
            let isProcessing = false;
            const observer = new MutationObserver((mutations) => {
                try {
                    if (isProcessing) return;

                    const hasRelevantChanges = mutations.some(mutation => {
                        try {
                            if (mutation.type !== 'childList') return false;
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                                if (node.hasAttribute &&
                                    (node.hasAttribute('data-category-inserted') ||
                                     node.hasAttribute('data-title-inserted') ||
                                     node.hasAttribute('data-outline-inserted'))) {
                                    return false;
                                }
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
                        // fix③: 先同步置锁，执行完成后同步释放
                        //        用 setTimeout 仅作为 DOM 渲染的等待，不负责释放锁
                        isProcessing = true;
                        try {
                            processAllTables();
                        } catch (e) {
                            Logger.error('重新处理表格失败:', e);
                        } finally {
                            // fix③: 同步释放锁（DOM 修改已在 processAllTables 内完成）
                            //        延迟仅用于防止同一批次 mutation 触发重复处理
                            setTimeout(() => { isProcessing = false; }, 100);
                        }
                    }
                } catch (e) {
                    Logger.error('MutationObserver 回调执行失败:', e);
                    // fix③: 异常时也要确保锁被释放
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

    setTimeout(init, 1000);
})();

// ================================================================
//  【模块二】自动评教助手 V1
//  功能：自动填分、批量提交、分值预览
//  仅在评教相关页面（xspj_*.do）生效
// ================================================================

(function () {
    'use strict';

    // fix⑥: 模块二同样包裹在独立 IIFE 中（原代码已是，此处保持不变）

    const KEY_STORE    = 'njust_eval_v1_store';
    const KEY_RUNNING  = 'njust_eval_running';
    const KEY_BUSY     = 'njust_eval_busy';
    const KEY_QUEUE    = 'njust_eval_queue';
    const KEY_CURLIST  = 'njust_eval_curlist';
    const KEY_LOG      = 'njust_eval_log';
    const KEY_LOGLVL   = 'njust_eval_loglvl';
    const KEY_SUBQUEUE = 'njust_eval_subqueue';
    const KEY_SUBRUN   = 'njust_eval_subrun';
    const KEY_SUBBSY   = 'njust_eval_subbsy';

    const PARAM_AUTO   = 'isAutoEval';
    const PARAM_SUBMIT = 'isAutoSubmit';
    const MAX_LOG      = 300;

    // ── 日志系统 ─────────────────────────────────────────────────────
    const LOG_LEVELS = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
    const LOG_LABELS = { debug: 'DBG', info: 'INF', success: 'OK ', warn: 'WRN', error: 'ERR' };
    const LOG_ICONS  = { debug: '🔍', info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };

    const loadLogs    = () => JSON.parse(localStorage.getItem(KEY_LOG) || '[]');
    const clearLogs   = () => { localStorage.removeItem(KEY_LOG); renderLogPanel(); };
    const getMinLevel = () => { const s = localStorage.getItem(KEY_LOGLVL); return (s && LOG_LEVELS[s] !== undefined) ? s : 'info'; };
    const setMinLevel = (l) => { localStorage.setItem(KEY_LOGLVL, l); renderLogPanel(); };

    const pushLog = (msg, level = 'info') => {
        const logs = loadLogs();
        logs.push({ ts: new Date().toTimeString().slice(0, 8), msg, level });
        if (logs.length > MAX_LOG) logs.splice(0, logs.length - MAX_LOG);
        localStorage.setItem(KEY_LOG, JSON.stringify(logs));
        renderLogPanel();
    };
    const logInfo    = (m) => pushLog(m, 'info');
    const logSuccess = (m) => pushLog(m, 'success');
    const logError   = (m) => pushLog(m, 'error');

    const renderLogPanel = () => {
        const minP  = LOG_LEVELS[getMinLevel()] ?? 1;
        const lines = loadLogs().filter(l => (LOG_LEVELS[l.level] ?? 1) >= minP);
        const html  = lines.map(l => {
            const level = l.level || 'info';
            const icon  = LOG_ICONS[level] || '•';
            const label = LOG_LABELS[level] || 'INF';
            return `<div class="log-line log-${level}">` +
                   `<span class="log-ts">${l.ts}</span>` +
                   `<span class="log-lvl">${icon} ${label}</span>` +
                   `<span class="log-msg">${esc(l.msg)}</span></div>`;
        }).join('');
        const el = document.getElementById('v80-log-content');
        if (el) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
        const sel = document.getElementById('log-level-sel');
        if (sel) sel.value = getMinLevel();
    };

    // ── 工具函数 ──────────────────────────────────────────────────────
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const qp = (url, key) => {
        try { return new URL(url, location.origin).searchParams.get(key) || ''; }
        catch { return url.match(new RegExp(`[?&]${key}=([^&]+)`))?.[1] || ''; }
    };

    const courseKey    = (url) => { const cid = qp(url, 'jx02id'), tid = qp(url, 'jg0101id'); return cid && tid ? `${cid}__${tid}` : null; };
    const appendParam  = (url, key, val) => url + (url.includes('?') ? '&' : '?') + key + '=' + val;
    const withAuto     = (url, val) => appendParam(url, PARAM_AUTO, val);
    const withSubmit   = (url) => appendParam(url, PARAM_SUBMIT, 'true');
    const roundFloat   = (n) => Math.round(n * 1e9) / 1e9;

    const loadStore    = () => JSON.parse(localStorage.getItem(KEY_STORE) || '{}');
    const saveStore    = (v) => localStorage.setItem(KEY_STORE, JSON.stringify(v));
    const loadQueue    = () => JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
    const saveQueue    = (q) => localStorage.setItem(KEY_QUEUE, JSON.stringify(q));
    const loadSubQueue = () => JSON.parse(localStorage.getItem(KEY_SUBQUEUE) || '[]');
    const saveSubQueue = (q) => localStorage.setItem(KEY_SUBQUEUE, JSON.stringify(q));

    const renderStoragePanel = () => {
        const el = document.getElementById('v80-storage-pre');
        if (el) el.textContent = JSON.stringify(loadStore(), null, 2);
    };

    // ── 评价页面核心逻辑 ──────────────────────────────────────────────
    const collectGroups = () => {
        const groups = {};
        document.querySelectorAll('input[type="radio"]').forEach(r => {
            if (!groups[r.name]) groups[r.name] = [];
            const idx  = r.id.split('_')[1];
            const fzEl = document.getElementsByName(`pj0601fz_${idx}_${r.value}`)[0];
            groups[r.name].push({ el: r, score: fzEl ? parseFloat(fzEl.value) || 0 : 0 });
        });
        const gkeys = Object.keys(groups);
        gkeys.forEach(k => groups[k].sort((a, b) => b.score - a.score));
        return { gkeys, groups };
    };

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

    const calcCurrentTotal = (gkeys, groups) => {
        let total = 0;
        gkeys.forEach(k => { const chosen = groups[k].find(o => o.el.checked); if (chosen) total += chosen.score; });
        return roundFloat(total);
    };

    const ensureValueFields = () => {
        const { gkeys, groups } = collectGroups();
        gkeys.forEach(k => {
            groups[k].forEach(({ el, score }) => {
                const idx  = el.id.split('_')[1];
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

    const applyStrategy = (strategy, gkeys, groups) => {
        const perturbIdx = findPerturbIdx(gkeys, groups);
        let total = 0;
        gkeys.forEach((k, i) => {
            const opts = groups[k], len = opts.length;
            let pick;
            if (strategy === 'highest') {
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

    // ── 样式注入 ──────────────────────────────────────────────────────
    const injectCSS = () => {
        if (document.getElementById('v80-style')) return;
        const style = document.createElement('style');
        style.id = 'v80-style';
        style.textContent = `
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
            #v80-min-btn {
                width: 28px; height: 28px; border-radius: 6px; background: #edf2f7; color: #4a5568;
                border: none; font-size: 16px; cursor: pointer;
                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
            }
            #v80-min-btn:hover { background: #e2e8f0; }
            #v80-action-bar { padding: 10px 14px 8px; border-bottom: 1px solid #edf2f7; background: #fff; flex-shrink: 0; }
            #v80-submit-hint { font-size: 11px; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; display: none; line-height: 1.6; }
            #v80-submit-hint.visible { display: block; }
            .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 7px; }
            #v80-body { padding: 10px 14px; overflow-y: auto; flex: 1; }
            .entry-card, .ci { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 7px; border: 1px solid #e2e8f0; margin-bottom: 7px; background: #f7fafc; }
            .ci { padding: 8px 10px; margin-bottom: 6px; border-color: #edf2f7; }
            .entry-label, .ci-name { flex: 1; font-weight: 500; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ci-teacher { color: #718096; white-space: nowrap; }
            .ci-zpf { color: #276749; font-size: 11px; background: #f0fff4; padding: 1px 7px; border-radius: 8px; border: 1px solid #c6f6d5; white-space: nowrap; }
            .entry-st-done, .st-submitted { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; white-space: nowrap; }
            .entry-st-wait, .st-wait { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fffaf0; color: #c05621; border: 1px solid #feebc8; white-space: nowrap; }
            .entry-st-run { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .st-can-submit { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fefcbf; color: #744210; border: 1px solid #f6e05e; white-space: nowrap; }
            .st-none { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #edf2f7; color: #718096; border: 1px solid #e2e8f0; white-space: nowrap; }
            .vb { padding: 6px 13px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
            .vb-primary { background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .vb-green { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
            .vb-yellow { background: #fefcbf; color: #744210; border: 1px solid #f6e05e; }
            .vb-outline { background: #fff; color: #4a5568; border: 1px solid #cbd5e0; }
            .vb-danger { background: #fff; color: #c53030; border: 1px solid #fed7d7; }
            .vb-mini { padding: 3px 9px; font-size: 11px; }
            .vb:disabled { opacity: 0.45; cursor: not-allowed; }
            .v80-section { flex-shrink: 0; border-top: 1px solid #edf2f7; }
            .v80-sec-hd { padding: 7px 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; background: #f7fafc; }
            .v80-sec-hd .lbl { font-size: 11px; color: #4a5568; font-weight: 600; flex: 1; }
            .v80-sec-hd .arr { font-size: 13px; color: #a0aec0; }
            .v80-sec-body { display: none; }
            .v80-sec-body.open { display: block; }
            #v80-log-content, #v80-storage-pre { max-height: 200px; overflow-y: auto; padding: 4px 0 10px; font-size: 11px; line-height: 1.6; font-family: 'SFMono-Regular', Consolas, monospace; background: #f7fafc; }
            .log-line { padding: 3px 14px; border-bottom: 1px solid rgba(226, 232, 240, 0.4); display: flex; gap: 6px; align-items: flex-start; transition: background 0.1s; }
            .log-line:hover { background: rgba(226, 232, 240, 0.6); }
            .log-ts { color: #a0aec0; user-select: none; flex-shrink: 0; min-width: 54px; }
            .log-lvl { font-weight: 700; flex-shrink: 0; min-width: 32px; text-align: center; border-radius: 3px; font-size: 10px; padding: 0 2px; }
            .log-msg { color: #4a5568; word-break: break-all; flex: 1; }
            .log-debug { background: rgba(159,122,234,0.05); } .log-debug .log-lvl { color: #9f7aea; background: rgba(159,122,234,0.1); }
            .log-info { background: transparent; } .log-info .log-lvl { color: #3182ce; background: rgba(49,130,206,0.1); }
            .log-success { background: rgba(72,187,120,0.05); } .log-success .log-lvl { color: #276749; background: rgba(72,187,120,0.1); }
            .log-warn { background: rgba(237,137,54,0.05); } .log-warn .log-lvl { color: #c05621; background: rgba(237,137,54,0.1); }
            .log-error { background: rgba(245,101,101,0.08); } .log-error .log-lvl { color: #c53030; background: rgba(245,101,101,0.15); }
            .log-level-select { font-size: 11px; padding: 1px 5px; border-radius: 4px; background: #fff; color: #4a5568; border: 1px solid #cbd5e0; cursor: pointer; }
            .minimized { transform: translateY(calc(100% - 44px)); }
            .v80-value-chip { display: inline-block; margin-left: 6px; font-size: 11px; color: #4a5568; }
        `;
        document.head.appendChild(style);
    };

    // ── 面板构建 ──────────────────────────────────────────────────────
    const buildPanel = (titleHtml, actionBarHtml, bodyHtml) => {
        injectCSS();
        const panel = document.createElement('div');
        panel.id = 'v80-panel';
        panel.innerHTML = `
            <div id="v80-header">
                <b>${titleHtml}</b>
                <button id="v80-min-btn" title="最小化">−</button>
            </div>
            <div id="v80-action-bar">${actionBarHtml}</div>
            <div id="v80-body">${bodyHtml}</div>
            <div class="v80-section">
                <div class="v80-sec-hd" id="log-hd">
                    <span class="lbl">📋 运行日志</span>
                    <select id="log-level-sel" class="log-level-select">
                        <option value="debug">DEBUG+</option>
                        <option value="info" selected>INFO+</option>
                        <option value="success">OK+</option>
                        <option value="warn">WARN+</option>
                        <option value="error">ERROR</option>
                    </select>
                    <span class="arr" id="log-arr">▴</span>
                </div>
                <div class="v80-sec-body open" id="v80-log-content"></div>
            </div>
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

        document.getElementById('v80-min-btn').onclick = (e) => { e.stopPropagation(); panel.classList.toggle('minimized'); };
        const logBody = document.getElementById('v80-log-content'), logArr = document.getElementById('log-arr');
        document.getElementById('log-hd').onclick = () => { logBody.classList.toggle('open'); logArr.textContent = logBody.classList.contains('open') ? '▴' : '▾'; };
        document.getElementById('log-level-sel').addEventListener('change', (e) => { e.stopPropagation(); setMinLevel(e.target.value); });
        const storeBody = document.getElementById('store-body'), storeArr = document.getElementById('store-arr');
        document.getElementById('store-hd').onclick = () => { storeBody.classList.toggle('open'); storeArr.textContent = storeBody.classList.contains('open') ? '▴' : '▾'; if (storeBody.classList.contains('open')) renderStoragePanel(); };

        // fix②: 面板拖拽同样改用 getBoundingClientRect，避免 minimized transform 影响坐标
        let drag = false, mouseStartX = 0, mouseStartY = 0, elemStartX = 0, elemStartY = 0;
        document.getElementById('v80-header').onmousedown = (e) => {
            if (e.target.id === 'v80-min-btn') return;
            const rect = panel.getBoundingClientRect();
            elemStartX = rect.left; elemStartY = rect.top;
            mouseStartX = e.clientX; mouseStartY = e.clientY;
            drag = true;
        };
        document.onmousemove = (e) => {
            if (!drag) return;
            panel.style.left  = (elemStartX + e.clientX - mouseStartX) + 'px';
            panel.style.top   = (elemStartY + e.clientY - mouseStartY) + 'px';
            panel.style.right = 'auto';
        };
        document.onmouseup = () => { drag = false; };

        renderLogPanel();
        return panel;
    };

    // ── FIND 页面 ─────────────────────────────────────────────────────
    if (location.href.includes('xspj_find.do')) {
        const scanEntries = () => {
            const anchors = document.querySelectorAll('a[href*="xspj_list.do"]');
            const found = [];
            anchors.forEach(a => {
                const href  = a.getAttribute('href');
                const label = a.textContent.trim() || a.title || href;
                const abs   = href.startsWith('http') ? href : location.origin + href;
                found.push({ label, url: abs });
            });
            return found;
        };

        buildPanel(
            '🎓 自动评教助手 V1',
            `
                <div id="v80-usage" style="font-size:13px;line-height:1.75;padding:14px 16px;border:1px solid #cbd5e0;border-radius:10px;background:#f7fafc;color:#2d3748;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
                    <div style="font-weight:800;margin-bottom:8px;font-size:14px;">新手使用指南</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <div>① 点击下方任一入口，进入该"类别"的课程列表页。</div>
                        <div>② 在课程列表页，勾选要自动处理的课程（默认全部勾选）。</div>
                        <div>③ 点击"开始评价并保存"，系统会依次打开勾选课程的评价页，自动填分并保存。</div>
                        <div>④ 保存后课程显示"待提交"，点击"提交已评课程"可批量提交。</div>
                        <div>⑤ "是否提交=是"的课程视为已完成，不会再进行任何自动操作。</div>
                        <div><span style="flex:1"><button class="vb vb-green">注意：用户必须自行点击"确认"弹窗确认</button></span></div>
                        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e0;display:flex;align-items:center;">
                            <span style="flex:1;color:#4a5568;font-size:12px;">查看更多使用说明请点击>>>>></span>
                            <a href="https://enhance.njust.wiki" target="_blank" class="vb vb-outline vb-mini" style="text-decoration:none;">增强助手官网</a>
                        </div>
                    </div>
                </div>
            `,
            `<div id="entry-list"></div>`
        );
        (function(){const p=document.getElementById('v80-panel');if(p)p.classList.add('wide');const lg=document.getElementById('v80-log-content');const arr=document.getElementById('log-arr');if(lg)lg.classList.remove('open');if(arr)arr.textContent='▾';})();

        const renderEntries = () => {
            const entries = scanEntries(), store = loadStore();
            const curList = localStorage.getItem(KEY_CURLIST) || '';
            const running = localStorage.getItem(KEY_RUNNING) === 'true';
            const box = document.getElementById('entry-list');
            if (!box) return;
            box.innerHTML = '';
            entries.forEach(entry => {
                const pj01    = qp(entry.url, 'pj01id');
                const related = Object.values(store).filter(c => c.url && qp(c.url, 'pj01id') === pj01);
                const doneN   = related.filter(c => c.done).length;
                const totalN  = related.length;
                const isCur   = running && curList && entry.url.includes(qp(curList, 'pj01id'));
                const allDone = totalN > 0 && doneN === totalN;
                const card = document.createElement('div');
                card.className = 'entry-card';
                card.innerHTML = `<span class="entry-label">${esc(entry.label)}</span>` +
                    (totalN ? `<span class="entry-count">${doneN}/${totalN}</span>` : '') +
                    `<span class="${isCur ? 'entry-st-run' : allDone ? 'entry-st-done' : 'entry-st-wait'}">${isCur ? '▶ 运行中' : allDone ? '✓ 已完成' : '等待中'}</span>` +
                    `<button class="vb vb-outline vb-mini" onclick="window.location.href='${esc(entry.url)}'">进入</button>`;
                box.appendChild(card);
            });
        };

        window.addEventListener('storage', () => { renderEntries(); renderLogPanel(); });
        renderEntries();
    }

    // ── LIST 页面 ─────────────────────────────────────────────────────
    if (location.href.includes('xspj_list.do')) {
        buildPanel(
            '🎓 自动评教助手',
            `
                <div id="v80-submit-hint"></div>
                <div class="btn-row">
                    <button id="start-btn" class="vb vb-primary" style="flex:2">开始评价并保存</button>
                    <button id="submit-all-btn" class="vb vb-yellow" style="flex:2" disabled>提交已评课程</button>
                </div>
                <div class="btn-row">
                    <button id="reset-btn" class="vb vb-outline" style="flex:1">重置缓存</button>
                    <button id="clear-log-btn" class="vb vb-danger" style="flex:1">清空日志</button>
                </div>
                <div class="btn-row">
                    <a href="https://enhance.njust.wiki" target="_blank" class="vb vb-outline vb-mini" style="text-decoration:none;flex:1;text-align:center;">🔗 点击前往增强助手官网</a>
                </div>
            `,
            `<div id="course-list"></div>`
        );

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

        const renderList = () => {
            const store = loadStore(), courses = parseRows(), box = document.getElementById('course-list');
            if (!box) return;
            box.innerHTML = '';
            courses.forEach(c => {
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
                    `<button class="vb vb-outline vb-mini" onclick="event.stopPropagation();window.open('${esc(c.rawUrl)}','_blank','width=1200,height=800')">查看</button>`;
                box.appendChild(el);
            });
            document.querySelectorAll('.course-ck').forEach(ck => {
                ck.onchange = (e) => { const k = e.target.getAttribute('data-key'); store[k].auto = e.target.checked; saveStore(store); updateSubmitBtn(); setTimeout(() => renderList(), 0); };
            });
            saveStore(store);
            updateSubmitBtn();
        };

        const execNext = () => {
            if (localStorage.getItem(KEY_RUNNING) !== 'true') return;
            if (localStorage.getItem(KEY_BUSY) === 'true') return;
            const store = loadStore(), curPj01 = qp(location.href, 'pj01id');
            const pending = Object.keys(store).filter(k => { const c = store[k]; return c.auto && !c.done && (!curPj01 || qp(c.url, 'pj01id') === curPj01); });
            if (pending.length > 0) {
                const c = store[pending[0]];
                localStorage.setItem(KEY_BUSY, 'true');
                logInfo(`▶ 正在保存：${c.name}`);
                window.open(withAuto(c.url, 'true'), '_blank', 'width=1200,height=800');
            } else {
                const queue = loadQueue();
                if (queue.length > 0) { const next = queue.shift(); saveQueue(queue); localStorage.setItem(KEY_CURLIST, next); localStorage.setItem(KEY_BUSY, 'false'); setTimeout(() => { location.href = next; }, 800); }
                else { localStorage.setItem(KEY_RUNNING, 'false'); localStorage.setItem(KEY_BUSY, 'false'); logSuccess('🎉 所有类别评价已全部完成！'); renderList(); alert('🎉全部评价已完成！'); }
            }
        };

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

        document.getElementById('start-btn').onclick      = () => { localStorage.setItem(KEY_RUNNING, 'true'); localStorage.setItem(KEY_BUSY, 'false'); renderList(); execNext(); };
        document.getElementById('submit-all-btn').onclick = () => {
            const store = loadStore(), toSubmit = parseRows().filter(c => { const info = store[c.key]; return (c.evaluated || (info && info.done)) && !c.submitted && (info ? info.auto !== false : true); });
            if (toSubmit.length === 0) return;
            if (!confirm(`即将提交以下 ${toSubmit.length} 门课程：\n` + toSubmit.map(c => `· ${c.name}（${c.teacher}）`).join('\n') + '\n\n确认继续？')) return;
            const queue = toSubmit.map(c => withSubmit(c.rawUrl)); saveSubQueue(queue); localStorage.setItem(KEY_SUBRUN, 'true'); localStorage.setItem(KEY_SUBBSY, 'false'); execNextSubmit();
        };
        document.getElementById('reset-btn').onclick      = () => { if (confirm('重置所有缓存？')) { [KEY_STORE, KEY_RUNNING, KEY_BUSY, KEY_QUEUE, KEY_CURLIST, KEY_SUBQUEUE, KEY_SUBRUN, KEY_SUBBSY].forEach(k => localStorage.removeItem(k)); location.reload(); } };
        document.getElementById('clear-log-btn').onclick  = () => clearLogs();

        window.addEventListener('storage', (e) => {
            if ([KEY_STORE, KEY_BUSY, KEY_RUNNING].includes(e.key)) { renderList(); renderLogPanel(); if (e.key === KEY_BUSY && e.newValue === 'false' && localStorage.getItem(KEY_RUNNING) === 'true') setTimeout(execNext, 800); }
            if (e.key === KEY_SUBBSY && e.newValue === 'false' && localStorage.getItem(KEY_SUBRUN) === 'true') setTimeout(execNextSubmit, 800);
        });

        renderList();
        if (localStorage.getItem(KEY_RUNNING) === 'true' && localStorage.getItem(KEY_BUSY) !== 'true') setTimeout(execNext, 1200);
        if (localStorage.getItem(KEY_SUBRUN) === 'true' && localStorage.getItem(KEY_SUBBSY) !== 'true') setTimeout(execNextSubmit, 1200);
    }

    // ── EDIT 页面 ─────────────────────────────────────────────────────
    if (location.href.includes('xspj_edit.do')) {
        const params = new URLSearchParams(location.search);
        const isAutoSave = params.get(PARAM_AUTO) === 'true';
        const isAutoSub  = params.get(PARAM_SUBMIT) === 'true';
        const isManual   = !isAutoSave && !isAutoSub;

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
                    <span style="font-weight:700;font-size:13px;">🎓 评教助手 V1</span>
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
                const manualHint   = document.getElementById('v8-manual-hint');
                const refreshScore = () => {
                    const { gkeys: gk2, groups: gr2 } = collectGroups();
                    const total    = calcCurrentTotal(gk2, gr2);
                    const answered = gk2.filter(k => gr2[k].some(o => o.el.checked)).length;
                    scoreDisplay.textContent = answered === 0 ? '未填写' : `总分 ${total} (${answered}/${gk2.length}题)`;
                    scoreDisplay.style.color = '#276749';
                };
                const strategies = [
                    { id: 'v8-fill-highest', s: 'highest', label: '最高分' },
                    { id: 'v8-fill-high',    s: 'high',    label: '中高分' },
                    { id: 'v8-fill-mid',     s: 'mid',     label: '中分'   },
                    { id: 'v8-fill-low',     s: 'low',     label: '低分'   }
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

        // 自动模式
        injectCSS();
        const bgColor   = isAutoSub ? '#f0fff4' : '#ebf8ff';
        const bdColor   = isAutoSub ? '#9ae6b4' : '#90cdf4';
        const textColor = isAutoSub ? '#276749'  : '#2c5282';
        const modeName  = isAutoSub ? '✅ 提交模式' : '💾 保存模式';

        const bar = document.createElement('div');
        bar.style.cssText = `position:sticky;top:0;left:0;width:100%;z-index:99999;box-sizing:border-box;background:${bgColor};color:${textColor};border-bottom:2px solid ${bdColor};box-shadow:0 2px 8px rgba(0,0,0,0.08);font-family:sans-serif;`;
        bar.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 20px;">
            <span style="font-weight:700;font-size:13px;">🎓 评教助手 V1</span>
            <span style="font-size:11px;padding:2px 10px;border-radius:8px;background:rgba(255,255,255,0.5);border:1px solid ${bdColor};">${modeName}</span>
            <span id="edit-tag" style="font-size:11px;padding:2px 10px;border-radius:8px;background:rgba(0,0,0,0.06);border:1px solid ${bdColor};">初始化...</span>
            <span id="v8-total-display" style="font-size:17px;font-weight:800;color:${textColor};padding:1px 10px;border-radius:6px;border:1px solid ${bdColor};background:#fff;">总分 0</span>
            <button id="stop-btn" style="margin-left:auto;background:#fff;border:1px solid ${bdColor};padding:4px 12px;border-radius:5px;font-weight:700;cursor:pointer;font-size:12px;">停止</button>
        </div>
        <div style="height:1px;background:${bdColor};opacity:0.4;margin:0 20px;"></div>
        <div id="v8-confirm-attn" style="display:flex;align-items:center;gap:6px;padding:5px 20px 8px;font-size:12px;font-weight:500;color:#2c5282;opacity:0.9;">请确认评分无误后，手动点击浏览器弹出的「确认」按钮</div>`;
        document.body.prepend(bar);

        const tag     = document.getElementById('edit-tag');
        const editLog = (msg, level = 'info') => { tag.textContent = msg; pushLog('[edit] ' + msg, level); };
        let stopped = false;
        document.getElementById('stop-btn').onclick = () => { stopped = true; editLog('已停止'); document.getElementById('stop-btn').style.display = 'none'; };

        if (isAutoSub) {
            setTimeout(() => {
                const key = courseKey(location.href), store = loadStore();
                editLog('准备提交...');
                if (stopped) return;
                ensureValueFields();

                const doSubmit = () => {
                    const tj = document.getElementById('tj');
                    if (!tj) { localStorage.setItem(KEY_SUBBSY, 'false'); setTimeout(() => window.close(), 1000); return; }
                    try {
                        unsafeWindow.saveData(tj, '1');
                        if (key && store[key]) { store[key].done = true; saveStore(store); }
                        editLog('已提交！', 'success');
                    } catch (err) {
                        logError(err.message);
                        editLog('提交出错，请手动操作', 'error');
                    }
                    setTimeout(() => { localStorage.setItem(KEY_SUBBSY, 'false'); setTimeout(() => window.close(), 300); }, 800);
                };

                let tries = 0;
                const poll = setInterval(() => {
                    tries++;
                    if (document.getElementById('tj') || tries > 10) { clearInterval(poll); doSubmit(); }
                }, 500);
            }, 800);
        } else {
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
                    const bc = document.getElementById('bc');
                    if (bc) try { unsafeWindow.saveData(bc, '0'); } catch (err) { logError(err.message); }
                    setTimeout(() => { localStorage.setItem(KEY_BUSY, 'false'); setTimeout(() => window.close(), 300); }, 600);
                }, 1000);
            }, 800);
        }
    }
})();