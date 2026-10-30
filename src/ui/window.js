    // ==================== 窗口能力（拖动 / 缩放 / 记忆） ====================
    /**
     * 为元素添加八方向缩放
     * @param {HTMLElement} target 目标窗口
     * @param {Object} [options]
     * @param {number} [options.minWidth]
     * @param {number} [options.minHeight]
     * @param {string[]} [options.edges] 需要启用的方向，默认八向全开
     * @param {Function} [options.onEnd] 缩放结束回调
     */
    function makeResizable(target, options = {}) {
        if (!target) return;

        const minWidth = options.minWidth || 280;
        const minHeight = options.minHeight || 160;
        const edges = options.edges || ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

        // 避免重复挂载
        if (target.querySelector('.nju-resize-layer')) return;

        let active = null;

        const onMove = (e) => {
            if (!active) return;
            const dx = e.clientX - active.startX;
            const dy = e.clientY - active.startY;
            let { left, top, width, height } = active;
            const edge = active.edge;

            if (edge.indexOf('e') !== -1) width = Math.max(minWidth, active.width + dx);
            if (edge.indexOf('s') !== -1) height = Math.max(minHeight, active.height + dy);
            if (edge.indexOf('w') !== -1) {
                width = Math.max(minWidth, active.width - dx);
                left = active.left + (active.width - width);
            }
            if (edge.indexOf('n') !== -1) {
                height = Math.max(minHeight, active.height - dy);
                top = active.top + (active.height - height);
            }

            // 视口边界约束
            const pad = 6;
            if (left < pad) { width += left - pad; left = pad; }
            if (top < pad) { height += top - pad; top = pad; }
            const maxRight = window.innerWidth - pad;
            const maxBottom = window.innerHeight - pad;
            if (left + width > maxRight) width = maxRight - left;
            if (top + height > maxBottom) height = maxBottom - top;

            target.style.left = left + 'px';
            target.style.top = top + 'px';
            target.style.width = Math.max(minWidth, width) + 'px';
            target.style.height = Math.max(minHeight, height) + 'px';
            target.style.right = 'auto';
            target.style.bottom = 'auto';
            target.style.maxWidth = 'none';
            target.style.maxHeight = 'none';
            e.preventDefault();
        };

        const onUp = () => {
            if (!active) return;
            active = null;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            if (options.onEnd) options.onEnd();
        };

        const onDown = (edge) => (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            const rect = target.getBoundingClientRect();
            active = {
                edge,
                startX: e.clientX,
                startY: e.clientY,
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            };
            target.style.transform = 'none';
            target.style.right = 'auto';
            target.style.bottom = 'auto';
            target.style.margin = '0';
            e.preventDefault();
            e.stopPropagation();
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        };

        const layer = document.createElement('div');
        layer.className = 'nju-resize-layer';
        edges.forEach((edge) => {
            const handle = document.createElement('div');
            handle.className = 'nju-resize-handle nju-resize-' + edge;
            handle.addEventListener('pointerdown', onDown(edge));
            layer.appendChild(handle);
        });
        target.appendChild(layer);
    }

    /**
     * 启用完整窗口行为：拖动、八向缩放、视口约束、位置/尺寸记忆、双击标题栏最大化
     * @param {Object} config
     * @param {string} config.id 用于记忆位置与尺寸
     * @param {HTMLElement} config.target 窗口容器
     * @param {HTMLElement} config.handle 拖动句柄（标题栏）
     * @param {number} [config.minWidth]
     * @param {number} [config.minHeight]
     * @param {string[]} [config.edges]
     */
    function enableWindow(config) {
        const { id, target, handle } = config || {};
        if (!target || !handle) return null;

        const minWidth = config.minWidth || 280;
        const minHeight = config.minHeight || 160;
        const storageKey = id ? ('njust_win_' + id) : null;

        // 恢复位置与尺寸
        if (storageKey) {
            try {
                const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
                const inViewport = saved &&
                    saved.left >= 0 && saved.left < window.innerWidth - 60 &&
                    saved.top >= 0 && saved.top < window.innerHeight - 40 &&
                    saved.width >= minWidth && saved.height >= minHeight;
                if (inViewport) {
                    target.style.left = saved.left + 'px';
                    target.style.top = saved.top + 'px';
                    target.style.width = saved.width + 'px';
                    target.style.height = saved.height + 'px';
                    target.style.right = 'auto';
                    target.style.bottom = 'auto';
                }
            } catch (e) { /* 忽略损坏的缓存 */ }
        }

        const persist = () => {
            if (!storageKey) return;
            const rect = target.getBoundingClientRect();
            try {
                localStorage.setItem(storageKey, JSON.stringify({
                    left: Math.round(rect.left),
                    top: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                }));
            } catch (e) { /* 忽略配额错误 */ }
        };

        let pressing = false;
        let dragging = false;
        let justDragged = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        const onMove = (e) => {
            if (!pressing) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // 移动超过阈值才判定为拖动，避免吞掉标题栏上的点击（如折叠）
            if (!dragging && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
            dragging = true;

            const rect = target.getBoundingClientRect();
            const pad = 4;
            const maxLeft = Math.max(pad, window.innerWidth - rect.width - pad);
            const maxTop = Math.max(pad, window.innerHeight - 40);
            const left = Math.min(Math.max(pad, startLeft + dx), maxLeft);
            const top = Math.min(Math.max(pad, startTop + dy), maxTop);
            target.style.left = left + 'px';
            target.style.top = top + 'px';
            e.preventDefault();
        };

        const onUp = () => {
            if (!pressing) return;
            pressing = false;
            if (dragging) {
                justDragged = true;
                setTimeout(() => { justDragged = false; }, 0);
                persist();
            }
            dragging = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };

        const onDown = (e) => {
            // 交互控件不触发拖动
            if (e.target.closest('.nju-close, .nju-window-actions, .nju-resize-handle, select, input, button, a')) return;
            if (e.button !== undefined && e.button !== 0) return;
            const rect = target.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            pressing = true;
            target.style.right = 'auto';
            target.style.bottom = 'auto';
            target.style.margin = '0';
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        };

        // 拖动结束后抑制本次 click，避免误触标题栏的折叠/切换
        handle.addEventListener('click', (e) => {
            if (!justDragged) return;
            e.stopPropagation();
            e.preventDefault();
        }, true);

        handle.addEventListener('pointerdown', onDown);

        // 双击标题栏：最大化 / 还原
        let maximized = false;
        let restoreRect = null;
        handle.addEventListener('dblclick', () => {
            const rect = target.getBoundingClientRect();
            if (!maximized) {
                restoreRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
                target.style.transform = 'none';
                target.style.left = '8px';
                target.style.top = '8px';
                target.style.width = (window.innerWidth - 16) + 'px';
                target.style.height = (window.innerHeight - 16) + 'px';
                maximized = true;
            } else {
                const r = restoreRect || { left: 40, top: 40, width: 480, height: 420 };
                target.style.left = r.left + 'px';
                target.style.top = r.top + 'px';
                target.style.width = r.width + 'px';
                target.style.height = r.height + 'px';
                maximized = false;
            }
            persist();
        });

        makeResizable(target, {
            minWidth,
            minHeight,
            edges: config.edges,
            onEnd: persist
        });

        // 视口尺寸变化时把窗口拉回可见区域
        window.addEventListener('resize', () => {
            const rect = target.getBoundingClientRect();
            if (rect.left > window.innerWidth - 60 || rect.top > window.innerHeight - 40) {
                target.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 80)) + 'px';
                target.style.top = Math.max(4, Math.min(rect.top, window.innerHeight - 60)) + 'px';
            }
        });

        return { persist };
    }

    window.NJUI = window.NJUI || {};
    window.NJUI.makeResizable = makeResizable;
    window.NJUI.enableWindow = enableWindow;
