// ==UserScript==
// @name         课程采集助手V2（带暂停/停止+完整大纲链接+格式化展示）
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  自动采集课程信息，自动翻页，导出 CSV，带暂停/停止，展示格式化数据表格，拼接完整大纲 URL，支持一键导出课程 JSON
// @author       Light + ChatGPT
// @match        http://202.119.81.112:8080//Logon.do*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // 添加 removeNode 方法以兼容老旧代码
  Element.prototype.removeNode = function(deep) {
      if (deep && this.parentNode) {
          this.parentNode.removeChild(this);
      } else if (this.parentNode) {
          this.parentNode.removeChild(this);
      }
      return this;
  };

  // 状态变量
  let allCourses = [];
  let isAutoRunning = false;
  let isPaused = false;
  let currentPage = 1; // 当前页数
  let isSortDesc = false; // 是否倒序显示

  // 创建控制面板
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; top: 60px; right: 20px; width: 360px; max-height: 600px;
    overflow-y: auto; background: rgba(255,255,255,0.97);
    border: 1px solid #aaa; padding: 12px; font-size: 14px;
    box-shadow: 0 0 12px rgba(0,0,0,0.2); border-radius: 8px; z-index:99999;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  `;

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin:0 0 12px 0;">
      <h3 style="font-weight:bold; font-size:18px; margin:0;">课程采集助手V2</h3>
      <button id="btnClose" style="background:none; border:none; font-size:16px; cursor:pointer; padding:0;">×</button>
    </div>
     <div style="color:#666; font-size:14px; line-height:1.5; word-wrap:break-word; word-break:break-all;">
    <p style="margin:0 0 6px 0;">
      URL: <a href="${window.location.href}" target="_blank" style="color:#0066cc; text-decoration:underline;">${window.location.href}</a> 触发了捕获规则
    </p>
    <p style="margin:0; font-size:13px;">
      确保当前浏览器地址栏URL与其一致，如不一致，可能是iframe嵌入导致，请<a href="${window.location.href}" target="_blank" style="color:#0066cc; text-decoration:underline;">前往该页面</a>进行处理！
    </p>
       <p style="margin:0; font-size:13px;">
     请通过页面左上角齿轮图片（看不见请刷新）将已显示字段设置为：<br>
     课程名称、学分、是否在用、课程编号、教学大纲是否录入、开课单位<br>
     设置完成后滚动小齿轮窗口到底部，点击确定<br>
     顺序必须一致<br><br>
    </p>
  </div>
    <div style="margin-bottom: 10px; display:flex; gap:6px; flex-wrap: wrap;">
      <button id="btnStart" style="flex:1 1 48%;">开始采集</button>
      <button id="btnPause" style="flex:1 1 48%;" disabled>暂停采集</button>
      <button id="btnExtractPage" style="flex:1 1 100%; margin-top:6px;">提取本页课程</button>
      <button id="btnExportCSV" style="flex:1 1 48%;">导出CSV</button>
      <button id="btnExportJSON" style="flex:1 1 48%;">一键导出可用 JSON</button>
    </div>
    <div id="resultCount" style="margin-bottom:6px; font-weight:bold;">已采集课程数量：0</div>
    <div id="logBox" style="height:80px; overflow-y:auto; margin-bottom:8px; border:1px solid #ddd; padding:5px; font-size:12px; background:#f9f9f9; border-radius:4px;"></div>
    <div style="margin-bottom:8px; display:flex; gap:6px;">
      <button id="btnSortAsc" style="flex:1;">正序查看</button>
      <button id="btnSortDesc" style="flex:1;">倒序查看</button>
    </div>
    <div style="overflow:auto; max-height:300px; border:1px solid #ddd; border-radius:4px; background:#fff;">
      <table id="resultTable" border="1" cellspacing="0" cellpadding="4" style="width:100%; border-collapse: collapse; font-size:13px; text-align:center;">
        <thead style="background:#f0f0f0;">
          <tr>
            <th>序号</th>
            <th>课程名称</th>
            <th>学分</th>
            <th>是否在用</th>
            <th>课程编号</th>
            <th>教学大纲录入</th>
            <th>开课单位</th>
            <th>操作（课程大纲查看）</th>
          </tr>
        </thead>
        <tbody id="resultTbody"></tbody>
      </table>
    </div>
  `;
  document.body.appendChild(panel);

  // 解析当前页课程数据
  function parsePageCourses() {
    const rows = document.querySelectorAll('tbody tr.smartTr');
    const courses = [];
    rows.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 9) return;

      // 序号：第二列文本去空格
      const indexText = tds[1].innerText.trim();

      // 拼接完整大纲链接
      let syllabusLink = '';
      const ondblclick = tr.getAttribute('ondblclick') || '';
      const match = ondblclick.match(/JsModck\('([^']+)'\)/);
      if(match){
        let partialUrl = match[1];
        // 拼接完整URL
        if(partialUrl.startsWith('/')){
          syllabusLink = location.origin + partialUrl;
        } else {
          syllabusLink = location.origin + '/' + partialUrl;
        }
      }

      courses.push({
        index: indexText,
        courseName: tds[2].title || tds[2].innerText.trim(),
        credit: tds[3].title || tds[3].innerText.trim(),
        inUse: tds[4].title || tds[4].innerText.trim(),
        courseCode: tds[5].title || tds[5].innerText.trim(),
        syllabusEntered: tds[6].title || tds[6].innerText.trim(),
        department: tds[7].title || tds[7].innerText.trim(),
        syllabusText: tds[8].innerText.trim(),
        syllabusLink,
      });
    });
    return courses;
  }

  // 添加日志函数
  function addLog(message) {
    const logBox = document.getElementById('logBox');
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBox.appendChild(logEntry);
    logBox.scrollTop = logBox.scrollHeight; // 自动滚动到底部
  }

  // 刷新表格UI
  function refreshTable(){
    const tbody = document.getElementById('resultTbody');
    tbody.innerHTML = '';

    // 创建一个副本用于排序，避免修改原始数据
    const coursesToDisplay = [...allCourses];

    // 根据排序方式决定显示顺序
    if (isSortDesc) {
      coursesToDisplay.reverse();
    }

    coursesToDisplay.forEach(c => {
      const tr = document.createElement('tr');

      // 创建各列单元格
      const tdIndex = document.createElement('td');
      tdIndex.textContent = c.index;

      const tdName = document.createElement('td');
      tdName.textContent = c.courseName;

      const tdCredit = document.createElement('td');
      tdCredit.textContent = c.credit;

      const tdInUse = document.createElement('td');
      tdInUse.textContent = c.inUse;

      const tdCode = document.createElement('td');
      tdCode.textContent = c.courseCode;

      const tdSyllabusEntered = document.createElement('td');
      tdSyllabusEntered.textContent = c.syllabusEntered;

      const tdDept = document.createElement('td');
      tdDept.textContent = c.department;

      const tdSyllabusOp = document.createElement('td');
      if(c.syllabusLink){
        const a = document.createElement('a');
        a.href = c.syllabusLink;
        a.target = '_blank';
        a.textContent = c.syllabusText || '查看';
        tdSyllabusOp.appendChild(a);
      } else {
        tdSyllabusOp.textContent = c.syllabusText || '无';
      }

      tr.appendChild(tdIndex);
      tr.appendChild(tdName);
      tr.appendChild(tdCredit);
      tr.appendChild(tdInUse);
      tr.appendChild(tdCode);
      tr.appendChild(tdSyllabusEntered);
      tr.appendChild(tdDept);
      tr.appendChild(tdSyllabusOp);

      tbody.appendChild(tr);
    });

    document.getElementById('resultCount').textContent = `已采集课程数量：${allCourses.length} (第${currentPage}页)`;
  }

  // 导出为CSV
  function toCSV(arr){
    const header = ['序号','课程名称','学分','是否在用','课程编号','教学大纲录入','开课单位','操作（课程大纲查看链接）'];
    const lines = arr.map(c => [
      `"${c.index}"`,
      `"${c.courseName}"`,
      `"${c.credit}"`,
      `"${c.inUse}"`,
      `"${c.courseCode}"`,
      `"${c.syllabusEntered}"`,
      `"${c.department}"`,
      `"${c.syllabusLink}"`
    ].join(','));
    return header.join(',') + '\n' + lines.join('\n');
  }
  function exportCSV(){
    if(allCourses.length === 0){
      alert('无课程数据可导出！');
      return;
    }
    const csv = toCSV(allCourses);
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `courses_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 一键导出课程 JSON，仅导出教学大纲录入为“√”的课程，提取id和课程编号
  function exportJSON(){
    if(allCourses.length === 0){
      alert('无课程数据可导出！');
      return;
    }
    const filtered = allCourses.filter(c => c.syllabusEntered === '√').map(c => {
      // 从 syllabusLink 里提取 id
      let idMatch = c.syllabusLink.match(/jx02id=([A-Z0-9]+)&isentering/);
      let id = idMatch ? idMatch[1] : null;
      return {
        id: id,
        course_code: c.courseCode
      };
    }).filter(item => item.id !== null);

    if(filtered.length === 0){
      alert('没有符合条件的课程数据（教学大纲录入为√）');
      return;
    }

    const blob = new Blob([JSON.stringify(filtered, null, 2)], {type:'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `courses_filtered_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`✅ 导出成功，共 ${filtered.length} 条课程记录`);
  }

  // 下一页按钮获取函数
  function getNextPageButton(){
    const btnImg = Array.from(document.querySelectorAll('img')).find(img=>/next/i.test(img.src));
    if(btnImg && btnImg.parentElement && btnImg.parentElement.tagName.toLowerCase()==='a'){
      return btnImg.parentElement;
    }
    return null;
  }

  // 自动翻页采集函数，支持暂停
  async function autoCollect(){
    isAutoRunning = true;
    isPaused = false;
    currentPage = 1; // 重置页数
    addLog(`开始采集第${currentPage}页...`);
    updateButtons();

    while(isAutoRunning){
      if(isPaused){
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }

      const pageCourses = parsePageCourses();

      // 获取当前页的课程编号范围
      let minIndex = "";
      let maxIndex = "";
      if(pageCourses.length > 0) {
        minIndex = pageCourses[0].index;
        maxIndex = pageCourses[pageCourses.length-1].index;
      }

      // 过滤已有序号避免重复添加
      let newCount = 0;
      pageCourses.forEach(c=>{
        if(!allCourses.find(item=>item.index === c.index)){
          allCourses.push(c);
          newCount++;
        }
      });

      // 添加日志
      if(pageCourses.length > 0) {
        addLog(`第${currentPage}页采集完成，编号${minIndex}~${maxIndex}，新增${newCount}条课程`);
      } else {
        addLog(`第${currentPage}页未找到课程数据`);
      }

      refreshTable();

      const nextBtn = getNextPageButton();
      if(!nextBtn){
        addLog(`未找到下一页按钮，采集结束`);
        break;
      }
      // 判断按钮是否禁用（可根据样式或图片判断）
      if(nextBtn.classList.contains('disabled') || nextBtn.style.pointerEvents==='none' || /no\.gif/i.test(nextBtn.querySelector('img')?.src)){
        addLog(`下一页按钮不可用，采集结束`);
        break;
      }

      addLog(`正在翻到第${currentPage+1}页...`);
      nextBtn.click();
      currentPage++;

      // 等待页面刷新加载完毕，适当等待2秒
      await new Promise(resolve => setTimeout(resolve, 2200));
      addLog(`开始采集第${currentPage}页...`);
    }
    isAutoRunning = false;
    updateButtons();
  }

  // 更新按钮状态
  function updateButtons(){
    document.getElementById('btnStart').disabled = isAutoRunning && !isPaused;
    document.getElementById('btnPause').disabled = !isAutoRunning;
    document.getElementById('btnPause').textContent = isPaused ? '继续采集' : '暂停采集';
  }

  // 绑定按钮事件
  document.getElementById('btnExtractPage').onclick = () => {
    const pageCourses = parsePageCourses();

    // 获取当前页的课程编号范围
    let minIndex = "";
    let maxIndex = "";
    if(pageCourses.length > 0) {
      minIndex = pageCourses[0].index;
      maxIndex = pageCourses[pageCourses.length-1].index;
    }

    // 过滤避免重复
    let newCount = 0;
    pageCourses.forEach(c=>{
      if(!allCourses.find(item=>item.index === c.index)){
        allCourses.push(c);
        newCount++;
      }
    });

    // 添加日志
    if(pageCourses.length > 0) {
      addLog(`手动提取：编号${minIndex}~${maxIndex}，新增${newCount}条课程`);
    } else {
      addLog(`当前页未找到课程数据`);
    }

    refreshTable();
  };

  document.getElementById('btnExportCSV').onclick = () => {
    exportCSV();
  };

  // 新增JSON导出按钮事件
  document.getElementById('btnExportJSON').onclick = () => {
    exportJSON();
  };

  document.getElementById('btnStart').onclick = () => {
    if(isAutoRunning && isPaused){
      // 继续
      isPaused = false;
      updateButtons();
      return;
    }
    if(isAutoRunning) return; // 已在跑，忽略
    autoCollect();
  };

  document.getElementById('btnPause').onclick = () => {
    if(!isAutoRunning) return;
    isPaused = !isPaused;
    updateButtons();
  };

  // 排序按钮事件
  document.getElementById('btnSortAsc').onclick = () => {
    isSortDesc = false;
    refreshTable();
  };

  document.getElementById('btnSortDesc').onclick = () => {
    isSortDesc = true;
    refreshTable();
  };

  // 关闭按钮事件
  document.getElementById('btnClose').onclick = () => {
    if(isAutoRunning && confirm('采集正在进行中，确定要关闭面板吗？')){
      document.body.removeChild(panel);
    } else if(!isAutoRunning) {
      document.body.removeChild(panel);
    }
  };

})();
