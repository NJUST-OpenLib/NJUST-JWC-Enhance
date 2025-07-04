# 📦 教学大纲数据采集指南

> 本文档介绍如何使用 `getKCDG.js` 脚本采集课程大纲映射数据
> ⚠️ **提示：普通用户无需采集数据，增强脚本已内置 2022 版大纲的最新版本**
> 
---

## 📥 数据采集过程

由于课程总库架构较旧，部分功能需要兼容性调整。`getKCDG.js` 已对其做兼容处理，可在现代浏览器中稳定运行。

### 采集步骤

1. 访问课程总库页面：[点击进入](http://202.119.81.112:9080/njlgdx/pyfa/kcdgxz)
2. 配置字段显示，如下图所示：

![字段配置](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/kczk0.png)
![字段选择](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/kczk.png)

3. 点击“确定”保存设置  
4. 若提示地址跳转，点击确认进入真实采集页面：

![跳转提示](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/kczk3.png)

5. 点击“开始采集”，脚本会自动提取课程数据并进行结构化处理：

![采集中](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/kczk4.png)

6. 数据采集完成后，可导出为 CSV格式：

![导出结果](https://cdn.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/kczk5.png)

---

## 🔄 数据处理流程

1. 使用脚本采集课程数据
2. 导出为 `.csv`
3. 通过[网页工具](https://enhance.njust.wiki/tools)筛选出已上传大纲的课程
4. 转为结构化 JSON（即 `kcdg.json`）


