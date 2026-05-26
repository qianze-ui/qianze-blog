package com.qianze.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import okhttp3.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GequhaiService {
    private final OkHttpClient client;
    private final ObjectMapper mapper;

    private String sessionCookie = null;     // server_name_session=xxx
    private String phpSessionId = null;       // PHPSESSID=xxx

    // Cache complete song info: mp3Id -> {url, cover, lyric}
    private final Cache<String, Map<String, String>> songInfoCache;

    public GequhaiService() {
        this.client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .followRedirects(true)
                .build();
        this.mapper = new ObjectMapper();

        this.songInfoCache = Caffeine.newBuilder()
                .expireAfterWrite(30, TimeUnit.MINUTES)
                .maximumSize(500)
                .build();
    }

    // ── Search: GET /s/{query} → parse HTML table ──

    public List<Map<String, Object>> search(String keyword, int limit) {
        try {
            ensureSession();
            return doSearch(keyword, limit);
        } catch (Exception e) {
            if (isSessionError(e)) {
                System.out.println("Gequhai search session error, retrying...");
                this.sessionCookie = null;
                this.phpSessionId = null;
                try {
                    ensureSession();
                    return doSearch(keyword, limit);
                } catch (Exception ex) {
                    ex.printStackTrace();
                    return List.of();
                }
            }
            e.printStackTrace();
            return List.of();
        }
    }

    private List<Map<String, Object>> doSearch(String keyword, int limit) throws Exception {
        String url = "https://www.gequhai.com/s/" + URLEncoder.encode(keyword, StandardCharsets.UTF_8);
        Request req = browserGet(url, "https://www.gequhai.com/");

        List<Map<String, Object>> results = new ArrayList<>();
        try (Response res = client.newCall(req).execute()) {
            if (res.code() == 403) throw new RuntimeException("403 Forbidden");
            String html = res.body().string();
            Document doc = Jsoup.parse(html);

            // Find the results table — skip header <th> rows, parse <td> rows
            Elements rows = doc.select("table tr");
            for (Element row : rows) {
                // Skip header row
                if (!row.select("th").isEmpty()) continue;

                Elements cells = row.select("td");
                if (cells.size() < 3) continue;

                Element linkEl = cells.get(1).selectFirst("a[href*=/play/]");
                if (linkEl == null) continue;

                String href = linkEl.attr("href");
                String title = linkEl.text().trim();
                String artist = cells.get(2).text().trim();

                Matcher m = Pattern.compile("/play/(\\d+)").matcher(href);
                if (!m.find()) continue;
                String mp3Id = m.group(1);

                Map<String, Object> song = new LinkedHashMap<>();
                song.put("songId", Long.parseLong(mp3Id));
                song.put("mp3Id", mp3Id);
                song.put("title", title);
                song.put("artist", artist.isEmpty() ? "未知" : artist);
                song.put("source", "gequhai");
                song.put("platform", "gequhai");
                song.put("url", "");
                song.put("playUrl", "");
                song.put("coverUrl", "");
                results.add(song);

                if (results.size() >= limit) break;
            }
        }
        return results;
    }

    // ── Resolve song info: GET /play/{id} → extract play_id/cover/lyric → POST /api/music ──

    public Map<String, String> getSongInfo(String mp3Id) {
        Map<String, String> cached = songInfoCache.getIfPresent(mp3Id);
        if (cached != null) return cached;

        try {
            ensureSession();
            return resolveSongInfo(mp3Id);
        } catch (Exception e) {
            if (isSessionError(e)) {
                this.sessionCookie = null;
                this.phpSessionId = null;
                try {
                    ensureSession();
                    return resolveSongInfo(mp3Id);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
            e.printStackTrace();
        }
        return null;
    }

    private Map<String, String> resolveSongInfo(String mp3Id) throws Exception {
        // Step 1: GET /play/{id} to extract window.play_id, window.mp3_cover, and LRC lyrics
        String playPageUrl = "https://www.gequhai.com/play/" + mp3Id;
        Request pageReq = browserGet(playPageUrl, "https://www.gequhai.com/");

        String playId;
        String cover = "";
        String lyric = "";
        try (Response res = client.newCall(pageReq).execute()) {
            if (res.code() == 403) throw new RuntimeException("403 Forbidden");
            String html = res.body().string();

            // Extract window.play_id
            Matcher m = Pattern.compile("window\\.play_id\\s*=\\s*'([^']+)'").matcher(html);
            if (!m.find()) return null;
            playId = m.group(1);

            // Extract window.mp3_cover
            Matcher coverM = Pattern.compile("window\\.mp3_cover\\s*=\\s*'([^']+)'").matcher(html);
            if (coverM.find()) {
                cover = coverM.group(1);
            }

            // Extract LRC lyrics from #content-lrc2
            Matcher lrcM = Pattern.compile("<div[^>]*id=\"content-lrc2\"[^>]*>([\\s\\S]*?)</div>").matcher(html);
            if (lrcM.find()) {
                lyric = lrcM.group(1)
                        .replaceAll("<br\\s*/?>", "\n")
                        .replaceAll("<[^>]+>", "")
                        .replace("&amp;", "&")
                        .replace("&lt;", "<")
                        .replace("&gt;", ">")
                        .replace("&quot;", "\"")
                        .trim();
            }

            // Also try plain text lyrics from .content-lrc if #content-lrc2 not found
            if (lyric.isEmpty()) {
                Matcher lrc2M = Pattern.compile("<div[^>]*class=\"[^\"]*content-lrc[^\"]*\"[^>]*>([\\s\\S]*?)</div>").matcher(html);
                if (lrc2M.find()) {
                    String raw = lrc2M.group(1);
                    // Only take the first block (before "查看全部")
                    int cutIdx = raw.indexOf("查看全部");
                    if (cutIdx > 0) raw = raw.substring(0, cutIdx);
                    lyric = raw.replaceAll("<br\\s*/?>", "\n")
                            .replaceAll("<[^>]+>", "")
                            .replace("&amp;", "&")
                            .replace("&lt;", "<")
                            .replace("&gt;", ">")
                            .replace("&quot;", "\"")
                            .trim();
                }
            }
        }

        // Step 2: POST /api/music with play_id
        String postBody = "id=" + URLEncoder.encode(playId, StandardCharsets.UTF_8) + "&type=0";

        RequestBody body = RequestBody.create(
                postBody,
                MediaType.get("application/x-www-form-urlencoded; charset=UTF-8"));

        Request apiReq = new Request.Builder()
                .url("https://www.gequhai.com/api/music")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
                .header("Accept", "application/json, text/javascript, */*; q=0.01")
                .header("X-Custom-Header", "SecretKey")
                .header("X-Requested-With", "XMLHttpRequest")
                .header("Origin", "https://www.gequhai.com")
                .header("Referer", playPageUrl)
                .header("Cookie", buildCookieHeader())
                .post(body)
                .build();

        try (Response res = client.newCall(apiReq).execute()) {
            if (!res.isSuccessful()) throw new RuntimeException("API returned " + res.code());
            String json = res.body().string();
            @SuppressWarnings("unchecked")
            Map<String, Object> data = mapper.readValue(json, Map.class);
            if ((int) data.getOrDefault("code", -1) != 200) return null;

            @SuppressWarnings("unchecked")
            Map<String, Object> inner = (Map<String, Object>) data.get("data");
            if (inner == null) return null;

            String url = (String) inner.get("url");
            if (url != null && !url.isEmpty()) {
                Map<String, String> info = new LinkedHashMap<>();
                info.put("url", url);
                info.put("cover", cover);
                info.put("lyric", lyric);
                songInfoCache.put(mp3Id, info);
                return info;
            }
        }
        return null;
    }

    // ── Session management ──

    private void ensureSession() throws IOException {
        if (sessionCookie != null) return;

        Request req = new Request.Builder()
                .url("https://www.gequhai.com/")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
                .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                .build();

        try (Response res = client.newCall(req).execute()) {
            List<String> cookies = res.headers("Set-Cookie");
            for (String cookie : cookies) {
                String value = cookie.split(";")[0].trim();
                if (value.startsWith("server_name_session=")) {
                    this.sessionCookie = value;
                } else if (value.startsWith("PHPSESSID=")) {
                    this.phpSessionId = value;
                }
            }
        }
        if (this.sessionCookie == null) {
            throw new RuntimeException("Failed to get server_name_session cookie from gequhai");
        }
        System.out.println("Gequhai session obtained: " + sessionCookie);
    }

    private String buildCookieHeader() {
        StringBuilder sb = new StringBuilder(sessionCookie);
        if (phpSessionId != null) {
            sb.append("; ").append(phpSessionId);
        }
        return sb.toString();
    }

    // ── Helpers ──

    private Request browserGet(String url, String referer) {
        return new Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
                .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                .header("Cookie", buildCookieHeader())
                .header("Referer", referer)
                .build();
    }

    private boolean isSessionError(Exception e) {
        String msg = e.getMessage();
        return msg != null && (msg.contains("403") || msg.contains("Session") || msg.contains("cookie"));
    }
}
