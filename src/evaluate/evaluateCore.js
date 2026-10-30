    // ── 评价页面核心逻辑 ──────────────────────────────────────────────
    /**
     * 收集当前评价页面的所有评分组 (Radio) 及其对应的分值
     */
    const collectGroups = () => {
        const groups = {};
        document.querySelectorAll('input[type="radio"]').forEach(r => {
            if (!groups[r.name]) groups[r.name] = [];
            const idx = r.id.split('_')[1];
            // 查找隐藏域中的分值 (pj0601fz_...)
            const fzEl = document.getElementsByName(`pj0601fz_${idx}_${r.value}`)[0];
            groups[r.name].push({ el: r, score: fzEl ? parseFloat(fzEl.value) || 0 : 0 });
        });
        const gkeys = Object.keys(groups);
        // 按分值从高到低排序，方便策略选择
        gkeys.forEach(k => groups[k].sort((a, b) => b.score - a.score));
        return { gkeys, groups };
    };

    /**
     * 寻找最适合进行分值扰动的题目索引
     * 原则：分值差距最小的题目，扰动对总分影响最小
     */
    const findPerturbIdx = (gkeys, groups) => {
        let minDelta = Infinity, perturbIdx = -1;
        gkeys.forEach((k, i) => {
            const opts = groups[k];
            if (opts.length < 2) return;
            const delta = roundFloat(opts[0].score - opts[1].score);
            if (delta < minDelta) { minDelta = delta; perturbIdx = i; }
        });
        return perturbIdx;
    };

    /**
     * 计算当前页面已勾选选项的总分
     */
    const calcCurrentTotal = (gkeys, groups) => {
        let total = 0;
        gkeys.forEach(k => { const chosen = groups[k].find(o => o.el.checked); if (chosen) total += chosen.score; });
        return roundFloat(total);
    };

    /**
     * 在详情页每个选项后标注具体分值，方便人工微调
     */
    const ensureValueFields = () => {
        const { gkeys, groups } = collectGroups();
        gkeys.forEach(k => {
            groups[k].forEach(({ el, score }) => {
                const idx = el.id.split('_')[1];
                const fzEl = document.getElementsByName(`pj0601fz_${idx}_${el.value}`)[0];
                if (!fzEl) return;
                let next = fzEl.nextElementSibling;
                if (next && next.classList && next.classList.contains('v80-value-chip')) return;
                const chip = document.createElement('span');
                chip.className = 'v80-value-chip';
                chip.textContent = `[${score}分]`;
                fzEl.insertAdjacentElement('afterend', chip);
            });
        });
    };

    /**
     * 应用评分策略并勾选 Radio
     * strategy: highest (最高分), high (次高), mid (中分), low (低分)
     * 策略中包含“选项去重”逻辑：即在保证总分尽量高的前提下，在某一道题上选择非最高分，避免全满分被系统拦截
     */
    const applyStrategy = (strategy, gkeys, groups) => {
        const perturbIdx = findPerturbIdx(gkeys, groups);
        let total = 0;
        gkeys.forEach((k, i) => {
            const opts = groups[k], len = opts.length;
            let pick = 0; // 默认选最高分，避免策略名异常时不勾选任何项
            if (strategy === 'highest') {
                // 最高分策略：在扰动项选次高，其余全选最高
                pick = (i === perturbIdx && len >= 2) ? 1 : 0;
            } else if (strategy === 'high') {
                pick = len < 2 ? 0 : (i === perturbIdx) ? 0 : 1;
            } else if (strategy === 'mid') {
                const midIdx = Math.floor((len - 1) / 2);
                pick = (i === perturbIdx && len >= 2) ? (midIdx > 0 ? midIdx - 1 : midIdx + 1) : midIdx;
            } else if (strategy === 'low') {
                pick = (i === perturbIdx && len >= 2) ? len - 2 : len - 1;
            }
            const chosen = opts[Math.min(pick, len - 1)];
            if (chosen) { chosen.el.checked = true; total += chosen.score; }
        });
        return roundFloat(total);
    };

