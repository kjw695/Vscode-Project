package com.kjw.deliverytracker;

import android.content.ContentValues;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "DailyInspectionPrint")
public class DailyInspectionPrintPlugin extends Plugin {
    private final List<WebView> activePrintViews = new ArrayList<>();

    @PluginMethod
    public void printHtml(PluginCall call) {
        final String html = call.getString("html");
        final String jobName = safeName(call.getString("name"));
        if (html == null || html.trim().isEmpty()) {
            call.reject("인쇄할 점검표 내용이 없습니다.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            final WebView printWebView = createPrintWebView();
            printWebView.setWebViewClient(new WebViewClient() {
                private boolean printStarted = false;

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (printStarted) return;
                    printStarted = true;
                    try {
                        PrintManager printManager = (PrintManager) getActivity()
                            .getSystemService(Context.PRINT_SERVICE);
                        if (printManager == null) {
                            releasePrintView(view);
                            call.reject("이 기기에서 인쇄 서비스를 사용할 수 없습니다.");
                            return;
                        }

                        PrintDocumentAdapter delegate = view.createPrintDocumentAdapter(jobName);
                        PrintDocumentAdapter retainedAdapter = new PrintDocumentAdapter() {
                            @Override public void onStart() { delegate.onStart(); }
                            @Override
                            public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                                delegate.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras);
                            }
                            @Override
                            public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                                CancellationSignal cancellationSignal, WriteResultCallback callback) {
                                delegate.onWrite(pages, destination, cancellationSignal, callback);
                            }
                            @Override
                            public void onFinish() {
                                try { delegate.onFinish(); }
                                finally { releasePrintView(view); }
                            }
                        };

                        printManager.print(jobName, retainedAdapter, createPrintAttributes());
                        call.resolve();
                    } catch (Exception error) {
                        releasePrintView(view);
                        call.reject("PDF 인쇄 화면을 열지 못했습니다: " + error.getMessage());
                    }
                }
            });
            printWebView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
        });
    }

    @PluginMethod
    public void exportPdf(PluginCall call) {
        final String html = call.getString("html");
        final String jobName = safeName(call.getString("name"));
        final String action = call.getString("action", "save");
        if (html == null || html.trim().isEmpty()) {
            call.reject("저장하거나 공유할 점검표 내용이 없습니다.");
            return;
        }

        renderPdf(html, jobName, call, pdfFile -> {
            try {
                if ("save".equals(action)) {
                    Uri savedUri = savePdfToDownloads(pdfFile, jobName + ".pdf");
                    JSObject result = new JSObject();
                    result.put("uri", savedUri.toString());
                    result.put("fileName", jobName + ".pdf");
                    call.resolve(result);
                } else if ("kakao".equals(action) || "sms".equals(action)) {
                    sharePdf(pdfFile, jobName + ".pdf", action);
                    call.resolve();
                } else {
                    call.reject("지원하지 않는 PDF 작업입니다.");
                }
            } catch (Exception error) {
                call.reject("PDF 파일 처리에 실패했습니다: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void openPdf(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null || uriValue.trim().isEmpty()) {
            call.reject("열 PDF 파일을 찾을 수 없습니다.");
            return;
        }
        try {
            Uri uri = Uri.parse(uriValue);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, "PDF 열기"));
            call.resolve();
        } catch (Exception error) {
            call.reject("PDF를 열 수 있는 앱을 찾지 못했습니다: " + error.getMessage());
        }
    }

    private void renderPdf(String html, String jobName, PluginCall call, PdfReadyCallback callback) {
        getActivity().runOnUiThread(() -> {
            final WebView webView = createPrintWebView(true);
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void onReady(String metrics) {
                    getActivity().runOnUiThread(() -> {
                        try {
                            String[] parts = metrics.split("\\|", 2);
                            int contentHeight = Integer.parseInt(parts[0]);
                            List<Integer> pageBreaks = new ArrayList<>();
                            if (parts.length > 1 && !parts[1].isEmpty()) {
                                for (String value : parts[1].split(",")) {
                                    try { pageBreaks.add(Integer.parseInt(value)); }
                                    catch (NumberFormatException ignored) { }
                                }
                            }
                            writePdfFromWebView(webView, contentHeight, pageBreaks, call, callback);
                        } catch (Exception error) {
                            releasePrintView(webView);
                            call.reject("PDF 페이지 정보를 읽지 못했습니다: " + error.getMessage());
                        }
                    });
                }
            }, "PdfBridge");

            webView.setWebViewClient(new WebViewClient() {
                private boolean started = false;

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (started) return;
                    started = true;
                    String readyScript =
                        "(function(){" +
                        "var attempts=0;" +
                        "function waitForReady(){" +
                        "if(!window.__dailyInspectionPrintReady&&attempts++<200){setTimeout(waitForReady,50);return;}" +
                        "var images=Array.prototype.slice.call(document.images||[]);" +
                        "Promise.all(images.map(function(img){return img.complete?Promise.resolve():new Promise(function(resolve){img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});}))" +
                        ".then(function(){" +
                        "requestAnimationFrame(function(){requestAnimationFrame(function(){" +
                        "var height=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0);" +
                        "var breaks=Array.prototype.slice.call(document.querySelectorAll('.page-break')).map(function(el){return Math.round(el.getBoundingClientRect().top);});" +
                        "window.PdfBridge.onReady(String(height)+'|'+breaks.join(','));" +
                        "});});" +
                        "});" +
                        "}" +
                        "waitForReady();" +
                        "})();";
                    view.evaluateJavascript(readyScript, null);
                }
            });

            String pdfHtml = html.replace("</style>",
                ".toolbar{display:none!important}#preview-content{zoom:1!important}" +
                "html,body{overflow:visible!important;margin:0!important}" +
                "</style>");
            webView.loadDataWithBaseURL("https://localhost/", pdfHtml, "text/html", "UTF-8", null);
        });
    }

    private void writePdfFromWebView(WebView webView, int contentHeight, List<Integer> pageBreaks,
        PluginCall call, PdfReadyCallback callback) {
        final int pageWidthPx = 1123;
        final int pageHeightPx = 794;
        final int pdfPageWidth = 842;
        final int pdfPageHeight = 595;
        final float scale = (float) pdfPageWidth / (float) pageWidthPx;

        if (contentHeight <= 0) {
            releasePrintView(webView);
            call.reject("PDF에 넣을 점검표 내용이 비어 있습니다.");
            return;
        }

        try {
            webView.measure(
                android.view.View.MeasureSpec.makeMeasureSpec(pageWidthPx, android.view.View.MeasureSpec.EXACTLY),
                android.view.View.MeasureSpec.makeMeasureSpec(pageHeightPx, android.view.View.MeasureSpec.EXACTLY)
            );
            webView.layout(0, 0, pageWidthPx, pageHeightPx);
            webView.setHorizontalScrollBarEnabled(false);
            webView.setVerticalScrollBarEnabled(false);

            PdfDocument document = new PdfDocument();
            int offset = 0;
            int pageNumber = 1;
            while (offset < contentHeight && pageNumber <= 100) {
                int nextOffset = Math.min(offset + pageHeightPx, contentHeight);
                for (Integer pageBreak : pageBreaks) {
                    if (pageBreak != null
                        && pageBreak > offset + (pageHeightPx * 65 / 100)
                        && pageBreak <= nextOffset
                        && pageBreak < contentHeight) {
                        nextOffset = pageBreak;
                        break;
                    }
                }
                if (nextOffset <= offset) nextOffset = Math.min(offset + pageHeightPx, contentHeight);

                PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(
                    pdfPageWidth, pdfPageHeight, pageNumber).create();
                PdfDocument.Page page = document.startPage(pageInfo);
                Canvas canvas = page.getCanvas();
                canvas.drawColor(Color.WHITE);
                canvas.save();
                canvas.scale(scale, scale);
                canvas.clipRect(0, 0, pageWidthPx, nextOffset - offset);
                webView.scrollTo(0, offset);
                webView.draw(canvas);
                canvas.restore();
                document.finishPage(page);

                offset = nextOffset;
                pageNumber += 1;
            }

            if (offset < contentHeight) {
                document.close();
                releasePrintView(webView);
                call.reject("점검표가 너무 길어 PDF 페이지를 모두 만들지 못했습니다.");
                return;
            }

            File output = new File(getContext().getCacheDir(),
                "daily-inspection-" + System.currentTimeMillis() + ".pdf");
            try (FileOutputStream stream = new FileOutputStream(output)) {
                document.writeTo(stream);
            } finally {
                document.close();
                releasePrintView(webView);
            }

            if (!output.exists() || output.length() == 0) {
                call.reject("PDF 파일이 비어 있습니다. 다시 시도해주세요.");
                return;
            }
            callback.onReady(output);
        } catch (Exception error) {
            releasePrintView(webView);
            call.reject("PDF 파일 생성에 실패했습니다: " + error.getMessage());
        }
    }
    private WebView createPrintWebView() {
        return createPrintWebView(false);
    }

    private WebView createPrintWebView(boolean enableJavascript) {
        WebView webView = new WebView(getActivity());
        webView.setBackgroundColor(Color.WHITE);
        webView.getSettings().setJavaScriptEnabled(enableJavascript);
        webView.getSettings().setLoadWithOverviewMode(false);
        webView.getSettings().setUseWideViewPort(true);
        webView.setInitialScale(100);
        activePrintViews.add(webView);
        return webView;
    }

    private PrintAttributes createPrintAttributes() {
        return new PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
            .setResolution(new PrintAttributes.Resolution(
                "daily-inspection-300dpi", "일상점검표 300dpi", 300, 300))
            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .build();
    }

    private Uri savePdfToDownloads(File source, String fileName) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
            values.put(MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/택배메이트");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = getContext().getContentResolver().insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("다운로드 폴더에 파일을 만들지 못했습니다.");

            try (InputStream input = new FileInputStream(source);
                 OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IOException("저장 파일을 열지 못했습니다.");
                copy(input, output);
            } catch (IOException error) {
                getContext().getContentResolver().delete(uri, null, null);
                throw error;
            }

            ContentValues completed = new ContentValues();
            completed.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(uri, completed, null, null);
            return uri;
        }

        File downloads = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            "택배메이트");
        if (!downloads.exists() && !downloads.mkdirs()) {
            throw new IOException("다운로드 폴더를 만들지 못했습니다.");
        }
        File destination = new File(downloads, fileName);
        try (InputStream input = new FileInputStream(source);
             OutputStream output = new FileOutputStream(destination)) {
            copy(input, output);
        }
        return FileProvider.getUriForFile(getContext(),
            getContext().getPackageName() + ".fileprovider", destination);
    }

    private void sharePdf(File pdfFile, String fileName, String action) throws Exception {
        Uri uri = FileProvider.getUriForFile(getContext(),
            getContext().getPackageName() + ".fileprovider", pdfFile);
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_STREAM, uri);
        intent.putExtra(Intent.EXTRA_SUBJECT, fileName);
        intent.setClipData(ClipData.newUri(getContext().getContentResolver(), fileName, uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        if ("kakao".equals(action)) {
            try {
                getContext().getPackageManager().getPackageInfo("com.kakao.talk", PackageManager.GET_ACTIVITIES);
                intent.setPackage("com.kakao.talk");
                getActivity().startActivity(intent);
                return;
            } catch (PackageManager.NameNotFoundException notInstalled) {
                intent.setPackage(null);
            } catch (Exception launchError) {
                intent.setPackage(null);
            }
            getActivity().startActivity(Intent.createChooser(intent, "카카오톡 또는 다른 앱으로 PDF 공유"));
            return;
        }

        getActivity().startActivity(Intent.createChooser(intent, "PDF를 첨부할 문자 앱 선택"));
    }

    private String safeName(String requestedName) {
        String name = requestedName == null || requestedName.trim().isEmpty()
            ? "일상점검표"
            : requestedName.trim();
        return name.replaceAll("[\\/:*?\"<>|]", "_");
    }

    private void copy(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[8192];
        int length;
        while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
        output.flush();
    }

    private void closeQuietly(ParcelFileDescriptor descriptor) {
        if (descriptor == null) return;
        try { descriptor.close(); } catch (IOException ignored) { }
    }

    private void releasePrintView(WebView view) {
        if (view == null) return;
        activePrintViews.remove(view);
        view.post(() -> {
            try {
                view.stopLoading();
                view.destroy();
            } catch (Exception ignored) {
                // 인쇄 또는 PDF 생성 완료 후 WebView 정리 중 발생하는 예외는 무시합니다.
            }
        });
    }

    private interface PdfReadyCallback {
        void onReady(File file);
    }
}