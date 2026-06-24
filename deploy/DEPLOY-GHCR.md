# HappyMusic 生产部署指南(ghcr.io 预构建镜像)

本指南使用 GitHub Container Registry(ghcr.io)的预构建镜像部署,无需本地构建源码,适合生产服务器快速上线。

## 前置条件

- Docker 20+ 和 Docker Compose v2
- GitHub Personal Access Token(PAT),至少有 `read:packages` 权限(读取 ghcr.io 镜像)
- 服务器能访问 `ghcr.io`(如国内服务器走代理)
- 域名 / SSL 证书(可选,生产推荐)

## 镜像清单

| 镜像 | 说明 | 构建来源 |
|---|---|---|
| `ghcr.io/history1441/happymusic/backend:latest` | FastAPI 后端(Python 3.12 + 依赖) | `.github/workflows/build-docker.yml` |
| `ghcr.io/history1441/happymusic/frontend:latest` | Nginx + React 管理后台静态文件 | 同上(多阶段构建) |

可用 tag:
- `:latest` — 最新 main 分支
- `:v1.8.13` — 对应 git tag
- `:sha-xxxxxxx` — 对应 commit

## 首次部署

### 1. 克隆配置(只需 deploy 目录)

```bash
git clone https://github.com/history1441/HappyMusic.git
cd HappyMusic/deploy
```

或最小化:只下载需要的文件:

```bash
mkdir -p ~/happymusic && cd ~/happymusic
curl -O https://raw.githubusercontent.com/history1441/HappyMusic/main/deploy/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/history1441/HappyMusic/main/.env.dist
curl -O https://raw.githubusercontent.com/history1441/HappyMusic/main/backend/nginx-loadbalancer.conf
```

### 2. 登录 ghcr.io(拉取私有镜像)

```bash
# 用 GitHub Personal Access Token 登录
echo "ghp_YOUR_GITHUB_TOKEN" | docker login ghcr.io -u history1441 --password-stdin
# 输出:Login Succeeded
```

> Token 获取:GitHub → Settings → Developer settings → Personal access tokens → 勾选 `read:packages`

### 3. 配置环境变量

```bash
cp .env.dist .env
vim .env
```

必须修改的关键变量:

```bash
# 数据库密码(强密码)
MYSQL_ROOT_PASSWORD=<openssl rand -base64 32>
MYSQL_PASSWORD=<openssl rand -base64 32>

# Redis 密码
REDIS_PASSWORD=<openssl rand -base64 32>

# JWT 密钥(所有 backend 实例必须相同)
JWT_SECRET_KEY=<openssl rand -hex 32>

# MinIO 密码(至少 12 字符)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<强密码>

# CORS 白名单(你的实际域名)
ALLOWED_ORIGINS=https://music.example.com,https://admin.music.example.com
```

### 4. 启动所有服务

```bash
docker compose -f docker-compose.prod.yml up -d
```

首次启动会:
- 拉取 ghcr.io 镜像(backend ~500MB + frontend ~25MB)
- 拉取 mysql / redis / minio / nginx 镜像
- 初始化 MySQL 数据库
- 创建 MinIO bucket(builds/backups/public)
- 创建默认 superadmin 用户(来自 ADMIN_USERNAME/PASSWORD)

### 5. 验证部署

```bash
# 查看所有容器状态
docker compose -f docker-compose.prod.yml ps

# 健康检查
curl http://localhost:8190/api/health
# 期望: {"status":"ok","version":"4.1.0","instance":"backend-1"}

# 负载均衡(交替返回 backend-1 / backend-2)
for i in 1 2 3 4; do curl -s http://localhost:8080/api/health | grep -o '"instance":"[^"]*"'; done

# MinIO 健康
curl -sf http://localhost:8190/files/ -o /dev/null && echo "MinIO 代理 OK"
```

## 访问入口

| 入口 | URL | 说明 |
|---|---|---|
| **前端 + API** | `http://server-ip:8190` | 用户访问(静态文件 + /api 代理) |
| **Nginx LB** | `http://server-ip:8080` | 负载均衡器直连 |
| **MinIO 文件** | `http://server-ip:8190/files/<bucket>/<object>` | 对象存储文件下载 |
| **MinIO 控制台** | `http://server-ip:8190/minio-console/` | 管理界面(建议加 IP 白名单) |
| **后端 1** | `http://server-ip:9527` | 直接访问(调试用) |
| **后端 2** | `http://server-ip:9528` | 直接访问(调试用) |

> **生产推荐**:用 Nginx/Caddy 在外层做 HTTPS 反代到 8190,隐藏其他端口。

## 常用运维命令

```bash
# 查看实时日志
docker compose -f docker-compose.prod.yml logs -f backend-1
docker compose -f docker-compose.prod.yml logs -f frontend

# 重启某个服务
docker compose -f docker-compose.prod.yml restart backend-1

# 停止全部
docker compose -f docker-compose.prod.yml down

# 停止并删除数据卷(危险!会清空数据库)
docker compose -f docker-compose.prod.yml down -v
```

## 升级到新版本

ghcr.io 镜像更新后,拉取新镜像并重启:

```bash
# 拉取最新镜像
docker compose -f docker-compose.prod.yml pull

# 滚动重启(逐个更新,避免服务中断)
docker compose -f docker-compose.prod.yml up -d --no-deps backend-1
docker compose -f docker-compose.prod.yml up -d --no-deps backend-2
docker compose -f docker-compose.prod.yml up -d --no-deps frontend

# 验证新版本
curl http://localhost:8190/api/health
```

**锁定特定版本**(避免 latest 意外升级):

编辑 `docker-compose.prod.yml`,把 `:latest` 改为具体 tag:

```yaml
backend-1:
  image: ghcr.io/history1441/happymusic/backend:v1.8.13
```

## 数据备份

### MySQL 自动备份(通过管理后台)

```bash
# 登录管理后台触发备份(API 会存到 MinIO)
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  http://localhost:8190/api/admin/database/backup

# 下载备份(管理员)
curl -H "Authorization: Bearer <admin_token>" \
  -o backup.sql.gz \
  http://localhost:8190/api/admin/database/download/happymusic_20260624_120000.sql.gz
```

### 手动备份 Docker Volume

```bash
# 备份 MySQL 数据
docker run --rm -v $(pwd)/backup:/backup -v $(pwd)/docker-compose.prod.yml:/compose \
  -w /compose busybox tar czf /backup/mysql-$(date +%Y%m%d).tar.gz mysql_data

# 或用 docker compose
docker run --rm -v happymusic_mysql_data:/data -v $(pwd)/backup:/backup alpine \
  tar czf /backup/mysql-$(date +%Y%m%d).tar.gz /data
```

## 故障排查

### 容器无法启动

```bash
# 查看具体错误
docker compose -f docker-compose.prod.yml logs backend-1 | tail -50
```

常见原因:
- **数据库连接失败**:检查 MYSQL_HOST/MYSQL_PASSWORD 是否正确,MySQL 是否健康
- **JWT_SECRET_KEY 为空**:必须在 .env 设置
- **CORS 拒绝**:ALLOWED_ORIGINS 未配置或域名不匹配

### ghcr.io 拉取失败

```bash
# 检查登录状态
docker login ghcr.io

# 检查网络(国内服务器)
curl -I https://ghcr.io/v2/
```

如果是私有仓库(仓库设置为 private),必须先登录。仓库设置为 public 则无需登录。

### MinIO bucket 未初始化

```bash
# 手动重新初始化
docker compose -f docker-compose.prod.yml up minio-init
# 查看初始化日志
docker logs happymusic-minio-init
```

### 文件下载 404

确认文件路径格式:`/files/<bucket>/<object>`。例:

```bash
# 正确
curl -O http://localhost:8190/files/happymusic-builds/HappyMusic-v1.8.13-android-arm64-v8a.apk

# 错误(缺少 bucket 名)
curl -O http://localhost:8190/files/HappyMusic-v1.8.13.apk  # 404
```

## 与开发模式 docker-compose.yml 的区别

| 项 | docker-compose.yml(开发) | docker-compose.prod.yml(生产) |
|---|---|---|
| **backend 获取方式** | `build: ./backend`(本地源码构建) | `image: ghcr.io/.../backend:latest`(拉取) |
| **frontend 获取方式** | `build: ./frontend` | `image: ghcr.io/.../frontend:latest` |
| **源码挂载** | `./backend/app:/app/app`(热更新) | 无(镜像内打包) |
| **构建时间** | 首次 5-10 分钟 | 拉取镜像 30 秒 |
| **适合场景** | 开发调试 | 生产部署 |
| **CORS** | 宽松 | 必须配置 `ALLOWED_ORIGINS` |

## 扩展:多机分布式部署

单机不够时,参考 `deploy/README.md` 的分布式拓扑:
- **基础设施服务器**:MySQL + Redis + MinIO(用 `docker-compose.infrastructure.yml` + `docker-compose.minio.yml`)
- **后端服务器**:每台运行 `docker-compose.backend.yml`(指向远程基础设施)
- **前端服务器**:运行 frontend 镜像 + Nginx LB

分布式部署时 backend 镜像可以从 ghcr.io 拉取,无需每台服务器本地构建。
