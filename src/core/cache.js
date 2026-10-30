    const CacheManager = {
        /**
         * 生成 URL 对应的哈希键名
         */
        getKey(url) {
            return CACHE_CONFIG.prefix + btoa(unescape(encodeURIComponent(url))).replace(/[^a-zA-Z0-9]/g, '');
        },

        /**
         * 存入缓存
         */
        set(url, data) {
            if (!CACHE_CONFIG.enabled) return false;
            try {
                const cacheData = {
                    data,
                    timestamp: Date.now(),
                    ttl: CACHE_CONFIG.ttl * 1000,
                    url
                };
                localStorage.setItem(this.getKey(url), JSON.stringify(cacheData));
                if (DEBUG_CONFIG.showCache) Logger.info(`缓存已保存: ${url}`);
                return true;
            } catch (e) {
                Logger.error('缓存保存失败: ', e);
                return false;
            }
        },

        /**
         * 读取缓存（包含过期校验）
         */
        get(url) {
            if (!CACHE_CONFIG.enabled) return null;
            try {
                const key = this.getKey(url);
                const cached = localStorage.getItem(key);
                if (!cached) {
                    if (DEBUG_CONFIG.showCache) Logger.debug(`缓存未命中: ${url}`);
                    return null;
                }
                const cacheData = JSON.parse(cached);
                const now = Date.now();
                // 过期判断
                if (now - cacheData.timestamp > cacheData.ttl) {
                    localStorage.removeItem(key);
                    if (DEBUG_CONFIG.showCache) Logger.warn(`⏰ 缓存已过期: ${url}`);
                    return null;
                }
                const age = ((now - cacheData.timestamp) / 1000).toFixed(1);
                const remaining = ((cacheData.ttl - (now - cacheData.timestamp)) / 1000).toFixed(1);
                if (DEBUG_CONFIG.showCache) Logger.info(`缓存命中: ${url} (已缓存${age}s，剩余${remaining}s)`);
                return cacheData.data;
            } catch (e) {
                Logger.error('缓存读取失败: ', e);
                return null;
            }
        },

        /**
         * 清空本脚本产生的所有缓存
         */
        clear() {
            try {
                const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_CONFIG.prefix));
                keys.forEach(k => localStorage.removeItem(k));
                Logger.info(`已清除 ${keys.length} 个缓存项`);
                return keys.length;
            } catch (e) {
                Logger.error('清除缓存失败: ', e);
                return 0;
            }
        },

        /**
         * 获取缓存占用情况统计
         */
        getStats() {
            try {
                const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_CONFIG.prefix));
                let totalSize = 0, validCount = 0, expiredCount = 0;
                const now = Date.now();
                keys.forEach(k => {
                    try {
                        const cached = localStorage.getItem(k);
                        totalSize += cached.length;
                        const d = JSON.parse(cached);
                        (now - d.timestamp > d.ttl) ? expiredCount++ : validCount++;
                    } catch (e) { expiredCount++; }
                });
                return { total: keys.length, valid: validCount, expired: expiredCount, size: totalSize };
            } catch (e) {
                Logger.error('获取缓存统计失败: ', e);
                return { total: 0, valid: 0, expired: 0, size: 0 };
            }
        }
    };

    // fix④: 彻底移除与 LogPanelUI 职责重叠的 StatusNotifier，
    //        原代码中该系统的调用已被注释，直接删除其定义以消除冗余。

