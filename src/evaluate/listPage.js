    // ── LIST 页面 (课程列表页) ────────────────────────────────────────
    if (location.href.includes('xspj_list.do')) {
        buildPanel(
            '南理工教务增强助手 V2',
            `
                <div id="v80-submit-hint"></div>
                <div class="btn-row">
                    <button id="start-btn" class="vb vb-primary" style="flex:2">开始评价并保存</button>
                    <button id="submit-all-btn" class="vb vb-yellow" style="flex:2" disabled>提交已评课程</button>
                </div>
                <div class="btn-row">
                    <button id="reset-btn" class="vb vb-outline" style="flex:1">重置缓存（清除状态）</button>
                    <button id="clear-log-btn" class="vb vb-danger" style="flex:1">清空日志</button>
                </div>
                <div class="btn-row">
                    <a href="https://enhance.njust.wiki" target="_blank" class="vb vb-outline vb-mini" style="text-decoration:none;flex:1;text-align:center;">前往增强助手官网</a>
                </div>
            `,
            `<div id="course-list"></div>`
        );

        /**
         * 解析当前页面的课程表格，提取课程信息和状态
         */
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

        /**
         * 更新“批量提交”按钮的状态和提示文字
         */
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

        /**
         * 渲染课程列表，包含勾选框和实时状态标签
         */
        const renderList = () => {
            const store = loadStore(), courses = parseRows(), box = document.getElementById('course-list');
            if (!box) return;
            box.innerHTML = '';
            courses.forEach(c => {
                // 初始化存储项
                if (!store[c.key]) store[c.key] = { auto: true, done: false, name: c.name, teacher: c.teacher, zpf: c.zpf, url: c.rawUrl, pj01id: qp(c.rawUrl, 'pj01id') };
                // 已评价或已提交都视为完成，避免重复打开同一门课
                if (c.submitted || c.evaluated) store[c.key].done = true;
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
                    `<button class="vb vb-outline vb-mini course-view-btn" data-url="${esc(c.rawUrl)}">查看</button>`;
                box.appendChild(el);
            });
            // 绑定勾选框事件，更新存储
            document.querySelectorAll('.course-ck').forEach(ck => {
                ck.onchange = (e) => { const k = e.target.getAttribute('data-key'); store[k].auto = e.target.checked; saveStore(store); updateSubmitBtn(); setTimeout(() => renderList(), 0); };
            });
            // 绑定"查看"按钮点击事件
            box.querySelectorAll('.course-view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = btn.getAttribute('data-url');
                    if (url) window.open(url, '_blank', 'width=1200,height=800');
                });
            });
            saveStore(store);
            updateSubmitBtn();
        };

        /**
         * “自动评价并保存”流水线的调度器
         */
        const execNext = () => {
            if (localStorage.getItem(KEY_RUNNING) !== 'true') return;

            // 互斥锁：等待当前课程处理完毕；超过阈值视为流程中断并自动恢复
            if (localStorage.getItem(KEY_BUSY) === 'true') {
                const ts = parseInt(localStorage.getItem(KEY_BUSY_TS) || '0', 10);
                if (ts && Date.now() - ts < LOCK_TIMEOUT) return;
                localStorage.setItem(KEY_BUSY, 'false');
                logInfo('上一次操作已超时，已自动恢复流程');
            }

            const store = loadStore(), curPj01 = qp(location.href, 'pj01id');
            // 查找属于当前类别且未完成的待评价课程
            const pending = Object.keys(store).filter(k => { const c = store[k]; return c.auto && !c.done && (!curPj01 || qp(c.url, 'pj01id') === curPj01); });

            if (pending.length > 0) {
                const c = store[pending[0]];
                localStorage.setItem(KEY_BUSY, 'true');
                localStorage.setItem(KEY_BUSY_TS, String(Date.now()));
                logInfo(`正在保存：${c.name}（本类别剩余 ${pending.length} 门）`);
                // 记录列表页地址，供评价页完成后返回
                sessionStorage.setItem('njust_eval_list_url', location.href);
                // 同页跳转，避免异步 window.open 被浏览器拦截
                setTimeout(() => { location.href = withAuto(c.url, 'true'); }, 300);
            } else {
                localStorage.setItem(KEY_RUNNING, 'false');
                localStorage.setItem(KEY_BUSY, 'false');
                logSuccess('当前类别的课程已全部处理完成');
                renderList();
            }
        };

        /**
         * “自动提交”流水线的调度器
         */
        const execNextSubmit = () => {
            if (localStorage.getItem(KEY_SUBRUN) !== 'true') return;

            if (localStorage.getItem(KEY_SUBBSY) === 'true') {
                const ts = parseInt(localStorage.getItem(KEY_SUBBSY_TS) || '0', 10);
                if (ts && Date.now() - ts < LOCK_TIMEOUT) return;
                localStorage.setItem(KEY_SUBBSY, 'false');
                logInfo('上一次提交已超时，已自动恢复流程');
            }

            const queue = loadSubQueue();
            if (queue.length === 0) {
                localStorage.setItem(KEY_SUBRUN, 'false');
                localStorage.setItem(KEY_SUBBSY, 'false');
                logSuccess('所有勾选课程提交完毕');
                setTimeout(() => location.reload(), 800);
                return;
            }

            const nextUrl = queue.shift();
            saveSubQueue(queue);
            localStorage.setItem(KEY_SUBBSY, 'true');
            localStorage.setItem(KEY_SUBBSY_TS, String(Date.now()));
            const submitStore = loadStore(), submitKey = courseKey(nextUrl), submitInfo = submitKey ? submitStore[submitKey] : null;
            logInfo(`正在提交：${submitInfo ? submitInfo.name + '（' + submitInfo.teacher + '）' : nextUrl}`);
            sessionStorage.setItem('njust_eval_list_url', location.href);
            // 同页跳转，避免被浏览器拦截
            setTimeout(() => { location.href = nextUrl; }, 300);
        };

        // 按钮点击事件绑定
        document.getElementById('start-btn').onclick = () => {
            localStorage.setItem(KEY_RUNNING, 'true');
            localStorage.setItem(KEY_BUSY, 'false');
            localStorage.setItem(KEY_CURLIST, location.href);
            renderList();
            execNext();
        };
        document.getElementById('submit-all-btn').onclick = () => {
            const store = loadStore(), toSubmit = parseRows().filter(c => { const info = store[c.key]; return (c.evaluated || (info && info.done)) && !c.submitted && (info ? info.auto !== false : true); });
            if (toSubmit.length === 0) return;
            if (!confirm(`即将提交以下 ${toSubmit.length} 门课程：\n` + toSubmit.map(c => `· ${c.name}（${c.teacher}）`).join('\n') + '\n\n确认继续？')) return;
            const queue = toSubmit.map(c => withSubmit(c.rawUrl)); saveSubQueue(queue); localStorage.setItem(KEY_SUBRUN, 'true'); localStorage.setItem(KEY_SUBBSY, 'false'); execNextSubmit();
        };
        document.getElementById('reset-btn').onclick = () => {
            if (!confirm('重置所有缓存？')) return;
            [KEY_STORE, KEY_RUNNING, KEY_BUSY, KEY_BUSY_TS, KEY_CURLIST,
                KEY_SUBQUEUE, KEY_SUBRUN, KEY_SUBBSY, KEY_SUBBSY_TS].forEach(k => localStorage.removeItem(k));
            location.reload();
        };
        document.getElementById('clear-log-btn').onclick = () => clearLogs();

        // 跨页面状态监听：当其他窗口修改了 busy 标志或完成状态时，本页面及时响应并触发下一步
        window.addEventListener('storage', (e) => {
            if ([KEY_STORE, KEY_BUSY, KEY_RUNNING].includes(e.key)) { renderList(); if (e.key === KEY_BUSY && e.newValue === 'false' && localStorage.getItem(KEY_RUNNING) === 'true') setTimeout(execNext, 800); }
            if (e.key === KEY_SUBBSY && e.newValue === 'false' && localStorage.getItem(KEY_SUBRUN) === 'true') setTimeout(execNextSubmit, 800);
        });

        renderList();
        // 自动恢复执行：若页面刷新时流水线正在运行，则继续
        if (localStorage.getItem(KEY_RUNNING) === 'true' && localStorage.getItem(KEY_BUSY) !== 'true') setTimeout(execNext, 1200);
        if (localStorage.getItem(KEY_SUBRUN) === 'true' && localStorage.getItem(KEY_SUBBSY) !== 'true') setTimeout(execNextSubmit, 1200);
    }

