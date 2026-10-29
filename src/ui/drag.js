    // ==================== 拖动功能 ====================
    /**
     * 统一拖拽实现 —— 全脚本唯一的拖拽入口
     *
     * 说明：
     * - 使用 getBoundingClientRect 读取视觉位置，避免折叠/动画 transform 造成的坐标跳变
     * - 同时支持鼠标与触摸事件
     * - 只使用 addEventListener，不会覆盖页面上的其它监听器
     *
     * @param {HTMLElement} handle 拖拽句柄
     * @param {HTMLElement} target 被移动的元素（通常为句柄所属容器）
     * @param {Object} [options]
     * @param {(e: Event) => boolean} [options.shouldIgnore] 返回 true 时忽略本次拖拽
     */
    function makeDraggable(handle, target, options = {}) {
        if (!handle || !target) return;

        let isDragging = false;
        let mouseStartX = 0, mouseStartY = 0, elemStartX = 0, elemStartY = 0;

        const getPoint = (e) =>
            (e.touches && e.touches[0])
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX, y: e.clientY };

        const dragStart = (e) => {
            if (options.shouldIgnore && options.shouldIgnore(e)) return;
            const point = getPoint(e);
            const rect = target.getBoundingClientRect();
            elemStartX = rect.left;
            elemStartY = rect.top;
            mouseStartX = point.x;
            mouseStartY = point.y;
            isDragging = true;
            e.preventDefault();
        };

        const drag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const point = getPoint(e);
            // 清除动画 transform 与原有定位，改用绝对坐标
            target.style.transform = 'none';
            target.style.margin = '0';
            target.style.right = 'auto';
            target.style.left = (elemStartX + point.x - mouseStartX) + 'px';
            target.style.top = (elemStartY + point.y - mouseStartY) + 'px';
        };

        const dragEnd = () => { isDragging = false; };

        handle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        handle.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd, { passive: false });
    }

    /** 兼容旧调用：句柄默认为容器内的 #dragHandle */
    function addDragFunctionality(container) {
        makeDraggable(container && container.querySelector('#dragHandle'), container);
    }

    // 挂载到公共 UI 层：模块一与模块二是相互隔离的作用域，
    // 模块二（自动评教）通过 window.NJUI.makeDraggable 复用同一份拖拽实现
    window.NJUI = window.NJUI || {};
    window.NJUI.makeDraggable = makeDraggable;
