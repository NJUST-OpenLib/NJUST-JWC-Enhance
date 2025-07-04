
<div align="center">

# NJUST-JWC-Enhance
# **🎓 南京理工大学教务系统增强助手**

**让教务系统更好用的浏览器脚本**

适用于南京理工大学，同时可能还适用于其他使用湖南强智教务系统的学校


![GitHub stars](https://img.shields.io/github/stars/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square) 
![GitHub forks](https://img.shields.io/github/forks/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square) 
![GitHub issues](https://img.shields.io/github/issues/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square) 
![GitHub license](https://img.shields.io/github/license/NJUST-OpenLib/NJUST-JWC-Enhance?style=flat-square)  


[快速开始](#快速开始) • [功能特性](#功能特性) • [使用方法](#使用方法) • [技术实现](#技术实现)

</div>



---




## 🚀 快速开始

### 一键安装

1. **安装用户脚本管理器**
   
   推荐使用以下任一用户脚本管理器，在 Edge  138.0.3351.65 上均测试通过：
   
   - **Tampermonkey** - 主流跨平台用户脚本管理器
     - [Chrome 商店安装](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) 
     -  [Firefox 安装](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/) 
     -  [Edge 商店安装](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   - **ScriptCat 脚本猫** - 国产开源脚本管理器
     - [官方文档](https://docs.scriptcat.org/) 
     - [Edge 商店安装](https://microsoftedge.microsoft.com/addons/detail/%E8%84%9A%E6%9C%AC%E7%8C%AB/liilgpjgabokdklappibcjfablkpcekh) 
     - [Chrome 商店安装](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf)


2. **安装脚本**
   ```bash
   # 点击下方链接直接安装
   ```
   📥 [点击安装 教务增强助手](https://github.com/your-username/NJUST-JWC-Enhance/raw/main/enhance.js)
   
   📥 [点击安装 数据采集助手V2.js](https://github.com/your-username/NJUST-JWC-Enhance/raw/main/getKCDG.js) *(可选，仅数据采集需要)*

3. **开始使用**
   - 登录 [南理工教务系统](http://202.119.81.113:8080/)
   - 脚本将自动启用，享受增强功能！

### ⚡ 核心功能预览

- 🔗 **教学大纲链接** - 课表/选课页面一键查看课程大纲
- 📊 **学分统计** - 成绩页面自动汇总选修课学分
- 🏷️ **课程分类** - 显示选修课详细类别信息
- 🚪 **登录优化** - 智能识别并引导正确登录入口


## 功能展示

### 1. 教学大纲与选修课分类显示

在课表、选课和成绩页面的课程信息中添加教学大纲链接，便于用户快速查看课程详情。
（部分课程未上传在线大纲，显示为无信息）

![教学大纲显示](/docs/static/select_class.png)
![课表界面显示](/docs/static/time_table.png)

### 2. 学分统计与选修课分类展示

在成绩页面中，按课程分类及通识选修类别，分别汇总已修课程及其学分。

![学分统计](/docs/static/catag.png)

### 3. 登录页面提示优化

当用户误进入无法登录的教务系统地址时，自动弹出提示，引导用户跳转到正确的登录入口。

> 南理工教务系统包含多个入口，详情如下：
> 
> * ✅ 正确入口：[http://202.119.81.113:8080/](http://202.119.81.113:8080/)（教务处官网）
> *  ✅ 正确入口：[https://ehall2.njust.edu.cn/](https://ehall2.njust.edu.cn/)（智慧理工搜索教务。注，第一次跳转会出现SSL错误，原因是天才信息化处把https请求发到80端口了。回到智慧理工再搜一次就行了）
> *  信息化处说是教务处的问题，智慧理工这个问题不归他们管。教务处说信息化处的系统有问题，是他们的问题。
> * ❌ 错误入口：[http://202.119.81.112:9080/](http://202.119.81.112:9080/)（只能通过教务处跳转进入，首页的登录框本身不可用）
> * ❌ 错误入口：[https://bkjw.njust.edu.cn/](https://bkjw.njust.edu.cn/)（只能通过“智慧理工”平台搜索“教务”跳转进入，首页的登录框本身不可用）

![登录提示](/docs/static/login_notice.png)

> 注意：验证码区分大小写，绝大多数字母为小写。



## 工作原理

本脚本通过远程读取两个核心 JSON 数据文件，实现数据增强：

### 1. 选修课类别数据（`xxk.json`）

包含课程号与课程名、所属选修类别的对应关系。

```json
[
  {
    "course_code": "课程号",
    "course_name": "课程名",
    "category": "分类"
  },
  {
    "course_code": "00000011",
    "course_name": "坦克学",
    "category": "自然科技类"
  }
]
```

* **数据来源：** 教务处官网
* **更新频率：** 每四年更新一次（当前为 2022 版方案，前一版为 2018）

### 2. 教学大纲数据（`kcdg.json`）

记录课程的系统 ID 与课程编号之间的映射关系。

```json
[
  {
    "id": "572BF3AE025044A7BDD7AF953460102C",
    "course_code": "161803E1"
  },
  {
    "id": "00000023",
    "course_code": "00000023"
  }
]
```

* **数据来源：** 从[课程总库](http://202.119.81.112:9080/njlgdx/pyfa/kcdgxz)爬取并筛选而来
* **数据规模：**总库约有 380 页、一万余条课程记录，但是仅约一千条课程上传了教学大纲，实际加载的外部数据文件不足 100K
* **更新频率：** 建议每年重新爬取一次

## 技术实现


### 数据获取

由于课程总库网页架构陈旧，部分功能需 IE6 浏览器支持，因此在 `getKCDG.js` 脚本中重写了一下功能，以保证页面自带的选框可供配置，数据可正常读取：

* 课程名称
* 学分信息
* 使用状态
* 课程编号
* 教学大纲录入状态
* 开课单位
  

![课程总库](docs/static/kczk0.png)

调整```已显示的字段```如图所示

![课程总库](docs/static/kczk.png)

点击确定保存
![课程总库](docs/static/kczk2.png)

脚本提示当前采集页面可能和访问页面不一致，点击进入实际地址

![课程总库](docs/static/kczk3.png)

点击开始采集，会自动提取所有课程并保存为结构化数据

![课程总库](docs/static/kczk4.png)

采集完毕后导出即可。其中 CSV 为完整内容，JSON 为筛选后的内容。

![课程总库](docs/static/kczk5.png)

本程序使用的是筛选后的 JSON，如需其他用途可导出完整 CSV


### 数据处理流程

1. 使用 `getKCDG.js` 脚本逐页爬取课程总库数据
2. 导出为 CSV 文件
3. 通过 外部网站自动剔除未上传教学大纲的课程记录，并转为 json 格式

## 📖 详细使用指南

### 基础使用

安装完成后，脚本会在以下页面自动生效：

- ✅ **课程表页面** - 显示教学大纲链接
- ✅ **选课页面** - 显示课程分类和大纲链接  
- ✅ **成绩页面** - 自动统计学分，显示课程分类
- ✅ **登录页面** - 智能提示正确登录入口

### 高级功能：数据采集

如需更新课程数据，可使用 `getKCDG.js` 脚本：

1. 访问 [课程总库页面](http://202.119.81.112:9080/njlgdx/pyfa/kcdgxz)
2. 按照脚本提示配置显示字段
3. 点击"开始采集"自动抓取所有课程数据
4. 导出 JSON 格式的课程大纲映射数据

> 💡 **提示**：普通用户无需使用数据采集功能，脚本已内置最新数据

## 免责声明 ⚠️

* 本脚本仅修改前端展示效果，不会对教务系统服务器端数据造成影响

* 本脚本在您浏览器上运行，不会传递出任何信息。
  
* 南理工教务系统具有大量前端验证机制，脚本没有刻意去做，但不保证用户修改前端是否会导致意料之外的后果。例如，您可以把课程附近的“display=none”删去，以显示退课按钮，进而实现大学四年所修学分为 0 分。

* 尽管从原理上不会造成任何破坏，但强智系统十份复杂和冗余，使用本工具仍存在未知风险，使用者需自行承担后果
  
* **开发者不对任何因使用本工具而产生的后果承担责任**



## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 如何贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 数据更新

- **选修课分类数据** (`xxk.json`) - 每四年更新一次
- **教学大纲数据** (`kcdg.json`) - 建议每年更新一次

如果发现数据过期，欢迎提交 Issue 或使用 ```数据采集助手V2``` 采集最新数据后，提交 PR。

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐

## 📞 联系方式

- 📧 Email: admin@njust.wiki
- 🐛 Issues: [GitHub Issues](https://github.com/NJUST-OpenLib/NJUST-JWC-Enhance/issues)


---

<div align="center">

**Made with ❤️by Light**

*部分变量命名遵循原教务系统命名规范，以保证兼容性*
例如：
kcdg 课程大纲
xxk  选修课

</div>
