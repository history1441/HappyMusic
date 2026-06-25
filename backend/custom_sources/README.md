# 自定义音源适配器目录

将 `.py` 适配器文件放在此目录,后端启动时自动加载,无需重启。

## 适配器文件规范

1. 文件名:`<short_name>.py`(如 `myradio.py`)
2. 定义一个继承 `BaseMusicClient` 的类
3. 类属性 `source = '<ClientClassName>'`(注册名,首字母大写驼峰)
4. 实现搜索相关方法

## 示例

```python
# myradio.py
from musicdl.modules.sources.base import BaseMusicClient

class MyRadioClient(BaseMusicClient):
    source = 'MyRadioClient'
    display_name = '我的电台'  # 可选,搜索结果中显示

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.session.headers.update({'User-Agent': '...'})

    def _constructsearchurls(self, keyword, rule, request_overrides):
        # 构造搜索 URL 列表,返回 list[str]
        return [f"https://api.example.com/search?q={keyword}"]

    def _search(self, keyword, search_url, **kwargs):
        # 执行单个 URL 的搜索,返回 list[SongInfo]
        # 参考 musicdl 内置音源(modules/sources/netease.py 等)
        ...
```

## 热更新方式

- **自动**:启动时扫描,新文件下次启动生效
- **手动**:管理后台调用 `POST /api/admin/sources/custom/reload` 立即重载

## 查看已加载

- `GET /api/admin/sources/custom/list` 返回当前已加载的自定义音源
