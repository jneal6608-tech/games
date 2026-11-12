# The game calls these methods from JavaScript by name.
-keepclassmembers class com.brewfall.game.Bridge { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
