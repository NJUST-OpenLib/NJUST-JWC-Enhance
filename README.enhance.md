# 🧩 增强功能详细说明

## 功能展示

### 1. 教学大纲与选修课分类显示

在课表、选课和成绩页面，自动为每门课程添加教学大纲链接，点击即可跳转查看详情。

- 大部分课程可直接访问教学大纲页面  
- 若未上传大纲，显示为“无信息”

![教学大纲显示](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/select_class.png)
![课表界面显示](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/time_table.png)

---

### 2. 成绩页学分统计与课程分类展示

在“成绩”页面中，自动识别课程所属类别（如公选课、人文素养等），并按类统计已修学分。

![学分统计](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/catag.png)

---

### 3. 登录页面优化提示

误入无效教务系统入口时，会弹出提示信息，引导用户跳转至正确登录地址。

> 南理工教务系统入口说明：
> 
> ✅ 正确入口：[http://202.119.81.113:8080/](http://202.119.81.113:8080/)  
> ✅ 智慧理工平台：[https://ehall2.njust.edu.cn/](https://ehall2.njust.edu.cn/)（初次跳转可能报 SSL 错）  
> ❌ 错误入口：[http://202.119.81.112:9080/](http://202.119.81.112:9080/)  
> ❌ 错误入口：[https://bkjw.njust.edu.cn/](https://bkjw.njust.edu.cn/)

![登录提示](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/login_notice.png)

---

## 工作原理

脚本通过远程加载两份核心数据文件实现功能增强：

### 1. 选修课分类数据（`xxk.json`）

```json
[
  {
    "course_code": "00000011",
    "course_name": "坦克学",
    "category": "自然科技类"
  }
]
```

- 来源：教务处发布的课程分类方案  
- 更新建议：每四年一次（2022年为当前版本）
- 使用[课程数据解析器](https://enhance.njust.wiki/tools/xxk.html)将教务处发布的表格中对内容转换为结构化的 json 数据

---

### 2. 教学大纲链接数据（`kcdg.json`）

```json
[
  {
    "id": "572BF3AE025044A7BDD7AF953460102C",
    "course_code": "161803E1"
  }
]
```

- 来源：[课程总库](http://202.119.81.112:9080/njlgdx/pyfa/kcdgxz) 爬取
- 数据体积：约 100KB，筛选后仅包含有大纲的课程
- 更新建议：每年爬取一次
- 使用 课程采集助手 V2 爬取所有课程为 csv 文件。再使用[CSV课程数据筛选工具](https://enhance.njust.wiki/tools/csv2json.html)转换为可供使用的json数组 
---
