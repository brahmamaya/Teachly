package com.physica.teachly;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Keeps Teachly up to date by itself.
 *
 * The board, tools and menus are web files. When the device is online, the
 * app quietly downloads the newest set of those files from the Teachly
 * website into its own storage (www-next). Nothing is changed while a lesson
 * is open: on the next start the complete new set replaces the old one.
 * Without internet the last version simply keeps working. Only Teachly's own
 * files are downloaded; nothing about the user is ever sent.
 */
final class Updater {
    static final String BASE = "https://brahmamaya.github.io/Teachly/";
    /** Version of this Java shell; a web update can ask for a newer one. */
    static final int NATIVE = 1;

    private Updater() {}

    static File current(Context c) {
        return new File(c.getFilesDir(), "www");
    }

    private static File next(Context c) {
        return new File(c.getFilesDir(), "www-next");
    }

    /** At start-up: switch to a fully downloaded new version. Returns true if it did. */
    static boolean applyPending(Context c) {
        File nx = next(c);
        if (!new File(nx, ".complete").exists()) {
            deleteTree(nx);
            return false;
        }
        File cur = current(c), old = new File(c.getFilesDir(), "www-old");
        deleteTree(old);
        if (cur.exists() && !cur.renameTo(old)) return false;
        if (!nx.renameTo(cur)) {
            old.renameTo(cur);
            return false;
        }
        deleteTree(old);
        return true;
    }

    /** The version now in use (downloaded, or the one inside the APK). */
    private static String installedVersion(Context c) {
        try {
            File f = new File(current(c), "app-update.json");
            InputStream in = f.exists() ? new FileInputStream(f) : c.getAssets().open("www/app-update.json");
            return new JSONObject(new String(readAll(in), "UTF-8")).optString("version", "");
        } catch (Exception e) {
            return "";
        }
    }

    /** Look for a newer version and download it in the background. */
    static void checkInBackground(final Context app) {
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(8000); // let the lesson start first
                    check(app);
                } catch (Exception ignored) {
                    // offline or the website is unreachable: try again next start
                }
            }
        }, "teachly-update");
        t.setPriority(Thread.MIN_PRIORITY);
        t.setDaemon(true);
        t.start();
    }

    private static void check(Context c) throws Exception {
        byte[] manifest = get(BASE + "app-update.json?t=" + System.currentTimeMillis());
        JSONObject m = new JSONObject(new String(manifest, "UTF-8"));
        String version = m.optString("version", "");
        if (version.isEmpty() || version.equals(installedVersion(c))) return;
        if (m.optInt("nativeMin", 1) > NATIVE) return; // needs a newer APK
        JSONArray files = m.getJSONArray("files");
        File nx = next(c);
        deleteTree(nx);
        if (!nx.mkdirs()) return;
        File cur = current(c);
        for (int i = 0; i < files.length(); i++) {
            String path = files.getString(i);
            if (path.contains("..") || path.startsWith("/")) throw new IOException("bad path");
            File out = new File(nx, path);
            File dir = out.getParentFile();
            if (dir != null && !dir.exists() && !dir.mkdirs()) throw new IOException("mkdir");
            // Files with a content hash in their name never change: reuse them.
            File have = new File(cur, path);
            if (path.startsWith("assets/") && have.exists()) copy(new FileInputStream(have), out);
            else write(out, get(BASE + path));
        }
        write(new File(nx, "app-update.json"), manifest);
        write(new File(nx, ".complete"), new byte[0]);
    }

    private static byte[] get(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(10000);
        con.setReadTimeout(20000);
        con.setUseCaches(false);
        try {
            if (con.getResponseCode() != 200) throw new IOException("HTTP " + con.getResponseCode());
            return readAll(con.getInputStream());
        } finally {
            con.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        } finally {
            in.close();
        }
    }

    private static void write(File f, byte[] data) throws IOException {
        OutputStream os = new FileOutputStream(f);
        try {
            os.write(data);
        } finally {
            os.close();
        }
    }

    private static void copy(InputStream in, File out) throws IOException {
        write(out, readAll(in));
    }

    static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }
}
