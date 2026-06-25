"""pytest 全局 fixtures

测试用 SQLite 内存数据库(快、零配置),通过 dependency_overrides 注入。
SQLite 外键约束默认关闭,这里通过 PRAGMA 启用以测试级联删除。
"""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.models.user import User
from app.utils.auth import hash_password


@pytest.fixture
def engine():
    """SQLite 内存 engine(StaticPool 共享同一内存连接,启用外键约束)"""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # 启用 SQLite 外键约束(默认关闭),让 ondelete 级联生效
    @event.listens_for(eng, "connect")
    def _enable_fk(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    """数据库 session,测试函数结束后自动回滚"""
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """TestClient,覆盖 get_db 依赖使用测试 session。

    注意:不进入 `with TestClient(app)` 上下文,避免触发 lifespan
    (lifespan 含 create_all + Redis listener,测试环境无 Redis)。
    """
    from app.main import app
    app.dependency_overrides[get_db] = lambda: db_session
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """创建测试用户,返回 User 对象"""
    user = User(
        username="testuser",
        password_hash=hash_password("testpass123"),
        nickname="测试用户",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """返回带 Bearer token 的请求头"""
    from app.utils.auth import create_access_token
    token = create_access_token(test_user.id, username=test_user.username)
    return {"Authorization": f"Bearer {token}"}


# 延迟导入 TestClient(避免模块加载时触发 app 初始化)
from fastapi.testclient import TestClient  # noqa: E402
