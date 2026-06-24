from fastapi import APIRouter, Depends, Query, HTTPException
from app.utils.auth import get_admin_user
from app.utils.redis import get_redis

router = APIRouter(prefix="/api/admin", tags=["缓存管理"])


@router.get("/cache/stats")
def cache_stats(admin_id: int = Depends(get_admin_user)):
    r = get_redis()
    info = r.info()
    return {
        "used_memory_human": info.get("used_memory_human"),
        "used_memory_peak_human": info.get("used_memory_peak_human"),
        "connected_clients": info.get("connected_clients"),
        "total_commands_processed": info.get("total_commands_processed"),
        "keyspace_hits": info.get("keyspace_hits"),
        "keyspace_misses": info.get("keyspace_misses"),
        "total_keys": r.dbsize(),
        "uptime_in_seconds": info.get("uptime_in_seconds"),
    }


@router.get("/cache/keys")
def cache_keys(
    pattern: str = Query("*"),
    limit: int = Query(100, ge=1, le=1000),
    admin_id: int = Depends(get_admin_user),
):
    r = get_redis()
    keys = list(r.scan_iter(match=pattern, count=limit))[:limit]
    result = []
    for k in keys:
        ttl = r.ttl(k)
        ktype = r.type(k)
        result.append({"key": k, "ttl": ttl, "type": ktype})
    return {"keys": result, "total": len(result)}


@router.get("/cache/keys/{key:path}")
def cache_key_value(key: str, admin_id: int = Depends(get_admin_user)):
    r = get_redis()
    if not r.exists(key):
        raise HTTPException(status_code=404, detail="Key not found")
    ktype = r.type(key)
    ttl = r.ttl(key)
    if ktype == "string":
        value = r.get(key)
    elif ktype == "list":
        value = r.lrange(key, 0, -1)
    elif ktype == "set":
        value = list(r.smembers(key))
    elif ktype == "hash":
        value = r.hgetall(key)
    elif ktype == "zset":
        value = r.zrange(key, 0, -1, withscores=True)
    else:
        value = None
    return {"key": key, "type": ktype, "ttl": ttl, "value": value}


@router.delete("/cache/keys/{key:path}")
def cache_delete_key(key: str, admin_id: int = Depends(get_admin_user)):
    r = get_redis()
    deleted = r.delete(key)
    return {"ok": True, "deleted": deleted}


@router.post("/cache/flush")
def cache_flush(confirm: bool = False, admin_id: int = Depends(get_admin_user)):
    if not confirm:
        raise HTTPException(status_code=400, detail="需要确认参数 confirm=true")
    r = get_redis()
    r.flushdb()
    return {"ok": True, "message": "缓存已清空"}
