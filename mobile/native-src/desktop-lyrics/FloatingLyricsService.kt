package com.happymusic.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

class FloatingLyricsService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var currentText: TextView? = null
    private var nextText: TextView? = null
    private var closeBtn: ImageView? = null
    private val handler = Handler(Looper.getMainLooper())
    private val channelId = "floating_lyrics_fg"
    private val notificationId = 20002
    private var isRunning = false

    private val updateRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            val curr = LyricsManager.currentLine
            val next = LyricsManager.nextLine
            currentText?.text = if (curr.isNotEmpty()) curr else "♪ ..."
            nextText?.text = if (next.isNotEmpty()) next else ""
            handler.postDelayed(this, 300)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        LyricsManager.floatingService = this
        createNotificationChannel()
        startForeground(notificationId, createNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        createOverlay()
        handler.post(updateRunnable)
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacks(updateRunnable)
        removeOverlay()
        LyricsManager.floatingService = null
        super.onDestroy()
    }

    fun updateText(current: String, next: String) {
        handler.post {
            currentText?.text = if (current.isNotEmpty()) current else "♪ ..."
            nextText?.text = if (next.isNotEmpty()) next else ""
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun createOverlay() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        // Outer container
        val outerContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#E6222222"))
                cornerRadius = 28f
            }
            background = bg
            setPadding(8, 6, 8, 6)
            elevation = 16f
        }

        // Top bar: drag handle + close button
        val topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setPadding(12, 4, 4, 0)
        }

        // Drag handle dots
        val handleView = View(this).apply {
            val handleBg = GradientDrawable().apply {
                setColor(Color.parseColor("#33FFFFFF"))
                cornerRadius = 4f
            }
            background = handleBg
            layoutParams = LinearLayout.LayoutParams(80, 8).apply {
                gravity = Gravity.CENTER
                marginStart = 0
                marginEnd = 8
            }
        }
        val handleWrapper = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, 28, 1f)
            addView(handleView)
        }

        // Close button
        closeBtn = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setColorFilter(Color.parseColor("#88FFFFFF"))
            layoutParams = LinearLayout.LayoutParams(32, 32).apply {
                marginEnd = 4
            }
            setBackgroundResource(android.R.drawable.list_selector_background)
            setPadding(4, 4, 4, 4)
            setOnClickListener {
                // Stop the service when close is clicked
                stopSelf()
                // Also notify JS layer to reset mode
                val intent = Intent("com.happymusic.app.LYRICS_CLOSED")
                sendBroadcast(intent)
            }
        }

        topBar.addView(handleWrapper)
        topBar.addView(closeBtn)

        // Lyrics content area
        val contentContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 4, 16, 12)
        }

        // Current line - prominent
        currentText = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 16f
            setTypeface(null, Typeface.BOLD)
            setShadowLayer(4f, 0f, 2f, Color.parseColor("#AA000000"))
            setLineSpacing(2f, 1f)
            gravity = Gravity.CENTER
        }

        // Next line - subtle
        nextText = TextView(this).apply {
            setTextColor(Color.parseColor("#99FFFFFF"))
            textSize = 13f
            setShadowLayer(2f, 0f, 1f, Color.parseColor("#66000000"))
            setPadding(0, 6, 0, 0)
            gravity = Gravity.CENTER
        }

        contentContainer.addView(currentText)
        contentContainer.addView(nextText)

        outerContainer.addView(topBar)
        outerContainer.addView(contentContainer)
        overlayView = outerContainer

        val screenWidth = resources.displayMetrics.widthPixels
        val params = WindowManager.LayoutParams(
            (screenWidth * 0.88).toInt(),
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = 180
            x = 0
        }

        setupDrag(outerContainer, params)
        windowManager?.addView(outerContainer, params)
    }

    private fun setupDrag(view: View, params: WindowManager.LayoutParams) {
        var initialY = 0
        var initialTouchY = 0f
        var isDragging = false

        view.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialY = params.y
                    initialTouchY = event.rawY
                    isDragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dy = event.rawY - initialTouchY
                    if (Math.abs(dy) > 10) {
                        isDragging = true
                    }
                    if (isDragging) {
                        params.y = initialY - dy.toInt()
                        windowManager?.updateViewLayout(view, params)
                    }
                }
            }
            isDragging
        }
    }

    private fun removeOverlay() {
        overlayView?.let {
            try {
                windowManager?.removeView(it)
            } catch (_: Exception) {}
        }
        overlayView = null
        currentText = null
        nextText = null
        closeBtn = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "悬浮窗歌词",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return Notification.Builder(this, channelId)
            .setContentTitle("悬浮窗歌词运行中")
            .setSmallIcon(com.happymusic.app.R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()
    }
}
