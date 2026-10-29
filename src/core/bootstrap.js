    // ==================== 延迟初始化日志 ====================
    function initializeLogging() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeLogging);
            return;
        }
        setTimeout(() => {
            try {
                Logger.info('南理工教务增强助手已启动', {
                    debug: DEBUG_CONFIG.enabled ? `Level ${DEBUG_CONFIG.level}` : '关闭',
                    cache: CACHE_CONFIG.enabled ? `TTL ${CACHE_CONFIG.ttl}s` : '关闭'
                });
                if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.showCache) {
                    const stats = CacheManager.getStats();
                    Logger.info(`缓存统计: 总${stats.total} 有效${stats.valid} 过期${stats.expired} ${(stats.size / 1024).toFixed(1)}KB`);
                }
            } catch (e) {
                console.error('初始化日志失败: ', e);
            }
        }, 100);
    }

    initializeLogging();

    // 早期初始化推广信息（在数据加载之前显示）
    function initializePromoBanner() {
        const tryShow = () => {
            // 检查是否已存在
            if (document.getElementById('njust-promo-line')) return true;

            // 检查两种版权信息结构
            const footer = document.getElementById('Footer1_divCopyright');
            const copyrightLink = document.querySelector('a.copyright[href*="qzdatasoft"]');

            if (footer || (copyrightLink && copyrightLink.parentElement)) {
                showPromoBanner();
                return true;
            }
            return false;
        };

        // 隐藏无法使用的二维码图片
        const hideUnusedElements = () => {
            const uselessImg = document.querySelector('img[src*="appewm.png"]');
            if (uselessImg) {
                uselessImg.style.display = 'none';
            }
        };

        // 尝试立即显示和隐藏
        if (tryShow()) {
            hideUnusedElements();
            return;
        }

        // 如果目标元素还不存在，监听 DOM 变化
        const observer = new MutationObserver(() => {
            if (tryShow()) {
                hideUnusedElements();
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // 5 秒后停止监听（防止内存泄漏）
        setTimeout(() => observer.disconnect(), 5000);
    }

    initializePromoBanner();

    let courseCategoryMap = {};
    let courseOutlineMap = {};

