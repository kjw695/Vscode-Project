package com.kjw.deliverytracker;

import android.graphics.Color;
import android.os.Bundle;
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
    @Override
    public void onCreate(Bundle savedInstanceState) {
        
        EdgeToEdge.enable(this);

        super.onCreate(savedInstanceState);

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
}