    async function init() {
        try {
            Logger.info('开始执行主要逻辑');

            // 强智概念版拦截
            if (checkQiangzhiPage()) {
                Logger.info('强智科技页面检测完成，脚本退出');
                return;
            }

            const currentUrl = window.location.href;
            const isSmartCampus = currentUrl.includes('bkjw.njust.edu.cn');
            if (isSmartCampus) {
                Logger.warn('检测到智慧理工平台，课程大纲功能将受限');
            }

            // 1. 登录保活与状态检查
            autoRefreshLoginStatus();
            checkLoginErrorAndRefresh();

            // 2. 加载远程配置数据（按学号对应的入学年份自适应培养方案口径）
            Logger.info('开始加载数据');
            const versionInfo = resolveCategoryVersion();
            Logger.info(`选修课分类口径：${versionInfo.version} 版（${describeVersionSource(versionInfo)}）`);
            const [categoryData, outlineData] = await Promise.all([
                loadJSON(getCategoryURLs(versionInfo.version)),
                loadJSON(OUTLINE_URLS)
            ]);

            // 3. 构建索引并执行初次处理
            Logger.info('数据加载完成，构建映射表');
            buildCourseMaps(categoryData, outlineData);

            if (window.location.pathname.includes('/njlgdx/kscj/cjcx_list')) {
                createCreditSummaryWindow();
            }

            processAllTables();

            /**
             * 4. 动态监听系统
             * 解决教务系统通过 AJAX 异步切换页面（如点击菜单）导致脚本失效的问题。
             */
            let isProcessing = false;
            const observer = new MutationObserver((mutations) => {
                try {
                    if (isProcessing) return;

                    const hasRelevantChanges = mutations.some(mutation => {
                        try {
                            if (mutation.type !== 'childList') return false;
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                                // 忽略脚本自己插入的 DOM
                                if (node.hasAttribute &&
                                    (node.hasAttribute('data-category-inserted') ||
                                        node.hasAttribute('data-title-inserted') ||
                                        node.hasAttribute('data-outline-inserted'))) {
                                    return false;
                                }
                                // 只关注表格类变更
                                if (node.tagName === 'TABLE' || node.tagName === 'TR' || node.tagName === 'TD') {
                                    return true;
                                }
                            }
                            return false;
                        } catch (e) {
                            Logger.warn('检查页面变化时出错:', e);
                            return false;
                        }
                    });

                    if (hasRelevantChanges && !checkQiangzhiPage()) {
                        isProcessing = true;
                        try {
                            processAllTables();
                        } catch (e) {
                            Logger.error('重新处理表格失败:', e);
                        } finally {
                            // 节流处理，防止频繁触发
                            setTimeout(() => { isProcessing = false; }, 100);
                        }
                    }
                } catch (e) {
                    Logger.error('MutationObserver 回调执行失败:', e);
                    isProcessing = false;
                }
            });

            try {
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (e) {
                Logger.error('启动页面变化监听器失败:', e);
            }

            Logger.info('南理工教务增强助手加载成功！');
        } catch (err) {
            Logger.error('初始化失败:', err);
        }
    }

    // 延迟 1 秒执行初始化，确保教务系统原始 JS 框架加载完成
    setTimeout(init, 1000);

    // 暴露 Logger 到全局，供模块二使用
    window.__NJUST_LOGGER__ = Logger;
})();
