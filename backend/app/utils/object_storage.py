"""对象存储工具(MinIO / S3 兼容)

封装 MinIO 客户端,提供 upload/download/delete/list/presigned_url 等操作。
用于 APK 发布、数据库备份等需要跨实例共享的文件。
"""

from io import BytesIO
from datetime import timedelta
from typing import Iterator, Optional
from minio import Minio
from minio.error import S3Error
from app.config import get_settings

settings = get_settings()

_client: Optional[Minio] = None


def get_minio() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _client


def ensure_bucket(bucket: str) -> None:
    client = get_minio()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def upload_bytes(
    bucket: str,
    object_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> None:
    ensure_bucket(bucket)
    get_minio().put_object(
        bucket, object_name, BytesIO(data),
        length=len(data), content_type=content_type,
    )


def upload_stream(
    bucket: str,
    object_name: str,
    stream,
    length: int,
    content_type: str = "application/octet-stream",
) -> None:
    """流式上传(适用于 UploadFile 等)"""
    ensure_bucket(bucket)
    get_minio().put_object(
        bucket, object_name, stream,
        length=length, content_type=content_type,
    )


def download_object(bucket: str, object_name: str):
    """返回一个可流式读取的 response,调用方负责 close/release_conn"""
    return get_minio().get_object(bucket, object_name)


def object_exists(bucket: str, object_name: str) -> bool:
    try:
        get_minio().stat_object(bucket, object_name)
        return True
    except S3Error:
        return False


def stat_object(bucket: str, object_name: str):
    """返回对象元数据(size, content_type, last_modified)"""
    return get_minio().stat_object(bucket, object_name)


def delete_object(bucket: str, object_name: str) -> None:
    get_minio().remove_object(bucket, object_name)


def list_objects(bucket: str, prefix: str = "") -> Iterator:
    return get_minio().list_objects(bucket, prefix=prefix, recursive=True)


def get_public_url(bucket: str, object_name: str) -> str:
    """通过前端 nginx /files/ 代理生成的公开下载 URL(仅对公开 bucket 有效)"""
    return f"{settings.MINIO_PUBLIC_URL}/{bucket}/{object_name}"


def get_presigned_url(bucket: str, object_name: str, expires_hours: int = 1) -> str:
    """生成预签名 URL(私有 bucket 临时访问,默认 1 小时)"""
    return get_minio().presigned_get_object(
        bucket, object_name, expires=timedelta(hours=expires_hours),
    )
