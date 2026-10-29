    // ==================== 数据加载（智能切源）====================
    // fix⑤: 无论第几个数据源成功，均进行缓存；缓存读取也遍历所有 URL
    function loadJSONWithFallback(urls) {
        return new Promise((resolve, reject) => {
            const urlArray = Array.isArray(urls) ? urls : [urls];
            const fileName = urlArray[0].includes('xxk') ? '选修课分类' : '课程大纲';

            Logger.info(`开始加载 ${fileName}，共 ${urlArray.length} 个数据源`);

            // fix⑤: 先遍历所有 URL，尝试从缓存中命中任意一个
            for (const url of urlArray) {
                const cachedData = CacheManager.get(url);
                if (cachedData) {
                    Logger.info(`从缓存读取 ${fileName} 成功 (${url})`);
                    resolve(cachedData);
                    return;
                }
            }

            // 缓存全部未命中，依次请求网络
            let currentIndex = 0;

            function tryNextUrl() {
                if (currentIndex >= urlArray.length) {
                    Logger.error(`${fileName} 所有数据源均不可用`);
                    reject(new Error(`所有数据源都不可用: ${fileName}`));
                    return;
                }

                const currentUrl = urlArray[currentIndex++];
                Logger.info(`尝试数据源 ${currentIndex}/${urlArray.length}: ${currentUrl}`);
                const startTime = Date.now();

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: currentUrl,
                    timeout: 10000,
                    onload(response) {
                        const loadTime = Date.now() - startTime;
                        try {
                            const json = JSON.parse(response.responseText);
                            // fix⑤: 无论哪个数据源成功，均以该 URL 为键进行缓存
                            const cached = CacheManager.set(currentUrl, json);
                            Logger.info(
                                `数据源 ${currentIndex} 请求成功 (${loadTime}ms, ${response.responseText.length}B, 缓存${cached ? '已保存' : '失败'})`
                            );
                            resolve(json);
                        } catch (e) {
                            Logger.error(`JSON 解析失败: ${currentUrl}`, e);
                            tryNextUrl();
                        }
                    },
                    onerror() {
                        Logger.warn(`数据源 ${currentIndex} 请求失败 (${Date.now() - startTime}ms): ${currentUrl}`);
                        tryNextUrl();
                    },
                    ontimeout() {
                        Logger.warn(`数据源 ${currentIndex} 请求超时: ${currentUrl}`);
                        tryNextUrl();
                    }
                });
            }

            tryNextUrl();
        });
    }

    function loadJSON(url) {
        return loadJSONWithFallback(Array.isArray(url) ? url : [url]);
    }

    // ==================== 构建课程映射 ====================
    function buildCourseMaps(categoryList, outlineList) {
        try {
            let categoryCount = 0, outlineCount = 0;

            if (Array.isArray(categoryList)) {
                categoryList.forEach(item => {
                    try {
                        if (item && item.course_code && item.category) {
                            courseCategoryMap[item.course_code.trim()] = item.category;
                            categoryCount++;
                        }
                    } catch (e) { Logger.warn('处理分类数据项时出错:', e); }
                });
            } else {
                Logger.warn('分类数据不是数组格式:', typeof categoryList);
            }

            if (Array.isArray(outlineList)) {
                outlineList.forEach(item => {
                    try {
                        if (item && item.course_code && item.id) {
                            courseOutlineMap[item.course_code.trim()] = item.id;
                            outlineCount++;
                        }
                    } catch (e) { Logger.warn('处理大纲数据项时出错:', e); }
                });
            } else {
                Logger.warn('大纲数据不是数组格式:', typeof outlineList);
            }

            Logger.info(`课程映射构建完成: 选修课类别 ${categoryCount} 条，课程大纲 ${outlineCount} 条`);
        } catch (e) {
            Logger.error('构建课程映射表失败:', e);
            if (typeof courseCategoryMap !== 'object') courseCategoryMap = {};
            if (typeof courseOutlineMap !== 'object') courseOutlineMap = {};
        }
    }

