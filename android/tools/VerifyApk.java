import com.android.apksig.ApkVerifier;

import java.io.File;

/** Checks the APK signature the same way Android does: VerifyApk app.apk */
public class VerifyApk {
    public static void main(String[] a) throws Exception {
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[0])).build().verify();
        System.out.println("Signature check: " + (r.isVerified() ? "OK" : "FAILED")
                + " (v1 " + r.isVerifiedUsingV1Scheme() + ", v2 " + r.isVerifiedUsingV2Scheme() + ")");
        for (Object e : r.getErrors()) System.out.println("  error: " + e);
        if (!r.isVerified()) System.exit(1);
    }
}
