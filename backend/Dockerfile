FROM python:3.12-slim

WORKDIR /app
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo Asia/Shanghai > /etc/timezone

# 后端只需 Python C 扩展编译工具 + curl(健康检查)
# 已移除:JDK、Node.js、Android SDK、Gradle、Capacitor、Electron/GTK 系统库
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖(清华源加速)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# pycryptodomex(独立验证安装)
RUN pip install --no-cache-dir pycryptodomex -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    python -c "from Cryptodome.Cipher import AES; print('Cryptodome OK')"

COPY . .

EXPOSE 9527

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9527"]
