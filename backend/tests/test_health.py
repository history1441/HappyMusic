"""健康检查端点测试"""


def test_health(client):
    """GET /api/health 返回 200 和 ok 状态"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
