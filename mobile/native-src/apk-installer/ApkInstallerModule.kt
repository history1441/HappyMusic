package com.happymusic.app

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * 触发系统包安装器安装本地 APK(应用内更新,不经过浏览器)。
 * 依赖:REQUEST_INSTALL_PACKAGES 权限 + FileProvider(authority = <package>.apkprovider)
 * 由 withApkInstaller config plugin 注入。
 */
class ApkInstallerModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName() = "ApkInstaller"

    @ReactMethod
    fun installApk(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("ENOENT", "APK 文件不存在: $filePath")
                return
            }
            val authority = ctx.packageName + ".apkprovider"
            val uri = FileProvider.getUriForFile(ctx, authority, file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_INSTALL", e.message ?: "安装失败")
        }
    }
}
