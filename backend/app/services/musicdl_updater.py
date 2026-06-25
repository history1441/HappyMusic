"""musicdl 第三方库热更新

运行中升级 musicdl(pip install --upgrade),清除 sys.modules 缓存,
下次搜索(函数内 import)自动使用新版本。无需重启 backend。

注意:
1. Docker 容器中升级写入容器文件系统,容器重启后会丢失(回到镜像版本)。
   持久化需要重建镜像或挂载 site-packages(不推荐)。
2. musicdl 大版本升级可能改变 API,搜索逻辑可能需要适配。
   升级后建议调用 /api/admin/sources/test 验证音源可用性。
3. 使用清华源加速国内下载。
"""
import subprocess
import sys
import logging

logger = logging.getLogger(__name__)

PIP_INDEX = "https://pypi.tuna.tsinghua.edu.cn/simple"


def get_musicdl_version() -> str:
    """获取当前已安装的 musicdl 版本"""
    try:
        import importlib.metadata
        return importlib.metadata.version("musicdl")
    except Exception:
        return "unknown"


def get_latest_version() -> str:
    """查询 PyPI 上的最新版本(不安装)"""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "index", "versions", "musicdl",
             "-i", PIP_INDEX],
            capture_output=True, text=True, timeout=30,
        )
        # 输出含 "Available versions: 2.10.2, 2.10.1, ..."
        out = result.stdout
        if "Available versions:" in out:
            line = out.split("Available versions:")[1].split("\n")[0]
            return line.strip().rstrip(",").split(",")[0].strip()
        return "unknown"
    except Exception as e:
        logger.warning(f"Failed to query latest musicdl version: {e}")
        return "unknown"


def upgrade_musicdl(version: str | None = None) -> dict:
    """运行时升级 musicdl(pip install --upgrade)+ 清除模块缓存

    Args:
        version: 指定版本(如 "2.11.0"),None 则升级到最新
    Returns:
        {ok, old_version, new_version, cleared_modules, stdout}
    """
    target = f"musicdl=={version}" if version else "musicdl"
    old_version = get_musicdl_version()

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", target,
             "-i", PIP_INDEX, "--no-input"],
            capture_output=True, text=True, timeout=180,
        )
        if result.returncode != 0:
            return {
                "ok": False,
                "old_version": old_version,
                "error": result.stderr[-500:] if result.stderr else "unknown error",
            }

        # 清除 sys.modules 中所有 musicdl 子模块,下次 import 会重新加载新版
        cleared = _clear_musicdl_modules()

        # 重置全局 MusicClient 单例(如果有)
        try:
            from app.utils.music import reset_music_client
            reset_music_client()
        except Exception:
            pass

        new_version = get_musicdl_version()
        logger.info(f"musicdl upgraded: {old_version} -> {new_version}, cleared {len(cleared)} modules")

        return {
            "ok": True,
            "old_version": old_version,
            "new_version": new_version,
            "cleared_modules": len(cleared),
            "already_latest": old_version == new_version,
            "stdout": result.stdout[-500:],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "pip install 超时(>180s),可能是网络问题"}
    except Exception as e:
        logger.exception("musicdl upgrade failed")
        return {"ok": False, "error": str(e)}


def _clear_musicdl_modules() -> list[str]:
    """从 sys.modules 移除所有 musicdl 相关模块

    search.py 的 _search_single_source 是函数内 import,
    清除后下次调用会重新执行 import,拿到新版本代码。
    """
    cleared = []
    for key in list(sys.modules.keys()):
        if key == "musicdl" or key.startswith("musicdl."):
            del sys.modules[key]
            cleared.append(key)
    return cleared
