    // ==================== 梨课程推荐提示 ====================
    function showPromoBanner() {
        // 检查是否已存在
        if (document.getElementById('njust-promo-line')) return;

        // 查找底部版权信息区域（支持两种页面结构）
        let insertTarget = null;
        let isLoginPage = false;

        // 1. 登录后的页面：Footer1_divCopyright
        const footer = document.getElementById('Footer1_divCopyright');
        if (footer) {
            insertTarget = footer;
        }

        // 2. 登录页面：包含 class="copyright" 的 td 元素
        if (!insertTarget) {
            const copyrightLink = document.querySelector('a.copyright[href*="qzdatasoft"]');
            if (copyrightLink && copyrightLink.parentElement && copyrightLink.parentElement.tagName === 'TD') {
                insertTarget = copyrightLink.parentElement;
                isLoginPage = true;
            }
        }

        if (!insertTarget) return;

        // 创建推荐文本行（纯文本样式，与页面风格融合）
        const promoLine = document.createElement('div');
        promoLine.id = 'njust-promo-line';
        if (!isLoginPage) {
            promoLine.className = 'Nsb_pw';
        }
        promoLine.style.cssText = `
            padding: 8px 20px;
            text-align: center;
            font-size: 12px;
            color: var(--nju-text-2);
        `;

        promoLine.innerHTML = `
            <strong>推荐：</strong>尝试最新开发，支持本科生/研究生的 <strong>梨课程</strong>。
            <a href="https://m.njust.store" target="_blank" rel="noopener noreferrer"
                style="color: var(--nju-primary); text-decoration: none;">前往 m.njust.store</a>
            <span style="font-size: 11px; color: var(--nju-text-3);">（支持 Android / HarmonyOS / iOS / PC）</span>
        `;

        // 在目标元素上方插入
        insertTarget.parentNode.insertBefore(promoLine, insertTarget);
    }

