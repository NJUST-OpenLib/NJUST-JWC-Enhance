    // ==================== 校园网访问限制提示 ====================
    /**
     * 教务处直连入口（202.119.81.112 / 202.119.81.113）已调整为仅校园网可访问。
     * 在校内访问成功时给出一次轻量提示，引导校外用户改用智慧理工门户登录。
     * 提示每天最多出现一次，关闭后当天不再显示。
     */
    const SMART_CAMPUS_LOGIN_URL = 'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp';

    function showCampusNetworkNotice() {
        try {
            const host = window.location.hostname;
            const isDirectJwc = (host === '202.119.81.112' || host === '202.119.81.113');
            if (!isDirectJwc) return;

            const KEY = 'njust_campus_notice_date';
            const today = new Date().toISOString().slice(0, 10);
            if (localStorage.getItem(KEY) === today) return; // 当天已提示过

            if (document.getElementById('njust-network-notice')) return;

            const bar = document.createElement('div');
            bar.id = 'njust-network-notice';
            bar.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0;
                z-index: var(--nju-z-topbar);
                background: var(--nju-warning-soft); color: var(--nju-text);
                border-bottom: 1px solid rgba(255, 149, 0, 0.35);
                padding: 9px 16px; font-family: var(--nju-font); font-size: var(--nju-fs-md);
                display: flex; align-items: center; justify-content: center; gap: 10px;
                box-shadow: var(--nju-shadow-sm);
            `;
            bar.innerHTML = `
                <span>教务处直连入口（202.119.81.112 / 113）仅限校园网访问，校外请使用
                    <a href="${SMART_CAMPUS_LOGIN_URL}" target="_blank"
                       style="color: var(--nju-primary); font-weight: 600; text-decoration: none;">智慧理工门户</a>
                    登录教务系统。
                </span>
                <button id="njust-network-notice-close" class="nju-close" title="今日不再提示">✕</button>
            `;

            (document.body || document.documentElement).appendChild(bar);

            const closeBtn = bar.querySelector('#njust-network-notice-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    localStorage.setItem(KEY, today);
                    bar.remove();
                });
            }

            Logger.info('已显示校园网访问限制提示');
        } catch (e) {
            Logger.warn('显示校园网访问限制提示失败:', e);
        }
    }
