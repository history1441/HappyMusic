# 贡献指南

感谢参与 HappyMusic 项目!本文档帮助你快速上手开发。

## 项目结构

```
HappyMusic/
├── backend/         # FastAPI 后端(Python 3.12)
├── frontend/        # React 管理后台(Vite)
├── mobile/          # Expo 移动端(React Native)
├── desktop/         # Tauri 桌面端(Rust + React)
├── common/          # 三端共享类型与逻辑
├── deploy/          # Docker 分布式部署配置
└── .github/workflows/  # CI/CD
```

## 开发环境

### 后端(FastAPI)

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt

# 数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --port 9527

# 运行测试(SQLite 内存,无需 MySQL)
pytest
```

### 前端管理后台

```bash
cd frontend
npm install
npm run dev      # Vite dev server,端口 3721
npm run build    # 类型检查 + 生产构建
```

### 移动端(Expo)

```bash
cd mobile
npm install
npx expo start                    # 开发模式
cd android && ./gradlew assembleRelease  # 构建 APK
```

> **注意**:`react-native-track-player v4` 不兼容新架构,`app.json` 中 `newArchEnabled: false` 必须保持。

### 共享层 common

修改 `common/src/` 后,三端(frontend/mobile/desktop)需重新构建才能生效:
```bash
cd common && npm run build
```

## 代码规范

### Python(后端)
- 类型注解必填(`def foo(x: int) -> str:`)
- 函数必须有 docstring(中文)
- 新增依赖必须加到 `requirements.txt` 并锁定版本(`==`)
- 数据库 schema 变更必须通过 Alembic 迁移(`alembic revision --autogenerate`)

### TypeScript(前端/移动端)
- 严格类型,避免 `any`(确需时用 `unknown`)
- 新增页面必须用 `React.lazy` 懒加载
- 长列表 `FlatList` 添加 `removeClippedSubviews` + `initialNumToRender` 等性能属性

### Rust(桌面端)
- `unwrap()` 仅用于确定不会 panic 的场景,否则用 `?` 或 `match`

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>
```

**type**:`feat` | `fix` | `perf` | `refactor` | `docs` | `ci` | `test` | `chore`

示例:
```
feat(search): 每音源独立 60s 超时,替代 180s 总超时
fix(playerStore): playSong 版本号竞态保护
perf(docker): backend 镜像瘦身,移除 Android SDK
ci: 添加 pytest 测试 workflow
docs: 添加 CONTRIBUTING 指南
```

## 测试

- 后端测试:`pytest tests/`(SQLite 内存,零配置)
- 提交前确保 `pytest` 通过
- 关键业务逻辑(认证、搜索、级联)必须有测试覆盖

## 数据库迁移

```bash
cd backend

# 修改 model 后,生成迁移
alembic revision --autogenerate -m "描述变更"

# 核对生成的迁移(versions/*.py),必要时手写 op

# 本地执行
alembic upgrade head

# 现有生产库标记为最新(不执行 SQL)
alembic stamp head
```

**禁止**直接修改 `Base.metadata.create_all` 的输出,所有 schema 变更走 Alembic。

## CI/CD

| Workflow | 触发 | 作用 |
|---|---|---|
| `test.yml` | push/PR | pytest + 覆盖率 |
| `build-release.yml` | tag v* | Android APK(ABI splits) |
| `build-docker.yml` | tag v* | ghcr.io 镜像 |
| `build-frontend.yml` | tag v* | 前端 dist |
| `build-pc.yml` | tag v* | Tauri 桌面端 |

PR 合并前必须通过 `test.yml`。

## 热更新

- **musicdl 第三方库**:运行中通过管理后台升级,无需重启 backend
  - `POST /api/admin/sources/musicdl/upgrade`
- **自定义音源适配器**:放入 `backend/custom_sources/*.py`,调用 reload 端点
  - `POST /api/admin/sources/custom/reload`
- **音源启停**:管理后台切换,即时生效
  - `PUT /api/admin/sources/toggle`

## PR 流程

1. Fork 仓库,创建特性分支(`feat/xxx`、`fix/xxx`)
2. 确保测试通过、代码规范
3. 提交 PR,描述改动和测试方法
4. 等待 CI 通过 + 代码评审

## 联系

- 问题:GitHub Issues
- 安全漏洞:私信(不要公开 Issue)
