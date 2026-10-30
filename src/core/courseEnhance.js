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
                                    titleDiv.textContent = `老师说明: ${courseCodeTd.title}`;
                                    courseCodeTd.appendChild(titleDiv);
                                    courseEnhanced = true;
                                }
                            } catch (e) { Logger.warn('添加老师说明时出错:', e); }

                            // 3. 插入教学大纲链接（原始 + 镜像）
                            try {
                                if (courseCodeTd && !courseCodeTd.querySelector('[data-outline-inserted]')) {
                                    const outlineDiv = document.createElement('div');
                                    outlineDiv.setAttribute('data-outline-inserted', '1');
                                    outlineDiv.style.marginTop = '4px';
                                    outlineDiv.style.fontSize = '13px';
                                    // 三个链接可能较长，允许自动换行
                                    outlineDiv.style.display = 'flex';
                                    outlineDiv.style.flexWrap = 'wrap';
                                    outlineDiv.style.gap = '2px';

                                    const realId = courseOutlineMap[courseCode];

                                    const makeOutlineLink = (href, text, title) => {
                                        const link = document.createElement('a');
                                        link.href = href;
                                        link.textContent = text;
                                        link.target = '_blank';
                                        link.rel = 'noopener noreferrer';
                                        link.style.color = 'var(--nju-primary)';
                                        link.style.textDecoration = 'none';
                                        link.style.marginLeft = '2px';
                                        if (title) link.title = title;
                                        return link;
                                    };

                                    const outlineMode = getOutlineMode();
                                    if (outlineMode !== 'none') {
                                        const showOriginal = (outlineMode === 'both' || outlineMode === 'original') && !!realId;
                                        const showMirror = (outlineMode === 'both' || outlineMode === 'mirror');

                                        if (showOriginal) {
                                            // 智慧理工平台大纲：内容与教务处一致，页面标题显示为 2018 版本，校内外均可访问
                                            outlineDiv.appendChild(makeOutlineLink(
                                                `https://bkjw.njust.edu.cn/njlgdx/view/pyfa/kcdg_View.jsp?jx02id=${realId}`,
                                                '[课程大纲1]',
                                                '智慧理工平台大纲：页面标题显示为 2018 版本，内容与教务处一致，校内外均可访问'
                                            ));

                                            // 老教务网站大纲：页面标题显示为 2022 版本，仅校园网可访问
                                            outlineDiv.appendChild(makeOutlineLink(
                                                `//202.119.81.112:8080/kcxxAction.do?method=kcdgView&jx02id=${realId}&isentering=0`,
                                                '[课程大纲2]',
                                                '老教务网站大纲：页面标题显示为 2022 版本，仅校园网可访问（内容与智慧理工版本基本一致）'
                                            ));
                                        }

                                        if (showMirror) {
                                            // 镜像站已收录全部课程（以课程号为唯一 key），不依赖 kcdg.json 映射，
                                            // 即使该课程未上传大纲，链接依然可以访问
                                            // 未收录官方大纲时，把入口称为「课程详情」更贴切
                                            outlineDiv.appendChild(makeOutlineLink(
                                                `https://kcdg.njust.store/html/${encodeURIComponent(courseCode)}.html`,
                                                realId ? '[大纲镜像]' : '[课程详情]',
                                                realId
                                                    ? '课程大纲镜像站（校内外均可访问）'
                                                    : '课程详情：该课程未收录官方大纲，可在镜像站查看课程信息（校内外均可访问）'
                                            ));
                                        }

                                        courseCodeTd.appendChild(outlineDiv);
                                        courseEnhanced = true;
                                    }
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
