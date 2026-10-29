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
                <span id="v80-close-btn" class="nju-close" title="关闭">✕</span>
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
            // hover 样式由 base.css 的 .nju-close 统一提供
        }
        // 存储预览区块折叠
        const storeBody = document.getElementById('store-body'), storeArr = document.getElementById('store-arr');
        document.getElementById('store-hd').onclick = () => { storeBody.classList.toggle('open'); storeArr.textContent = storeBody.classList.contains('open') ? '▴' : '▾'; if (storeBody.classList.contains('open')) renderStoragePanel(); };

        // 复用公共拖拽实现（避免直接赋值 document.onmousemove 覆盖页面其它监听器）
        window.NJUI.makeDraggable(document.getElementById('v80-header'), panel, {
            shouldIgnore: (e) => e.target.id === 'v80-close-btn'
        });

        return panel;
    };

