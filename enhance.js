// ==UserScript==
// @name         南理工教务增强助手 2.0
// @namespace    http://tampermonkey.net/
// @version      2.0
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
// 选修课分类数据源（按优先级排序）
const CATEGORY_URLS = [
    'https://enhance.njust.wiki/data/xxk.json',
    'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json',
    'https://testingcf.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json',
    'https://raw.githubusercontent.com/NJUST-OpenLib/NJUST-JWC-Enhance/refs/heads/main/data/xxk.json'

];

// 课程大纲数据源（按优先级排序）
const OUTLINE_URLS = [
    'https://enhance.njust.wiki/data/kcdg.json',
    'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/kcdg.json',
    'https://testingcf.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/kcdg.json',
    'https://raw.githubusercontent.com/NJUST-OpenLib/NJUST-JWC-Enhance/refs/heads/main/data/kcdg.json'

];

(function () {
    'use strict';

    // ==================== 配置选项 ====================
    // 用户界面配置
    const UI_CONFIG = {
        showNotifications: true  // 是否显示前端提示框 (true=显示，false=隐藏)
                                // 设置为 false 可完全关闭所有状态提示框
                                // 设置为 true 则正常显示加载、成功、错误等提示
    };

    // 调试配置
    const DEBUG_CONFIG = {
        enabled: true,          // 是否启用调试
        level: 4,              // 调试级别: 0=关闭，1=错误，2=警告，3=信息，4=详细
        showCache: true        // 是否显示缓存相关日志
    };

    // 缓存配置
    const CACHE_CONFIG = {
        enabled: true,         // 是否启用缓存
        ttl: 86400,            // 缓存生存时间 (秒)
        prefix: 'njust_jwc_enhance_'  // 缓存键前缀
    };

    // ==================== 调试系统 ====================
    // 日志面板 UI (Module 1)
    const LogPanelUI = {
        container: null,
        body: null,
        initialized: false,
        statusTimer: null,
        queue: [],

        init() {
            if (this.initialized || !document.body) return;
            this.initialized = true;

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

            // 展开/折叠
            this.container.querySelector('#njust-enhance-log-hd').onclick = (e) => {
                if (e.target.id === 'nel-clear-btn') return;
                const isMin = this.container.classList.toggle('minimized');
                this.container.querySelector('#njust-log-toggle').textContent = isMin ? '展开 ▴' : '折叠 ▾';
            };

            // 清空
            this.container.querySelector('#nel-clear-btn').onclick = (e) => {
                e.stopPropagation();
                if (this.body) this.body.innerHTML = '';
                const statusText = this.container.querySelector('#nel-status-text');
                if (statusText) statusText.textContent = '日志已清空';
            };

            // 处理排队消息
            if (this.queue.length > 0) {
                this.queue.forEach(item => this.add(item.level, item.msg));
                this.queue = [];
            }
        },

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
            if (this.body.children.length > 200) this.body.removeChild(this.body.firstChild);
            this.body.scrollTop = this.body.scrollHeight;

            // 更新标题栏状态
            const statusText = this.container.querySelector('#nel-status-text');
            if (statusText) {
                if (this.statusTimer) clearTimeout(this.statusTimer);
                
                statusText.textContent = msg;
                const colors = { error: '#e53e3e', warn: '#dd6b20', success: '#38a169', info: '#3182ce', debug: '#718096' };
                statusText.style.color = colors[level] || '#2d3748';
                
                // 简单的状态闪烁提示
                statusText.style.opacity = '0.5';
                setTimeout(() => statusText.style.opacity = '1', 100);

                // 5秒后恢复默认状态
                this.statusTimer = setTimeout(() => {
                    statusText.textContent = '增强助手加载成功';
                    statusText.style.color = '#2d3748';
                    statusText.style.opacity = '0.7';
                }, 5000);
            }
        },

        esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    };

    const Logger = {
        LEVELS: { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 },

        log(level, message, ...args) {
            if (!DEBUG_CONFIG.enabled || level > DEBUG_CONFIG.level) return;

            const timestamp = new Date().toLocaleTimeString();
            const levelNames = ['', 'error', 'warn', 'info', 'debug'];
            const lvlName = levelNames[level] || 'info';

            const prefix = `[${timestamp}] [南理工教务助手]`;
            console.log(prefix, message, ...args);

            // 格式化附加参数以便在日志面板显示
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

            // 发送到日志面板（面板内部会自动更新标题栏状态）
            LogPanelUI.add(lvlName, displayMessage);
        },

        error(message, ...args) { this.log(this.LEVELS.ERROR, message, ...args); },
        warn(message, ...args) { this.log(this.LEVELS.WARN, message, ...args); },
        info(message, ...args) { this.log(this.LEVELS.INFO, message, ...args); },
        debug(message, ...args) { this.log(this.LEVELS.DEBUG, message, ...args); }
    };

    // ==================== 缓存系统 ====================
    const CacheManager = {
        // 获取缓存键
        getKey(url) {
            return CACHE_CONFIG.prefix + btoa(url).replace(/[^a-zA-Z0-9]/g, '');
        },

        // 设置缓存
        set(url, data) {
            if (!CACHE_CONFIG.enabled) return false;

            try {
                const cacheData = {
                    data: data,
                    timestamp: Date.now(),
                    ttl: CACHE_CONFIG.ttl * 1000,
                    url: url
                };

                const key = this.getKey(url);
                localStorage.setItem(key, JSON.stringify(cacheData));

                if (DEBUG_CONFIG.showCache) {
                    Logger.info(`💾 缓存已保存: ${url}`, {
                        key: key,
                        size: JSON.stringify(cacheData).length + ' bytes',
                        ttl: CACHE_CONFIG.ttl + 's'
                    });
                }

                return true;
            } catch (e) {
                Logger.error('缓存保存失败: ', e);
                return false;
            }
        },

        // 获取缓存
        get(url) {
            if (!CACHE_CONFIG.enabled) return null;

            try {
                const key = this.getKey(url);
                const cached = localStorage.getItem(key);

                if (!cached) {
                    if (DEBUG_CONFIG.showCache) {
                        Logger.debug(`缓存未命中: ${url}`);
                    }
                    return null;
                }

                const cacheData = JSON.parse(cached);
                const now = Date.now();
                const age = (now - cacheData.timestamp) / 1000;
                const remaining = (cacheData.ttl - (now - cacheData.timestamp)) / 1000;

                // 检查是否过期
                if (now - cacheData.timestamp > cacheData.ttl) {
                    localStorage.removeItem(key);
                    if (DEBUG_CONFIG.showCache) {
                        Logger.warn(`⏰ 缓存已过期: ${url}`, {
                            age: age.toFixed(1) + 's',
                            expired: (age - CACHE_CONFIG.ttl).toFixed(1) + 's ago'
                        });
                    }
                    return null;
                }

                if (DEBUG_CONFIG.showCache) {
                    Logger.info(`✅ 缓存命中: ${url}`, {
                        age: age.toFixed(1) + 's',
                        remaining: remaining.toFixed(1) + 's',
                        size: cached.length + ' bytes'
                    });
                }

                return cacheData.data;
            } catch (e) {
                Logger.error('缓存读取失败: ', e);
                return null;
            }
        },

        // 清除所有缓存
        clear() {
            try {
                const keys = Object.keys(localStorage).filter(key =>
                    key.startsWith(CACHE_CONFIG.prefix)
                );

                keys.forEach(key => localStorage.removeItem(key));

                Logger.info(`已清除 ${keys.length} 个缓存项`);
                return keys.length;
            } catch (e) {
                Logger.error('清除缓存失败: ', e);
                return 0;
            }
        },

        // 获取缓存统计信息
        getStats() {
            try {
                const keys = Object.keys(localStorage).filter(key =>
                    key.startsWith(CACHE_CONFIG.prefix)
                );

                let totalSize = 0;
                let validCount = 0;
                let expiredCount = 0;
                const now = Date.now();

                keys.forEach(key => {
                    try {
                        const cached = localStorage.getItem(key);
                        totalSize += cached.length;

                        const cacheData = JSON.parse(cached);
                        if (now - cacheData.timestamp > cacheData.ttl) {
                            expiredCount++;
                        } else {
                            validCount++;
                        }
                    } catch (e) {
                        expiredCount++;
                    }
                });

                return {
                    total: keys.length,
                    valid: validCount,
                    expired: expiredCount,
                    size: totalSize
                };
            } catch (e) {
                Logger.error('获取缓存统计失败: ', e);
                return { total: 0, valid: 0, expired: 0, size: 0 };
            }
        }
    };

    // ==================== 状态提示框系统 ====================
    const StatusNotifier = {
        container: null,
        messageQueue: [],
        messageId: 0,

        // 初始化状态提示框容器
        init() {
            if (!STATUS_CONFIG.enabled || this.container) return;

            // 确保 DOM 已准备好
            if (!document.body) {
                setTimeout(() => this.init(), 50);
                return;
            }

            try {
                this.container = document.createElement('div');
                this.container.id = 'njustStatusNotifier';

                // 根据配置设置位置
                const positions = {
                    'top-left': { top: '20px', left: '20px', flexDirection: 'column' },
                    'top-right': { top: '20px', right: '20px', flexDirection: 'column' },
                    'bottom-left': { bottom: '20px', left: '20px', flexDirection: 'column-reverse' },
                    'bottom-right': { bottom: '20px', right: '20px', flexDirection: 'column-reverse' }
                };

                const pos = positions[STATUS_CONFIG.position] || positions['top-right'];

                this.container.style.cssText = `
                    position: fixed;
                    ${Object.entries(pos).filter(([k]) => k !== 'flexDirection').map(([k, v]) => `${k}: ${v}`).join('; ')};
                    display: flex;
                    flex-direction: ${pos.flexDirection};
                    gap: 8px;
                    z-index: 9999;
                    pointer-events: none;
                    max-width: 350px;
                `;

                document.body.appendChild(this.container);
            } catch (e) {
                console.error('StatusNotifier 初始化失败: ', e);
                this.container = null;
            }
        },

        // 显示状态消息
        show(message, type = 'info', duration = null) {
            if (!STATUS_CONFIG.enabled || !UI_CONFIG.showNotifications) return;

            try {
                this.init();

                // 确保容器已创建
                if (!this.container) {
                    console.warn('StatusNotifier 容器未创建，跳过消息显示');
                    return;
                }

                // 如果是 loading 类型的消息，先隐藏之前的 loading 消息
                if (type === 'loading') {
                    const existingLoadingMessages = this.messageQueue.filter(m => m.type === 'loading');
                    existingLoadingMessages.forEach(m => this.hideMessage(m.id));
                }

                const messageElement = this.createMessageElement(message, type);
                const messageData = {
                    id: ++this.messageId,
                    element: messageElement,
                    type: type,
                    timestamp: Date.now()
                };

                this.messageQueue.push(messageData);
                this.container.appendChild(messageElement);

                // 限制同时显示的消息数量
                this.limitMessages();

                // 显示动画
                requestAnimationFrame(() => {
                    if (messageElement.parentNode) {
                        messageElement.style.opacity = '1';
                        messageElement.style.transform = 'translateX(0) scale(1)';
                    }
                });

                // 自动隐藏逻辑
                if (STATUS_CONFIG.autoHide && type !== 'loading') {
                    const hideTime = duration || this.getHideDelay(type);
                    setTimeout(() => this.hideMessage(messageData.id), hideTime);
                }
            } catch (e) {
                console.error('StatusNotifier 显示消息失败: ', e);
            }
        },

        // 创建消息元素
        createMessageElement(message, type) {
            const icons = {
                info: 'ℹ️',
                success: '✅',
                warning: '⚠️',
                error: '❌',
                loading: '🔄'
            };

            const colors = {
                info: { bg: 'rgba(49, 130, 206, 0.9)', border: '#3182ce', shadow: 'rgba(49, 130, 206, 0.3)' },
                success: { bg: 'rgba(56, 161, 105, 0.9)', border: '#38a169', shadow: 'rgba(56, 161, 105, 0.3)' },
                warning: { bg: 'rgba(221, 107, 32, 0.9)', border: '#dd6b20', shadow: 'rgba(221, 107, 32, 0.3)' },
                error: { bg: 'rgba(229, 62, 62, 0.9)', border: '#e53e3e', shadow: 'rgba(229, 62, 62, 0.3)' },
                loading: { bg: 'rgba(113, 128, 150, 0.9)', border: '#718096', shadow: 'rgba(113, 128, 150, 0.3)' }
            };

            const typeStyle = colors[type] || colors.info;

            const messageElement = document.createElement('div');
            messageElement.style.cssText = `
                background: ${typeStyle.bg};
                color: white;
                padding: 12px 18px;
                border-radius: 10px;
                border-left: 4px solid ${typeStyle.border};
                box-shadow: 0 4px 12px ${typeStyle.shadow};
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 14px;
                font-weight: 500;
                opacity: 0;
                transform: translateX(${STATUS_CONFIG.position.includes('right') ? '30px' : '-30px'}) scale(0.95);
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                pointer-events: auto;
                line-height: 1.5;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 2px;
            `;

            messageElement.innerHTML = `
                <span style="font-size: 18px; line-height: 1;">${icons[type] || icons.info}</span>
                <span style="flex: 1;">${message}</span>
            `;

            // 点击关闭功能
            messageElement.addEventListener('click', () => {
                const messageData = this.messageQueue.find(m => m.element === messageElement);
                if (messageData) {
                    this.hideMessage(messageData.id);
                }
            });

            return messageElement;
        },

        // 获取不同类型消息的隐藏延迟
        getHideDelay(type) {
            const delays = {
                info: STATUS_CONFIG.infoDelay || 2000,     // info 消息显示更久
                success: STATUS_CONFIG.hideDelay || 2000,
                warning: STATUS_CONFIG.hideDelay || 2000,
                error: STATUS_CONFIG.hideDelay || 2000,
                loading: STATUS_CONFIG.hideDelay || 2000 // loading 消息不自动隐藏
            };
            return delays[type] || STATUS_CONFIG.hideDelay;
        },

        // 隐藏指定消息
        hideMessage(messageId) {
            const messageIndex = this.messageQueue.findIndex(m => m.id === messageId);
            if (messageIndex === -1) return;

            const messageData = this.messageQueue[messageIndex];
            const element = messageData.element;

            // 立即从队列中移除，避免 limitMessages 中的循环问题
            this.messageQueue.splice(messageIndex, 1);

            // 隐藏动画
            element.style.opacity = '0';
            element.style.transform = `translateX(${STATUS_CONFIG.position.includes('right') ? '30px' : '-30px'}) scale(0.9)`;

            // 延迟移除 DOM 元素
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 300);
        },

        // 限制同时显示的消息数量
        limitMessages() {
            // 避免无限循环: 只移除超出数量的消息，不使用 while 循环
            if (this.messageQueue.length > STATUS_CONFIG.maxMessages) {
                const excessCount = this.messageQueue.length - STATUS_CONFIG.maxMessages;
                // 移除最旧的消息
                for (let i = 0; i < excessCount; i++) {
                    if (this.messageQueue.length > 0) {
                        const oldestMessage = this.messageQueue[0];
                        this.hideMessage(oldestMessage.id);
                    }
                }
            }
        },

        // 隐藏所有消息
        hide() {
            this.messageQueue.forEach(messageData => {
                this.hideMessage(messageData.id);
            });
        },

        // 移除状态提示框
        remove() {
            if (this.container) {
                this.container.remove();
                this.container = null;
                this.messageQueue = [];
            }
        }
    };

    // 状态提示框配置
    const STATUS_CONFIG = {
        enabled: true,         // 是否显示状态提示
        autoHide: true,       // 是否自动隐藏
        hideDelay: 2000,      // 默认自动隐藏延迟 (毫秒)
        infoDelay: 2000,      // info 类型消息显示时间 (毫秒)
        maxMessages: 5,       // 同时显示的最大消息数量
        position: 'top-right' // 位置: top-left, top-right, bottom-left, bottom-right
    };

    // 延迟初始化日志，避免在 DOM 未完全加载时出现问题
    function initializeLogging() {
        // 确保 DOM 已加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeLogging);
            return;
        }

        // 延迟执行，避免与页面初始化冲突
        setTimeout(() => {
            try {
                Logger.info('南理工教务增强助手已启动', {
                    debug: DEBUG_CONFIG.enabled ? `Level ${DEBUG_CONFIG.level}` : '关闭',
                    cache: CACHE_CONFIG.enabled ? `TTL ${CACHE_CONFIG.ttl}s` : '关闭'
                });

                // 显示缓存统计
                if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.showCache) {
                    const stats = CacheManager.getStats();
                    Logger.info('缓存统计:', {
                        总数: stats.total,
                        有效: stats.valid,
                        过期: stats.expired,
                        大小: (stats.size / 1024).toFixed(1) + 'KB'
                    });
                }
            } catch (e) {
                console.error('初始化日志失败: ', e);
            }
        }, 100);
    }

    // 调用初始化
    initializeLogging();

    let courseCategoryMap = {};
    let courseOutlineMap = {};

    // 统一弹窗样式函数
    function createUnifiedModal(title, content, type = 'info') {
        // 移除可能存在的旧弹窗
        const existingModal = document.getElementById('njustAssistantModal');
        if (existingModal) {
            existingModal.remove();
        }

        const container = document.createElement('div');
        container.id = 'njustAssistantModal';

        // 根据类型设置不同的渐变色
        let gradientColor;
        switch (type) {
            case 'warning':
                gradientColor = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
                break;
            case 'success':
                gradientColor = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                break;
            case 'info':
            default:
                gradientColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                break;
        }

        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${gradientColor};
            border: none;
            border-radius: 15px;
            padding: 0;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 200px;
            max-width: 500px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            animation: fadeIn 0.3s ease-out;
        `;

        container.innerHTML = `
            <div id="dragHandle" style="
                background: rgba(255,255,255,0.1);
                padding: 15px 20px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.2);
            ">
                <div style="color: white; font-weight: bold; font-size: 18px;">
                    🎓 ${title}
                </div>
                <span style="
                    cursor: pointer;
                    color: rgba(255,255,255,0.8);
                    font-size: 18px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                "
                onclick="this.closest('div').parentElement.remove()"
                onmouseover="this.style.backgroundColor='rgba(255,255,255,0.2)'"
                onmouseout="this.style.backgroundColor='transparent'">✕</span>
            </div>
            <div style="
                background: white;
                padding: 25px;
            ">
                ${content}
                <div style="
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                    line-height: 1.4;
                    text-align: center;
                ">
                    <div style="margin-bottom: 8px;">
                        <strong>请查看
                        <a href="https://enhance.njust.wiki" target="_blank" style="color: #007bff; text-decoration: none;">官方网站</a>
                      以获取使用说明</strong>
                        </div>
                    <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 5px;">⚠️ 免责声明</div>
                    <div>本工具仅为学习交流使用，数据仅供参考。</div>
                   <div>请以教务处官网信息为准，使用本工具产生的任何后果均由用户自行承担。</div>
                </div>
            </div>
        `;

        // 添加 CSS 动画
        if (!document.getElementById('njustAssistantStyles')) {
            const style = document.createElement('style');
            style.id = 'njustAssistantStyles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        // 添加拖动功能
        addDragFunctionality(container);

        document.body.appendChild(container);
        return container;
    }

    // 拖动功能
    function addDragFunctionality(container) {
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        const dragHandle = container.querySelector('#dragHandle');

        function dragStart(e) {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            if (e.target === dragHandle || dragHandle.contains(e.target)) {
                isDragging = true;
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                xOffset = currentX;
                yOffset = currentY;
                container.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }

        dragHandle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        dragHandle.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd, { passive: false });
    }

    // 检测强智科技页面
    function checkQiangzhiPage() {
        try {
            const currentUrl = window.location.href;
            const pageTitle = document.title || '';

            Logger.debug('检测页面类型', {
                URL: currentUrl,
                标题: pageTitle
            });

            // 检测是否为强智科技页面且无法登录
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
                                display: inline-block;
                                background: #28a745;
                                color: white;
                                padding: 12px 20px;
                                text-decoration: none;
                                border-radius: 8px;
                                margin: 5px;
                                font-weight: bold;
                                transition: background-color 0.2s;
                            " onmouseover="this.style.backgroundColor='#218838'" onmouseout="this.style.backgroundColor='#28a745'">
                                🏫 智慧理工登录页面
                            </a>
                        </div>
                        <div style="margin: 10px 0;">
                            <a href="http://202.119.81.113:8080/" target="_blank" style="
                                display: inline-block;
                                background: #007bff;
                                color: white;
                                padding: 12px 20px;
                                text-decoration: none;
                                border-radius: 8px;
                                margin: 5px;
                                font-weight: bold;
                                transition: background-color 0.2s;
                            " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">
                                🔗 教务处登录页面
                            </a>
                        </div>
                    </div>
                    <div style="
                        margin-top: 15px;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 6px;
                        font-size: 14px;
                        color: #666;
                        text-align: center;
                    ">
                        💡 提示:<br>
                        强智科技教务系统概念版是无法登陆的。<br>
                        请使用上述链接跳转到正确的登录页面，<br>
                        登录后可正常使用教务系统功能<br>
                        验证码区分大小写，大部分情况下均为小写
                    </div>
                `;

                try {
                    createUnifiedModal('南理工教务增强助手', content, 'warning');
                } catch (e) {
                    Logger.error('创建强智科技页面提示弹窗失败:', e);
                }
                return true;
            }
            return false;
        } catch (e) {
            Logger.error('检测强智科技页面失败:', e);
            return false;
        }
    }

    function loadJSONWithFallback(urls) {
        return new Promise((resolve, reject) => {
            // 确保urls是数组
            const urlArray = Array.isArray(urls) ? urls : [urls];

            // 获取数据类型名称用于日志显示
            const fileName = urlArray[0].includes('xxk') ? '选修课分类' : '课程大纲';

            Logger.info(`开始智能数据源切换: ${fileName}`, {
                数据源数量: urlArray.length,
                数据源列表: urlArray
            });

            let currentIndex = 0;

            function tryNextUrl() {
                if (currentIndex >= urlArray.length) {
                Logger.error(`所有数据源都不可用: ${fileName}`);
                    Logger.error(`${fileName}数据加载失败，所有数据源都不可用`);
                    reject(new Error(`所有数据源都不可用: ${fileName}`));
                    return;
                }

                const currentUrl = urlArray[currentIndex];
                currentIndex++;

                Logger.info(`尝试数据源 ${currentIndex}/${urlArray.length}: ${currentUrl}`);

                // 尝试从缓存获取数据（只尝试第一个URL的缓存）
                if (currentIndex === 1) {
                    const cachedData = CacheManager.get(currentUrl);
                    if (cachedData) {
                        Logger.debug(`使用缓存数据: ${currentUrl}`);
                        Logger.info(`从缓存读取${fileName}数据成功`);
                        resolve(cachedData);
                        return;
                    }
                }

                // 发起网络请求
                const startTime = Date.now();

                GM_xmlhttpRequest({
                    method: "GET",
                    url: currentUrl,
                    timeout: 10000, // 10秒超时
                    onload: function (response) {
                        const loadTime = Date.now() - startTime;

                        try {
                            const json = JSON.parse(response.responseText);

                            // 保存到缓存（只缓存第一个成功请求的URL）
                            if (currentIndex === 1) {
                                const cached = CacheManager.set(currentUrl, json);
                                Logger.info(`✅ 请求成功: ${currentUrl}`, {
                                    耗时: loadTime + 'ms',
                                    大小: response.responseText.length + ' bytes',
                                    缓存: cached ? '已保存' : '保存失败'
                                });
                            } else {
                                Logger.info(`✅ 备用数据源请求成功: ${currentUrl}`, {
                                    耗时: loadTime + 'ms',
                                    大小: response.responseText.length + ' bytes',
                                    备用序号: currentIndex
                                });
                            }

                            // 显示成功状态
                            if (currentIndex > 1) {
                                Logger.info(`从备用数据源${currentIndex-1}加载${fileName}成功 (${loadTime}ms)`);
                            } else {
                                Logger.info(`从远程加载${fileName}成功 (${loadTime}ms)`);
                            }

                            resolve(json);
                        } catch (e) {
                            Logger.error(`JSON 解析失败: ${currentUrl}`, e);
                            // 继续尝试下一个URL
                            tryNextUrl();
                        }
                    },
                    onerror: function (err) {
                        const loadTime = Date.now() - startTime;
                        Logger.warn(`⚠️ 数据源 ${currentIndex} 请求失败: ${currentUrl}`, {
                            耗时: loadTime + 'ms',
                            错误: err,
                            将尝试: currentIndex < urlArray.length ? '下一个数据源' : '无更多数据源'
                        });

                        // 继续尝试下一个URL
                        tryNextUrl();
                    },
                    ontimeout: function() {
                        Logger.warn(`数据源 ${currentIndex} 请求超时: ${currentUrl}`);
                        // 继续尝试下一个URL
                        tryNextUrl();
                    }
                });
            }

            // 开始尝试第一个URL
            tryNextUrl();
        });
    }

    function loadJSON(url) {
        // 兼容原有的单URL调用方式
        if (typeof url === 'string') {
            return loadJSONWithFallback([url]);
        }
        // 新的多数据源调用方式
        return loadJSONWithFallback(url);
    }

    function buildCourseMaps(categoryList, outlineList) {
        try {
            Logger.debug('开始构建课程映射表');

            let categoryCount = 0;
            let outlineCount = 0;

            // 安全处理分类数据
            if (Array.isArray(categoryList)) {
                categoryList.forEach(item => {
                    try {
                        if (item && item.course_code && item.category) {
                            courseCategoryMap[item.course_code.trim()] = item.category;
                            categoryCount++;
                        }
                    } catch (e) {
                        Logger.warn('处理分类数据项时出错:', e, item);
                    }
                });
            } else {
                Logger.warn('分类数据不是数组格式:', typeof categoryList);
            }

            // 安全处理大纲数据
            if (Array.isArray(outlineList)) {
                outlineList.forEach(item => {
                    try {
                        if (item && item.course_code && item.id) {
                            courseOutlineMap[item.course_code.trim()] = item.id;
                            outlineCount++;
                        }
                    } catch (e) {
                        Logger.warn('⚠️ 处理大纲数据项时出错:', e, item);
                    }
                });
            } else {
                Logger.warn('⚠️ 大纲数据不是数组格式:', typeof outlineList);
            }

            Logger.info('课程映射表构建完成', {
                选修课类别: categoryCount + '条',
                课程大纲: outlineCount + '条',
                总数据: (categoryCount + outlineCount) + '条'
            });
        } catch (e) {
            Logger.error('构建课程映射表失败:', e);
            // 确保映射表至少是空对象，避免后续访问出错
            if (typeof courseCategoryMap !== 'object') courseCategoryMap = {};
            if (typeof courseOutlineMap !== 'object') courseOutlineMap = {};
        }
    }

    function createCreditSummaryWindow() {
        try {
            // 使用统一的弹窗样式，但保持原有的固定位置和拖动功能
            const container = document.createElement('div');
            container.id = 'creditSummaryWindow';
            container.style.cssText = `
                position: fixed;
                top: 40px;
                right: 40px;
                background: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 14px;
                padding: 0;
                box-shadow: 0 8px 32px rgba(0,0,0,0.13);
                z-index: 9999;
                min-width: 420px;
                max-width: 520px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
            `;

            container.innerHTML = `
                <div id="creditDragHandle" style="
                    background: #f5f6fa;
                    padding: 14px 22px;
                    cursor: move;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #e0e0e0;
                ">
                    <div style="color: #333; font-weight: 600; font-size: 17px; letter-spacing: 1px;">
                        🎓 南理工教务增强助手
                    </div>
                    <span style="
                        cursor: pointer;
                        color: #888;
                        font-size: 18px;
                        padding: 2px 8px;
                        border-radius: 4px;
                        transition: background-color 0.2s;
                    "
                    onclick="this.closest('div').parentElement.remove()"
                    onmouseover="this.style.backgroundColor='#e0e0e0'"
                    onmouseout="this.style.backgroundColor='transparent'">✕</span>
                </div>
                <div style="
                    background: #fff;
                    padding: 18px 22px 10px 22px;
                    max-height: 540px;
                    overflow-y: auto;
                ">
                    <div id="creditSummary"></div>
                    <div style="
                        margin-top: 18px;
                        padding-top: 12px;
                        border-top: 1px solid #e0e0e0;
                        font-size: 13px;
                        color: #888;
                        line-height: 1.6;
                        text-align: left;
                    ">

                        <div><li>对照个人培养方案核实具体修课要求</li></div><li>选修课类别统计仅包含已知分类的通识教育选修课</li>
                                <li>课程分类信息可能随时更新，请以教务处最新通知为准</li>

                        <div style="margin-bottom: 8px;">
                            <span>请查看 <a href="https://enhance.njust.wiki" target="_blank" style="color: #007bff; text-decoration: none;">增强助手官网</a> 获取使用说明</span>
                        </div>
                    </div>
                </div>
            `;

            // 添加拖动功能
            let isDragging = false;
            let currentX, currentY, initialX, initialY;
            let xOffset = 0, yOffset = 0;

            const dragHandle = container.querySelector('#creditDragHandle');
            if (!dragHandle) {
                Logger.warn('未找到拖拽句柄元素');
                document.body.appendChild(container);
                return container;
            }

            function dragStart(e) {
                try {
                    if (e.type === "touchstart") {
                        initialX = e.touches[0].clientX - xOffset;
                        initialY = e.touches[0].clientY - yOffset;
                    } else {
                        initialX = e.clientX - xOffset;
                        initialY = e.clientY - yOffset;
                    }
                    if (e.target === dragHandle || dragHandle.contains(e.target)) {
                        isDragging = true;
                    }
                } catch (err) {
                    Logger.error('❌ 拖拽开始失败:', err);
                }
            }

            function dragEnd(e) {
                try {
                    initialX = currentX;
                    initialY = currentY;
                    isDragging = false;
                } catch (err) {
                    Logger.error('❌ 拖拽结束失败:', err);
                }
            }

            function drag(e) {
                try {
                    if (isDragging) {
                        e.preventDefault();
                        if (e.type === "touchmove") {
                            currentX = e.touches[0].clientX - initialX;
                            currentY = e.touches[0].clientY - initialY;
                        } else {
                            currentX = e.clientX - initialX;
                            currentY = e.clientY - initialY;
                        }
                        xOffset = currentX;
                        yOffset = currentY;
                        container.style.transform = `translate(${currentX}px, ${currentY}px)`;
                    }
                } catch (err) {
                    Logger.error('❌ 拖拽移动失败:', err);
                }
            }

            dragHandle.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
            dragHandle.addEventListener('touchstart', dragStart, { passive: false });
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('touchend', dragEnd, { passive: false });

            document.body.appendChild(container);
            Logger.debug('✅ 学分统计弹窗创建完成');
            return container;
        } catch (e) {
            Logger.error('❌ 创建学分统计弹窗失败:', e);
            if (UI_CONFIG.showNotifications) {
                Logger.error('创建学分统计弹窗失败');
            }
            return null;
        }
    }

    function updateCreditSummary() {
        try {
            Logger.debug('开始更新学分统计');
            const creditSummaryDiv = document.getElementById('creditSummary');
            if (!creditSummaryDiv) {
                Logger.warn('⚠️ 未找到学分统计容器');
                return;
            }

            const creditsByType = {}; // 按课程类型（通识教育课等）统计
            const creditsByCategory = {}; // 按选修课类别统计
            const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const tds = row.querySelectorAll('td');
                if (tds.length >= 11) {
                    const courseCode = tds[2].textContent.trim();
                    const credit = parseFloat(tds[6].textContent) || 0;
                    const courseType = tds[10].textContent.trim(); // 课程类型（通识教育课等）

                    // 从页面上已显示的类别信息中提取选修课类别
                    const categoryDiv = tds[2].querySelector('[data-category-inserted]');
                    let category = null;
                    if (categoryDiv) {
                        // 直接获取文本内容，因为现在只显示类别名称
                        category = categoryDiv.textContent.trim();
                        // 如果文本为空或者不是有效的类别，则设为 null
                        if (!category || category.length === 0) {
                            category = null;
                        }
                    }

                    // 按课程类型统计
                    if (courseType) {
                        if (!creditsByType[courseType]) {
                            creditsByType[courseType] = {
                                credits: 0,
                                count: 0
                            };
                        }
                        creditsByType[courseType].credits += credit;
                        creditsByType[courseType].count += 1;
                    }

                    // 按选修课类别统计
                    if (category) {
                        if (!creditsByCategory[category]) {
                            creditsByCategory[category] = {
                                credits: 0,
                                count: 0
                            };
                        }
                        creditsByCategory[category].credits += credit;
                        creditsByCategory[category].count += 1;
                    }
                }
            });
        });

        // 计算总计
        const totalCreditsByType = Object.values(creditsByType).reduce((sum, data) => sum + data.credits, 0);
        const totalCountByType = Object.values(creditsByType).reduce((sum, data) => sum + data.count, 0);
        const totalCreditsByCategory = Object.values(creditsByCategory).reduce((sum, data) => sum + data.credits, 0);
        const totalCountByCategory = Object.values(creditsByCategory).reduce((sum, data) => sum + data.count, 0);

        Logger.debug('学分统计结果', {
            课程类型数: Object.keys(creditsByType).length,
            选修课类别数: Object.keys(creditsByCategory).length,
            总学分: totalCreditsByType.toFixed(1),
            总课程数: totalCountByType
        });

        // 生成 HTML - 表格样式布局
        let summaryHTML = '<div style="border-bottom: 1px solid #e0e0e0; margin-bottom: 12px; padding-bottom: 10px;">';
        summaryHTML += '<div style="margin-bottom: 8px; font-size: 15px; color: #222; font-weight: 600; letter-spacing: 0.5px;">📊 按课程性质统计</div>';
        // 总计行
        summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center; background: #f7f7fa; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px;">
            <span style="color: #007bff; font-weight: 600; font-size: 13px; text-align: left;">总计</span>
            <span style="font-weight: 600; color: #007bff; font-size: 13px; text-align: left;">${totalCreditsByType.toFixed(1)} 学分</span>
            <span style="color: #007bff; font-weight: 600; font-size: 13px; text-align: left;">${totalCountByType} 门</span>
        </div>`;
        // 课程类型表格
        summaryHTML += '<div style="display: grid; gap: 2px;">';
        for (const [type, data] of Object.entries(creditsByType)) {
            summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                <span style="color: #444; font-weight: 400; font-size: 13px; text-align: left;">${type}</span>
                <span style="font-weight: 400; color: #333; font-size: 13px; text-align: left;">${data.credits.toFixed(1)} 学分</span>
                <span style="color: #888; font-size: 13px; text-align: left;">${data.count} 门</span>
            </div>`;
        }
        summaryHTML += '</div>';
        summaryHTML += '</div>';

        if (Object.keys(creditsByCategory).length > 0) {
            summaryHTML += '</div><div style="margin-top: 16px;">';
            summaryHTML += '<div style="margin-bottom: 8px; font-size: 15px; color: #222; font-weight: 600; letter-spacing: 0.5px;">🏷️ 按选修课类别统计</div>';
            // 总计行
            summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center; background: #f7f7fa; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px;">
                <span style="color: 007bff; font-weight: 600; font-size: 13px; text-align: left;">总计</span>
                <span style="font-weight: 600; color: #007bff; font-size: 13px; text-align: left;">${totalCreditsByCategory.toFixed(1)} 学分</span>
                <span style="color: #007bff; font-weight: 600; font-size: 13px; text-align: left;">${totalCountByCategory} 门</span>
            </div>`;
            // 选修课类别表格
            summaryHTML += '<div style="display: grid; gap: 2px;">';
            for (const [category, data] of Object.entries(creditsByCategory)) {
                summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                    <span style="color: #444; font-weight: 400; font-size: 13px; text-align: left;">${category}</span>
                    <span style="font-weight: 400; color: #333; font-size: 13px; text-align: left;">${data.credits.toFixed(1)} 学分</span>
                    <span style="color: #888; font-size: 13px; text-align: left;">${data.count} 门</span>
                </div>`;
            }
            summaryHTML += '</div>';
        }
        summaryHTML += '</div>';

            creditSummaryDiv.innerHTML = summaryHTML || '暂无数据';
            Logger.debug('✅ 学分统计更新完成');
        } catch (e) {
            Logger.error('❌ 更新学分统计失败:', e);
            const creditSummaryDiv = document.getElementById('creditSummary');
            if (creditSummaryDiv) {
                creditSummaryDiv.innerHTML = '<div style="color: #dc3545; padding: 10px; text-align: center;">❌ 学分统计更新失败</div>';
            }
        }
    }

    function processAllTables() {
        try {
            Logger.debug('开始处理页面表格');
            const tables = document.querySelectorAll('table');
            const isGradePage = window.location.pathname.includes('/njlgdx/kscj/cjcx_list');
            const isSchedulePage = window.location.pathname.includes('xskb_list.do') &&
                                  document.title.includes('学期理论课表');

            Logger.debug(`📋 找到 ${tables.length} 个表格`, {
                成绩页面: isGradePage,
                课表页面: isSchedulePage
            });

            let processedTables = 0;
            let processedRows = 0;
            let enhancedCourses = 0;

            tables.forEach(table => {
                try {
            // 如果是课表页面，只处理 id="dataList" 的表格
            if (isSchedulePage && table.id !== 'dataList') {
                Logger.debug('⏭️ 跳过非 dataList 表格');
                return;
            }

            const rows = table.querySelectorAll('tr');
            Logger.debug(`处理表格 (${rows.length} 行)`, {
                表格ID: table.id || '无 ID',
                成绩页面: isGradePage,
                课表页面: isSchedulePage
            });

            processedTables++;

                rows.forEach(row => {
                    try {
                        const tds = row.querySelectorAll('td');
                        if (tds.length < 3) return;

                        processedRows++;

                        let courseCodeTd;
                        let courseCode;

                        if (isGradePage) {
                            courseCodeTd = tds[2]; // 成绩页面课程代码在第3列
                            courseCode = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                        } else if (isSchedulePage) {
                            courseCodeTd = tds[1]; // 课表页面课程代码在第2列
                            courseCode = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                        } else {
                            courseCodeTd = tds[1];
                            if (courseCodeTd && courseCodeTd.innerHTML) {
                                const parts = courseCodeTd.innerHTML.split('<br>');
                                if (parts.length === 2) {
                                    courseCode = parts[1].trim();
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                        }

                        if (!courseCode) return;

                        Logger.debug(`处理课程: ${courseCode}`);

                        let courseEnhanced = false;

                        // 插入类别
                        try {
                            if (courseCodeTd && !courseCodeTd.querySelector('[data-category-inserted]')) {
                                const category = courseCategoryMap[courseCode];
                                if (category) {
                                    const catDiv = document.createElement('div');
                                    catDiv.setAttribute('data-category-inserted', '1');
                                    catDiv.style.color = '#28a745';
                                    catDiv.style.fontWeight = 'bold';
                                    catDiv.style.marginTop = '4px';
                                    // 只显示类别名称，不显示前缀
                                    catDiv.textContent = category;
                                    courseCodeTd.appendChild(catDiv);
                                    Logger.debug(`✅ 添加课程类别: ${category}`);
                                    courseEnhanced = true;
                                }
                            }
                        } catch (e) {
                            Logger.warn('⚠️ 添加课程类别时出错:', e, courseCode);
                        }

                        // 插入老师说明（来自 title，仅在非成绩页面和非课表页面）
                        try {
                            if (!isGradePage && !isSchedulePage && courseCodeTd && courseCodeTd.title && !courseCodeTd.querySelector('[data-title-inserted]')) {
                                const titleDiv = document.createElement('div');
                                titleDiv.setAttribute('data-title-inserted', '1');
                                titleDiv.style.color = '#666';
                                titleDiv.style.fontSize = '13px';
                                titleDiv.style.marginTop = '4px';
                                titleDiv.style.fontStyle = 'italic';
                                titleDiv.textContent = `📌 老师说明: ${courseCodeTd.title}`;
                                courseCodeTd.appendChild(titleDiv);
                                Logger.debug('添加老师说明');
                                courseEnhanced = true;
                            }
                        } catch (e) {
                            Logger.warn('⚠️ 添加老师说明时出错:', e, courseCode);
                        }

                        // 插入课程大纲链接
                        try {
                            if (courseCodeTd && !courseCodeTd.querySelector('[data-outline-inserted]')) {
                                const realId = courseOutlineMap[courseCode];
                                const outlineDiv = document.createElement('div');
                                outlineDiv.setAttribute('data-outline-inserted', '1');
                                outlineDiv.style.marginTop = '4px';

                                // 检查当前是否在智慧理工平台
                                const currentUrl = window.location.href;
                                const isSmartCampus = currentUrl.includes('bkjw.njust.edu.cn');

                                if (isSmartCampus) {
                                    // 在智慧理工平台下，显示提示信息
                                    outlineDiv.textContent = '⚠️ 课程大纲功能受限';
                                    outlineDiv.style.color = '#ff9800';
                                    outlineDiv.style.fontWeight = 'bold';
                                    outlineDiv.style.cursor = 'pointer';
                                    outlineDiv.title = '当前使用智慧理工平台，课程大纲功能受限。请访问教务处官网 http://202.119.81.113:8080/ 获取完整功能';

                                    // 添加点击事件，显示详细提示
                                    outlineDiv.addEventListener('click', function() {
                                        if (UI_CONFIG.showNotifications) {
                                            Logger.warn('智慧理工平台限制：课程大纲功能无法使用。请访问教务处官网 http://202.119.81.113:8080/ 获取完整功能');
                                        }
                                    });

                                    Logger.warn('⚠️ 智慧理工平台检测到，课程大纲功能已禁用');
                                    courseEnhanced = true;
                                } else if (realId) {
                                    const link = document.createElement('a');
                                    link.href = `http://202.119.81.112:8080/kcxxAction.do?method=kcdgView&jx02id=${realId}&isentering=0`;
                                    link.textContent = '📘 查看课程大纲';
                                    link.target = '_blank';
                                    link.style.color = '#0077cc';
                                    outlineDiv.appendChild(link);
                                    Logger.debug('添加课程大纲链接');
                                    courseEnhanced = true;
                                } else {
                                    outlineDiv.textContent = '❌ 无大纲信息';
                                    outlineDiv.style.color = 'gray';
                                    Logger.debug(`❌ 无大纲信息`);
                                }
                                courseCodeTd.appendChild(outlineDiv);
                            }
                        } catch (e) {
                            Logger.warn('⚠️ 添加课程大纲链接时出错:', e, courseCode);
                        }

                        if (courseEnhanced) {
                            enhancedCourses++;
                        }
                    } catch (e) {
                        Logger.warn('⚠️ 处理表格行时出错:', e);
                    }
                });
                } catch (e) {
                    Logger.warn('⚠️ 处理表格时出错:', e);
                }
            });

            // 输出处理统计
            Logger.info('表格处理统计', {
                处理表格数: processedTables,
                处理行数: processedRows,
                增强课程数: enhancedCourses
            });

            // 更新学分统计（仅在成绩页面）
            if (isGradePage) {
                Logger.debug('更新学分统计');
                updateCreditSummary();
            }

            Logger.debug('表格处理完成');
        } catch (e) {
            Logger.error('❌ 处理页面表格失败:', e);
            if (UI_CONFIG.showNotifications) {
                Logger.error('页面表格处理失败');
            }
        }
    }

    // 统计追踪请求
    /* function sendTrackingRequest() {
        try {
            // 发送追踪请求，用于统计使用情况
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://manual.njust.wiki/test.html?from=enhancer',
                timeout: 5000,
                onload: function () {
                    // 请求成功，不做任何处理
                },
                onerror: function () {
                    // 请求失败，静默处理
                },
                ontimeout: function () {
                    // 请求超时，静默处理
                }
            });
        } catch (e) {
            // 静默处理任何错误
        }
    } */

    // 检测登录错误页面并自动处理
    function checkLoginErrorAndRefresh() {
        try {
            const pageTitle = document.title || '';
            const pageContent = document.body ? document.body.textContent : '';

            // 检测是否为登录错误页面
            const isLoginError = pageTitle.includes('出错页面') &&
                                (pageContent.includes('您登录后过长时间没有操作') ||
                                 pageContent.includes('您的用户名已经在别处登录') ||
                                 pageContent.includes('请重新输入帐号，密码后，继续操作'));

            if (isLoginError) {
                Logger.warn('⚠️ 检测到登录超时或重复登录错误页面');

                // 显示用户提示
                if (UI_CONFIG.showNotifications) {
                    Logger.warn('检测到登录超时，正在自动刷新登录状态...');
                }

                // 强制刷新登录状态（忽略时间间隔限制）
                performLoginRefresh(true);

                return true;
            }

            return false;
        } catch (e) {
            Logger.error('❌ 检测登录错误页面失败:', e);
            return false;
        }
    }

    // 执行登录状态刷新
    function performLoginRefresh(forceRefresh = false) {
        const currentUrl = window.location.href;

        try {
            // 构建刷新 URL - 从当前 URL 提取基础部分
            let baseUrl;
            if (currentUrl.includes('njlgdx/')) {
                baseUrl = currentUrl.substring(0, currentUrl.indexOf('njlgdx/'));
            } else {
                // 如果当前 URL 不包含 njlgdx，尝试从域名构建
                const urlObj = new URL(currentUrl);
                baseUrl = `${urlObj.protocol}//${urlObj.host}/`;
            }

            const refreshUrl = baseUrl + 'njlgdx/pyfa/kcdgxz';

            Logger.info('准备使用隐藏 iframe 刷新登录状态:', refreshUrl);

            // 创建隐藏的 iframe 来加载刷新页面
            const iframe = document.createElement('iframe');
            iframe.style.cssText = `
                position: absolute;
                left: -9999px;
                top: -9999px;
                width: 1px;
                height: 1px;
                opacity: 0;
                visibility: hidden;
                border: none;
            `;
            iframe.src = refreshUrl;

            // 添加加载完成监听器
            iframe.onload = function() {
                Logger.info('✅ 登录状态刷新请求已完成');

                if (forceRefresh && UI_CONFIG.showNotifications) {
                    Logger.info('登录状态已刷新，请重新尝试操作');
                }

                // 延迟移除 iframe，确保请求完全处理
                setTimeout(() => {
                    if (iframe.parentNode) {
                        iframe.parentNode.removeChild(iframe);
                        Logger.debug('隐藏 iframe 已清理');
                    }
                }, 1000);
            };

            // 添加错误处理
            iframe.onerror = function() {
                Logger.warn('⚠️ 登录状态刷新请求失败');
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }

                if (forceRefresh && UI_CONFIG.showNotifications) {
                    Logger.error('登录状态刷新失败，请手动重新点击选课中心 - 课程总库');
                }
            };

            // 将 iframe 添加到页面
            document.body.appendChild(iframe);

            // 设置超时清理，防止 iframe 长时间存在
            setTimeout(() => {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                    Logger.debug('⏰ 超时清理隐藏 iframe');
                }
            }, 10000); // 10 秒超时

        } catch (e) {
            Logger.error('❌ 自动刷新登录状态失败:', e);
            if (forceRefresh && UI_CONFIG.showNotifications) {
                Logger.error('登录状态刷新失败，请手动重新登录');
            }
        }
    }

    // 自动刷新登录状态功能
    function autoRefreshLoginStatus() {
        try {
            const currentUrl = window.location.href;

            // 检查当前页面 URL 是否包含 njlgdx/framework/main.jsp
            if (currentUrl.includes('njlgdx/framework/main.jsp')) {
                // 防止频繁触发 - 检查上次刷新时间
                const lastRefreshKey = 'njust_last_login_refresh';
                const lastRefreshTime = localStorage.getItem(lastRefreshKey);
                const now = Date.now();
                const refreshInterval = 5 * 60 * 1000; // 5 分钟间隔

                if (lastRefreshTime && (now - parseInt(lastRefreshTime)) < refreshInterval) {
                    Logger.debug('⏭️ 距离上次刷新不足5分钟，跳过本次刷新');
                    return;
                }

                Logger.info('检测到主框架页面，准备刷新登录状态');

                // 记录本次刷新时间
                localStorage.setItem(lastRefreshKey, now.toString());

                // 使用统一的刷新函数
                performLoginRefresh(false);
            }
        } catch (e) {
            Logger.error('❌ 自动刷新登录状态检查失败:', e);
        }
    }

    async function init() {
        try {
            Logger.info('开始执行主要逻辑');
        //    StatusNotifier.show('南理工教务助手正在启动...', 'info');

            // 发送统计追踪请求
           // sendTrackingRequest();

            // 首先检测强智科技页面
            if (checkQiangzhiPage()) {
                Logger.info('强智科技页面检测完成，脚本退出');
                return; // 如果是强智科技页面，显示提示后直接返回
            }

            // 检测智慧理工平台并显示相应提示
            const currentUrl = window.location.href;
            const isSmartCampus = currentUrl.includes('bkjw.njust.edu.cn');

            if (isSmartCampus) {
                Logger.warn('⚠️ 检测到智慧理工平台，课程大纲功能将受限');
                if (UI_CONFIG.showNotifications) {
                    Logger.warn('当前使用智慧理工平台，课程大纲功能受限。建议访问教务处官网 http://202.119.81.113:8080/ 获取完整功能');
                }
            }

            // 检查是否需要自动刷新登录状态
            autoRefreshLoginStatus();

            // 检测登录错误页面并处理
            checkLoginErrorAndRefresh();

            Logger.info('开始加载数据');
         //   StatusNotifier.show('正在加载课程数据...', 'loading');

            const [categoryData, outlineData] = await Promise.all([
                loadJSON(CATEGORY_URLS),
                loadJSON(OUTLINE_URLS)
            ]);

            Logger.info('数据加载完成，开始初始化功能');
          //  StatusNotifier.show('正在解析数据...', 'loading');
            buildCourseMaps(categoryData, outlineData);

            // 如果是成绩页面，创建悬浮窗
            if (window.location.pathname.includes('/njlgdx/kscj/cjcx_list')) {
                Logger.debug('检测到成绩页面，创建学分统计窗口');
                createCreditSummaryWindow();
            }

            Logger.debug('开始处理页面表格');
        //StatusNotifier.show('正在处理页面表格...', 'loading');
        processAllTables();
       // StatusNotifier.show('页面表格处理完成', 'success', 2000);

            Logger.debug('启动页面变化监听器');
            let isProcessing = false; // 防止死循环的标志
            const observer = new MutationObserver((mutations) => {
                try {
                    // 防止死循环：如果正在处理中，跳过
                    if (isProcessing) {
                        return;
                    }

                    // 检查是否有实际的内容变化（排除我们自己添加的元素）
                    const hasRelevantChanges = mutations.some(mutation => {
                        try {
                            // 如果是我们添加的标记元素，忽略
                            if (mutation.type === 'childList') {
                                for (let node of mutation.addedNodes) {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        // 如果是我们添加的标记元素，忽略这个变化
                                        if (node.hasAttribute && (
                                            node.hasAttribute('data-category-inserted') ||
                                            node.hasAttribute('data-title-inserted') ||
                                            node.hasAttribute('data-outline-inserted')
                                        )) {
                                            return false;
                                        }
                                        // 如果是表格相关的重要变化，才处理
                                        if (node.tagName === 'TABLE' || node.tagName === 'TR' || node.tagName === 'TD') {
                                            return true;
                                        }
                                    }
                                }
                            }
                            return false;
                        } catch (e) {
                            Logger.warn('⚠️ 检查页面变化时出错:', e);
                            return false;
                        }
                    });

                    if (hasRelevantChanges && !checkQiangzhiPage()) {
                        Logger.debug('检测到相关页面变化，重新处理表格');
                        isProcessing = true;
                        try {
                      //      StatusNotifier.show('正在更新页面表格...', 'loading');
                            processAllTables();
                       //     StatusNotifier.show('页面表格更新完成', 'success', 1500);
                        } catch (e) {
                            Logger.error('❌ 重新处理表格失败:', e);
                        } finally {
                            // 延迟重置标志，确保 DOM 修改完成
                            setTimeout(() => {
                                isProcessing = false;
                            }, 100);
                        }
                    }
                } catch (e) {
            Logger.error('MutationObserver 回调函数执行失败:', e);
                    // 确保重置处理标志
                    isProcessing = false;
                }
            });

            try {
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (e) {
            Logger.error('启动页面变化监听器失败:', e);
            }

            Logger.info(' 脚本初始化完成');
            Logger.info('南理工教务增强助手加载成功！');

        } catch (err) {
            Logger.error('初始化失败:', err);
            Logger.error('系统初始化失败');
        }
    }

    setTimeout(init, 1000);
})();

// ================================================================
//  【模块二】自动评教助手 V1
//  功能：自动填分、批量提交、分值预览
//  仅在评教相关页面（xspj_*.do）生效
// ================================================================
/**
 * 【自动评教助手 V1.0.0】
 * 作者：Light NJUST.WIKI项目组
 * 功能：
 * 1. 自动填分：根据预设策略（最高、中高、中、低）自动填充单选题。
 * 2. 批量提交：自动处理已保存但未提交的课程。
 * 3. 分值预览：在编辑页面直接查看每个选项对应的真实分值。
 * 4. 状态跟踪：在列表页清晰显示待评价、待提交、已提交状态。
 */

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════
    //  全局常量与本地存储键名
    // ════════════════════════════════════════════════════════════════
    const KEY_STORE    = 'njust_eval_v1_store';    // 存储课程评价状态
    const KEY_RUNNING  = 'njust_eval_running';     // 保存流水线运行标志
    const KEY_BUSY     = 'njust_eval_busy';        // 窗口忙碌锁（防止重复打开）
    const KEY_QUEUE    = 'njust_eval_queue';       // 待处理的类别队列
    const KEY_CURLIST  = 'njust_eval_curlist';     // 当前正在处理的类别URL
    const KEY_LOG      = 'njust_eval_log';         // 运行日志存储
    const KEY_LOGLVL   = 'njust_eval_loglvl';      // 日志过滤等级
    const KEY_SUBQUEUE = 'njust_eval_subqueue';    // 提交流水线队列
    const KEY_SUBRUN   = 'njust_eval_subrun';      // 提交流水线运行标志
    const KEY_SUBBSY   = 'njust_eval_subbsy';      // 提交窗口忙碌锁

    // ── edit.do URL 参数定义 ──────────────────────────────────────────
    const PARAM_AUTO   = 'isAutoEval';             // 自动保存参数
    const PARAM_SUBMIT = 'isAutoSubmit';           // 自动提交参数

    const MAX_LOG = 300;                           // 最大日志保留条数

    // ════════════════════════════════════════════════════════════════
    //  日志系统：用于记录脚本运行状态
    // ════════════════════════════════════════════════════════════════
    const LOG_LEVELS = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
    const LOG_LABELS = { debug: 'DBG', info: 'INF', success: 'OK ', warn: 'WRN', error: 'ERR' };
    const LOG_ICONS  = { debug: '🔍', info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
    const LOG_COLORS = { debug: '#9f7aea', info: '#3182ce', success: '#276749', warn: '#c05621', error: '#c53030' };

    const loadLogs    = () => JSON.parse(localStorage.getItem(KEY_LOG) || '[]');
    const clearLogs   = () => { localStorage.removeItem(KEY_LOG); renderLogPanel(); };
    const getMinLevel = () => { const s = localStorage.getItem(KEY_LOGLVL); return (s && LOG_LEVELS[s] !== undefined) ? s : 'info'; };
    const setMinLevel = (l) => { localStorage.setItem(KEY_LOGLVL, l); renderLogPanel(); };

    /**
     * 推送日志并持久化
     * @param {string} msg 日志内容
     * @param {string} level 级别 (info/success/warn/error/debug)
     */
    const pushLog = (msg, level = 'info') => {
        const logs = loadLogs();
        logs.push({ ts: new Date().toTimeString().slice(0, 8), msg, level });
        if (logs.length > MAX_LOG) logs.splice(0, logs.length - MAX_LOG);
        localStorage.setItem(KEY_LOG, JSON.stringify(logs));
        renderLogPanel();
    };
    const logDebug   = (m) => pushLog(m, 'debug');
    const logInfo    = (m) => pushLog(m, 'info');
    const logSuccess = (m) => pushLog(m, 'success');
    const logWarn    = (m) => pushLog(m, 'warn');
    const logError   = (m) => pushLog(m, 'error');

    /**
     * 渲染主面板中的日志内容
     */
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

    // ════════════════════════════════════════════════════════════════
    //  通用工具函数
    // ════════════════════════════════════════════════════════════════
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    /**
     * 解析 URL 中的查询参数
     */
    const qp = (url, key) => {
        try { return new URL(url, location.origin).searchParams.get(key) || ''; }
        catch { return url.match(new RegExp(`[?&]${key}=([^&]+)`))?.[1] || ''; }
    };

    /**
     * 生成课程唯一标识符：课程ID + 教师ID
     */
    const courseKey = (url) => {
        const cid = qp(url, 'jx02id'), tid = qp(url, 'jg0101id');
        return cid && tid ? `${cid}__${tid}` : null;
    };

    const appendParam = (url, key, val) => url + (url.includes('?') ? '&' : '?') + key + '=' + val;
    const withAuto    = (url, val) => appendParam(url, PARAM_AUTO, val);
    const withSubmit  = (url)      => appendParam(url, PARAM_SUBMIT, 'true');

    const roundFloat = (n) => Math.round(n * 1e9) / 1e9;

    // 存储管理
    const loadStore = () => JSON.parse(localStorage.getItem(KEY_STORE) || '{}');
    const saveStore = (v) => localStorage.setItem(KEY_STORE, JSON.stringify(v));

    const loadQueue    = () => JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
    const saveQueue    = (q) => localStorage.setItem(KEY_QUEUE, JSON.stringify(q));
    const loadSubQueue = () => JSON.parse(localStorage.getItem(KEY_SUBQUEUE) || '[]');
    const saveSubQueue = (q) => localStorage.setItem(KEY_SUBQUEUE, JSON.stringify(q));

    const renderStoragePanel = () => {
        const el = document.getElementById('v80-storage-pre');
        if (el) el.textContent = JSON.stringify(loadStore(), null, 2);
    };

    // ════════════════════════════════════════════════════════════════
    //  评价页面核心逻辑：解析、标注、填分
    // ════════════════════════════════════════════════════════════════

    /**
     * 收集 edit.do 单选题分组及其对应的分值
     * 返回 { gkeys: string[], groups: { [name]: [{el, score}] } }
     */
    const collectGroups = () => {
        const groups = {};
        document.querySelectorAll('input[type="radio"]').forEach(r => {
            if (!groups[r.name]) groups[r.name] = [];
            const idx  = r.id.split('_')[1];
            // 从对应的隐藏分值 input 中提取分数
            const fzEl = document.getElementsByName(`pj0601fz_${idx}_${r.value}`)[0];
            groups[r.name].push({ el: r, score: fzEl ? parseFloat(fzEl.value) || 0 : 0 });
        });
        const gkeys = Object.keys(groups);
        // 按分值从高到低排序，方便策略选择
        gkeys.forEach(k => groups[k].sort((a, b) => b.score - a.score));
        return { gkeys, groups };
    };

    /**
     * 寻找扰动题：找到两档分差最小的一题，用于在选高分时做微调，避免均为同一项
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
     * 计算当前页面所有已选中题目的总分
     */
    const calcCurrentTotal = (gkeys, groups) => {
        let total = 0;
        gkeys.forEach(k => {
            const chosen = groups[k].find(o => o.el.checked);
            if (chosen) total += chosen.score;
        });
        return roundFloat(total);
    };

    /**
     * 在单选题选项旁注入 [x.x分] 标注
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
     * 执行填分策略
     * @param {string} strategy 策略名称 (highest/high/mid/low)
     */
    const applyStrategy = (strategy, gkeys, groups) => {
        const perturbIdx = findPerturbIdx(gkeys, groups);
        let total = 0;
        gkeys.forEach((k, i) => {
            const opts = groups[k];
            const len  = opts.length;
            let pick;

            if (strategy === 'highest') {
                // 最高分：除扰动题选次高外，其余选最高
                pick = (i === perturbIdx && len >= 2) ? 1 : 0;
            } else if (strategy === 'high') {
                // 中高分：除扰动题选最高外，其余选次高
                if (len < 2)      pick = 0;
                else              pick = (i === perturbIdx) ? 0 : 1;
            } else if (strategy === 'mid') {
                // 中分：选中间档
                const midIdx = Math.floor((len - 1) / 2);
                if (i === perturbIdx && len >= 2) {
                    pick = (midIdx > 0) ? midIdx - 1 : midIdx + 1;
                } else {
                    pick = midIdx;
                }
            } else if (strategy === 'low') {
                // 低分：选最后一档
                pick = (i === perturbIdx && len >= 2) ? len - 2 : len - 1;
            }

            const chosen = opts[Math.min(pick, len - 1)];
            if (chosen) { chosen.el.checked = true; total += chosen.score; }
        });
        return roundFloat(total);
    };

    // ════════════════════════════════════════════════════════════════
    //  界面样式注入
    // ════════════════════════════════════════════════════════════════
    const injectCSS = () => {
        if (document.getElementById('v80-style')) return;
        const style = document.createElement('style');
        style.id = 'v80-style';
        style.textContent = `
            #v80-panel {
                position: fixed; top: 20px; right: 20px; width: 490px;
                background: #fff; border-radius: 10px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.10);
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex; flex-direction: column;
                border: 1px solid #e2e8f0;
                max-height: 90vh; overflow: hidden;
                transition: transform 0.25s ease;
                font-size: 13px; color: #2d3748;
            }
            #v80-panel.wide { width: 640px; }
            #v80-header {
                padding: 11px 14px; background: #f7fafc;
                border-bottom: 1px solid #e2e8f0;
                cursor: move; display: flex; align-items: center;
                gap: 8px; user-select: none; flex-shrink: 0;
            }
            #v80-header b { flex: 1; font-size: 14px; color: #2d3748; }
            #v80-min-btn {
                width: 28px; height: 28px; border-radius: 6px;
                background: #edf2f7; color: #4a5568; border: none;
                font-size: 16px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            #v80-min-btn:hover { background: #e2e8f0; }

            #v80-action-bar { padding: 10px 14px 8px; border-bottom: 1px solid #edf2f7; background: #fff; flex-shrink: 0; }
            #v80-submit-hint { font-size: 11px; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; display: none; line-height: 1.6; }
            #v80-submit-hint.visible { display: block; }
            .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 7px; }
            #v80-body { padding: 10px 14px; overflow-y: auto; flex: 1; }

            /* 卡片样式 */
            .entry-card, .ci { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 7px; border: 1px solid #e2e8f0; margin-bottom: 7px; background: #f7fafc; }
            .ci { padding: 8px 10px; margin-bottom: 6px; border-color: #edf2f7; }
            .entry-label, .ci-name { flex: 1; font-weight: 500; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ci-teacher { color: #718096; white-space: nowrap; }
            .ci-zpf { color: #276749; font-size: 11px; background: #f0fff4; padding: 1px 7px; border-radius: 8px; border: 1px solid #c6f6d5; white-space: nowrap; }

            /* 状态标签配色 */
            .entry-st-done, .st-submitted { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; white-space: nowrap; }
            .entry-st-wait, .st-wait { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fffaf0; color: #c05621; border: 1px solid #feebc8; white-space: nowrap; }
            .entry-st-run { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .st-can-submit { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fefcbf; color: #744210; border: 1px solid #f6e05e; white-space: nowrap; }
            .st-none { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #edf2f7; color: #718096; border: 1px solid #e2e8f0; white-space: nowrap; }

            /* 按钮基础样式 */
            .vb { padding: 6px 13px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
            .vb-primary { background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .vb-green { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
            .vb-yellow { background: #fefcbf; color: #744210; border: 1px solid #f6e05e; }
            .vb-outline { background: #fff; color: #4a5568; border: 1px solid #cbd5e0; }
            .vb-danger { background: #fff; color: #c53030; border: 1px solid #fed7d7; }
            .vb-mini { padding: 3px 9px; font-size: 11px; }
            .vb:disabled { opacity: 0.45; cursor: not-allowed; }

            /* 折叠区样式 */
            .v80-section { flex-shrink: 0; border-top: 1px solid #edf2f7; }
            .v80-sec-hd { padding: 7px 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; background: #f7fafc; }
            .v80-sec-hd .lbl { font-size: 11px; color: #4a5568; font-weight: 600; flex: 1; }
            .v80-sec-hd .arr { font-size: 13px; color: #a0aec0; }
            .v80-sec-body { display: none; }
            .v80-sec-body.open { display: block; }

            /* 日志与存储预览区 */
            #v80-log-content, #v80-storage-pre { max-height: 200px; overflow-y: auto; padding: 4px 0 10px; font-size: 11px; line-height: 1.6; font-family: 'SFMono-Regular', Consolas, monospace; background: #f7fafc; }
            .log-line { padding: 3px 14px; border-bottom: 1px solid rgba(226, 232, 240, 0.4); display: flex; gap: 6px; align-items: flex-start; transition: background 0.1s; }
            .log-line:hover { background: rgba(226, 232, 240, 0.6); }
            .log-ts { color: #a0aec0; user-select: none; flex-shrink: 0; min-width: 54px; }
            .log-lvl { font-weight: 700; flex-shrink: 0; min-width: 32px; text-align: center; border-radius: 3px; font-size: 10px; padding: 0 2px; }
            .log-msg { color: #4a5568; word-break: break-all; flex: 1; }

            .log-debug { background: rgba(159, 122, 234, 0.05); }
            .log-debug .log-lvl { color: #9f7aea; background: rgba(159, 122, 234, 0.1); }
            .log-info { background: transparent; }
            .log-info .log-lvl { color: #3182ce; background: rgba(49, 130, 206, 0.1); }
            .log-success { background: rgba(72, 187, 120, 0.05); }
            .log-success .log-lvl { color: #276749; background: rgba(72, 187, 120, 0.1); }
            .log-warn { background: rgba(237, 137, 54, 0.05); }
            .log-warn .log-lvl { color: #c05621; background: rgba(237, 137, 54, 0.1); }
            .log-error { background: rgba(245, 101, 101, 0.08); }
            .log-error .log-lvl { color: #c53030; background: rgba(245, 101, 101, 0.15); }
            .log-level-select { font-size: 11px; padding: 1px 5px; border-radius: 4px; background: #fff; color: #4a5568; border: 1px solid #cbd5e0; cursor: pointer; }
            .minimized { transform: translateY(calc(100% - 44px)); }

            /* 编辑页分值标注 */
            .v80-value-chip { display: inline-block; margin-left: 6px; font-size: 11px; color: #4a5568; }
        `;
        document.head.appendChild(style);
    };

    /**
     * 构建主控制面板骨架
     */
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

        // 面板交互绑定
        document.getElementById('v80-min-btn').onclick = (e) => { e.stopPropagation(); panel.classList.toggle('minimized'); };
        const logBody = document.getElementById('v80-log-content');
        const logArr  = document.getElementById('log-arr');
        document.getElementById('log-hd').onclick = () => { logBody.classList.toggle('open'); logArr.textContent = logBody.classList.contains('open') ? '▴' : '▾'; };
        document.getElementById('log-level-sel').addEventListener('change', (e) => { e.stopPropagation(); setMinLevel(e.target.value); });
        const storeBody = document.getElementById('store-body');
        const storeArr  = document.getElementById('store-arr');
        document.getElementById('store-hd').onclick = () => { storeBody.classList.toggle('open'); storeArr.textContent = storeBody.classList.contains('open') ? '▴' : '▾'; if (storeBody.classList.contains('open')) renderStoragePanel(); };

        // 拖拽逻辑
        let drag = false, off = [0, 0];
        document.getElementById('v80-header').onmousedown = (e) => { if (e.target.id === 'v80-min-btn') return; drag = true; off = [panel.offsetLeft - e.clientX, panel.offsetTop - e.clientY]; };
        document.onmousemove = (e) => { if (!drag) return; panel.style.left = (e.clientX + off[0]) + 'px'; panel.style.top = (e.clientY + off[1]) + 'px'; panel.style.right = 'auto'; };
        document.onmouseup = () => { drag = false; };

        renderLogPanel();
        return panel;
    };

    // ════════════════════════════════════════════════════════════════
    //  FIND 页面逻辑：入口导航与指南
    // ════════════════════════════════════════════════════════════════
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
                        <div>① 点击下方任一入口，进入该“类别”的课程列表页。</div>
                        <div>② 在课程列表页，勾选要自动处理的课程（默认全部勾选）。</div>
                        <div>③ 点击“开始评价并保存”，系统会依次打开勾选课程的评价页，自动填分并保存。</div>
                        <div>④ 保存后课程显示“待提交”，点击“提交已评课程”可批量提交。</div>
                        <div>⑤ “是否提交=是”的课程视为已完成，不会再进行任何自动操作。</div>
                        <div>  <span style="flex:1"><button class="vb vb-green">注意：用户必须自行点击“确认”弹窗确认</button></span></div>
                        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e0;display:flex;align-items:center;">
                            <span style="flex:1;color:#4a5568;font-size:12px;">查看更多使用说明</span>      
                            <a href="https://enhance.njust.wiki" target="_blank" class="vb vb-outline vb-mini" style="text-decoration:none;">增强助手官网</a>
                        </div>
                    </div>
                </div>
            `,
            `<div id="entry-list"></div>`
        );
        // 该页面自动加宽并折叠日志
        (function(){const p=document.getElementById('v80-panel');if(p)p.classList.add('wide');const lg=document.getElementById('v80-log-content');const arr=document.getElementById('log-arr');if(lg)lg.classList.remove('open');if(arr)arr.textContent='▾';})();

        const renderEntries = () => {
            const entries = scanEntries();
            const store   = loadStore();
            const curList = localStorage.getItem(KEY_CURLIST) || '';
            const running = localStorage.getItem(KEY_RUNNING) === 'true';
            const box     = document.getElementById('entry-list');
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
                    `<span class="${isCur ? 'entry-st-run' : allDone ? 'entry-st-done' : 'entry-st-wait'}">` +
                    `${isCur ? '▶ 运行中' : allDone ? '✓ 已完成' : '等待中'}</span>` +
                    `<button class="vb vb-outline vb-mini" onclick="window.location.href='${esc(entry.url)}'">进入</button>`;
                box.appendChild(card);
            });
        };

        window.addEventListener('storage', () => { renderEntries(); renderLogPanel(); });
        renderEntries();
    }

    // ════════════════════════════════════════════════════════════════
    //  LIST 页面逻辑：课程列表、勾选与流水线启动
    // ════════════════════════════════════════════════════════════════
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
            const rows = document.querySelectorAll('#dataList tr:not(:first-child)');
            const result = [];
            rows.forEach(row => {
                if (row.cells.length < 7) return;
                const a = row.querySelector('a[href*="openWindow"]');
                if (!a) return;
                const rawUrl = a.getAttribute('href').match(/'([^']+)'/)?.[1];
                if (!rawUrl) return;
                result.push({
                    key: courseKey(rawUrl),
                    rawUrl,
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
                btn.disabled = false;
                hint.className = 'visible';
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
                if (c.submitted) {
                    stClass = 'st-submitted';
                    stLabel = '已提交';
                } else if (info.auto !== false) {
                    if (c.evaluated || info.done) {
                        stClass = 'st-can-submit';
                        stLabel = '待提交';
                    } else {
                        stClass = 'st-wait';
                        stLabel = '待评价';
                    }
                } else {
                    stClass = 'st-none';
                    stLabel = '不操作';
                }

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

        // 流水线控制逻辑（保存与提交）
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
                else { localStorage.setItem(KEY_RUNNING, 'false'); localStorage.setItem(KEY_BUSY, 'false'); logSuccess('🎉 所有类别评价已全部完成！🎉'); renderList(); alert('🎉全部评价已完成！🎉'); }
            }
        };

        const execNextSubmit = () => {
            if (localStorage.getItem(KEY_SUBRUN) !== 'true') return;
            if (localStorage.getItem(KEY_SUBBSY) === 'true') return;
            const queue = loadSubQueue();
            if (queue.length === 0) { localStorage.setItem(KEY_SUBRUN, 'false'); localStorage.setItem(KEY_SUBBSY, 'false'); logSuccess('🎉 所有勾选课程提交完毕！'); setTimeout(() => location.reload(), 800); return; }
            const nextUrl = queue.shift(); saveSubQueue(queue); localStorage.setItem(KEY_SUBBSY, 'true');
            const submitStore = loadStore(); const submitKey = courseKey(nextUrl); const submitInfo = submitKey ? submitStore[submitKey] : null;
            logInfo(`▶ 正在提交：${submitInfo ? submitInfo.name + '（' + submitInfo.teacher + '）' : nextUrl}`);
            window.open(nextUrl, '_blank', 'width=1200,height=800');
        };

        // 按钮事件
        document.getElementById('start-btn').onclick = () => { localStorage.setItem(KEY_RUNNING, 'true'); localStorage.setItem(KEY_BUSY, 'false'); renderList(); execNext(); };
        document.getElementById('submit-all-btn').onclick = () => {
            const store = loadStore(), toSubmit = parseRows().filter(c => { const info = store[c.key]; return (c.evaluated || (info && info.done)) && !c.submitted && (info ? info.auto !== false : true); });
            if (toSubmit.length === 0) return;
            if (!confirm(`即将提交以下 ${toSubmit.length} 门课程：\n` + toSubmit.map(c => `· ${c.name}（${c.teacher}）`).join('\n') + '\n\n确认继续？')) return;
            const queue = toSubmit.map(c => withSubmit(c.rawUrl)); saveSubQueue(queue); localStorage.setItem(KEY_SUBRUN, 'true'); localStorage.setItem(KEY_SUBBSY, 'false'); execNextSubmit();
        };
        document.getElementById('reset-btn').onclick = () => { if (confirm('重置所有缓存？')) { [KEY_STORE, KEY_RUNNING, KEY_BUSY, KEY_QUEUE, KEY_CURLIST, KEY_SUBQUEUE, KEY_SUBRUN, KEY_SUBBSY].forEach(k => localStorage.removeItem(k)); location.reload(); } };
        document.getElementById('clear-log-btn').onclick = () => clearLogs();

        window.addEventListener('storage', (e) => {
            if ([KEY_STORE, KEY_BUSY, KEY_RUNNING].includes(e.key)) { renderList(); renderLogPanel(); if (e.key === KEY_BUSY && e.newValue === 'false' && localStorage.getItem(KEY_RUNNING) === 'true') setTimeout(execNext, 800); }
            if (e.key === KEY_SUBBSY && e.newValue === 'false' && localStorage.getItem(KEY_SUBRUN) === 'true') setTimeout(execNextSubmit, 800);
        });

        renderList();
        if (localStorage.getItem(KEY_RUNNING) === 'true' && localStorage.getItem(KEY_BUSY) !== 'true') setTimeout(execNext, 1200);
        if (localStorage.getItem(KEY_SUBRUN) === 'true' && localStorage.getItem(KEY_SUBBSY) !== 'true') setTimeout(execNextSubmit, 1200);
    }

    // ════════════════════════════════════════════════════════════════
    //  EDIT 页面逻辑：自动或手动评价
    // ════════════════════════════════════════════════════════════════
    if (location.href.includes('xspj_edit.do')) {
        const params = new URLSearchParams(location.search), isAutoSave = params.get(PARAM_AUTO) === 'true', isAutoSub = params.get(PARAM_SUBMIT) === 'true', isManual = !isAutoSave && !isAutoSub;

        if (isManual) {
            const initManual = () => {
                injectCSS(); const { gkeys, groups } = collectGroups(); if (gkeys.length === 0) return; ensureValueFields();
                const bar = document.createElement('div');
                bar.id = 'v80-manual-bar';
                bar.style.cssText = 'position:sticky;top:0;left:0;width:100%;z-index:99999;box-sizing:border-box;background:#ebf8ff;border-bottom:2px solid #90cdf4;color:#2c5282;padding:10px 18px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.08);';
                bar.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><span style="font-weight:700;font-size:13px;">🎓 评教助手 V1</span>` +
                    `<span style="font-size:11px;padding:2px 9px;border-radius:7px;background:#edf2f7;color:#718096;border:1px solid #cbd5e0;">手动模式</span>` +
                    `<span style="font-size:12px;color:#4a5568;">快捷填分：</span>` +
                    `<button id="v8-fill-highest" class="vb vb-outline vb-mini">最高分</button><button id="v8-fill-high" class="vb vb-outline vb-mini">中高分</button><button id="v8-fill-mid" class="vb vb-outline vb-mini">中分</button><button id="v8-fill-low" class="vb vb-outline vb-mini">低分</button>` +
                    `<span id="v8-score-display" style="font-size:18px;font-weight:800;color:#2d3748;padding:4px 10px;border-radius:6px;background:#f7fafc;border:1px solid #e2e8f0;margin-left:4px;">未填写</span></div>` +
                    `<div id="v8-manual-hint" style="margin-top:7px;font-size:11px;color:#718096;display:none;">已自动填写，请确认无误后手动点击页面上的「保存」或「提交」按钮。</div>`;
                document.body.prepend(bar);
                const scoreDisplay = document.getElementById('v8-score-display'), manualHint = document.getElementById('v8-manual-hint');
                const refreshScore = () => { const { gkeys: gk2, groups: gr2 } = collectGroups(); const total = calcCurrentTotal(gk2, gr2); const answered = gk2.filter(k => gr2[k].some(o => o.el.checked)).length; scoreDisplay.textContent = answered === 0 ? '未填写' : `总分 ${total} (${answered}/${gk2.length}题)`; scoreDisplay.style.color = '#276749'; };
                const strategies = [{ id: 'v8-fill-highest', s: 'highest', label: '最高分' }, { id: 'v8-fill-high', s: 'high', label: '中高分' }, { id: 'v8-fill-mid', s: 'mid', label: '中分' }, { id: 'v8-fill-low', s: 'low', label: '低分' }];
                strategies.forEach(({ id, s, label }) => { document.getElementById(id).addEventListener('click', () => { const { gkeys: gk2, groups: gr2 } = collectGroups(); const total = applyStrategy(s, gk2, gr2); scoreDisplay.textContent = `当前 ${total} 分（${label}）`; scoreDisplay.style.color = '#276749'; manualHint.style.display = 'block'; }); });
                document.querySelectorAll('input[type="radio"]').forEach(r => r.addEventListener('change', refreshScore));
                refreshScore();
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initManual, 300)); else setTimeout(initManual, 300);
            return;
        }

        // 自动模式 UI 与逻辑
        injectCSS();
        const bgColor = isAutoSub ? '#f0fff4' : '#ebf8ff', bdColor = isAutoSub ? '#9ae6b4' : '#90cdf4', textColor = isAutoSub ? '#276749' : '#2c5282', modeName = isAutoSub ? '✅ 提交模式' : '💾 保存模式';
        const bar = document.createElement('div');
        bar.style.cssText = `position:sticky;top:0;left:0;width:100%;z-index:99999;box-sizing:border-box;background:${bgColor};color:${textColor};border-bottom:2px solid ${bdColor};box-shadow:0 2px 8px rgba(0,0,0,0.08);font-family:sans-serif;`;
        bar.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 20px;"><span style="font-weight:700;font-size:13px;">🎓 评教助手 V1</span>` +
            `<span style="font-size:11px;padding:2px 10px;border-radius:8px;background:rgba(255,255,255,0.5);border:1px solid ${bdColor};">${modeName}</span>` +
            `<span id="edit-tag" style="font-size:11px;padding:2px 10px;border-radius:8px;background:rgba(0,0,0,0.06);border:1px solid ${bdColor};">初始化...</span>` +
            `<span id="v8-total-display" style="font-size:17px;font-weight:800;color:${textColor};padding:1px 10px;border-radius:6px;border:1px solid ${bdColor};background:#fff;">总分 0</span>` +
            `<button id="stop-btn" style="margin-left:auto;background:#fff;border:1px solid ${bdColor};padding:4px 12px;border-radius:5px;font-weight:700;cursor:pointer;font-size:12px;">停止</button></div>` +
            `<div style="height:1px;background:${bdColor};opacity:0.4;margin:0 20px;"></div>` +
            `<div id="v8-confirm-attn" style="display:flex;align-items:center;gap:6px;padding:5px 20px 8px;font-size:12px;font-weight:500;color:#2c5282;opacity:0.9;">请确认评分无误后，手动点击浏览器弹出的「确认」按钮</div>`;
        document.body.prepend(bar);

        const tag = document.getElementById('edit-tag'), editLog = (msg, level = 'info') => { tag.textContent = msg; pushLog('[edit] ' + msg, level); };
        let stopped = false; document.getElementById('stop-btn').onclick = () => { stopped = true; editLog('已停止'); document.getElementById('stop-btn').style.display = 'none'; };

        if (isAutoSub) {
            setTimeout(() => {
                const key = courseKey(location.href), store = loadStore(), info = key ? store[key] : null;
                editLog(`准备提交...`); if (stopped) return; ensureValueFields();
                const doSubmit = () => {
                    const tj = document.getElementById('tj'); if (!tj) { localStorage.setItem(KEY_SUBBSY, 'false'); setTimeout(() => window.close(), 1000); return; }
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
                let tries = 0, poll = setInterval(() => { tries++; if (document.getElementById('tj') || tries > 10) { clearInterval(poll); doSubmit(); } }, 500);
            }, 800);
        } else {
            setTimeout(() => {
                const key = courseKey(location.href), store = loadStore(); const { gkeys, groups } = collectGroups(); ensureValueFields();
                const perturbIdx = findPerturbIdx(gkeys, groups);
                const total = applyStrategy('highest', gkeys, groups);
                document.getElementById('v8-total-display').textContent = `总分 ${total}`;
                if (key && store[key]) { store[key].done = true; saveStore(store); }
                if (stopped) return; editLog('填写完成，即将保存');
                setTimeout(() => {
                    if (stopped) return; const bc = document.getElementById('bc');
                    if (bc) try { unsafeWindow.saveData(bc, '0'); } catch (err) { logError(err.message); }
                    setTimeout(() => { localStorage.setItem(KEY_BUSY, 'false'); setTimeout(() => window.close(), 300); }, 600);
                }, 1000);
            }, 800);
        }
    }
})();