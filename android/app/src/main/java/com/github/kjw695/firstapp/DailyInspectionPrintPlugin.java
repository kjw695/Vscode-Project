package com.kjw.deliverytracker;

import android.content.ContentValues;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
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
            final WebView webView = createPrintWebView(true);
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
                            writePdfFromWebView(webView, jobName, call, callback);
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

    /**
     * WebView를 직접 Canvas에 그리는 방식은 Android WebView의 렌더링 시점에 따라
     * 빈 페이지가 만들어질 수 있습니다. 공식 PrintDocumentAdapter로 PDF 스트림을 생성합니다.
     */
    private void writePdfFromWebView(WebView webView, String jobName, PluginCall call,
        PdfReadyCallback callback) {
        final File output = new File(getContext().getCacheDir(),
            "daily-inspection-" + System.currentTimeMillis() + ".pdf");
        final PrintDocumentAdapter adapter;

        try {
            adapter = webView.createPrintDocumentAdapter(jobName);
            adapter.onStart();
        } catch (Exception error) {
            releasePrintView(webView);
            call.reject("PDF 인쇄 엔진을 시작하지 못했습니다: " + error.getMessage());
            return;
        }

        final CancellationSignal cancellationSignal = new CancellationSignal();
        try {
            adapter.onLayout(null, createPrintAttributes(), cancellationSignal,
                new PrintDocumentAdapter.LayoutResultCallback() {
                    @Override
                    public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                        if (info == null || info.getPageCount() == 0) {
                            output.delete();
                            finishPdfAdapter(adapter, webView);
                            call.reject("PDF에 포함할 페이지를 찾지 못했습니다.");
                            return;
                        }

                        final ParcelFileDescriptor destination;
                        try {
                            destination = ParcelFileDescriptor.open(output,
                                ParcelFileDescriptor.MODE_CREATE
                                    | ParcelFileDescriptor.MODE_TRUNCATE
                                    | ParcelFileDescriptor.MODE_READ_WRITE);
                        } catch (IOException error) {
                            output.delete();
                            finishPdfAdapter(adapter, webView);
                            call.reject("PDF 임시 파일을 만들지 못했습니다: " + error.getMessage());
                            return;
                        }

                        try {
                            adapter.onWrite(new PageRange[]{PageRange.ALL_PAGES}, destination,
                                cancellationSignal, new PrintDocumentAdapter.WriteResultCallback() {
                                    @Override
                                    public void onWriteFinished(PageRange[] pages) {
                                        closeQuietly(destination);
                                        finishPdfAdapter(adapter, webView);
                                        try {
                                            validatePdfHasVisibleContent(output);
                                            callback.onReady(output);
                                        } catch (Exception error) {
                                            output.delete();
                                            call.reject(error.getMessage() == null
                                                ? "PDF 내용 확인에 실패했습니다."
                                                : error.getMessage());
                                        }
                                    }

                                    @Override
                                    public void onWriteFailed(CharSequence error) {
                                        closeQuietly(destination);
                                        output.delete();
                                        finishPdfAdapter(adapter, webView);
                                        call.reject("PDF 내용을 기록하지 못했습니다: " + error);
                                    }

                                    @Override
                                    public void onWriteCancelled() {
                                        closeQuietly(destination);
                                        output.delete();
                                        finishPdfAdapter(adapter, webView);
                                        call.reject("PDF 생성이 취소되었습니다.");
                                    }
                                });
                        } catch (Exception error) {
                            closeQuietly(destination);
                            output.delete();
                            finishPdfAdapter(adapter, webView);
                            call.reject("PDF 기록을 시작하지 못했습니다: " + error.getMessage());
                        }
                    }

                    @Override
                    public void onLayoutFailed(CharSequence error) {
                        output.delete();
                        finishPdfAdapter(adapter, webView);
                        call.reject("PDF 페이지 구성을 만들지 못했습니다: " + error);
                    }

                    @Override
                    public void onLayoutCancelled() {
                        output.delete();
                        finishPdfAdapter(adapter, webView);
                        call.reject("PDF 페이지 구성 작업이 취소되었습니다.");
                    }
                }, null);
        } catch (Exception error) {
            output.delete();
            finishPdfAdapter(adapter, webView);
            call.reject("PDF 레이아웃을 시작하지 못했습니다: " + error.getMessage());
        }
    }

    private void finishPdfAdapter(PrintDocumentAdapter adapter, WebView webView) {
        try {
            adapter.onFinish();
        } catch (Exception ignored) {
            // 인쇄 엔진 정리 오류가 이미 완료된 PDF 결과를 바꾸지 않도록 무시합니다.
        }
        releasePrintView(webView);
    }

    /**
     * 파일 크기뿐 아니라 PDF 페이지와 첫 페이지의 실제 픽셀도 확인해
     * 빈 PDF가 저장되거나 공유되는 것을 차단합니다.
     */
    private void validatePdfHasVisibleContent(File pdfFile) throws IOException {
        if (!pdfFile.exists() || pdfFile.length() < 500) {
            throw new IOException("PDF 파일이 비어 있습니다. 다시 시도해주세요.");
        }

        ParcelFileDescriptor descriptor = null;
        PdfRenderer renderer = null;
        PdfRenderer.Page firstPage = null;
        Bitmap previewBitmap = null;
        try {
            descriptor = ParcelFileDescriptor.open(pdfFile, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(descriptor);
            if (renderer.getPageCount() <= 0) {
                throw new IOException("PDF에 페이지가 없습니다. 다시 시도해주세요.");
            }

            firstPage = renderer.openPage(0);
            previewBitmap = Bitmap.createBitmap(480, 340, Bitmap.Config.ARGB_8888);
            firstPage.render(previewBitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);

            int visibleSamples = 0;
            for (int y = 0; y < previewBitmap.getHeight() && visibleSamples < 20; y += 3) {
                for (int x = 0; x < previewBitmap.getWidth() && visibleSamples < 20; x += 3) {
                    int pixel = previewBitmap.getPixel(x, y);
                    if (Color.red(pixel) < 248 || Color.green(pixel) < 248
                        || Color.blue(pixel) < 248) {
                        visibleSamples += 1;
                    }
                }
            }
            if (visibleSamples < 20) {
                throw new IOException("PDF 첫 페이지에 점검표 내용이 보이지 않습니다. 다시 시도해주세요.");
            }
        } catch (IOException error) {
            throw error;
        } catch (Exception error) {
            throw new IOException("PDF 내용 확인에 실패했습니다: " + error.getMessage(), error);
        } finally {
            if (firstPage != null) firstPage.close();
            if (previewBitmap != null) previewBitmap.recycle();
            if (renderer != null) {
                renderer.close();
            } else {
                closeQuietly(descriptor);
            }
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