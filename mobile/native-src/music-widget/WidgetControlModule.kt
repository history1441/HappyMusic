package com.happymusic.app

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * 桥接桌面小组件与 RN:
 *  - 捕获 widget 按钮经 MainActivity.onNewIntent 传递的 widget_action,emit "WidgetControl" 事件
 *  - 暴露 getInitialAction() 处理冷启动(getIntent),updateWidget() 反向刷新小组件
 */
class WidgetControlModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        // ActivityEventListener.onNewIntent 在 MainActivity 收到新 Intent(热启动点 widget)时触发
        reactContext.addActivityEventListener(object : com.facebook.react.bridge.ActivityEventListener {
            override fun onNewIntent(intent: Intent?) {
                val action = intent?.getStringExtra(MusicWidgetProvider.EXTRA_ACTION) ?: return
                sendEvent(action)
            }
            override fun onActivityResult(activity: android.app.Activity?, requestCode: Int, resultCode: Int, data: Intent?) {}
        })
    }

    override fun getName() = "WidgetControl"

    /** 冷启动:app 未运行时点 widget,Intent 在 getIntent 中。JS 启动后调用一次取回并消费。 */
    @ReactMethod
    fun getInitialAction(promise: Promise) {
        val activity = currentActivity
        val action = activity?.intent?.getStringExtra(MusicWidgetProvider.EXTRA_ACTION)
        activity?.intent?.removeExtra(MusicWidgetProvider.EXTRA_ACTION)
        promise.resolve(action)
    }

    /** JS 调用:用当前歌曲/播放状态刷新小组件。 */
    @ReactMethod
    fun updateWidget(song: String, artist: String, isPlaying: Boolean) {
        try {
            MusicWidgetProvider.updateAll(reactContext, song, artist, isPlaying)
        } catch (_: Exception) {}
    }

    private fun sendEvent(action: String) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("WidgetControl", action)
    }
}
