package com.kjw.deliverytracker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;

// 🔥 1. 최신 Edge-to-Edge 패키지를 추가로 불러옵니다.
import androidx.activity.EdgeToEdge; 
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String DAILY_INSPECTION_NOTIFICATION_CHANNEL_ID = "daily_inspection_reminder_v1";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        
        registerPlugin(DailyInspectionPrintPlugin.class);

        EdgeToEdge.enable(this);

        super.onCreate(savedInstanceState);
        ensureDailyInspectionNotificationChannel();

        // 2. 상단바 및 하단바 색상 강제 지정 (흰색 띠 방지)
        int myDarkColor = Color.parseColor("#111827");
        getWindow().setStatusBarColor(myDarkColor);
        getWindow().setNavigationBarColor(myDarkColor);

        // 3. 아이콘 색상 (흰색)
        WindowInsetsControllerCompat insetsController = 
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false); 
            insetsController.setAppearanceLightNavigationBars(false); 
        }

        View webView = getBridge().getWebView();
        if (webView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) v.getLayoutParams();

                // 상단: 0으로 붙여서 흰색 배경을 가립니다.
                params.topMargin = 0;
                
                // 하단: 시스템이 알려주는 높이만큼 자동으로 들어올립니다. (겹침 완벽 해결)
                params.bottomMargin = insets.bottom; 
                
                v.setLayoutParams(params);
                return windowInsets;
            });
        }
    }

    private void ensureDailyInspectionNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        if (notificationManager == null
                || notificationManager.getNotificationChannel(DAILY_INSPECTION_NOTIFICATION_CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                DAILY_INSPECTION_NOTIFICATION_CHANNEL_ID,
                "일상점검표 알림",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("업무 시작 전 일상점검표 작성 알림");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 300, 200, 300 });
        channel.setSound(
                Settings.System.DEFAULT_NOTIFICATION_URI,
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
        );

        notificationManager.createNotificationChannel(channel);
    }
}