"""自定义音源适配器热加载器

从 backend/custom_sources/ 目录扫描 .py 文件,动态注册到 musicdl 的 MusicClientBuilder。
支持运行时上传新适配器(reload 端点),无需重启服务。

适配器文件规范:
1. 文件放在 backend/custom_sources/<short_name>.py
2. 定义一个继承 musicdl.modules.sources.base.BaseMusicClient 的类
3. 类属性 source = '<ClientClassName>'(用于注册名)
4. 实现 __init__ / _constructsearchurls / _search 等方法(参考 musicdl 内置音源)

示例(backend/custom_sources/myradio.py):
    from musicdl.modules.sources.base import BaseMusicClient
    class MyRadioClient(BaseMusicClient):
        source = 'MyRadioClient'
        def __init__(self, **kwargs):
            super().__init__(**kwargs)
        def _constructsearchurls(self, keyword, rule, request_overrides):
            ...
        def _search(self, keyword, search_url, **kwargs):
            ...
"""
import os
import importlib.util
import inspect
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# 自定义适配器目录(backend/custom_sources/)
CUSTOM_SOURCES_DIR = Path(__file__).resolve().parents[2] / "custom_sources"

# 已加载的自定义音源 {short_name: {class_name, file, loaded_at, display_name}}
_loaded: dict[str, dict] = {}


def load_all_custom_sources() -> dict:
    """扫描 custom_sources/ 目录,加载所有 .py 适配器到 musicdl

    返回 {loaded: [...], failed: [...]}
    """
    CUSTOM_SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    # 确保 __init__.py 存在(让目录可作为包)
    init_file = CUSTOM_SOURCES_DIR / "__init__.py"
    if not init_file.exists():
        init_file.write_text("# 自定义音源适配器目录\n", encoding="utf-8")

    results = {"loaded": [], "failed": []}

    for py_file in sorted(CUSTOM_SOURCES_DIR.glob("*.py")):
        if py_file.name.startswith("_"):
            continue
        try:
            info = _load_one(py_file)
            results["loaded"].append(info)
            logger.info(f"Loaded custom source: {info['short_name']} ({info['class_name']})")
        except Exception as e:
            err = {"file": py_file.name, "error": str(e)}
            results["failed"].append(err)
            logger.warning(f"Failed to load custom source {py_file.name}: {e}")

    _sync_to_source_map()
    return results


def _load_one(py_file: Path) -> dict:
    """动态加载单个适配器文件并注册到 MusicClientBuilder"""
    from musicdl.modules.sources import MusicClientBuilder
    from musicdl.modules.sources.base import BaseMusicClient

    # 用唯一模块名加载(支持热替换:重新加载同名文件)
    module_name = f"custom_source_{py_file.stem}_{int(datetime.now().timestamp())}"
    spec = importlib.util.spec_from_file_location(module_name, py_file)
    if spec is None or spec.loader is None:
        raise ValueError(f"无法加载模块: {py_file}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    # 查找继承 BaseMusicClient 的类
    client_class = None
    for _name, obj in inspect.getmembers(module, inspect.isclass):
        if issubclass(obj, BaseMusicClient) and obj is not BaseMusicClient and obj.__module__ == module_name:
            client_class = obj
            break

    if client_class is None:
        raise ValueError(f"未找到 BaseMusicClient 的子类(文件需定义一个继承 BaseMusicClient 的类)")

    class_name = client_class.__name__
    # 注册到 musicdl(直接修改 REGISTERED_MODULES,支持热替换)
    MusicClientBuilder.REGISTERED_MODULES[class_name] = client_class

    # short_name 优先用 source 属性的小写,否则用文件名 stem
    short_name = getattr(client_class, "source", py_file.stem).lower()
    # 显示名(可选:从类属性 display_name 或文件名)
    display_name = getattr(client_class, "display_name", short_name)

    info = {
        "short_name": short_name,
        "class_name": class_name,
        "display_name": display_name,
        "file": py_file.name,
        "loaded_at": datetime.now().isoformat(),
    }
    _loaded[short_name] = info
    return info


def _sync_to_source_map() -> None:
    """把自定义音源同步到 SOURCE_NAME_MAP(让搜索能用 short_name)"""
    from app.utils.music import SOURCE_NAME_MAP
    for short_name, info in _loaded.items():
        SOURCE_NAME_MAP[short_name] = info["class_name"]


def get_loaded_sources() -> list[dict]:
    """返回已加载的自定义音源列表"""
    return list(_loaded.values())


def reload_all() -> dict:
    """重新加载所有自定义适配器(清空已加载后重新扫描)"""
    _loaded.clear()
    return load_all_custom_sources()
