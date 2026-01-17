## 选修课分类数据更新指南

一般而言，每四年南京理工大学会更新一次教学大纲，对应也会产生一批新的选修课列表。

- 2018 版课程分类：[查看链接](https://jwc.njust.edu.cn/77/2c/c1189a227116/page.htm)
- 2022 版课程分类：[查看链接](https://jwc.njust.edu.cn/b1/7f/c1189a307583/page.htm)

我们可以看到，这些页面展示的是标准的表格，如下图所示：

![选修课分类页面](https://enhance.njust.wiki/docs/static/xxk_catag.png)

### 复制课程数据

从页面左上角选中整个表格区域，向下拖动并复制：

![复制表格数据](https://enhance.njust.wiki/docs/static/xxk_copy.png)

粘贴后得到类似如下的纯文本内容：

```
课程号

课程名

分类

00000011

坦克学

自然科技类

...
```

### 使用课程数据解析器

将上述完整内容（无需手动处理空行）粘贴至 [课程数据解析器](https://enhance.njust.wiki/tools/xxk.html)。

点击“解析为 JSON”，确认输出无误后点击“下载 JSON”：

![生成 JSON 数据](https://enhance.njust.wiki/docs/static/xxk_gen_json.png)

### 更新数据文件

如果你发现已有的 `xxk.json` 版本已过时，可以按照上述方法重新生成，并进行如下操作：

- 上传至服务器


然后将用户脚本中的分类数据地址替换为新的链接，例如：

```js
const CATEGORY_URL = 'https://fastly.jsdelivr.net/gh/NJUST-OpenLib/NJUST-JWC-Enhance@latest/data/xxk.json';
```
- 或提交 Pull Request 更新本项目的 `data/xxk.json`

---

如需查看课程大纲数据的采集方式，请参阅：[README.getKCDG.md](./README.getKCDG.md)
