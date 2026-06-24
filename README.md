# HappyMusic

全栈音乐应用 —— 聚合多源音乐搜索、播放、下载,支持移动端(Android)、桌面端(Windows/macOS/Linux)、Web 管理后台。

当前版本:**v1.8.13**(versionCode 67)

---

## 功能特性

### 用户端(移动 + 桌面)
- **多源音乐搜索**:聚合网易云、QQ音乐、酷狗、酷我、咪咕、千千 6 大音源,流式返回结果
- **播放器**:后台播放、锁屏控制、耳机线控、桌面悬浮歌词、睡眠定时
- **下载管理**:并发控制(最多 2 个并行)、断点续传、自动缓存清理
- **歌单与收藏**:多设备 WebSocket 实时同步
- **AI 心情解读**:基于歌词分析当前心情(需配置 AI Key)
- **心情电台 / 猜歌游戏 / 铃声制作**:扩展娱乐功能
- **扫码登录**:PC 端扫码快速登录
- **播放历史 / 热歌榜 / 本地音乐库**:完整的音乐管理

### 管理后台(Web)
- **用户管理**:CRUD、角色分层(user/admin/superadmin)、封禁、批量操作
- **应用发布**:APK/桌面端构建上传、版本分发、强制更新
- **音乐源管理**:动态启停音源、健康监控
- **数据分析**:播放统计、活跃用户、API 响应时间
- **系统监控**:CPU/内存/磁盘、Redis 浏览、日志查看(WebSocket 实时推送)
- **公告 / 审计日志 / 数据库备份**:完整运维工具链

### 基础设施
- **分布式部署**:Docker Compose,Nginx 负载均衡,多后端实例
- **WebSocket 跨实例广播**:Redis Pub/Sub 桥接
- **安全加固**:CORS 白名单、JWT 短期令牌、登录限流、superadmin 分层、审计日志异步写入

---

## 技术栈

| 层 | 技术 |
|---|---|
| **后端** | Python 3.11 · FastAPI · SQLAlchemy · MySQL 8.0 · Redis 7 · Pydantic · python-jose(JWT) |
| **移动端** | Expo SDK 54 · React Native · TypeScript · Zustand · react-native-track-player v4 |
| **桌面端** | Tauri 2 · React · TypeScript · Rust |
| **前端管理后台** | React 19 · Vite · TypeScript · Recharts · Tailwind CSS |
| **共享层** | common/ 目录,前后端复用类型定义 |
| **部署** | Docker · Docker Compose · Nginx |

---

## 项目结构

```
HappyMusic/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── routers/        # API 路由(12 用户端 + 13 管理端)
│   │   ├── models/         # SQLAlchemy 模型
│   │   ├── services/       # 业务逻辑
│   │   ├── middleware/     # 审计日志 + API 指标
│   │   └── utils/          # 认证 / Redis / 请求工具
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # React 管理后台
│   ├── src/pages/admin/    # 15 个管理页面
│   └── src/services/       # adminApi + 认证
├── mobile/                 # Expo 移动端
│   ├── src/
│   │   ├── screens/        # 23 个页面
│   │   ├── stores/         # Zustand 状态管理
│   │   ├── services/       # API / 播放 / 下载 / 同步
│   │   └── components/     # 复用组件
│   ├── native-src/         # Kotlin 原生模块(桌面歌词)
│   ├── plugins/            # Expo Config Plugins
│   └── app.plugin.js
├── desktop/                # Tauri 桌面端
│   ├── src/                # React 前端
│   └── src-tauri/          # Rust 后端
├── common/                 # 前后端共享类型
├── deploy/                 # 分布式部署配置
│   ├── docker-compose.infrastructure.yml
│   ├── docker-compose.backend.yml
│   └── docker-compose.frontend.yml
├── docker-compose.yml      # 单机完整部署
└── .env.dist               # 配置模板
```

---

## 快速开始

### 环境要求
- Python 3.11+
- Node.js 20+
- JDK 17(移动端 Android 构建)
- Docker & Docker Compose(部署)

### 1. 配置
```bash
cp .env.dist .env
# 编辑 .env,设置:
#   MYSQL_PASSWORD / REDIS_PASSWORD(强密码)
#   JWT_SECRET_KEY(openssl rand -hex 32)
#   ALLOWED_ORIGINS(你的前端域名)
#   AI_API_KEY(可选)
```

### 2. 单机部署(推荐)
```bash
docker compose up -d
# 服务端口:
#   前端:8190  Nginx LB:8080
#   后端:9527 / 9528
#   MySQL:33206  Redis:63996
```

### 3. 验证
```bash
curl http://localhost:8190/api/health
# {"status":"ok","version":"4.1.0","instance":"backend-1"}
```

详细分布式部署(多服务器)见 [deploy/README.md](deploy/README.md)。

---

## 开发环境

### 后端
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 9527
```

### 前端管理后台
```bash
cd frontend
npm install
npm run dev    # Vite dev server,默认 5173
```

### 移动端
```bash
cd mobile
npm install
# 生成 Android 原生项目
npx expo prebuild --platform android
# 开发模式
npx expo start
# 构建 Release APK
cd android && ./gradlew assembleRelease
```

> **注意**:react-native-track-player v4 不兼容新架构,`app.json` 中 `newArchEnabled: false` 必须保持。

---

## 安全特性

v1.8.13 版本完成了全面的安全审计与加固:

| 类别 | 措施 |
|---|---|
| **认证** | JWT access 2h + refresh 14d,登录 IP 速率限制(5次/60s) |
| **授权** | 三级角色(user/admin/superadmin),高危操作(删用户/改角色)要求 superadmin |
| **网络安全** | CORS 配置化白名单(`ALLOWED_ORIGINS`),GZip 压缩 |
| **数据安全** | 数据库备份使用参数化命令(杜绝 shell 注入),文件上传流式化(防 OOM) |
| **审计** | ThreadPoolExecutor 异步写入,所有 admin 操作留痕 |
| **资源管理** | APK 上传 1MB 分块,日志读取用 deque 防 OOM,大文件下载流式 |

---

## 版本历史

- **v1.8.13** (2026-06-24) — 移动端 12 项稳定性修复 + 管理后台 14 项安全/性能加固
- **v1.8.10** — AI 心情解读、分布式部署完善
- **v1.8.7** — 桌面歌词悬浮窗、铃声制作
- **v1.8.0** — Tauri 桌面端接入
- **v1.5.x** — 猜歌游戏、心情电台、扫码登录

---

## 部署架构

```
              公网用户
                 │
                 ▼
      ┌─────────────────────┐
      │  前端服务器(Nginx)  │
      │  + Nginx LB(ip_hash)│
      └──────────┬──────────┘
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
   Backend 1  Backend 2  Backend N
       └─────────┼─────────┘
                 ▼
      ┌─────────────────────┐
      │  MySQL + Redis      │
      │  (Redis Pub/Sub     │
      │   跨实例 WS 广播)    │
      └─────────────────────┘
```

---

## 相关文档

- [分布式部署指南](deploy/README.md)
- [版本升级清单](docs/UPGRADE.md)(如有)
- [管理后台使用手册](docs/ADMIN.md)(如有)

---

## License

私有项目(Private)。All rights reserved.
