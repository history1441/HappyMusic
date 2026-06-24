FROM python:3.12-slim

WORKDIR /app
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo Asia/Shanghai > /etc/timezone

# System dependencies for Python + Android + Electron
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make libffi-dev \
    curl wget unzip \
    default-jdk-headless \
    libgtk-3-dev libnotify-dev libnss3 libxss1 libasound2t64 libxtst6 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Android SDK
ENV ANDROID_HOME=/opt/android-sdk
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$JAVA_HOME/bin:$PATH"

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdtools.zip && \
    unzip -qo /tmp/cmdtools.zip -d ${ANDROID_HOME}/ && \
    mv ${ANDROID_HOME}/cmdline-tools ${ANDROID_HOME}/cmdline-tools-tmp && \
    mkdir -p ${ANDROID_HOME}/cmdline-tools/latest && \
    mv ${ANDROID_HOME}/cmdline-tools-tmp/bin ${ANDROID_HOME}/cmdline-tools/latest/ && \
    mv ${ANDROID_HOME}/cmdline-tools-tmp/lib ${ANDROID_HOME}/cmdline-tools/latest/ && \
    rm -rf ${ANDROID_HOME}/cmdline-tools-tmp /tmp/cmdtools.zip && \
    yes | sdkmanager --licenses 2>/dev/null || true && \
    sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools" 2>/dev/null && \
    rm -rf ${ANDROID_HOME}/.temp

# Install Capacitor CLI globally
RUN npm install -g @capacitor/cli 2>/dev/null || true

# Install Gradle 8.2.1 globally (used by Capacitor Android builds)
ENV GRADLE_USER_HOME=/opt/gradle-home
RUN wget -q https://repo.huaweicloud.com/gradle/gradle-8.2.1-all.zip -O /tmp/gradle.zip && \
    unzip -qo /tmp/gradle.zip -d /opt && \
    ln -sf /opt/gradle-8.2.1/bin/gradle /usr/local/bin/gradle && \
    rm /tmp/gradle.zip && \
    gradle --version

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

RUN pip install --no-cache-dir pycryptodomex -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    python -c "from Cryptodome.Cipher import AES; print('Cryptodome OK')"

COPY . .

EXPOSE 9527

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9527"]
