    // ==================== 统一弹窗 ====================
    function createUnifiedModal(title, content, type = 'info') {
        const existingModal = document.getElementById('njustAssistantModal');
        if (existingModal) existingModal.remove();

        const container = document.createElement('div');
        container.id = 'njustAssistantModal';

        // Apple 风格主题色彩配置
        const themeConfig = {
            warning: { accent: '#FF9500', accentLight: 'rgba(255,149,0,0.12)' },
            success: { accent: '#34C759', accentLight: 'rgba(52,199,89,0.12)' },
            info: { accent: '#007AFF', accentLight: 'rgba(0,122,255,0.12)' }
        };
        const theme = themeConfig[type] || themeConfig.info;

        container.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: #ffffff;
            border: none; border-radius: 20px; padding: 0;
            box-shadow: 0 24px 80px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.08);
            z-index: 10000; min-width: 340px; max-width: 460px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
            overflow: hidden; animation: njustFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        container.innerHTML = `
            <div id="dragHandle" style="padding: 24px 28px 20px 28px; cursor: move;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <div style="font-size: 20px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.3px;">
                        ${title}
                    </div>
                    <button id="closeModalBtn" style="
                        width: 28px; height: 28px; border-radius: 50%;
                        border: none; background: #f5f5f7;
                        cursor: pointer; display: flex; align-items: center;
                        justify-content: center; color: #86868b;
                        font-size: 16px; transition: all 0.15s;
                        margin-left: 16px; flex-shrink: 0;
                    ">×</button>
                </div>
                <div style="color: #424245; font-size: 14px; line-height: 1.65; font-weight: 400;">
                    ${content}
                </div>
            </div>
            <div style="padding: 16px 28px 22px 28px; background: #f5f5f7; border-top: 1px solid #e5e5ea;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <a href="https://enhance.njust.wiki" target="_blank"
                        style="color: ${theme.accent}; text-decoration: none; font-weight: 500; font-size: 14px;">
                        查看使用说明
                    </a>
                </div>
                <div style="
                    padding: 12px 14px;
                    background: ${theme.accentLight}; border-radius: 10px;
                ">
                    <div style="font-size: 12px; color: #424245; line-height: 1.5;">
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
                #closeModalBtn:hover { background: #e8e8ed; color: #1d1d1f; }
            `;
            document.head.appendChild(style);
        }

        addDragFunctionality(container);
        document.body.appendChild(container);

        // 绑定关闭按钮事件
        const closeBtn = container.querySelector('#closeModalBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => container.remove());
        }

        return container;
    }

