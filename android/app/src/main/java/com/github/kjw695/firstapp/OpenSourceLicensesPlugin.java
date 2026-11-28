package com.kjw.deliverytracker;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.oss.licenses.v2.OssLicensesMenuActivity;

@CapacitorPlugin(name = "OpenSourceLicenses")
public class OpenSourceLicensesPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                OssLicensesMenuActivity.setActivityTitle("오픈소스 라이선스");
                Intent intent = new Intent(getActivity(), OssLicensesMenuActivity.class);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception exception) {
                call.reject("Android 오픈소스 라이선스 화면을 열 수 없습니다.", exception);
            }
        });
    }
}
