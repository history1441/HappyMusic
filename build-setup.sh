#!/bin/bash
# HappyMusic 构建环境安装脚本
# 在宿主机上运行一次即可

set -e

echo "========================================="
echo "  HappyMusic 构建环境安装"
echo "========================================="

# Install Node.js if needed
if ! command -v node &>/dev/null; then
    echo "[1/4] 安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[1/4] Node.js 已安装: $(node --version)"
fi

# Install JDK 17 for Android builds
if ! command -v java &>/dev/null; then
    echo "[2/4] 安装 JDK 17..."
    apt-get update -qq
    apt-get install -y openjdk-17-jdk-headless unzip
else
    echo "[2/4] JDK 已安装: $(java -version 2>&1 | head -1)"
fi

# Install Android SDK command-line tools
ANDROID_DIR="/opt/android-sdk"
if [ ! -d "$ANDROID_DIR/cmdline-tools" ]; then
    echo "[3/4] 安装 Android SDK..."
    mkdir -p $ANDROID_DIR
    cd /tmp
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdtools.zip
    unzip -qo cmdtools.zip -d $ANDROID_DIR/
    mkdir -p $ANDROID_DIR/cmdline-tools/latest
    mv $ANDROID_DIR/cmdline-tools/bin $ANDROID_DIR/cmdline-tools/latest/ 2>/dev/null || true
    mv $ANDROID_DIR/cmdline-tools/lib $ANDROID_DIR/cmdline-tools/latest/ 2>/dev/null || true

    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
    yes | $ANDROID_DIR/cmdline-tools/latest/bin/sdkmanager --licenses 2>/dev/null || true
    $ANDROID_DIR/cmdline-tools/latest/bin/sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools" 2>/dev/null
    rm -f cmdtools.zip
    echo "Android SDK 安装完成"
else
    echo "[3/4] Android SDK 已安装"
fi

# Install global npm tools
echo "[4/4] 安装 Capacitor CLI..."
npm install -g @capacitor/cli 2>/dev/null || true

echo ""
echo "========================================="
echo "  构建环境安装完成！"
echo "========================================="
echo "Node: $(node --version)"
echo "Java: $(java -version 2>&1 | head -1)"
echo "Android SDK: $ANDROID_DIR"
