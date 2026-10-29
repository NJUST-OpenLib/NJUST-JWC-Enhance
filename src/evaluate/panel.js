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

