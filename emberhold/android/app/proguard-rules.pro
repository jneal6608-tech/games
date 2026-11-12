# Methods called from JavaScript must keep their names.
-keepclassmembers class com.emberhold.game.** { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
