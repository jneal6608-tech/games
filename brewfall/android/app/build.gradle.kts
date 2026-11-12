import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release secrets and live IDs come from android/keystore.properties (never committed). See TECHNICAL_NOTES.md.
val secrets = Properties().apply { val f = rootProject.file("keystore.properties"); if (f.exists()) f.inputStream().use { load(it) } }
fun secret(k: String, d: String = "") = (secrets.getProperty(k) ?: d)

// Google's public sample IDs: they always serve test ads. Replace through keystore.properties before launch.
val testAppId = "ca-app-pub-3940256099942544~3347511713"
val testRewarded = "ca-app-pub-3940256099942544/5224354917"
val testInterstitial = "ca-app-pub-3940256099942544/1033173712"

android {
    namespace = "com.brewfall.game"
    compileSdk = 36
    defaultConfig {
        applicationId = secret("applicationId", "com.brewfall.game")
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        manifestPlaceholders["admobAppId"] = secret("admobAppId", testAppId)
        buildConfigField("String", "AD_REWARDED", "\"${secret("admobRewardedId", testRewarded)}\"")
        buildConfigField("String", "AD_INTERSTITIAL", "\"${secret("admobInterstitialId", testInterstitial)}\"")
        buildConfigField("String", "PLAY_LICENSE_KEY", "\"${secret("playLicenseKey")}\"")
        buildConfigField("String", "PRIVACY_URL", "\"${secret("privacyUrl")}\"")
    }
    signingConfigs {
        create("release") {
            if (secrets.getProperty("storeFile") != null) {
                storeFile = rootProject.file(secret("storeFile")); storePassword = secret("storePassword")
                keyAlias = secret("keyAlias"); keyPassword = secret("keyPassword")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true; isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (secrets.getProperty("storeFile") != null) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
    bundle { language { enableSplit = false } }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("com.android.billingclient:billing-ktx:8.0.0")
    implementation("com.google.android.gms:play-services-ads:24.5.0")
    implementation("com.google.android.ump:user-messaging-platform:3.2.0")
    implementation("com.google.android.play:review-ktx:2.0.2")
    testImplementation("junit:junit:4.13.2")
}
