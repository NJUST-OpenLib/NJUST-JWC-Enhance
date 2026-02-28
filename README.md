# 南理工教务系统增强助手V2 - 现已支持自动评教

<div style="
  padding: 20px 24px;
  margin: 20px 0;
  background: linear-gradient(90deg, #e0f2fe 0%, #f0f9ff 100%);
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(30, 64, 175, 0.08);
">
  <span style="
    font-size: 16px;
    color: #1e40af;
    font-weight: 700;
    letter-spacing: 0.5px;
    line-height: 1.7;
  ">
    🎉 功能升级 | 南京理工大学教务处增强助手V2正式加入评教助手组件
  </span>
  <p style="
    margin: 8px 0 0 0;
    font-size: 15px;
    color: #334155;
    font-weight: 500;
  ">
    支持自动评教，告别繁琐，一键完成！
  </p>
</div>


> 🧩 让教务系统更顺手的浏览器脚本 | 💡 支持南京理工大学及强智教务系统高校

<div align="center">
  <img src="https://enhance.njust.wiki/docs/static/catag.png"  alt="课程分类示意图" />
<br>
  <img src="https://enhance.njust.wiki/docs/static/kczk4.png" alt="课程增强示意图" />
<br>
<img src="https://enhance.njust.wiki/docs/static/eval_use3.png" alt="自动评教功能" />

<p>
  <img src="https://img.shields.io/github/stars/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
  <img src="https://img.shields.io/github/forks/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
  <img src="https://img.shields.io/github/issues/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
  <img src="https://img.shields.io/github/license/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
  <img src="https://img.shields.io/github/last-commit/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
</p>
## Star History

<a href="https://www.star-history.com/#NJUST-OpenLib/NJUST-JWC-Enhance&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=NJUST-OpenLib/NJUST-JWC-Enhance&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=NJUST-OpenLib/NJUST-JWC-Enhance&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=NJUST-OpenLib/NJUST-JWC-Enhance&type=Date" />
 </picture>
</a>

</div>

## 关注我们

- [📖 南理工生存手册](https://manual.njust.wiki)
- [💻 GitHub 仓库](https://github.com/NJUST-OpenLib/NJUST-JWC-Enhance)
- [🐱 ScriptCat 脚本猫](https://scriptcat.org/zh-CN/users/174962)
- [🔧 GreasyFork](https://greasyfork.org/zh-CN/users/1491624-njust-openlib)

---

## ✨ 功能概览

- 🎯 一键评教
- 🔗 教学大纲快捷访问
- 🏷️ 选修类别自动显示
- 📊 成绩页学分统计
- 🚪 登录页面智能提示
- 📥 配套的数据采集及处理工具
---

## 📖 更多功能详解

详细图文说明和数据结构介绍请参见：

-  [增强助手功能说明](./README.enhance.md)

-  [🎉一键评教使用说明🎉](./README.ace.md)

-  [课程大纲采集流程（使用课程采集助手 V2）](./README.getKCDG.md)

-  [选修课采集流程（README.getXXK.md）](./README.getXXK.md)

-  [数据格式处理工具集](https://enhance.njust.wiki/tools)
  
---

## 🚀 快速开始

### 0 预备知识

- Tampermonkey 和 ScriptCat 都是脚本管理器，安装一个即可（推荐使用Tampermonkey）

- scriptcat.org 和 GreasyFork.org 都是脚本仓库，选择一个即可

### 🧪 兼容性


| 操作系统 | 系统版本 | 浏览器         | 浏览器版本       | 脚本管理器        | 测试状态 |
| :------- | :------- | :------------- | :--------------- | :---------------- | :------- |
| Windows  | 11       | Microsoft Edge | 143.0.3650.139   | Tampermonkey 5.4.0 | ✅ 测试通过 |
| Windows  | -        | Google Chrome  | 143.0.7499.193   | Tampermonkey 5.4.1 | ✅ 测试通过 |
| Windows  | -        | Google Chrome  | 143.0.7499.193   | ScriptCat v1.2.4   | ❌ 存在问题 |
| Android  | -        | Microsoft Edge | 143.0.3650.125   | Tampermonkey 5.4.0 | ✅ 测试通过 |



---

### 1 安装脚本管理器

推荐以下浏览器插件（任选一个）：

- **Tampermonkey（主流推荐）**
  - [Chrome 商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
  - [Edge 商店（推荐）](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
  - [Firefox 商店](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)
  
 [!NOTICE]ScriptCat 脚本猫在个别情况版本可能存在兼容性问题，推荐使用 Tampermonkeyy

- **ScriptCat 脚本猫（国产开源）**
  - [官方主页](https://docs.scriptcat.org/)

#### 1.2 安装脚本管理器

对于在基于 Chrome 的浏览器中使用扩展（版本 5.3+）的用户，必须启用“允许用户脚本”开关（在 Chrome 138+ 中可通过扩展设置找到）或启用开发者模式

[Tampermonkey 开启开发者模式](https://www.tampermonkey.net/faq.php?version=5.4.6227&ext=gcal#Q209)

[Scriptcat 开启开发者模式](https://docs.scriptcat.org/docs/use/open-dev/)

---

### 2 安装「南理工教务系统增强助手」
脚本内置选修课数据 + 课程大纲数据，无需手动配置。
任选下方一个平台安装即可，所有脚本管理器通用（Tampermonkey/ScriptCat 均可安装）。

- 安装地址 ①：[ScriptCat 脚本猫仓库](https://scriptcat.org/zh-CN/script-show-page/3745/)
- 安装地址 ②：[GreasyFork 脚本库](https://greasyfork.org/zh-CN/scripts/541627)

### 可选：安装「数据采集助手 V2」  

用于获取课程大纲数据，仅供开发者使用  

- 安装地址 ①：[ScriptCat 脚本猫仓库](https://scriptcat.org/zh-CN/script-show-page/3744/)  
- 安装地址 ②：[GreasyFork 脚本库](https://greasyfork.org/zh-CN/scripts/541628)  

---

### 3 启用脚本

![启用](https://enhance.njust.wiki/docs/static/PixPin_2025-07-04_23-19-05.png)
![启用](https://enhance.njust.wiki/docs/static/enable.png)

启用后，访问 [教务系统主页](http://202.119.81.113:8080/)，脚本会自动生效，无需手动配置。

### 4 刷新登录状态

如果您在点击课程大纲时遇到以下提示：

![登录状态失效提示](https://enhance.njust.wiki/docs/static/re_login.png)

说明课程总库登录状态已失效。为应对该问题，系统将在

- 首次登录成功后每五分钟
- 每次出现提示时

自动尝试加载 `http://202.119.81.112:9080/njlgdx/pyfa/kcdgxz` 隐藏页面来刷新课程总库的登录状态（大概率不成功，建议使用下方手动方法）。  
但如果您仍然无法访问，请直接访问以下任一地址手动刷新：

- 适用于教务处登录：<http://202.119.81.112:9080/njlgdx/pyfa/kcdgxz>
- 适用于智慧理工登录：<http://bkjw.njust.edu.cn/njlgdx/pyfa/kcdgxz>

完成后您应当可以点击课程大纲以预览。

推荐使用教务处官网`http://jwc.njust.edu.cn`登录。
![登录状态失效提示](https://enhance.njust.wiki/docs/static/jwc_login.png)

---

## ⚠️ 注意事项

**本脚本完全开源，不对可靠性做任何保证。**

**因使用本脚本产生的任何后果，开发者概不负责，请自行判断风险**

- 本脚本不会修改服务器数据，关闭插件即恢复原状
- 所有功能均在本地执行，无任何统计功能，不会上传或收集任何信息
- 强智系统结构复杂，因此部分功能可能随系统更新而失效
- 附带的数据文件具有一定时效性，且开发者毕业后可能无法持续更新
- 教务系统大量依赖前端校验，更改前端页面有风险
- 选课统计因网络波动等原因不一定准确，请以教务处官网为准
  
---

## 🤝 参与贡献

欢迎提交 Issue、PR 或数据更新：

- `xxk.json`（选修课分类）：建议每 4 年更新一次。  
  参考[选修课采集流程（README.getXXK.md）](./README.getXXK.md)

- `kcdg.json`（教学大纲映射）：建议每年更新一次  
 参考 [课程大纲采集流程（README.getKCDG.md）](./README.getKCDG.md)

---

## 📄 License

本项目采用 [MIT License](./LICENSE) 开源。

---

## 📬 联系我们

- 邮箱：<admin@njust.wiki>  
- 提交问题：[GitHub Issues](https://github.com/NJUST-OpenLib/NJUST-JWC-Enhance/issues)

## 常见问题

### 变量名

部分变量命名源于教务系统字段，例如：

| 变量名 | 含义 |
|--------|------|
| kcdg | 课程大纲 |
| xxk | 选修课 |
| kczk | 课程总库 |

~~绝对不是英语水平差！~~

### 提示无课程大纲

个别课程没有上传课程大纲信息，因此无法查看。  
如果您确信课程总库里可以查看大纲信息，那么请您按上述流程更新 kcdg.json 信息

### 页面上提示框很烦

请参考注释调整脚本代码中对应的通知等级。
<div align="center" style="font-size: 0.9em; color: #666;">
  <p>项目由 <a href="https://github.com/NJUST-OpenLib" target="_blank">NJUST OpenLib</a> 社区维护 &nbsp; 
    <span title="支持 IPv6 网络访问">
      <svg t="1737132800000" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6012" width="14" height="14" style="vertical-align: -1px;fill:#4285F4;"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zM512 896c-211 0-384-173-384-384s173-384 384-384 384 173 384 384-173 384-384 384z" p-id="6013"></path><path d="M704 320H320c-17.7 0-32 14.3-32 32v320c0 17.7 14.3 32 32 32h384c17.7 0 32-14.3 32-32V352c0-17.7-14.3-32-32-32zM672 672H352V384h320v288z m-192-64c-17.7 0-32-14.3-32-32V448c0-17.7 14.3-32 32-32s32 14.3 32 32v128c0 17.7-14.3 32-32 32z m-64 0c-17.7 0-32-14.3-32-32V448c0-17.7 14.3-32 32-32s32 14.3 32 32v128c0 17.7-14.3 32-32 32z m128 0c-17.7 0-32-14.3-32-32V448c0-17.7 14.3-32 32-32s32 14.3 32 32v128c0 17.7-14.3 32-32 32z" p-id="6014"></path></svg>
      支持 IPv6 访问
    </span>
  </p>
  版权所有 © 2024–2025 <a href="https://njust.wiki" target="_blank">NJUST.WIKI</a>
</div>