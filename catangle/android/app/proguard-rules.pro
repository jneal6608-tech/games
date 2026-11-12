# Methods called from JavaScript must keep their names.
-keepclassmembers class com.catangle.game.MainActivity$Bridge { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
