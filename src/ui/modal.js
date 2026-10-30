    // ==================== 统一弹窗 ====================
    function createUnifiedModal(title, content, type = 'info') {
        const existingModal = document.getElementById('njustAssistantModal');
        if (existingModal) existingModal.remove();

        const container = document.createElement('div');
        container.id = 'njustAssistantModal';

        // 主题色彩统一取自设计变量（src/ui/theme.css）
        const themeConfig = {
            warning: { accent: 'var(--nju-warning)', accentLight: 'var(--nju-warning-soft)' },
            success: { accent: 'var(--nju-success)', accentLight: 'var(--nju-success-soft)' },
            info: { accent: 'var(--nju-primary)', accentLight: 'var(--nju-primary-soft)' }
        };
        const theme = themeConfig[type] || themeConfig.info;

        container.className = 'nju-window';
        container.style.cssText = `
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 420px; min-width: 320px; max-width: 90vw;
            z-index: var(--nju-z-modal);
            animation: njustFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        container.innerHTML = `
            <div id="dragHandle" style="padding: 24px 28px 20px 28px; cursor: move;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <div style="font-size: 20px; font-weight: 600; color: var(--nju-text); letter-spacing: -0.3px;">
                        ${title}
                    </div>
                    <button id="closeModalBtn" class="nju-close" style="margin-left: 16px; flex-shrink: 0;">×</button>
                </div>
                <div style="color: var(--nju-text-2); font-size: 14px; line-height: 1.65; font-weight: 400;">
                    ${content}
                </div>
            </div>
            <div style="padding: 16px 28px 22px 28px; background: var(--nju-bg-subtle); border-top: 1px solid var(--nju-border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <a href="https://enhance.njust.wiki" target="_blank"
                        style="color: ${theme.accent}; text-decoration: none; font-weight: 500; font-size: 14px;">
                        查看使用说明
                    </a>
                </div>
                <div style="
                    padding: 12px 14px;
                    background: ${theme.accentLight}; border-radius: var(--nju-radius-md);
                ">
                    <div style="font-size: var(--nju-fs-sm); color: var(--nju-text-2); line-height: 1.5;">
                        <strong style="color: ${theme.accent};">免责声明</strong> — 本工具仅供学习交流，数据仅供参考。请以教务处官网信息为准，使用本工具产生的任何后果由用户自行承担。
                    </div>
                </div>
            </div>
        `;

        if (!document.getElementById('njustAssistantStyles')) {
            const style = document.createElement('style');
            style.id = 'njustAssistantStyles';
            style.textContent = `
                @keyframes njustFadeIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                /* 关闭按钮交互态由 base.css 的 .nju-close 统一提供 */
            `;
            document.head.appendChild(style);
        }

        enableWindow({
            id: 'modal',
            target: container,
            handle: container.querySelector('#dragHandle'),
            minWidth: 320,
            minHeight: 220
        });
        document.body.appendChild(container);

        // 绑定关闭按钮事件
        const closeBtn = container.querySelector('#closeModalBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => container.remove());
        }

        return container;
    }

