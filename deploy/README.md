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
EOF

# 启动 MySQL + Redis
docker compose -f docker-compose.infrastructure.yml up -d

# 验证
docker compose -f docker-compose.infrastructure.yml ps
mysql -h 10.0.0.100 -u happymusic -p -e "SELECT 1"
redis-cli -h 10.0.0.100 -a your_secure_redis_pass ping
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

# JWT（所有服务器必须相同！）
JWT_SECRET_KEY=your_jwt_secret_key_change_this
JWT_ALGORITHM=HS256

# AI 配置（可选）
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com
AI_API_KEY=sk-your-key
AI_MODEL=gpt-3.5-turbo

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
