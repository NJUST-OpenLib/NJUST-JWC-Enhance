    // ==================== 检测强智科技页面 ====================
    function checkQiangzhiPage() {
        try {
            const pageTitle = document.title || '';
            if (pageTitle.includes('强智科技教务系统概念版')) {
                Logger.warn('检测到强智科技概念版页面，显示登录引导');
                const content = `
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 15px; font-weight: 500; color: #1d1d1f; margin-bottom: 10px;">
                            当前页面无法登录
                        </div>
                        <div style="font-size: 14px; color: #424245; line-height: 1.6;">
                            这是强智科技教务系统概念版，仅供展示，不提供登录功能。请前往以下入口登录教务系统。
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <a href="http://202.119.81.113:8080/" target="_blank" style="
                            display: flex; align-items: center; justify-content: center;
                            background: var(--nju-primary); color: white;
                            padding: 13px 20px; text-decoration: none; border-radius: var(--nju-radius-md);
                            font-weight: 500; font-size: var(--nju-fs-lg); text-align: center;
                            transition: background 0.15s;"
                            onmouseover="this.style.background='var(--nju-primary-hover)'" onmouseout="this.style.background='var(--nju-primary)'">
                            教务处登录入口
                            <span style="margin-left: 8px; font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 6px;">推荐</span>
                        </a>
                        <a href="https://www.njust.edu.cn/" target="_blank" style="
                            display: block; background: var(--nju-bg-subtle); color: var(--nju-text);
                            padding: 13px 20px; text-decoration: none; border-radius: var(--nju-radius-md);
                            font-weight: 500; font-size: var(--nju-fs-lg); text-align: center;
                            border: 1px solid var(--nju-border-strong); transition: background 0.15s;"
                            onmouseover="this.style.background='var(--nju-bg-hover)'" onmouseout="this.style.background='var(--nju-bg-subtle)'">
                            智慧理工登录入口
                        </a>
                    </div>
                    <div style="margin-top: 18px; padding: 14px; background: var(--nju-bg-subtle); border-radius: var(--nju-radius-md);">
                        <div style="font-size: var(--nju-fs-md); color: var(--nju-text-2); line-height: 1.6;">
                            <strong style="color: var(--nju-text);">温馨提示</strong><br>
                            验证码区分大小写，通常为小写字母。如遇登录问题，建议使用教务处入口。
                        </div>
                    </div>
                `;
                try { createUnifiedModal('南理工教务增强助手 V2', content, 'warning'); }
                catch (e) { Logger.error('创建强智科技页面提示弹窗失败:', e); }
                return true;
            }
            return false;
        } catch (e) {
            Logger.error('检测强智科技页面失败:', e);
            return false;
        }
    }

