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
