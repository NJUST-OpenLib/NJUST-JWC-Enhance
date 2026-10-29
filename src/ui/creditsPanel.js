    // ==================== 学分统计悬浮窗 ====================
    function createCreditSummaryWindow() {
        try {
            const container = document.createElement('div');
            container.id = 'creditSummaryWindow';
            container.style.cssText = `
                position: fixed; top: 40px; right: 40px;
                background: var(--nju-bg); border: 1px solid var(--nju-border); border-radius: var(--nju-radius-lg);
                padding: 0; box-shadow: var(--nju-shadow-md);
                z-index: var(--nju-z-panel); min-width: 420px; max-width: 520px;
                font-family: var(--nju-font);
                overflow: hidden;
            `;

            container.innerHTML = `
                <div id="creditDragHandle" style="
                    background: var(--nju-bg-subtle); padding: 14px 22px; cursor: move;
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid var(--nju-border);">
                    <div style="color: var(--nju-text); font-weight: 600; font-size: var(--nju-fs-xl); letter-spacing: 1px;">
                        🎓 南理工教务增强助手 V2
                    </div>
                    <span id="creditCloseBtn" class="nju-close">✕</span>
                </div>
                <div style="background: var(--nju-bg); padding: 18px 22px 10px 22px; max-height: 540px; overflow-y: auto;">
                    <div id="creditSummary"></div>
                    <div id="xxkVersionBar" style="margin-top: 14px; padding: 9px 12px; background: var(--nju-primary-soft);
                        border: 1px solid rgba(0, 122, 255, 0.25); border-radius: var(--nju-radius-sm); font-size: var(--nju-fs-md); color: var(--nju-text-2);
                        display: flex; align-items: center;">
                        <span id="xxkVersionText">📦 分类口径：加载中…</span>
                        <select id="xxkVersionSelect" title="选择学分统计所依据的培养方案版本"
                            style="margin-left: auto; font-size: var(--nju-fs-sm); padding: 2px 6px; border: 1px solid var(--nju-border);
                            border-radius: var(--nju-radius-sm); background: var(--nju-bg); color: var(--nju-text-2);">
                            <option value="">按学号自动</option>
                            <option value="2018">2018 版</option>
                            <option value="2022">2022 版</option>
                            <option value="2026">2026 版</option>
                        </select>
                    </div>
                    <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--nju-border);
                        font-size: var(--nju-fs-md); color: var(--nju-text-3); line-height: 1.6; text-align: left;">
                        <li>对照个人培养方案核实具体修课要求</li>
                        <li>选修课类别统计仅包含已知分类的通识教育选修课</li>
                        <li>课程分类信息可能随时更新，请以教务处最新通知为准</li>
                        <div style="margin-bottom: 8px;">
                            <span>请查看 <a href="https://enhance.njust.wiki" target="_blank"
                                style="color: var(--nju-primary); text-decoration: none;">增强助手官网</a> 获取使用说明</span>
                        </div>
                    </div>
                </div>
            `;

            // 统一使用公共拖拽实现（句柄为本窗体的 creditDragHandle）
            makeDraggable(container.querySelector('#creditDragHandle'), container);

            document.body.appendChild(container);

            // 绑定关闭按钮事件
            const creditCloseBtn = container.querySelector('#creditCloseBtn');
            if (creditCloseBtn) {
                creditCloseBtn.addEventListener('click', () => container.remove());
                // hover 样式由 base.css 的 .nju-close 统一提供
            }

            // 培养方案口径显示与手动切换
            try {
                const versionText = container.querySelector('#xxkVersionText');
                const versionSelect = container.querySelector('#xxkVersionSelect');
                const info = resolveCategoryVersion();
                if (versionText) {
                    versionText.textContent = `📦 分类口径：${info.version} 版（${describeVersionSource(info)}）`;
                }
                if (versionSelect) {
                    versionSelect.value = localStorage.getItem(KEY_XXK_VERSION) || '';
                    versionSelect.addEventListener('change', () => {
                        const value = versionSelect.value;
                        if (value) localStorage.setItem(KEY_XXK_VERSION, value);
                        else localStorage.removeItem(KEY_XXK_VERSION);
                        CacheManager.clear();
                        Logger.info(`分类口径已切换为「${value || '按学号自动'}」，正在重新加载数据`);
                        setTimeout(() => location.reload(), 300);
                    });
                }
            } catch (e) {
                Logger.warn('渲染分类口径控件失败:', e);
            }

            Logger.debug('学分统计弹窗创建完成');
            return container;
        } catch (e) {
            Logger.error('创建学分统计弹窗失败:', e);
            return null;
        }
    }

    // ==================== 学分统计更新 ====================
    function updateCreditSummary() {
        try {
            const creditSummaryDiv = document.getElementById('creditSummary');
            if (!creditSummaryDiv) { Logger.warn('未找到学分统计容器'); return; }

            const creditsByType = {};
            const creditsByCategory = {};
            const tables = document.querySelectorAll('table');

            tables.forEach(table => {
                table.querySelectorAll('tr').forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length < 11) return;
                    const courseCode = tds[2].textContent.trim();
                    const credit = parseFloat(tds[6].textContent) || 0;
                    const courseType = tds[10].textContent.trim();

                    const categoryDiv = tds[2].querySelector('[data-category-inserted]');
                    let category = null;
                    if (categoryDiv) {
                        category = categoryDiv.textContent.trim() || null;
                    }

                    if (courseType) {
                        if (!creditsByType[courseType]) creditsByType[courseType] = { credits: 0, count: 0 };
                        creditsByType[courseType].credits += credit;
                        creditsByType[courseType].count++;
                    }
                    if (category) {
                        if (!creditsByCategory[category]) creditsByCategory[category] = { credits: 0, count: 0 };
                        creditsByCategory[category].credits += credit;
                        creditsByCategory[category].count++;
                    }
                });
            });

            const totalCreditsByType = Object.values(creditsByType).reduce((s, d) => s + d.credits, 0);
            const totalCountByType = Object.values(creditsByType).reduce((s, d) => s + d.count, 0);
            const totalCreditsByCategory = Object.values(creditsByCategory).reduce((s, d) => s + d.credits, 0);
            const totalCountByCategory = Object.values(creditsByCategory).reduce((s, d) => s + d.count, 0);

            let summaryHTML = `<div style="border-bottom: 1px solid var(--nju-border); margin-bottom: 12px; padding-bottom: 10px;">`;
            summaryHTML += `<div style="margin-bottom: 8px; font-size: var(--nju-fs-lg); color: var(--nju-text); font-weight: 600;">📊 按课程性质统计</div>`;
            summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; background: var(--nju-bg-subtle); border-radius: var(--nju-radius-sm); padding: 4px 6px; margin-bottom: 4px;">
                <span style="color: var(--nju-primary); font-weight: 600; font-size: var(--nju-fs-md);">总计</span>
                <span style="font-weight: 600; color: var(--nju-primary); font-size: var(--nju-fs-md);">${totalCreditsByType.toFixed(1)} 学分</span>
                <span style="color: var(--nju-primary); font-weight: 600; font-size: var(--nju-fs-md);">${totalCountByType} 门</span>
            </div><div style="display: grid; gap: 2px;">`;
            for (const [type, data] of Object.entries(creditsByType)) {
                summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                    <span style="color: var(--nju-text-2); font-size: var(--nju-fs-md);">${type}</span>
                    <span style="color: var(--nju-text); font-size: var(--nju-fs-md);">${data.credits.toFixed(1)} 学分</span>
                    <span style="color: var(--nju-text-3); font-size: var(--nju-fs-md);">${data.count} 门</span>
                </div>`;
            }
            summaryHTML += `</div></div>`;

            if (Object.keys(creditsByCategory).length > 0) {
                summaryHTML += `<div style="margin-top: 16px;">`;
                summaryHTML += `<div style="margin-bottom: 8px; font-size: var(--nju-fs-lg); color: var(--nju-text); font-weight: 600;">🏷️ 按选修课类别统计</div>`;
                summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; background: var(--nju-bg-subtle); border-radius: var(--nju-radius-sm); padding: 4px 6px; margin-bottom: 4px;">
                    <span style="color: var(--nju-primary); font-weight: 600; font-size: var(--nju-fs-md);">总计</span>
                    <span style="font-weight: 600; color: var(--nju-primary); font-size: var(--nju-fs-md);">${totalCreditsByCategory.toFixed(1)} 学分</span>
                    <span style="color: var(--nju-primary); font-weight: 600; font-size: var(--nju-fs-md);">${totalCountByCategory} 门</span>
                </div><div style="display: grid; gap: 2px;">`;
                for (const [category, data] of Object.entries(creditsByCategory)) {
                    summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                        <span style="color: var(--nju-text-2); font-size: var(--nju-fs-md);">${category}</span>
                        <span style="color: var(--nju-text); font-size: var(--nju-fs-md);">${data.credits.toFixed(1)} 学分</span>
                        <span style="color: var(--nju-text-3); font-size: var(--nju-fs-md);">${data.count} 门</span>
                    </div>`;
                }
                summaryHTML += `</div></div>`;
            }

            creditSummaryDiv.innerHTML = summaryHTML || '暂无数据';
            Logger.debug('学分统计更新完成');
        } catch (e) {
            Logger.error('更新学分统计失败:', e);
            const el = document.getElementById('creditSummary');
            if (el) el.innerHTML = '<div style="color:var(--nju-danger);padding:10px;text-align:center;">❌ 学分统计更新失败</div>';
        }
    }

    /**
     * ── 课程信息增强核心逻辑 ───────────────────────────────────────
     * 负责解析教务系统的表格 DOM，并根据映射表插入大纲链接、选修课类别等信息。
     */
