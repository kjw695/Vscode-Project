package com.github.kjw695.firstapp;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. 전체 화면 모드 (일단 화면을 꽉 채웁니다)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // 2. 상단바 색상 강제 지정 (흰색 띠 방지)
        // 앱 배경색과 똑같은 남색(#111827)을 칠해버립니다.
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
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) v.getLayoutParams();

            // 🔥 [핵심 요청 반영]
            // 상단: 0으로 붙여서 흰색 배경을 가립니다. (공간은 App.js에서 수동으로 줍니다)
            params.topMargin = 0;
            
            // 하단: 시스템이 알려주는 높이만큼 자동으로 들어올립니다. (겹침 완벽 해결)
            params.bottomMargin = insets.bottom; 
            
            v.setLayoutParams(params);
            return windowInsets;
        });
    }
}