package com.physica.teachly;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Teachly for Android boards: the whole app runs offline from the files
 * inside the APK, full screen, with file picking (PDF, PowerPoint, pictures),
 * saving into Downloads/Teachly and the microphone for lesson recording.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int REQ_FILE = 1;
    private static final int REQ_MIC = 2;
    private static final int REQ_STORAGE = 3;

    private static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("woff2", "font/woff2");
        MIME.put("wasm", "application/wasm");
    }

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingMic;
    private byte[] pendingData;
    private String pendingName;
    private String pendingMime;
    private long lastBack;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        hideSystemBars();

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.addJavascriptInterface(new Bridge(), "TeachlyAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serve(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // Links to websites open in the browser.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException e) {
                    toast("No browser found to open the link");
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                String[] types = mimeTypes(params.getAcceptTypes());
                if (types.length > 0) pick.putExtra(Intent.EXTRA_MIME_TYPES, types);
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(pick, "Choose a file"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    toast("No file manager found on this board");
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (hasPermission(Manifest.permission.RECORD_AUDIO)) {
                            request.grant(request.getResources());
                        } else {
                            pendingMic = request;
                            askPermission(Manifest.permission.RECORD_AUDIO, REQ_MIC);
                        }
                    }
                });
            }
        });

        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    /** Serve the app's own files (packed in assets/www) on a secure address. */
    private WebResourceResponse serve(Uri u) {
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath();
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        try {
            InputStream in = getAssets().open("www" + path);
            String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
            String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
            WebResourceResponse res = new WebResourceResponse(mime, "utf-8", in);
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", "*");
            res.setResponseHeaders(headers);
            return res;
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String[] mimeTypes(String[] accept) {
        java.util.ArrayList<String> out = new java.util.ArrayList<String>();
        if (accept != null) {
            for (String a : accept) {
                if (a == null) continue;
                for (String part : a.split(",")) {
                    String t = part.trim().toLowerCase();
                    if (t.isEmpty()) continue;
                    if (t.equals(".pdf")) t = "application/pdf";
                    else if (t.equals(".pptx")) t = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                    else if (t.equals(".ppt")) t = "application/vnd.ms-powerpoint";
                    else if (t.equals(".teachly") || t.equals(".json")) t = "*/*";
                    else if (t.startsWith(".")) continue;
                    if (t.equals("*/*")) return new String[0];
                    if (!out.contains(t)) out.add(t);
                }
            }
        }
        return out.toArray(new String[0]);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[] { data.getData() };
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ---- saving files ---------------------------------------------------------

    private class Bridge {
        @JavascriptInterface
        public void saveFile(String base64, String name, String mime) {
            final byte[] data = Base64.decode(base64, Base64.DEFAULT);
            final String fname = name;
            final String fmime = mime;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    save(data, fname, fmime);
                }
            });
        }

        @JavascriptInterface
        public String version() {
            return "1";
        }
    }

    private void save(byte[] data, String name, String mime) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentResolver cr = getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Teachly");
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new IOException("Could not create the file");
                OutputStream os = cr.openOutputStream(uri);
                if (os == null) throw new IOException("Could not write the file");
                os.write(data);
                os.close();
            } else {
                if (Build.VERSION.SDK_INT >= 23 && !hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                    pendingData = data;
                    pendingName = name;
                    pendingMime = mime;
                    askPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE, REQ_STORAGE);
                    return;
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Teachly");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("Could not create Downloads/Teachly");
                File f = new File(dir, name);
                int i = 1;
                String base = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name;
                String ext = name.contains(".") ? name.substring(name.lastIndexOf('.')) : "";
                while (f.exists()) f = new File(dir, base + " (" + (i++) + ")" + ext);
                FileOutputStream os = new FileOutputStream(f);
                os.write(data);
                os.close();
                MediaScannerConnection.scanFile(this, new String[] { f.getAbsolutePath() }, new String[] { mime }, null);
            }
            toast("Saved in Downloads/Teachly: " + name);
        } catch (Exception e) {
            toast("Could not save: " + e.getMessage());
        }
    }

    // ---- permissions ----------------------------------------------------------

    private boolean hasPermission(String p) {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
    }

    private void askPermission(String p, int code) {
        if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[] { p }, code);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQ_MIC && pendingMic != null) {
            if (ok) pendingMic.grant(pendingMic.getResources());
            else pendingMic.deny();
            pendingMic = null;
        } else if (requestCode == REQ_STORAGE && pendingData != null) {
            byte[] d = pendingData;
            pendingData = null;
            if (ok) save(d, pendingName, pendingMime);
            else toast("Allow storage to save files");
        }
    }

    // ---- full screen, back button, lifecycle ----------------------------------

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public void onBackPressed() {
        // Everything is saved automatically; ask for a second press so a stray
        // tap on the board's back key does not close the lesson.
        long now = System.currentTimeMillis();
        if (now - lastBack < 2000) {
            super.onBackPressed();
        } else {
            lastBack = now;
            toast("Press back again to close Teachly");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }
}
