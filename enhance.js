// ==UserScript==
// @name         1南理工选课增强脚本（类别 + 大纲 + 老师说明）
// @namespace    http://tampermonkey.net/
// @version      8
// @description  在课程代码下方完整显示：选修类别、老师说明、大纲链接
// @match        202.119.81.112/*
// @match        bkjw.njust.edu.cn/*
// @match       202.119.81.112:9080/*
// @match       202.119.81.113:9080/*
// @grant        GM_xmlhttpRequest
// @connect      fastly.jsdelivr.net
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
            border-radius: 20px;
            padding: 0;
            box-shadow: 0 16px 48px rgba(0,0,0,0.25), 0 1.5px 8px rgba(0,0,0,0.08);
            z-index: 10000;
            min-width: 420px;
            max-width: 540px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            animation: fadeIn 0.3s ease-out;
            backdrop-filter: blur(12px) saturate(1.2);
        `;

        container.innerHTML = `
            <div id="dragHandle" style="
                background: rgba(255,255,255,0.18);
                padding: 18px 28px 14px 28px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1.5px solid rgba(255,255,255,0.22);
                user-select: none;
            ">
                <div style="color: white; font-weight: bold; font-size: 20px; letter-spacing: 1px;">
                    🎓 ${title}
                </div>
                <span style="
                    cursor: pointer;
                    color: rgba(255,255,255,0.85);
                    font-size: 22px;
                    padding: 4px 10px;
                    border-radius: 6px;
                    transition: background-color 0.18s;
                "
                onclick="this.closest('div').parentElement.remove()"
                onmouseover="this.style.backgroundColor='rgba(255,255,255,0.25)'"
                onmouseout="this.style.backgroundColor='transparent'">✕</span>
            </div>
            <div style="
                background: rgba(255,255,255,0.93);
                padding: 32px 32px 18px 32px;
                border-radius: 0 0 20px 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.03);
            ">
                ${content}
                <div style="
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1.5px solid #eee;
                    font-size: 13px;
                    color: #666;
                    line-height: 1.5;
                    text-align: center;
                ">
                    <div style="margin-bottom: 10px;">
                        <strong>🎓 南理工教务助手</strong> |
                        <a href="https://njust.wiki" target="_blank" style="color: #007bff; text-decoration: none;">官方网站</a>
                    </div>
                    <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 6px;">⚠️ 免责声明</div>
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
        const container = document.createElement('div');
        container.id = 'creditSummaryWindow';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            min-width: 280px;
            max-width: 320px;
            font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            overflow: hidden;
            z-index: 9999;
            border: 1px solid #e1e5e9;
        `;
        container.innerHTML = `
            <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:16px;font-weight:600;color:#2c3e50;">📊 学分统计</span>
                    <button onclick="this.closest('div').parentElement.remove()" style="background:none;border:none;font-size:18px;color:#95a5a6;cursor:pointer;padding:0;width:20px;height:20px;">&times;</button>
                </div>
            </div>
            <div style="padding:20px;background:#fafbfc;">
                <div id="creditSummary"></div>
                <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e9ecef;font-size:11px;color:#6c757d;text-align:center;">
                    <a href="https://njust.wiki" target="_blank" style="color:#007bff;text-decoration:none;">南理工教务助手</a>
                </div>
            </div>
        `;
    }

    function updateCreditSummary() {
        const creditSummaryDiv = document.getElementById('creditSummary');
        if (!creditSummaryDiv) return;
        const creditsByType = {};
        const creditsByCategory = {};
        let totalCredits = 0, totalCourses = 0, electiveCredits = 0;
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const tds = row.querySelectorAll('td');
                if (tds.length >= 11) {
                    const courseCode = tds[2].textContent.trim();
                    const credit = parseFloat(tds[6].textContent) || 0;
                    const courseType = tds[10].textContent.trim();
                    const categoryDiv = tds[2].querySelector('[data-category-inserted]');
                    let category = null;
                    if (categoryDiv) {
                        category = categoryDiv.textContent.trim();
                        if (!category) category = null;
                    }
                    totalCredits += credit;
                    totalCourses += 1;
                    if (category) electiveCredits += credit;
                    if (courseType) {
                        if (!creditsByType[courseType]) creditsByType[courseType] = {credits: 0, count: 0};
                        creditsByType[courseType].credits += credit;
                        creditsByType[courseType].count += 1;
                    }
                    if (category) {
                        if (!creditsByCategory[category]) creditsByCategory[category] = {credits: 0, count: 0};
                        creditsByCategory[category].credits += credit;
                        creditsByCategory[category].count += 1;
                    }
                }
            });
        });
        let summaryHTML = `<div style=\"margin-bottom:10px;\"><strong style=\"color:#222;\">课程总学分：</strong><span style=\"color:#007bff;font-weight:bold;\">${totalCredits.toFixed(1)}</span>，<strong style=\"color:#222;\">课程总数：</strong><span style=\"color:#007bff;font-weight:bold;\">${totalCourses}</span></div>`;
        summaryHTML += `<div style=\"margin-bottom:10px;\"><strong style=\"color:#222;\">选修课总学分：</strong><span style=\"color:#28a745;font-weight:bold;\">${electiveCredits.toFixed(1)}</span></div>`;
        summaryHTML += '<div style="border-bottom:1px solid #eee;margin-bottom:8px;padding-bottom:6px;"><strong style="color:#333;">按课程类型统计：</strong><br>';
        for (const [type, data] of Object.entries(creditsByType)) {
            summaryHTML += `<div style=\"margin:3px 0;\"><span style=\"color:#007bff;\">${type}:</span> <strong>${data.credits.toFixed(1)}</strong> 学分 <span style=\"color:#888;\">（${data.count} 门）</span></div>`;
        }
        summaryHTML += '</div>';
        if (Object.keys(creditsByCategory).length > 0) {
            summaryHTML += '<div style="margin-top:8px;"><strong style="color:#333;">按选修课类别统计：</strong><br>';
            for (const [category, data] of Object.entries(creditsByCategory)) {
                summaryHTML += `<div style=\"margin:3px 0;\"><span style=\"color:#28a745;\">${category}:</span> <strong>${data.credits.toFixed(1)}</strong> 学分 <span style=\"color:#888;\">（${data.count} 门）</span></div>`;
            }
            summaryHTML += '</div>';
        }
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
                    titleDiv.style.fontSize = '13px';
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