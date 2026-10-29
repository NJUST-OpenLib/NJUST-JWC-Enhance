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
                    background: var(--nju-bg); border: 1px solid var(--nju-border); border-bottom: none;
                    border-radius: var(--nju-radius-md) var(--nju-radius-md) 0 0; box-shadow: var(--nju-shadow-sm);
                    z-index: var(--nju-z-float); font-family: var(--nju-font-mono);
                    display: flex; flex-direction: column; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                #njust-enhance-log.minimized { transform: translateY(calc(100% - 38px)); }

                /* 标题栏样式 */
                #njust-enhance-log-hd {
                    padding: 10px 15px; background: var(--nju-bg-subtle); border-bottom: 1px solid var(--nju-border);
                    cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                    border-radius: var(--nju-radius-md) var(--nju-radius-md) 0 0; user-select: none; gap: 10px;
                }
                #njust-enhance-log-hd b { font-size: var(--nju-fs-md); color: var(--nju-text); display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
                #nel-status-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; }

                /* 日志列表样式 */
                #njust-enhance-log-body {
                    height: 220px; overflow-y: auto; background: var(--nju-bg); font-size: var(--nju-fs-xs);
                    padding: 4px 0; scroll-behavior: smooth;
                }
                .nel-btn { font-size: var(--nju-fs-xs); color: var(--nju-text-2); background: var(--nju-bg-subtle); padding: 2px 8px; border-radius: var(--nju-radius-sm); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .nel-btn:hover { background: var(--nju-bg-hover); color: var(--nju-text); }
                .nel-clear { background: var(--nju-danger-soft); color: var(--nju-danger); }
                .nel-clear:hover { background: rgba(255, 59, 48, 0.18); color: var(--nju-danger); }

                /* 日志行与分级颜色 */
                .nel-line { padding: 3px 12px; border-bottom: 1px solid var(--nju-border); display: flex; gap: 8px; align-items: flex-start; }
                .nel-line:hover { background: var(--nju-bg-subtle); }
                .nel-ts { color: var(--nju-text-3); flex-shrink: 0; min-width: 55px; user-select: none; }
                .nel-lvl { font-weight: bold; flex-shrink: 0; min-width: 42px; text-align: center; font-size: 10px; }
                .nel-msg { color: var(--nju-text-2); word-break: break-all; flex: 1; line-height: 1.5; }

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
