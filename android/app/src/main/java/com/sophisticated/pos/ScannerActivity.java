package com.sophisticated.pos;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.RelativeLayout;
import androidx.appcompat.app.AppCompatActivity;
import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import java.util.List;

public class ScannerActivity extends AppCompatActivity {
    private DecoratedBarcodeView barcodeView;
    private long lastScanTime = 0;
    private String lastCode = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create layout programmatically
        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        barcodeView = new DecoratedBarcodeView(this);
        barcodeView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(barcodeView);

        // Add a Close button at the bottom
        RelativeLayout overlay = new RelativeLayout(this);
        overlay.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        
        Button closeButton = new Button(this);
        closeButton.setText("Close Scanner");
        closeButton.setAllCaps(true);
        RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.addRule(RelativeLayout.ALIGN_PARENT_BOTTOM);
        lp.addRule(RelativeLayout.CENTER_HORIZONTAL);
        lp.setMargins(0, 0, 0, 100);
        closeButton.setLayoutParams(lp);
        closeButton.setOnClickListener(v -> finish());
        
        overlay.addView(closeButton);
        root.addView(overlay);

        setContentView(root);

        barcodeView.decodeContinuous(new BarcodeCallback() {
            @Override
            public void barcodeResult(BarcodeResult result) {
                String code = result.getText();
                if (code == null || code.isEmpty()) return;

                long currentTime = System.currentTimeMillis();

                // Prevent duplicate scans within 1.5 seconds
                if (code.equals(lastCode) && (currentTime - lastScanTime) < 1500) {
                    return;
                }

                lastCode = code;
                lastScanTime = currentTime;

                // Send broadcast to MainActivity
                Intent intent = new Intent("SCAN_RESULT");
                intent.putExtra("code", code);
                sendBroadcast(intent);
            }

            @Override
            public void possibleResultPoints(List<com.google.zxing.ResultPoint> resultPoints) {}
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        barcodeView.resume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        barcodeView.pause();
    }
}
