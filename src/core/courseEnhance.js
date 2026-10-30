    function processAllTables() {
        try {
            const tables = document.querySelectorAll('table');
            // 页面类型识别
            const isGradePage = window.location.pathname.includes('/njlgdx/kscj/cjcx_list');
            const isSchedulePage = window.location.pathname.includes('xskb_list.do') &&
                document.title.includes('学期理论课表');
            const isSmartCampus = window.location.href.includes('bkjw.njust.edu.cn');

            let processedTables = 0, processedRows = 0, enhancedCourses = 0;

            tables.forEach(table => {
                try {
                    // 课表页面只处理 id 为 dataList 的主表格
                    if (isSchedulePage && table.id !== 'dataList') return;
                    const rows = table.querySelectorAll('tr');
                    processedTables++;

                    rows.forEach(row => {
                        try {
                            const tds = row.querySelectorAll('td');
                            if (tds.length < 3) return; // 略过非数据行
                            processedRows++;

                            let courseCodeTd, courseCode;

                            // 不同页面的课程代码提取逻辑差异化处理
                            if (isGradePage) {
                                courseCodeTd = tds[2];
                                courseCode = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                            } else if (isSchedulePage) {
                                courseCodeTd = tds[1];
                                courseCode = courseCodeTd ? courseCodeTd.textContent.trim() : '';
                            } else {
                                // 通用逻辑：提取形如 "课程名<br>课程代码" 的结构
                                courseCodeTd = tds[1];
                                if (courseCodeTd && courseCodeTd.innerHTML) {
                                    const parts = courseCodeTd.innerHTML.split('<br>');
                                    if (parts.length === 2) courseCode = parts[1].trim();
                                    else return;
                                } else return;
                            }

                            if (!courseCode) return;
                            let courseEnhanced = false;

                            // 1. 插入选修课类别（如：人文素养、自然科学等）
                            try {
                                if (courseCodeTd && !courseCodeTd.querySelector('[data-category-inserted]')) {
                                    const category = courseCategoryMap[courseCode];
                                    if (category) {
                                        const catDiv = document.createElement('div');
                                        catDiv.setAttribute('data-category-inserted', '1');
                                        catDiv.style.color = '#28a745';
                                        catDiv.style.fontWeight = 'bold';
                                        catDiv.style.marginTop = '4px';
                                        catDiv.textContent = category;
                                        courseCodeTd.appendChild(catDiv);
                                        courseEnhanced = true;
                                    }
                                }
                            } catch (e) { Logger.warn('添加课程类别时出错:', e); }

                            // 2. 插入老师说明（将 <td> 的 title 属性显性化）
                            try {
                                if (!isGradePage && !isSchedulePage && courseCodeTd &&
                                    courseCodeTd.title && !courseCodeTd.querySelector('[data-title-inserted]')) {
                                    const titleDiv = document.createElement('div');
                                    titleDiv.setAttribute('data-title-inserted', '1');
                                    titleDiv.style.color = '#666';
                                    titleDiv.style.fontSize = '13px';
                                    titleDiv.style.marginTop = '4px';
                                    titleDiv.style.fontStyle = 'italic';
                                    titleDiv.textContent = `📌 老师说明: ${courseCodeTd.title}`;
                                    courseCodeTd.appendChild(titleDiv);
                                    courseEnhanced = true;
                                }
                            } catch (e) { Logger.warn('添加老师说明时出错:', e); }

                            // 3. 插入教学大纲链接
                            try {
                                if (courseCodeTd && !courseCodeTd.querySelector('[data-outline-inserted]')) {
                                    const outlineDiv = document.createElement('div');
                                    outlineDiv.setAttribute('data-outline-inserted', '1');
                                    outlineDiv.style.marginTop = '4px';

                                    if (isSmartCampus) {
                                        // 智慧理工平台因跨域和权限限制，无法直接预览官网大纲
                                        outlineDiv.textContent = '⚠️ 课程大纲功能受限';
                                        outlineDiv.style.color = '#ff9800';
                                        outlineDiv.style.fontWeight = 'bold';
                                        outlineDiv.style.cursor = 'pointer';
                                        outlineDiv.title = '当前使用智慧理工平台，课程大纲功能受限。请访问教务处官网获取完整功能';
                                    } else {
                                        const realId = courseOutlineMap[courseCode];
                                        if (realId) {
                                            const link = document.createElement('a');
                                            // 拼接教务处官网预览链接（协议相对，跟随当前页面 http/https）
                                            link.href = `//202.119.81.112:8080/kcxxAction.do?method=kcdgView&jx02id=${realId}&isentering=0`;
                                            link.textContent = '📘 查看课程大纲';
                                            link.target = '_blank';
                                            link.style.color = '#0077cc';
                                            outlineDiv.appendChild(link);
                                        } else {
                                            outlineDiv.textContent = '❌ 无大纲信息';
                                            outlineDiv.style.color = 'gray';
                                        }
                                    }
                                    courseCodeTd.appendChild(outlineDiv);
                                    courseEnhanced = true;
                                }
                            } catch (e) { Logger.warn('添加课程大纲链接时出错:', e); }

                            if (courseEnhanced) enhancedCourses++;
                        } catch (e) { Logger.warn('处理表格行时出错:', e); }
                    });
                } catch (e) { Logger.warn('处理表格时出错:', e); }
            });

            Logger.info(`表格处理完成: ${processedTables}个表格, ${processedRows}行, 增强${enhancedCourses}门课程`);

            // 成绩页面额外执行学分实时汇总
            if (isGradePage) updateCreditSummary();
        } catch (e) {
            Logger.error('处理页面表格失败:', e);
        }
    }

    /**
     * ── 登录保活与自动修复系统 ───────────────────────────────────────
     * 解决教务系统频繁掉线、重复登录导致的报错页面。
     */
