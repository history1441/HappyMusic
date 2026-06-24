package com.happymusic.app

object LyricsManager {
    @Volatile
    var currentLine: String = ""
    @Volatile
    var nextLine: String = ""
    var floatingService: FloatingLyricsService? = null

    fun update(current: String, next: String) {
        currentLine = current
        nextLine = next
        floatingService?.updateText(current, next)
    }

    fun clear() {
        currentLine = ""
        nextLine = ""
        floatingService?.updateText("", "")
    }
}
