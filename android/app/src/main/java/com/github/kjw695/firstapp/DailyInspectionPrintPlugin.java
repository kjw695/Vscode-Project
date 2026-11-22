package com.kjw.deliverytracker;

import android.content.ContentValues;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.pdf.PdfDocument;
import android.view.View;
import android.view.ViewGroup;
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
            // 화면에 연결된 WebView만 PDF 캡처합니다. Android WebView는 분리된 상태에서
            // draw(Canvas)를 호출하면 페이지 전체 또는 다음 페이지가 비어 나올 수 있습니다.
            final WebView webView = createPrintWebView(true);
            final ViewGroup contentRoot = getActivity().findViewById(android.R.id.content);
            if (contentRoot == null) {
                releasePrintView(webView);
                call.reject("PDF 렌더링 화면을 준비하지 못했습니다.");
                return;
            }

            contentRoot.addView(webView, 0, new ViewGroup.LayoutParams(1123, 794));
            webView.setFocusable(false);
            webView.setFocusableInTouchMode(false);
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            webView.setHorizontalScrollBarEnabled(false);
            webView.setVerticalScrollBarEnabled(false);

            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void onReady(String metrics) {
                    getActivity().runOnUiThread(() -> {
                        try {
                            if ("timeout".equals(metrics)) {
                                releasePrintView(webView);
                                call.reject("서명 이미지 준비가 완료되지 않아 PDF를 만들지 못했습니다. 다시 시도해주세요.");
                                return;
                            }

                            String[] parts = metrics.split("\\|", 3);
                            if (parts.length < 2) {
                                releasePrintView(webView);
                                call.reject("PDF 페이지 정보를 읽지 못했습니다.");
                                return;
                            }

                            int contentHeight = Integer.parseInt(parts[0]);
                            int detailTop = Integer.parseInt(parts[1]);
                            List<Integer> detailRowEnds = parseBreakPoints(
                                parts.length > 2 ? parts[2] : "");

                            if (contentHeight <= 0 || detailTop <= 0 || contentHeight <= detailTop) {
                                releasePrintView(webView);
                                call.reject("불량 점검 및 조치 기록 영역을 PDF 원본에서 찾지 못했습니다.");
                                return;
                            }

                            writePdfFromWebView(webView, jobName, contentHeight, detailTop,
                                detailRowEnds, call, callback);
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
                        "if(!window.__dailyInspectionPrintReady){if(attempts++<200){setTimeout(waitForReady,50);return;}window.PdfBridge.onReady('timeout');return;}" +
                        "var images=Array.prototype.slice.call(document.images||[]);" +
                        "Promise.all(images.map(function(img){return img.complete?Promise.resolve():new Promise(function(resolve){img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});}))" +
                        ".then(function(){" +
                        "requestAnimationFrame(function(){requestAnimationFrame(function(){" +
                        "var detail=document.querySelector('.detail');" +
                        "var detailTop=detail?Math.round(detail.getBoundingClientRect().top+window.scrollY):0;" +
                        "var detailBottom=detail?Math.round(detail.getBoundingClientRect().bottom+window.scrollY):0;" +
                        "var rows=Array.prototype.slice.call(document.querySelectorAll('.detail-table tbody tr'));" +
                        "var rowEnds=rows.map(function(row){return Math.round(row.getBoundingClientRect().bottom+window.scrollY);}).filter(function(v){return v>detailTop;});" +
                        "var height=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0,detailBottom);" +
                        "window.PdfBridge.onReady(String(height)+'|'+String(detailTop)+'|'+rowEnds.join(','));" +
                        "});});" +
                        "});" +
                        "}" +
                        "waitForReady();" +
                        "})();";
                    view.evaluateJavascript(readyScript, null);
                }
            });

            // A4 가로 용지 폭을 고정해 앱 화면 크기와 무관하게 PDF를 만듭니다.
            String pdfHtml = html
                .replace("width=device-width", "width=1123")
                .replace("</style>",
                    ".toolbar{display:none!important}" +
                    "#preview-content{zoom:1!important;height:auto!important}" +
                    "html,body{height:auto!important;overflow:visible!important;margin:0!important}" +
                    ".detail{border:0!important;margin:0!important;padding:0!important}" +
                    "</style>");
            webView.loadDataWithBaseURL("https://localhost/", pdfHtml, "text/html", "UTF-8", null);
        });
    }

    private void writePdfFromWebView(WebView webView, String jobName, int contentHeight,
        int detailTop, List<Integer> detailRowEnds, PluginCall call, PdfReadyCallback callback) {
        final int pageWidthPx = 1123;
        final int pageHeightPx = 794;
        final int pdfPageWidth = 842;
        final int pdfPageHeight = 595;
        final float scale = (float) pdfPageWidth / (float) pageWidthPx;
        final File output = new File(getContext().getCacheDir(),
            "daily-inspection-" + System.currentTimeMillis() + ".pdf");
        final PdfDocument document = new PdfDocument();

        try {
            // 첫 페이지의 실제 끝은 불량 점검 기록(.detail)이 시작되는 위치입니다.
            // 794px로 잘라 버리지 않고, 첫 페이지 전체를 캡처할 수 있도록 WebView 높이를 늘립니다.
            int firstPageHeight = detailTop;
            if (firstPageHeight <= 0) {
                throw new IOException("일상점검표의 첫 페이지 높이를 확인하지 못했습니다.");
            }
            int firstPageViewHeight = Math.max(pageHeightPx, firstPageHeight);
            webView.setLayoutParams(new ViewGroup.LayoutParams(pageWidthPx, firstPageViewHeight));
            webView.measure(
                View.MeasureSpec.makeMeasureSpec(pageWidthPx, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(firstPageViewHeight, View.MeasureSpec.EXACTLY)
            );
            webView.layout(0, 0, pageWidthPx, firstPageViewHeight);
            webView.requestLayout();
            webView.invalidate();

            // 1쪽은 운수종사자 일상점검표 전체를 한 장에 맞춰 출력하고,
            // 2쪽부터 불량 점검 및 조치 기록을 출력합니다.
            drawPdfPage(webView, document, output, jobName, contentHeight, detailRowEnds,
                0, firstPageHeight, 1, pageWidthPx, pageHeightPx,
                pdfPageWidth, pdfPageHeight, scale, call, callback);
        } catch (Exception error) {
            try { document.close(); } catch (Exception ignored) { }
            output.delete();
            releasePrintView(webView);
            call.reject("PDF 페이지를 준비하지 못했습니다: " + error.getMessage());
        }
    }

    private void drawPdfPage(WebView webView, PdfDocument document, File output,
        String jobName, int contentHeight, List<Integer> detailRowEnds,
        int offset, int pageContentHeight, int pageNumber,
        int pageWidthPx, int pageHeightPx, int pdfPageWidth, int pdfPageHeight,
        float scale, PluginCall call, PdfReadyCallback callback) {

        if (offset >= contentHeight) {
            try {
                try (FileOutputStream stream = new FileOutputStream(output)) {
                    document.writeTo(stream);
                }
                document.close();
                releasePrintView(webView);

                if (!output.exists() || output.length() < 500) {
                    output.delete();
                    call.reject("PDF 파일이 비어 있습니다. 다시 시도해주세요.");
                    return;
                }
                callback.onReady(output);
            } catch (Exception error) {
                try { document.close(); } catch (Exception ignored) { }
                output.delete();
                releasePrintView(webView);
                call.reject("PDF 파일을 완성하지 못했습니다: " + error.getMessage());
            }
            return;
        }

        if (pageNumber > 100) {
            try { document.close(); } catch (Exception ignored) { }
            output.delete();
            releasePrintView(webView);
            call.reject("점검표가 너무 길어 PDF 페이지를 모두 만들지 못했습니다.");
            return;
        }

        int nextOffset;
        if (pageNumber == 1) {
            nextOffset = pageContentHeight;
        } else {
            nextOffset = Math.min(offset + pageHeightPx, contentHeight);

            // 조치 기록 표의 행이 페이지 중간에서 잘리지 않도록 가능한 경우
            // 현재 페이지 끝보다 앞선 마지막 행 끝으로 페이지 경계를 이동합니다.
            int lastSafeRowEnd = -1;
            for (Integer rowEnd : detailRowEnds) {
                if (rowEnd == null || rowEnd <= offset) continue;
                if (rowEnd <= nextOffset) {
                    lastSafeRowEnd = rowEnd;
                } else {
                    break;
                }
            }
            if (lastSafeRowEnd > offset + 160 && lastSafeRowEnd < nextOffset) {
                nextOffset = lastSafeRowEnd;
            }
        }

        if (nextOffset <= offset) {
            nextOffset = Math.min(offset + pageHeightPx, contentHeight);
        }

        final int pageEndOffset = nextOffset;
        // 첫 페이지는 .detail 시작점까지 전체를 캡처합니다. 후속 페이지는 A4 높이만큼 캡처합니다.
        final int clipHeight = pageNumber == 1
            ? pageContentHeight
            : Math.min(pageHeightPx, pageEndOffset - offset);

        // 페이지 위치는 JavaScript DOM에서 CSS px로 계산됩니다.
        // Android View.scrollTo()에 그대로 전달하지 않고 WebView 문서 좌표계에서 이동해야
        // 두 번째 페이지부터 올바른 위치를 캡처할 수 있습니다.
        webView.evaluateJavascript(
            "window.scrollTo(0, " + offset + "); window.scrollY.toString();",
            scrollResult -> {
                webView.postVisualStateCallback(pageNumber, new WebView.VisualStateCallback() {
            @Override
            public void onComplete(long requestId) {
                try {
                    PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(
                        pdfPageWidth, pdfPageHeight, pageNumber).create();
                    PdfDocument.Page page = document.startPage(pageInfo);
                    Canvas canvas = page.getCanvas();
                    canvas.drawColor(Color.WHITE);
                    canvas.save();
                    // 첫 페이지 높이가 A4를 넘으면 가로·세로 비율을 유지해 한 장에 축소합니다.
                    // 불량 조치 기록 페이지는 기존 A4 배율을 그대로 사용합니다.
                    float pageScale = pageNumber == 1
                        ? Math.min(scale, (float) pdfPageHeight / (float) clipHeight)
                        : scale;
                    float pageLeft = (pdfPageWidth - (pageWidthPx * pageScale)) / 2.0f;
                    canvas.translate(pageLeft, 0);
                    canvas.scale(pageScale, pageScale);
                    canvas.clipRect(0, 0, pageWidthPx, clipHeight);
                    webView.draw(canvas);
                    canvas.restore();
                    document.finishPage(page);

                    // 첫 페이지 전체를 캡처한 뒤 WebView 높이를 일반 페이지 크기로 복원합니다.
                    // 이후 페이지는 정상적인 794px 뷰포트에서 스크롤 위치를 계산합니다.
                    if (pageNumber == 1 && pageContentHeight > pageHeightPx) {
                        webView.setLayoutParams(new ViewGroup.LayoutParams(pageWidthPx, pageHeightPx));
                        webView.measure(
                            View.MeasureSpec.makeMeasureSpec(pageWidthPx, View.MeasureSpec.EXACTLY),
                            View.MeasureSpec.makeMeasureSpec(pageHeightPx, View.MeasureSpec.EXACTLY)
                        );
                        webView.layout(0, 0, pageWidthPx, pageHeightPx);
                        webView.requestLayout();
                        webView.invalidate();
                    }

                    drawPdfPage(webView, document, output, jobName, contentHeight, detailRowEnds,
                        pageEndOffset, nextPageHeight, pageNumber + 1,
                        pageWidthPx, pageHeightPx, pdfPageWidth, pdfPageHeight,
                        scale, call, callback);
                } catch (Exception error) {
                    try { document.close(); } catch (Exception ignored) { }
                    output.delete();
                    releasePrintView(webView);
                    call.reject("PDF 페이지 " + pageNumber + "를 생성하지 못했습니다: " + error.getMessage());
                }
            }
                });
            }
        );
    }

    private List<Integer> parseBreakPoints(String values) {
        List<Integer> points = new ArrayList<>();
        if (values == null || values.trim().isEmpty()) return points;
        for (String value : values.split(",")) {
            try {
                int point = Integer.parseInt(value.trim());
                if (point > 0 && !points.contains(point)) points.add(point);
            } catch (NumberFormatException ignored) { }
        }
        return points;
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
            // 일반 공유창으로 빠지지 않도록 카카오톡 앱을 수신 대상으로 고정합니다.
            intent.setPackage("com.kakao.talk");
            try {
                getActivity().startActivity(intent);
            } catch (android.content.ActivityNotFoundException notInstalled) {
                throw new IOException("카카오톡을 찾을 수 없습니다. 카카오톡 설치 상태를 확인해주세요.");
            }
            return;
        }

        if ("sms".equals(action)) {
            // smsto 스킴으로 문자 앱만 대상으로 지정하고 PDF를 첨부합니다.
            intent.setDataAndType(Uri.parse("smsto:"), "application/pdf");
            intent.putExtra("sms_body", "운수종사자 일상점검표 PDF 파일입니다.");
            try {
                getActivity().startActivity(intent);
            } catch (android.content.ActivityNotFoundException unsupported) {
                throw new IOException("이 기기의 문자 앱이 PDF 첨부를 지원하지 않습니다. PDF를 저장한 뒤 문자 앱에서 직접 첨부해주세요.");
            }
            return;
        }

        throw new IllegalArgumentException("지원하지 않는 공유 방식입니다.");
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

    private void releasePrintView(WebView view) {
        if (view == null) return;
        activePrintViews.remove(view);
        if (view.getParent() instanceof ViewGroup) {
            ((ViewGroup) view.getParent()).removeView(view);
        }
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