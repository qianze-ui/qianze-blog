package com.qianze.service;

import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.*;
import java.util.*;

@Service
public class ImportService {

    private static final Path MUSIC_DIR = Path.of("music");
    private static final int MAX_RETRIES = 3;

    /** Download a file from URL, save to /music/ with UUID name */
    public Map<String, String> download(String sourceUrl, String prefix) {
        String ext = guessExt(sourceUrl, prefix);
        String name = UUID.randomUUID().toString().substring(0, 10) + "." + ext;
        Path target = MUSIC_DIR.resolve(name);

        IOException lastErr = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                Files.createDirectories(MUSIC_DIR);
                HttpURLConnection conn = (HttpURLConnection) URI.create(sourceUrl).toURL().openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");
                if (conn.getResponseCode() >= 400) throw new IOException("HTTP " + conn.getResponseCode());
                try (InputStream in = conn.getInputStream()) {
                    Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
                }
                long size = Files.size(target);
                if (size < 1024) throw new IOException("File too small: " + size + " bytes");
                return Map.of("url", "/music/" + name, "size", String.valueOf(size));
            } catch (IOException e) {
                lastErr = e;
                if (attempt < MAX_RETRIES) {
                    try { Thread.sleep(1000L * attempt); } catch (InterruptedException ignored) {}
                }
            }
        }
        throw new RuntimeException("下载失败(重试" + MAX_RETRIES + "次): " + (lastErr != null ? lastErr.getMessage() : "未知错误"));
    }

    /** Check if a source URL is still accessible */
    public boolean checkAlive(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0");
            conn.setRequestMethod("HEAD");
            return conn.getResponseCode() < 400;
        } catch (Exception e) {
            return false;
        }
    }

    private String guessExt(String url, String prefix) {
        if (url == null || !url.contains(".")) return prefix.equals("cover") ? "jpg" : "mp3";
        String ext = url.substring(url.lastIndexOf('.') + 1).toLowerCase();
        if (ext.contains("?")) ext = ext.substring(0, ext.indexOf('?'));
        if (prefix.equals("cover")) {
            return ext.matches("jpg|jpeg|png|gif|webp") ? (ext.equals("jpeg") ? "jpg" : ext) : "jpg";
        }
        return ext.matches("mp3|m4a|aac|ogg|wav|flac|opus") ? ext : "mp3";
    }
}
