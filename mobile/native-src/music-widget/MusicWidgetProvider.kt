package com.happymusic.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * 桌面播放控制小组件(4×1):
 *  - 显示当前歌曲名/歌手 + 上一首/播放暂停/下一首按钮
 *  - 按钮通过 PendingIntent 启动 MainActivity 并携带 widget_action,
 *    由 WidgetControlModule(ActivityEventListener)捕获并 emit 到 JS
 *  - JS 侧通过 WidgetControl.updateWidget() 反向更新小组件显示
 */
class MusicWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(id, buildRemoteViews(context, "HappyMusic", "点击打开应用", false))
        }
    }

    companion object {
        const val EXTRA_ACTION = "widget_action"

        fun buildRemoteViews(context: Context, song: String, artist: String, isPlaying: Boolean): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_music)
            views.setTextViewText(R.id.widget_song, if (song.isNotEmpty()) song else "HappyMusic")
            views.setTextViewText(R.id.widget_artist, if (artist.isNotEmpty()) artist else "点击打开应用")
            views.setTextViewText(R.id.btn_play, if (isPlaying) "⏸" else "▶")
            views.setOnClickPendingIntent(R.id.btn_prev, controlIntent(context, "prev", 1))
            views.setOnClickPendingIntent(R.id.btn_play, controlIntent(context, "toggle", 2))
            views.setOnClickPendingIntent(R.id.btn_next, controlIntent(context, "next", 3))
            views.setOnClickPendingIntent(R.id.widget_icon, openAppIntent(context, 0))
            views.setOnClickPendingIntent(R.id.widget_text, openAppIntent(context, 4))
            return views
        }

        private fun controlIntent(context: Context, action: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                putExtra(EXTRA_ACTION, action)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            return PendingIntent.getActivity(
                context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        private fun openAppIntent(context: Context, requestCode: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            return PendingIntent.getActivity(
                context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        /** 由 JS 调用:刷新所有小组件实例的显示。 */
        fun updateAll(context: Context, song: String, artist: String, isPlaying: Boolean) {
            val mgr = AppWidgetManager.getInstance(context)
            val provider = ComponentName(context, MusicWidgetProvider::class.java)
            val ids = mgr.getAppWidgetIds(provider)
            for (id in ids) {
                mgr.updateAppWidget(id, buildRemoteViews(context, song, artist, isPlaying))
            }
        }
    }
}
