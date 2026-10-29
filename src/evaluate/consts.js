// ================================================================
//  【模块二】自动评教助手 V1
//  功能：自动填分、批量保存、批量提交、分值实时预览
//  适用页面：学生评教入口 (xspj_find.do)、课程列表 (xspj_list.do)、评价详情 (xspj_edit.do)
// ================================================================

(function () {
    'use strict';

    // ── 常量定义 ─────────────────────────────────────────────────────
    // 存储键名，用于跨页面同步状态
    const KEY_STORE = 'njust_eval_v1_store';    // 核心存储：课程状态、评分选项等
    const KEY_RUNNING = 'njust_eval_running';     // 全局标志：是否处于“开始评价并保存”流水线中
    const KEY_BUSY = 'njust_eval_busy';        // 互斥锁：防止多个窗口同时执行保存操作
    const KEY_QUEUE = 'njust_eval_queue';       // 队列：待处理的类别 URL 列表
    const KEY_CURLIST = 'njust_eval_curlist';     // 当前正在处理的类别 URL
    const KEY_LOG = 'njust_eval_log';         // 日志存储
    const KEY_LOGLVL = 'njust_eval_loglvl';      // 日志显示等级过滤
    const KEY_SUBQUEUE = 'njust_eval_subqueue';    // 待提交课程的 URL 队列
    const KEY_SUBRUN = 'njust_eval_subrun';      // 全局标志：是否处于“提交已评课程”流水线中
    const KEY_SUBBSY = 'njust_eval_subbsy';      // 互斥锁：防止多个窗口同时执行提交操作

    // URL 参数，用于传递指令给详情页
    const PARAM_AUTO = 'isAutoEval';             // 详情页接收后执行自动填分+保存
    const PARAM_SUBMIT = 'isAutoSubmit';           // 详情页接收后执行自动提交
    const MAX_LOG = 300;                      // 日志最大保留条数

    // ── 日志系统 ─────────────────────────────────────────────────────
    // 日志级别与 UI 映射
    const LOG_LEVELS = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
    const LOG_LABELS = { debug: 'DBG', info: 'INF', success: 'OK ', warn: 'WRN', error: 'ERR' };
    const LOG_ICONS = { debug: '🔍', info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };

    // 日志持久化与读取
    const loadLogs = () => JSON.parse(localStorage.getItem(KEY_LOG) || '[]');
    const clearLogs = () => { localStorage.removeItem(KEY_LOG); renderLogPanel(); };
    const getMinLevel = () => { const s = localStorage.getItem(KEY_LOGLVL); return (s && LOG_LEVELS[s] !== undefined) ? s : 'info'; };
    const setMinLevel = (l) => { localStorage.setItem(KEY_LOGLVL, l); renderLogPanel(); };

    /**
     * 推送新日志并更新面板
     * 同时输出到模块一的 LogPanelUI（如果存在）
     */
    const pushLog = (msg, level = 'info') => {
        const logs = loadLogs();
        logs.push({ ts: new Date().toTimeString().slice(0, 8), msg, level });
        if (logs.length > MAX_LOG) logs.splice(0, logs.length - MAX_LOG);
        localStorage.setItem(KEY_LOG, JSON.stringify(logs));
        renderLogPanel();

        // 同步输出到模块一的日志面板
        if (window.__NJUST_LOGGER__) {
            const levelMap = { debug: 4, info: 3, success: 3, warn: 2, error: 1 };
            const loggerLevel = levelMap[level] || 3;
            window.__NJUST_LOGGER__.log(loggerLevel, `[评教] ${msg}`);
        }
    };
    const logInfo = (m) => pushLog(m, 'info');
    const logSuccess = (m) => pushLog(m, 'success');
    const logError = (m) => pushLog(m, 'error');

    /**
     * 渲染控制面板底部的日志区域（已简化，日志现在显示在模块一的面板中）
     */
    const renderLogPanel = () => {
        // 日志现在统一显示在模块一的 LogPanelUI 中
        // 此函数仅用于内部状态更新，不再渲染独立的日志区块
    };

    // ── 通用工具函数 ──────────────────────────────────────────────────
    // HTML 转义防止 XSS
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 解析 URL 参数
    const qp = (url, key) => {
        try { return new URL(url, location.origin).searchParams.get(key) || ''; }
        catch { return url.match(new RegExp(`[?&]${key}=([^&]+)`))?.[1] || ''; }
    };

    // 生成课程唯一 Key (课程ID + 教师ID)
    const courseKey = (url) => { const cid = qp(url, 'jx02id'), tid = qp(url, 'jg0101id'); return cid && tid ? `${cid}__${tid}` : null; };
    const appendParam = (url, key, val) => url + (url.includes('?') ? '&' : '?') + key + '=' + val;
    const withAuto = (url, val) => appendParam(url, PARAM_AUTO, val);
    const withSubmit = (url) => appendParam(url, PARAM_SUBMIT, 'true');
    const roundFloat = (n) => Math.round(n * 1e9) / 1e9; // 解决浮点数精度误差

    // 快捷访问 LocalStorage
    const loadStore = () => JSON.parse(localStorage.getItem(KEY_STORE) || '{}');
    const saveStore = (v) => localStorage.setItem(KEY_STORE, JSON.stringify(v));
    const loadQueue = () => JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
    const saveQueue = (q) => localStorage.setItem(KEY_QUEUE, JSON.stringify(q));
    const loadSubQueue = () => JSON.parse(localStorage.getItem(KEY_SUBQUEUE) || '[]');
    const saveSubQueue = (q) => localStorage.setItem(KEY_SUBQUEUE, JSON.stringify(q));

    /**
     * 在控制面板预览当前存储的课程状态
     */
    const renderStoragePanel = () => {
        const el = document.getElementById('v80-storage-pre');
        if (el) el.textContent = JSON.stringify(loadStore(), null, 2);
    };

