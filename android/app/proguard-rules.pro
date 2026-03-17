# --- Capacitor 기본 규칙 ---
# 자바스크립트와 자바 간의 인터페이스 클래스가 삭제되지 않도록 보호합니다.
-keepattributes JavascriptInterface
-keep @interface android.webkit.JavascriptInterface { *; }
-keep class com.getcapacitor.** { *; }
-keepclasseswithmembers class * {
  @android.webkit.JavascriptInterface <methods>;
}

# --- AdMob (Google Mobile Ads) 규칙 ---
# 광고 라이브러리의 클래스와 인터페이스가 삭제되거나 이름이 바뀌지 않게 합니다.
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }

# 미디에이션이나 특정 광고 라이브러리에서 사용하는 클래스 보호
-keep class com.google.android.gms.internal.** { *; }

# --- Firebase 규칙 ---
# Firebase 및 관련 분석 라이브러리 보호
-keep class com.google.firebase.** { *; }

# --- 기타 앱 최적화 ---
# 소스 파일 이름과 줄 번호를 보존하여 에러 로그(Crashlytics 등) 분석을 용이하게 합니다.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile