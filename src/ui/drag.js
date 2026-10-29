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

