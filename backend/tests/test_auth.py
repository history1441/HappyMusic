"""认证端点测试:注册、登录、token 校验"""


def test_register_success(client):
    """新用户注册成功,返回 access_token 和 refresh_token"""
    response = client.post("/api/auth/register", json={
        "username": "newuser",
        "password": "pass123456",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_register_duplicate(client, test_user):
    """重复用户名注册失败 400"""
    response = client.post("/api/auth/register", json={
        "username": "testuser",  # test_user fixture 已创建
        "password": "pass123456",
    })
    assert response.status_code == 400


def test_login_success(client, test_user):
    """正确密码登录成功,返回 token"""
    response = client.post("/api/auth/login", json={
        "username": "testuser",
        "password": "testpass123",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client, test_user):
    """错误密码登录失败 401"""
    response = client.post("/api/auth/login", json={
        "username": "testuser",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


def test_protected_endpoint_requires_token(client):
    """无 token 访问受保护端点返回 401 或 403(均为未授权)"""
    response = client.get("/api/playlists")
    assert response.status_code in (401, 403), \
        f"未授权访问应被拒绝,实际 {response.status_code}"


def test_protected_endpoint_with_token(client, auth_headers):
    """有效 token 能访问受保护端点"""
    response = client.get("/api/playlists", headers=auth_headers)
    assert response.status_code == 200
