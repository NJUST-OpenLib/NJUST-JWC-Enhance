// ==UserScript==
// @name         南理工教务增强助手
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  在合适的地方显示课程大纲、选修课类别及选修课学分情况
// @match        202.119.81.112/*
// @match        bkjw.njust.edu.cn/*
// @match        202.119.81.112:9080/*
// @match        202.119.81.113:9080/*
// @grant        GM_xmlhttpRequest
// @connect      jsdelivr.net
// @author       Light
// @license      MIT
// @supportURL   https://github.com/NJUST-OpenLib/NJUST-JWC-Enhance
// ==/UserScript==

(function () {
    'use strict';

    const CATEGORY_URL = 'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json';
    const OUTLINE_URL = 'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/kcdg.json';

    let courseCategoryMap = {};
    let courseOutlineMap = {};

    // 统一弹窗样式函数
    function createUnifiedModal(title, content, type = 'info') {
        // 移除可能存在的旧弹窗
        const existingModal = document.getElementById('njustAssistantModal');
        if (existingModal) {
            existingModal.remove();
        }

        const container = document.createElement('div');
        container.id = 'njustAssistantModal';

        // 根据类型设置不同的渐变色
        let gradientColor;
        switch (type) {
            case 'warning':
                gradientColor = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
                break;
            case 'success':
                gradientColor = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                break;
            case 'info':
            default:
                gradientColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                break;
        }

        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${gradientColor};
            border: none;
            border-radius: 15px;
            padding: 0;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 200px;
            max-width: 500px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            animation: fadeIn 0.3s ease-out;
        `;

        container.innerHTML = `
            <div id="dragHandle" style="
                background: rgba(255,255,255,0.1);
                padding: 15px 20px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.2);
            ">
                <div style="color: white; font-weight: bold; font-size: 18px;">
                    🎓 ${title}
                </div>
                <span style="
                    cursor: pointer;
                    color: rgba(255,255,255,0.8);
                    font-size: 18px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                "
                onclick="this.closest('div').parentElement.remove()"
                onmouseover="this.style.backgroundColor='rgba(255,255,255,0.2)'"
                onmouseout="this.style.backgroundColor='transparent'">✕</span>
            </div>
            <div style="
                background: white;
                padding: 25px;
            ">
                ${content}
                <div style="
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                    line-height: 1.4;
                    text-align: center;
                ">
                    <div style="margin-bottom: 8px;">
                        <strong>请查看</strong> |
                        <a href="https://enhance.njust.wiki" target="_blank" style="color: #007bff; text-decoration: none;">官方网站</a>
                       <strong>以获取使用说明</strong> |
                        </div>
                    <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 5px;">⚠️ 免责声明</div>
                    <div>本工具仅为学习交流使用，数据仅供参考。请以教务处官网信息为准，使用本工具产生的任何后果由用户自行承担。</div>
                </div>
            </div>
        `;

        // 添加CSS动画
        if (!document.getElementById('njustAssistantStyles')) {
            const style = document.createElement('style');
            style.id = 'njustAssistantStyles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        // 添加拖动功能
        addDragFunctionality(container);

        document.body.appendChild(container);
        return container;
    }

    // 拖动功能
    function addDragFunctionality(container) {
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        const dragHandle = container.querySelector('#dragHandle');

        function dragStart(e) {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            if (e.target === dragHandle || dragHandle.contains(e.target)) {
                isDragging = true;
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                xOffset = currentX;
                yOffset = currentY;
                container.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }

        dragHandle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        dragHandle.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', dragEnd);
    }

    // 检测强智科技页面
    function checkQiangzhiPage() {
        const currentUrl = window.location.href;
        const pageTitle = document.title;

        // 检测是否为强智科技页面且无法登录
        if (
            pageTitle.includes('强智科技教务系统概念版')) {

            const content = `
                <div style="text-align: center; font-size: 16px; color: #333; margin-bottom: 20px; line-height: 1.6;">
                    <div style="font-size: 20px; margin-bottom: 15px;">🚫 该页面无法登录</div>
                    <div>检测到您正在访问强智科技教务系统概念版，该页面无法正常登录。</div>
                    <div style="margin-top: 10px;">请转向以下正确的登录页面：</div>
                </div>
                <div style="text-align: center; margin: 20px 0;">
                    <div style="margin: 10px 0;">
                        <a href="https://ehall2.njust.edu.cn/index.html#/search?searchKey=%E6%95%99%E5%8A%A1&placeholder=" target="_blank" style="
                            display: inline-block;
                            background: #28a745;
                            color: white;
                            padding: 12px 20px;
                            text-decoration: none;
                            border-radius: 8px;
                            margin: 5px;
                            font-weight: bold;
                            transition: background-color 0.2s;
                        " onmouseover="this.style.backgroundColor='#218838'" onmouseout="this.style.backgroundColor='#28a745'">
                            🏫 智慧理工登录页面
                        </a>
                    </div>
                    <div style="margin: 10px 0;">
                        <a href="http://202.119.81.113:8080/" target="_blank" style="
                            display: inline-block;
                            background: #007bff;
                            color: white;
                            padding: 12px 20px;
                            text-decoration: none;
                            border-radius: 8px;
                            margin: 5px;
                            font-weight: bold;
                            transition: background-color 0.2s;
                        " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">
                            🔗 教务处登录页面
                        </a>
                    </div>
                </div>
                <div style="
                    margin-top: 15px;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    font-size: 14px;
                    color: #666;
                    text-align: center;
                ">
                    💡 提示：请使用上述链接进行登录，登录后可正常使用教务系统功能
                </div>
            `;

            createUnifiedModal('南理工教务助手', content, 'warning');
            return true;
        }
        return false;
    }

    function loadJSON(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url,
                onload: function (response) {
                    try {
                        const json = JSON.parse(response.responseText);
                        resolve(json);
                    } catch (e) {
                        console.error(`解析 JSON 失败: ${url}`, e);
                        reject(e);
                    }
                },
                onerror: function (err) {
                    console.error(`加载失败: ${url}`, err);
                    reject(err);
                }
            });
        });
    }

    function buildCourseMaps(categoryList, outlineList) {
        categoryList.forEach(item => {
            if (item.course_code && item.category) {
                courseCategoryMap[item.course_code.trim()] = item.category;
            }
        });

        outlineList.forEach(item => {
            if (item.course_code && item.id) {
                courseOutlineMap[item.course_code.trim()] = item.id;
            }
        });
    }

    function createCreditSummaryWindow() {
        // 使用统一的弹窗样式，但保持原有的固定位置和拖动功能
        const container = document.createElement('div');
        container.id = 'creditSummaryWindow';
        container.style.cssText = `
            position: fixed;
            top: 40px;
            right: 40px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 14px;
            padding: 0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.13);
            z-index: 9999;
            min-width: 420px;
            max-width: 520px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        `;

        container.innerHTML = `
            <div id="creditDragHandle" style="
                background: #f5f6fa;
                padding: 14px 22px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #e0e0e0;
            ">
                <div style="color: #333; font-weight: 600; font-size: 17px; letter-spacing: 1px;">
                    🎓 南理工教务增强助手
                </div>
                <span style="
                    cursor: pointer;
                    color: #888;
                    font-size: 18px;
                    padding: 2px 8px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                "
                onclick="this.closest('div').parentElement.remove()"
                onmouseover="this.style.backgroundColor='#e0e0e0'"
                onmouseout="this.style.backgroundColor='transparent'">✕</span>
            </div>
            <div style="
                background: #fff;
                padding: 18px 22px 10px 22px;
                max-height: 540px;
                overflow-y: auto;
            ">
                <div id="creditSummary"></div>
                <div style="
                    margin-top: 18px;
                    padding-top: 12px;
                    border-top: 1px solid #e0e0e0;
                    font-size: 13px;
                    color: #888;
                    line-height: 1.6;
                    text-align: left;
                ">
                 <div style="color: #e67e22; font-weight: 500; margin-bottom: 5px;">⚠️ 特别声明</div>
                    <div>选修课类别可能发生变化，仅供参考。<br>本工具可能因为教务处改版而不可靠，不对数据准确性负责</div>
                    <div style="margin-bottom: 8px;">
                        <span>请查看 <a href="https://enhance.njust.wiki" target="_blank" style="color: #007bff; text-decoration: none;">南理工教务增强助手官方网站</a> 以获取使用说明</span>
                    </div>
                </div>
            </div>
        `;

        // 添加拖动功能
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        const dragHandle = container.querySelector('#creditDragHandle');

        function dragStart(e) {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            if (e.target === dragHandle || dragHandle.contains(e.target)) {
                isDragging = true;
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                xOffset = currentX;
                yOffset = currentY;
                container.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }

        dragHandle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        dragHandle.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', dragEnd);

        document.body.appendChild(container);
        return container;
    }

    function updateCreditSummary() {
        const creditSummaryDiv = document.getElementById('creditSummary');
        if (!creditSummaryDiv) return;

        const creditsByType = {}; // 按课程类型（通识教育课等）统计
        const creditsByCategory = {}; // 按选修课类别统计
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const tds = row.querySelectorAll('td');
                if (tds.length >= 11) {
                    const courseCode = tds[2].textContent.trim();
                    const credit = parseFloat(tds[6].textContent) || 0;
                    const courseType = tds[10].textContent.trim(); // 课程类型（通识教育课等）

                    // 从页面上已显示的类别信息中提取选修课类别
                    const categoryDiv = tds[2].querySelector('[data-category-inserted]');
                    let category = null;
                    if (categoryDiv) {
                        // 直接获取文本内容，因为现在只显示类别名称
                        category = categoryDiv.textContent.trim();
                        // 如果文本为空或者不是有效的类别，则设为null
                        if (!category || category.length === 0) {
                            category = null;
                        }
                    }

                    // 按课程类型统计
                    if (courseType) {
                        if (!creditsByType[courseType]) {
                            creditsByType[courseType] = {
                                credits: 0,
                                count: 0
                            };
                        }
                        creditsByType[courseType].credits += credit;
                        creditsByType[courseType].count += 1;
                    }

                    // 按选修课类别统计
                    if (category) {
                        if (!creditsByCategory[category]) {
                            creditsByCategory[category] = {
                                credits: 0,
                                count: 0
                            };
                        }
                        creditsByCategory[category].credits += credit;
                        creditsByCategory[category].count += 1;
                    }
                }
            });
        });

        // 计算总计
        const totalCreditsByType = Object.values(creditsByType).reduce((sum, data) => sum + data.credits, 0);
        const totalCountByType = Object.values(creditsByType).reduce((sum, data) => sum + data.count, 0);
        const totalCreditsByCategory = Object.values(creditsByCategory).reduce((sum, data) => sum + data.credits, 0);
        const totalCountByCategory = Object.values(creditsByCategory).reduce((sum, data) => sum + data.count, 0);

        // 生成HTML - 表格样式布局
        let summaryHTML = '<div style="border-bottom: 1px solid #e0e0e0; margin-bottom: 12px; padding-bottom: 10px;">';
        summaryHTML += '<div style="margin-bottom: 8px; font-size: 15px; color: #222; font-weight: 600; letter-spacing: 0.5px;">📊 按课程类型统计</div>';
        // 总计行
        summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center; background: #f7f7fa; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px;">
            <span style="color: #007bff; font-weight: 600; font-size: 13px; text-align: left;">总计</span>
            <span style="font-weight: 600; color: #007bff; font-size: 13px; text-align: left;">${totalCreditsByType.toFixed(1)} 学分</span>
            <span style="color: #007bff; font-weight: 600; font-size: 13px; text-align: left;">${totalCountByType} 门</span>
        </div>`;
        // 课程类型表格
        summaryHTML += '<div style="display: grid; gap: 2px;">';
        for (const [type, data] of Object.entries(creditsByType)) {
            summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                <span style="color: #444; font-weight: 400; font-size: 13px; text-align: left;">${type}</span>
                <span style="font-weight: 400; color: #333; font-size: 13px; text-align: left;">${data.credits.toFixed(1)} 学分</span>
                <span style="color: #888; font-size: 13px; text-align: left;">${data.count} 门</span>
            </div>`;
        }
        summaryHTML += '</div>';
        summaryHTML += '</div>';

        if (Object.keys(creditsByCategory).length > 0) {
            summaryHTML += '</div><div style="margin-top: 16px;">';
            summaryHTML += '<div style="margin-bottom: 8px; font-size: 15px; color: #222; font-weight: 600; letter-spacing: 0.5px;">🏷️ 按选修课类别统计</div>';
            // 总计行
            summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center; background: #f7f7fa; border-radius: 4px; padding: 4px 6px; margin-bottom: 4px;">
                <span style="color: 007bff; font-weight: 600; font-size: 13px; text-align: left;">总计</span>
                <span style="font-weight: 600; color: #007bff; font-size: 13px; text-align: left;">${totalCreditsByCategory.toFixed(1)} 学分</span>
                <span style="color: #007bff; font-weight: 600; font-size: 13px; text-align: left;">${totalCountByCategory} 门</span>
            </div>`;
            // 选修课类别表格
            summaryHTML += '<div style="display: grid; gap: 2px;">';
            for (const [category, data] of Object.entries(creditsByCategory)) {
                summaryHTML += `<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; padding: 2px 0; align-items: center;">
                    <span style="color: #444; font-weight: 400; font-size: 13px; text-align: left;">${category}</span>
                    <span style="font-weight: 400; color: #333; font-size: 13px; text-align: left;">${data.credits.toFixed(1)} 学分</span>
                    <span style="color: #888; font-size: 13px; text-align: left;">${data.count} 门</span>
                </div>`;
            }
            summaryHTML += '</div>';
        }
        summaryHTML += '</div>';

        creditSummaryDiv.innerHTML = summaryHTML || '暂无数据';
    }

    function processAllTables() {
        const tables = document.querySelectorAll('table');
        const isGradePage = window.location.pathname.includes('/njlgdx/kscj/cjcx_list');
        const isSchedulePage = window.location.pathname.includes('xskb_list.do') &&
                              document.title.includes('学期理论课表');

        tables.forEach(table => {
            // 如果是课表页面，只处理 id="dataList" 的表格
            if (isSchedulePage && table.id !== 'dataList') {
                return;
            }

            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const tds = row.querySelectorAll('td');
                if (tds.length < 3) return;

                let courseCodeTd;
                let courseCode;

                if (isGradePage) {
                    courseCodeTd = tds[2]; // 成绩页面课程代码在第3列
                    courseCode = courseCodeTd.textContent.trim();
                } else if (isSchedulePage) {
                    courseCodeTd = tds[1]; // 课表页面课程代码在第2列
                    courseCode = courseCodeTd.textContent.trim();
                } else {
                    courseCodeTd = tds[1];
                    const parts = courseCodeTd.innerHTML.split('<br>');
                    if (parts.length === 2) {
                        courseCode = parts[1].trim();
                    } else {
                        return;
                    }
                }

                // 插入类别
                if (!courseCodeTd.querySelector('[data-category-inserted]')) {
                    const category = courseCategoryMap[courseCode];
                    if (category) {
                        const catDiv = document.createElement('div');
                        catDiv.setAttribute('data-category-inserted', '1');
                        catDiv.style.color = '#28a745';
                        catDiv.style.fontWeight = 'bold';
                        catDiv.style.marginTop = '4px';
                        // 只显示类别名称，不显示前缀
                        catDiv.textContent = category;
                        courseCodeTd.appendChild(catDiv);
                    }
                }

                // 插入老师说明（来自 title，仅在非成绩页面和非课表页面）
                if (!isGradePage && !isSchedulePage && courseCodeTd.title && !courseCodeTd.querySelector('[data-title-inserted]')) {
                    const titleDiv = document.createElement('div');
                    titleDiv.setAttribute('data-title-inserted', '1');
                    titleDiv.style.color = '#666';
                    titleDiv.style.fontSize = '13   px';
                    titleDiv.style.marginTop = '4px';
                    titleDiv.style.fontStyle = 'italic';
                    titleDiv.textContent = `📌 老师说明：${courseCodeTd.title}`;
                    courseCodeTd.appendChild(titleDiv);
                }

                // 插入课程大纲链接
                if (!courseCodeTd.querySelector('[data-outline-inserted]')) {
                    const realId = courseOutlineMap[courseCode];
                    const outlineDiv = document.createElement('div');
                    outlineDiv.setAttribute('data-outline-inserted', '1');
                    outlineDiv.style.marginTop = '4px';

                    if (realId) {
                        const link = document.createElement('a');
                        link.href = `http://202.119.81.112:8080/kcxxAction.do?method=kcdgView&jx02id=${realId}&isentering=0`;
                        link.textContent = '📘 查看课程大纲';
                        link.target = '_blank';
                        link.style.color = '#0077cc';
                        outlineDiv.appendChild(link);
                    } else {
                        outlineDiv.textContent = '❌ 无大纲信息';
                        outlineDiv.style.color = 'gray';
                    }
                    courseCodeTd.appendChild(outlineDiv);
                }
            });
        });

        // 更新学分统计（仅在成绩页面）
        if (isGradePage) {
            updateCreditSummary();
        }
    }

    async function init() {
        try {
            // 首先检测强智科技页面
            if (checkQiangzhiPage()) {
                return; // 如果是强智科技页面，显示提示后直接返回
            }

            const [categoryData, outlineData] = await Promise.all([
                loadJSON(CATEGORY_URL),
                loadJSON(OUTLINE_URL)
            ]);
            buildCourseMaps(categoryData, outlineData);

            // 如果是成绩页面，创建悬浮窗
            if (window.location.pathname.includes('/njlgdx/kscj/cjcx_list')) {
                createCreditSummaryWindow();
            }

            processAllTables();

            const observer = new MutationObserver(() => {
                // 每次页面变化时也检查强智科技页面
                if (!checkQiangzhiPage()) {
                    processAllTables();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

        } catch (err) {
            console.error('初始化失败：', err);
        }
    }

    setTimeout(init, 1000);
})();