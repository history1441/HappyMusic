# HappyMusic 分布式部署指南

## 部署模式选择

| 模式 | 适用场景 | 文件 | 说明 |
|------|---------|------|------|
| **单机完整部署** | 开发/小规模生产（<100用户） | `docker-compose.yml` | 所有服务在一台机器 |
| **分布式部署** | 中大规模生产（>100用户） | `deploy/*.yml` | 按角色拆分到多台服务器 |

---

## 一、单机完整部署（最简单）

```bash
# 1. 复制配置
cp .env.dist .env
# 编辑 .env，修改密码和密钥

# 2. 启动所有服务
docker compose up -d

# 3. 查看状态
docker compose ps
curl http://localhost:8190/api/health
```

**服务端口：**
- 前端：http://localhost:8190
- Nginx LB：http://localhost:8080
- 后端1：http://localhost:9527
- 后端2：http://localhost:9528
- MySQL：localhost:33206
- Redis：localhost:63996

---

## 二、分布式部署（多服务器）

### 拓扑示例

```
                    公网用户
                       │
                       ▼
            ┌─────────────────────┐
            │  前端服务器           │
            │  10.0.0.103          │
            │  ┌────────────────┐  │
            │  │ Nginx (前端)   │  │
            │  │ Nginx LB       │  │
            │  │ :80 / :8080    │  │
            │  └────────────────┘  │
            └──────────┬──────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Backend 1│ │ Backend 2│ │ Backend N│
   │10.0.0.101│ │10.0.0.102│ │10.0.0.10X│
   │  :9527   │ │  :9527   │ │  :9527   │
   └─────┬────┘ └─────┬────┘ └─────┬────┘
         │            │            │
         └────────────┼────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │  基础设施服务器       │
            │  10.0.0.100          │
            │  ┌────────────────┐  │
            │  │ MySQL :3306    │  │
            │  │ Redis :6379    │  │
            │  └────────────────┘  │
            └─────────────────────┘
```

### 步骤1：部署基础设施服务器（10.0.0.100）

```bash
# 在基础设施服务器上
cd /opt/happymusic
git clone <repo> .
cd deploy

# 创建 .env
cat > .env <<EOF
MYSQL_ROOT_PASSWORD=your_secure_root_pass
MYSQL_PASSWORD=your_secure_mysql_pass
REDIS_PASSWORD=your_secure_redis_pass
MYSQL_PORT=3306
REDIS_PORT=6379

# MinIO 对象存储(APK 发布 / 数据库备份等共享文件)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=your_secure_minio_password_at_least_12_chars
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
EOF

# 启动 MySQL + Redis
docker compose -f docker-compose.infrastructure.yml up -d

# 启动 MinIO 对象存储(+ minio-init 自动创建 bucket)
docker compose -f docker-compose.minio.yml up -d

# 验证
docker compose -f docker-compose.infrastructure.yml ps
docker compose -f docker-compose.minio.yml ps
mysql -h 10.0.0.100 -u happymusic -p -e "SELECT 1"
redis-cli -h 10.0.0.100 -a your_secure_redis_pass ping
curl -sf http://10.0.0.100:9000/minio/health/live && echo "MinIO OK"

# (可选)SSH 隧道访问 MinIO 控制台(避免公网暴露)
# ssh -L 9001:localhost:9001 root@10.0.0.100
# 然后浏览器访问 http://localhost:9001
```

### 步骤2：部署后端服务器（10.0.0.101, 10.0.0.102, ...）

**在每台后端服务器上执行：**

```bash
# 在后端服务器 1 上（10.0.0.101）
cd /opt/happymusic
git clone <repo> .
cd deploy

# 创建 .env（每台服务器 INSTANCE_ID 不同）
cat > .env <<EOF
# 实例标识（每台服务器不同！）
INSTANCE_ID=backend-1

# 连接共享基础设施
MYSQL_HOST=10.0.0.100
MYSQL_PORT=3306
MYSQL_USER=happymusic
MYSQL_PASSWORD=your_secure_mysql_pass
MYSQL_DATABASE=happymusic

REDIS_HOST=10.0.0.100
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_pass

# MinIO 对象存储(连接基础设施服务器上的 MinIO)
MINIO_ENDPOINT=10.0.0.100:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=your_secure_minio_password_at_least_12_chars
MINIO_SECURE=false
MINIO_BUCKET_BUILDS=happymusic-builds
MINIO_BUCKET_BACKUPS=happymusic-backups
MINIO_BUCKET_PUBLIC=happymusic-public

# JWT（所有服务器必须相同！）
JWT_SECRET_KEY=your_jwt_secret_key_change_this
JWT_ALGORITHM=HS256

# AI 配置（可选）
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com
AI_API_KEY=sk-your-key
AI_MODEL=gpt-3.5-turbo

# CORS 白名单(生产环境必须配置)
ALLOWED_ORIGINS=https://music.example.com,https://admin.music.example.com

# 调试
HAPPYMUSIC_DEBUG=false
EOF

# 启动后端实例
docker compose -f docker-compose.backend.yml up -d

# 验证
curl http://localhost:9527/api/health
# 返回: {"status":"ok","version":"4.1.0","instance":"backend-1"}
```

**在后端服务器 2 上（10.0.0.102）重复上述步骤，修改 `INSTANCE_ID=backend-2`。**

### 步骤3：部署前端服务器（10.0.0.103）

```bash
# 在前端服务器上
cd /opt/happymusic
git clone <repo> .
cd deploy

# 修改 nginx-lb.conf，添加所有后端服务器地址
vim nginx-lb.conf
# 修改 upstream backend_pool:
#   server 10.0.0.101:9527;  # backend-1
#   server 10.0.0.102:9527;  # backend-2

# 启动前端 + Nginx LB
docker compose -f docker-compose.frontend.yml up -d

# 验证
curl http://localhost/lb-health
# 返回: {"status":"ok","instance":"lb"}

# 测试负载均衡
for i in 1 2 3 4 5; do
  curl -s http://localhost:8080/api/health | jq .instance
done
# 应该看到 backend-1 和 backend-2 交替出现（或基于 ip_hash 固定）
```

---

## 三、扩展后端实例

### 添加第 3 台后端服务器

1. **在新服务器上部署**（同步骤2）：
   ```bash
   INSTANCE_ID=backend-3
   ```

2. **在前端服务器的 nginx-lb.conf 中添加**：
   ```nginx
   upstream backend_pool {
       ip_hash;
       server 10.0.0.101:9527;  # backend-1
       server 10.0.0.102:9527;  # backend-2
       server 10.0.0.103:9527;  # backend-3 (新增)
   }
   ```

3. **重载 Nginx LB**（零停机）：
   ```bash
   docker exec happymusic-nginx-lb nginx -s reload
   ```

### 移除后端服务器（优雅下线）

1. **在 nginx-lb.conf 中注释或删除对应行**：
   ```nginx
   # server 10.0.0.102:9527;  # 临时下线
   ```

2. **重载 Nginx**：
   ```bash
   docker exec happymusic-nginx-lb nginx -s reload
   ```

3. **等待现有连接结束**（约 1-2 分钟），然后停止后端容器。

---

## 四、关键配置说明

### 1. JWT 密钥必须一致

所有后端实例必须使用**相同的** `JWT_SECRET_KEY`，否则用户在不同实例间无法共享登录状态。

### 2. WebSocket 跨实例广播

当前实现通过 Redis Pub/Sub 广播 WebSocket 消息：

- 用户在 Backend-1 上发送消息
- Backend-1 将消息 publish 到 Redis channel `happymusic:ws:broadcast`
- 所有其他 Backend 实例订阅该 channel，收到消息后转发给本地连接的同用户 WebSocket

**前提**：所有 Backend 实例连接**同一个 Redis**。

### 3. Nginx ip_hash 的作用

`ip_hash` 保证同一客户端 IP 的请求始终路由到同一后端实例：

- 减少 Redis 跨实例广播量
- WebSocket 连接更稳定（不会因负载均衡切换实例）

如果客户端使用代理（所有请求来自同一 IP），`ip_hash` 会失效，此时需要改用 `hash $cookie_session_id` 或其他粘滞策略。

### 4. 数据库连接池

每个 Backend 实例的连接池配置（已在 `backend/app/database.py` 中设置）：

```python
pool_size=20,       # 每个实例维持 20 个连接
max_overflow=40,    # 峰值可扩展到 60 个
```

3 个 Backend 实例 = 最多 180 个数据库连接，MySQL 配置 `max-connections=200`（在 infrastructure compose 中已设置）。

---

## 五、监控与运维

### 健康检查脚本

```bash
#!/bin/bash
# health-check.sh

echo "=== 基础设施 ==="
docker exec happymusic-mysql mysqladmin ping -h localhost
docker exec happymusic-redis redis-cli ping

echo "=== 后端实例 ==="
for port in 9527 9528; do
  echo -n "Backend :${port}: "
  curl -s http://localhost:${port}/api/health | jq -c .
done

echo "=== 负载均衡器 ==="
curl -s http://localhost:8080/lb-health
```

### 查看实例分布

```bash
# 查看当前哪些后端实例在服务
curl -s http://localhost:8080/api/health | jq .instance
```

### 日志聚合

```bash
# 查看所有后端日志
docker compose -f docker-compose.backend.yml logs -f backend

# 查看特定实例
docker logs -f happymusic-backend-1
```

---

## 六、安全建议

1. **MySQL/Redis 不暴露公网**：仅允许内网访问（防火墙规则）
2. **使用强密码**：所有 `.env` 中的密码至少 20 字符
3. **HTTPS**：前端服务器配置 SSL 证书（Let's Encrypt）
4. **JWT 密钥**：使用随机生成的 64 字符字符串
5. **防火墙**：仅开放 80/443 端口，其他端口仅内网访问

```bash
# 生成强密码
openssl rand -base64 32

# 生成 JWT 密钥
openssl rand -hex 32
```

---

## 七、对象存储（MinIO）

HappyMusic 使用 MinIO（S3 兼容对象存储)保存需要跨实例共享的文件,彻底解决负载均衡下多后端实例的 404 问题。

### 为什么要对象存储?

| 场景 | 本地存储的问题 | MinIO 解决 |
|---|---|---|
| 管理员上传 APK | 文件存在 backend-1 本地,用户从 backend-2 下载 → 404 | 所有实例共享 MinIO |
| 数据库备份 | 备份在 backend-1 本地,容器重启后丢失 | 持久化 + 跨实例访问 |
| 移动端 IP 变化 | ip_hash 失效,路由到不同 backend → 404 | 文件源统一 |

### Bucket 设计

| Bucket | 访问策略 | 用途 |
|---|---|---|
| `happymusic-builds` | **公开读** | APK / 桌面端安装包发布 |
| `happymusic-backups` | **私有** | 数据库备份(仅管理员 API) |
| `happymusic-public` | **公开读** | 通用公开文件 |

Bucket 在 MinIO 首次启动时由 `minio-init` 容器自动创建并设置策略,无需手动操作。

### 3 种部署模式

#### 模式 A：单机一体化（开发/小规模生产）

直接用根目录的 `docker-compose.yml`,MinIO 内置,零配置:

```bash
cd /opt/happymusic
cp .env.dist .env  # 编辑密码
docker compose up -d
```

MinIO 与 MySQL/Redis/backend 全部在同一 compose,通过 Docker 内网通信。

#### 模式 B：MinIO 独立部署（分布式推荐）

**步骤 1**:在基础设施服务器(10.0.0.100)启动 MinIO:

```bash
cd /opt/happymusic/deploy
docker compose -f docker-compose.minio.yml up -d
```

**步骤 2**:在后端服务器的 `.env` 配置远程 MinIO:

```bash
MINIO_ENDPOINT=10.0.0.100:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=your_secure_minio_password
```

**步骤 3**:在前端服务器的 nginx 配置代理(已在 `frontend/nginx.conf` 预置):

```nginx
# MinIO 文件下载代理
location /files/ {
    proxy_pass http://10.0.0.100:9000/;
    # ... 其他 proxy_set_header
}

# MinIO 管理控制台代理(可选)
location /minio-console/ {
    proxy_pass http://10.0.0.100:9001/;
    # ...
}
```

> **注意**:分布式部署时,`frontend/nginx.conf` 中的 `proxy_pass` 需要从 `http://minio:9000/` 改为实际的 MinIO 服务器地址 `http://10.0.0.100:9000/`。

#### 模式 C：MinIO 与 MySQL/Redis 同机

将 `docker-compose.minio.yml` 的内容合并到 `docker-compose.infrastructure.yml`,一起启动。适合基础设施服务器资源充足的场景。

### 访问方式

#### 公开文件下载(无需 auth)

通过前端 nginx `/files/` 代理:

```bash
# 下载 APK(用户端)
curl -O https://music.example.com/files/happymusic-builds/HappyMusic-v1.9.0-android.apk

# 浏览器直接访问
https://music.example.com/files/happymusic-builds/HappyMusic-v1.9.0-android.apk
```

#### 私有文件下载(需管理员 auth)

通过后端 API 代理:

```bash
# 下载数据库备份(管理员)
curl -H "Authorization: Bearer <admin_token>" \
  https://music.example.com/api/admin/database/download/happymusic_20260624_120000.sql.gz
```

#### MinIO 管理控制台

通过前端 nginx `/minio-console/` 代理访问,或 SSH 隧道:

```bash
# SSH 隧道(生产推荐,避免公网暴露)
ssh -L 9001:localhost:9001 root@10.0.0.100
# 浏览器访问 http://localhost:9001
```

登录用户名/密码来自 `.env` 的 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`。

### 常用运维命令

```bash
# 进入 deploy 目录
cd /opt/happymusic/deploy

# 查看 MinIO 状态
docker compose -f docker-compose.minio.yml ps

# 查看 MinIO 日志
docker compose -f docker-compose.minio.yml logs -f minio

# 重启 MinIO
docker compose -f docker-compose.minio.yml restart

# 手动创建/检查 bucket
docker run --rm --network happymusic-net minio/mc:latest \
  sh -c "
  mc alias set local http://minio:9000 minioadmin your_secure_password &&
  mc ls local/ &&
  mc anonymous set download local/happymusic-builds
  "

# 备份 MinIO 数据(到本地)
docker run --rm -v $(pwd)/minio-backup:/backup -v minio_data:/data alpine \
  tar czf /backup/minio-$(date +%Y%m%d).tar.gz /data
```

### 故障排查

| 问题 | 排查方法 |
|---|---|
| 上传 APK 报错 500 | 检查 backend 能否连接 MinIO:`docker exec happymusic-backend-1 curl http://minio:9000/minio/health/live` |
| 下载 `/files/` 返回 403 | Bucket 未设公开读,手动执行 `mc anonymous set download local/happymusic-builds` |
| 下载 `/files/` 返回 404 | 文件不存在或 bucket 名错误,检查 URL 路径格式:`/files/<bucket>/<object>` |
| 备份上传失败 | 检查 `MINIO_SECRET_KEY` 配置,backend 容器需能访问 MinIO |
| `minio-init` 容器反复重启 | 首次初始化后可停止:`docker compose -f docker-compose.minio.yml stop minio-init` |

