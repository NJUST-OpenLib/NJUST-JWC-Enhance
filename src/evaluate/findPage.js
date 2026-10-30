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
                // 完整 URL、协议相对（//host/...）均保持原样，其余按当前站点补全
                const abs = /^(https?:)?\/\//.test(href) ? href : location.origin + href;
                found.push({ label, url: abs });
            });
            return found;
        };

        buildPanel(
            '南理工教务增强助手 V2',
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
                const curPj01 = curList ? qp(curList, 'pj01id') : '';
                const isCur = running && curPj01 && entry.url.includes(curPj01);
                const allDone = totalN > 0 && doneN === totalN;
                const card = document.createElement('div');
                card.className = 'entry-card';
                card.innerHTML = `<span class="entry-label">${esc(entry.label)}</span>` +
                    (totalN ? `<span class="entry-count">${doneN}/${totalN}</span>` : '') +
                    `<span class="${isCur ? 'entry-st-run' : allDone ? 'entry-st-done' : 'entry-st-wait'}">${isCur ? '运行中' : allDone ? '已完成' : '等待中'}</span>` +
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

