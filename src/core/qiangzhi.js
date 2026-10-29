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
                            background: #007AFF; color: white;
                            padding: 13px 20px; text-decoration: none; border-radius: 12px;
                            font-weight: 500; font-size: 15px; text-align: center;
                            transition: background 0.15s;"
                            onmouseover="this.style.background='#0066d6'" onmouseout="this.style.background='#007AFF'">
                            教务处登录入口
                            <span style="margin-left: 8px; font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 6px;">推荐</span>
                        </a>
                        <a href="https://www.njust.edu.cn/" target="_blank" style="
                            display: block; background: #f5f5f7; color: #1d1d1f;
                            padding: 13px 20px; text-decoration: none; border-radius: 12px;
                            font-weight: 500; font-size: 15px; text-align: center;
                            border: 1px solid #d2d2d7; transition: background 0.15s;"
                            onmouseover="this.style.background='#e8e8ed'" onmouseout="this.style.background='#f5f5f7'">
                            智慧理工登录入口
                        </a>
                    </div>
                    <div style="margin-top: 18px; padding: 14px; background: #f5f5f7; border-radius: 10px;">
                        <div style="font-size: 13px; color: #424245; line-height: 1.6;">
                            <strong style="color: #1d1d1f;">温馨提示</strong><br>
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

