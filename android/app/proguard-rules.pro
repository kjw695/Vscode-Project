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

# --- Capacitor 플러그인 데이터 보호 ---
# 플러그인을 통해 전달되는 객체의 필드 이름이 바뀌지 않도록 보호합니다.
-keepclassmembers class * {
  @com.getcapacitor.JSMethod <methods>;
}

# --- 사용 중인 주요 플러그인 모델 보호 ---
-keep class com.capawesome.capacitor.appupdate.** { *; }
-keep class com.capacitorjs.plugins.app.** { *; }
-keep class com.capacitorjs.plugins.preferences.** { *; }
-keep class com.Hamjad.pedometer.** { *; }

# --- JSON 및 데이터 모델 보호 (계산 에러 해결) ---
# 앱 내부에서 사용하는 데이터 객체의 필드 이름이 난독화되는 것을 방지
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.getcapacitor.JSObject { *; }

# ✨ 데이터 항목 이름 보호 (계산기 정상 작동을 위해 필수)
-keepclassmembers class * {
    *** get*();
    *** set*(***);
}

# Capacitor 데이터 전송 객체 보호 강화
-keep class com.getcapacitor.JSObject { *; }
-keep class com.getcapacitor.JSArray { *; }