# 🎓 南理工教务系统增强助手


> 🧩 让教务系统更顺手的浏览器脚本  
> 💡 支持南京理工大学和其他使用“湖南强智教务系统”的高校

<div align="center">
  <img src="https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/catag.png"  alt="课程分类示意图" />

  <img src="https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/kczk4.png" alt="课程增强示意图" />


<p align="center">
  <img src="https://img.shields.io/github/stars/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
  <img src="https://img.shields.io/github/forks/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
  <img src="https://img.shields.io/github/issues/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
  <img src="https://img.shields.io/github/license/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square" />
</p>

---

## ✨ 功能概览

- 🔗 教学大纲快捷访问
- 🏷️ 选修类别自动显示
- 📊 成绩页学分统计
- 🚪 登录页面智能提示
- 📥 可选的数据采集工具（获取课程大纲数据）

---

## 📖 更多功能详解

详细图文说明和数据结构介绍请参见：

- 🧩 [增强功能效果说明（README.enhance.md）](./README.enhance.md)

- 📦 [课程大纲采集流程（README.getKCDG.md）](./README.getKCDG.md)

- 📦 [选修课采集流程（README.getXXK.md）](./README.getXXK.md)

---

## 🚀 快速开始

### 0 预备知识：
Tampermonkey 和 ScriptCat 都是脚本管理器，安装一个即可

scriptcat.org 和 GreasyFork 都是脚本仓库，选择一个即可

---

### 1 安装脚本管理器

推荐以下浏览器插件（任选一个）：

- **Tampermonkey（主流推荐）**
  - [Chrome 商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
  - [Edge 商店](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
  -  [Firefox 商店](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)
  
  - **ScriptCat 脚本猫（国产开源）**
  - [官方主页](https://docs.scriptcat.org/)

#### 1.2 安装脚本管理器

对于在基于 Chrome 的浏览器中使用扩展（版本 5.3+）的用户，必须启用“允许用户脚本”切换开关（在 Chrome 138+ 中可通过扩展设置找到）或 开发者模式

[Tampermonkey 开启开发者模式](https://www.tampermonkey.net/faq.php?version=5.4.6227&ext=gcal#Q209)

[Scriptcat 开启开发者模式](https://docs.scriptcat.org/docs/use/open-dev/)

---

### 2 安装增强脚本

- [📦 ScriptCat.org](https://scriptcat.org/zh-CN/script-show-page/3745/)
- [📦 GreasyFork](https://greasyfork.org/zh-CN/scripts/541627)

> 可选功能：数据采集助手 V2  
> [ScriptCat.org](https://scriptcat.org/zh-CN/script-show-page/3744/)
> [GreasyFork](https://greasyfork.org/zh-CN/scripts/541628)

### 3 启用脚本

![启用](https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/docs/static/PixPin_2025-07-04_23-19-05.png)

访问 [教务系统主页](http://202.119.81.113:8080/)，脚本会自动启用，无需手动配置。

---



## ⚠️ 注意事项

- 本脚本仅修改页面显示，不影响服务器数据
- 所有功能在本地浏览器执行，不上传任何个人信息
- 强智系统复杂，功能适配可能随系统变动而失效，请谨慎使用

---

## 🤝 参与贡献

欢迎提交 Issue、PR 或数据更新：

- `xxk.json`（选修课分类）：建议每 4 年更新一次
- `kcdg.json`（教学大纲映射）：建议每年更新一次

---

## 📄 License

本项目采用 [MIT License](./LICENSE) 开源。

---

## 📬 联系我们

- 邮箱：admin@njust.wiki  
- 提交问题：[GitHub Issues](https://github.com/NJUST-OpenLib/NJUST-JWC-Enhance/issues)

<div align="center">
  <sub>Made with ❤️ by Light</sub><br/>
  <sup>部分变量命名源于教务系统字段，例如 kcdg=课程大纲</sup>
</div>
