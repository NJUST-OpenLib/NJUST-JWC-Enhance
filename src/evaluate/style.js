    // ── 样式注入 ──────────────────────────────────────────────────────
    const injectCSS = () => {
        if (document.getElementById('v80-style')) return;
        const style = document.createElement('style');
        style.id = 'v80-style';
        style.textContent = `
            /* 控制面板主容器 */
            #v80-panel {
                position: fixed; top: 20px; right: 20px; width: 490px;
                background: #fff; border-radius: 10px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.10);
                z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex; flex-direction: column; border: 1px solid #e2e8f0;
                max-height: 90vh; overflow: hidden;
                transition: transform 0.25s ease; font-size: 13px; color: #2d3748;
            }
            #v80-panel.wide { width: 640px; }
            #v80-header {
                padding: 11px 14px; background: #f7fafc; border-bottom: 1px solid #e2e8f0;
                cursor: move; display: flex; align-items: center; gap: 8px; user-select: none; flex-shrink: 0;
            }
            #v80-header b { flex: 1; font-size: 14px; color: #2d3748; }
            #v80-action-bar { padding: 10px 14px 8px; border-bottom: 1px solid #edf2f7; background: #fff; flex-shrink: 0; }
            #v80-submit-hint { font-size: 11px; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; display: none; line-height: 1.6; }
            #v80-submit-hint.visible { display: block; }
            .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 7px; }
            #v80-body { padding: 10px 14px; overflow-y: auto; flex: 1; }

            /* 列表项卡片样式 */
            .entry-card, .ci { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 7px; border: 1px solid #e2e8f0; margin-bottom: 7px; background: #f7fafc; }
            .ci { padding: 8px 10px; margin-bottom: 6px; border-color: #edf2f7; }
            .entry-label, .ci-name { flex: 1; font-weight: 500; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ci-teacher { color: #718096; white-space: nowrap; }
            .ci-zpf { color: #276749; font-size: 11px; background: #f0fff4; padding: 1px 7px; border-radius: 8px; border: 1px solid #c6f6d5; white-space: nowrap; }

            /* 状态标签 */
            .entry-st-done, .st-submitted { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; white-space: nowrap; }
            .entry-st-wait, .st-wait { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fffaf0; color: #c05621; border: 1px solid #feebc8; white-space: nowrap; }
            .entry-st-run { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .st-can-submit { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #fefcbf; color: #744210; border: 1px solid #f6e05e; white-space: nowrap; }
            .st-none { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: #edf2f7; color: #718096; border: 1px solid #e2e8f0; white-space: nowrap; }

            /* 按钮 */
            .vb { padding: 6px 13px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
            .vb-primary { background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .vb-green { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
            .vb-yellow { background: #fefcbf; color: #744210; border: 1px solid #f6e05e; }
            .vb-outline { background: #fff; color: #4a5568; border: 1px solid #cbd5e0; }
            .vb-danger { background: #fff; color: #c53030; border: 1px solid #fed7d7; }
            .vb-mini { padding: 3px 9px; font-size: 11px; }
            .vb:disabled { opacity: 0.45; cursor: not-allowed; }

            /* 可折叠区块样式 */
            .v80-section { flex-shrink: 0; border-top: 1px solid #edf2f7; }
            .v80-sec-hd { padding: 7px 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; background: #f7fafc; }
            .v80-sec-hd .lbl { font-size: 11px; color: #4a5568; font-weight: 600; flex: 1; }
            .v80-sec-hd .arr { font-size: 13px; color: #a0aec0; }
            .v80-sec-body { display: none; }
            .v80-sec-body.open { display: block; }

            /* Storage 预览样式 */
            #v80-storage-pre { max-height: 200px; overflow-y: auto; padding: 4px 10px; font-size: 11px; line-height: 1.6; font-family: 'SFMono-Regular', Consolas, monospace; background: #f7fafc; }
            .v80-value-chip { display: inline-block; margin-left: 6px; font-size: 11px; color: #4a5568; }
        `;
        document.head.appendChild(style);
    };

