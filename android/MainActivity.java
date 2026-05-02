package com.example.avdinbrowser;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    // Ad domains to block
    private static final String[] AD_DOMAINS = {
            "doubleclick.net", "googlesyndication.com", "googleadservices.com",
            "adnxs.com", "amazon-adsystem.com", "outbrain.com", "taboola.com",
            "criteo.com", "pubmatic.com", "rubiconproject.com", "openx.net",
            "scorecardresearch.com", "quantserve.com", "hotjar.com",
            "google-analytics.com", "googletagmanager.com", "moatads.com",
            "advertising.com", "adroll.com", "clarity.ms",
            "youtube.com/api/stats/ads", "youtube.com/pagead/",
            "youtube.com/ptracking", "googleads.g.doubleclick.net",
            "ad.youtube.com"
    };

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Full screen - hide status bar
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        // Hide navigation bar (immersive mode)
        hideSystemUI();

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.myWebView);

        setupWebView();
        setupBackButton();

        webView.loadUrl("file:///android_asset/index.html");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings s = webView.getSettings();

        s.setJavaScriptEnabled(true);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);

        // FIX: Use fully qualified class name instead of import to avoid resolve error
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Real Chrome mobile user-agent
        s.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 10; Mobile) " +
                        "AppleWebKit/537.36 (KHTML, like Gecko) " +
                        "Chrome/124.0.0.0 Mobile Safari/537.36"
        );

        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Enable remote debugging via chrome://inspect
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // Inject the Android ↔ JS bridge
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (isAdUrl(url)) return true; // block
                view.loadUrl(url);
                return true;
            }

            // Fallback for API < 24
            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (isAdUrl(url)) return true;
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);

                // POPRAVKA: Ako učitavamo lokalni fajl, šaljemo prazan string za URL bar
                String displayUrl = (url != null && url.contains("index.html")) ? "" : url;

                final String safeUrl = escapeJs(displayUrl);
                view.post(() -> webView.evaluateJavascript(
                        "if(window.onAndroidPageStarted) window.onAndroidPageStarted('" + safeUrl + "');",
                        null
                ));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.post(() -> webView.evaluateJavascript(
                        "document.body.classList.add('android-mode');", null
                ));
                String title = view.getTitle();

                // POPRAVKA: I ovdje šaljemo prazan string ako je u pitanju dashboard
                String displayUrl = (url != null && url.contains("index.html")) ? "" : url;

                final String safeUrl   = escapeJs(displayUrl);
                final String safeTitle = escapeJs(title != null ? title : "");
                view.post(() -> webView.evaluateJavascript(
                        "if(window.onAndroidPageFinished) " +
                                "window.onAndroidPageFinished('" + safeUrl + "','" + safeTitle + "');",
                        null
                ));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage msg) {
                android.util.Log.d("LightBrowser",
                        msg.message() + " [line " + msg.lineNumber() + "] " + msg.sourceId());
                return true;
            }
        });
    }

    // FIX: Replace deprecated onBackPressed() with OnBackPressedDispatcher
    private void setupBackButton() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    // No more history — let the system handle it (exits app)
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    // Ad blocker
    private boolean isAdUrl(String url) {
        if (url == null) return false;
        for (String domain : AD_DOMAINS) {
            if (url.contains(domain)) return true;
        }
        return false;
    }

    // Escape for JS string injection
    private String escapeJs(String s) {
        return s.replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    // Hide system UI (status bar + nav bar)
    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION       |
                            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY      |
                            View.SYSTEM_UI_FLAG_FULLSCREEN             |
                            View.SYSTEM_UI_FLAG_LAYOUT_STABLE          |
                            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    // ── JavaScript Bridge ─────────────────────────────────────────────────────

    public class AndroidBridge {

        @android.webkit.JavascriptInterface
        public void navigate(String url) {
            runOnUiThread(() -> webView.loadUrl(url));
        }

        @android.webkit.JavascriptInterface
        public void goBack() {
            runOnUiThread(() -> { if (webView.canGoBack()) webView.goBack(); });
        }

        @android.webkit.JavascriptInterface
        public void goForward() {
            runOnUiThread(() -> { if (webView.canGoForward()) webView.goForward(); });
        }

        @android.webkit.JavascriptInterface
        public void reload() {
            runOnUiThread(() -> webView.reload());
        }

        @android.webkit.JavascriptInterface
        public void stopLoading() {
            runOnUiThread(() -> webView.stopLoading());
        }

        @android.webkit.JavascriptInterface
        public boolean canGoBack() {
            return webView.canGoBack();
        }

        @android.webkit.JavascriptInterface
        public boolean canGoForward() {
            return webView.canGoForward();
        }

        @android.webkit.JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show()
            );
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}