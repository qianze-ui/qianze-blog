package com.qianze.controller;

import com.qianze.config.JwtUtil;
import com.qianze.config.UaParser;
import com.qianze.entity.GuestMusicLog;
import com.qianze.entity.Song;
import com.qianze.mapper.GuestMusicLogMapper;
import com.qianze.service.GequhaiService;
import com.qianze.service.ImportService;
import com.qianze.service.IpService;
import com.qianze.service.SongService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/songs")
public class SongController {
    private final SongService service;
    private final GuestMusicLogMapper guestMusicLogMapper;
    private final IpService ipService;
    private final ImportService importService;
    private final GequhaiService gequhaiService;

    public SongController(SongService service, GuestMusicLogMapper guestMusicLogMapper,
                          IpService ipService, ImportService importService,
                          GequhaiService gequhaiService) {
        this.service = service; this.guestMusicLogMapper = guestMusicLogMapper;
        this.ipService = ipService; this.importService = importService;
        this.gequhaiService = gequhaiService;
    }

    @GetMapping
    public List<Song> getAll() { return service.findAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Song song = service.findById(id);
        return song != null ? ResponseEntity.ok(song) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Song song, HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));
        return ResponseEntity.ok(service.create(song));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Song song, HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));
        return ResponseEntity.ok(service.update(id, song));
    }

    @PostMapping("/{id}/play")
    public ResponseEntity<?> recordPlay(@PathVariable Long id) {
        service.incrementPlayCount(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));
        service.deleteById(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // Guest music search tracking
    @PostMapping("/track")
    public ResponseEntity<?> trackGuestMusic(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String ip = IpService.getClientIp(request);
        String ua = request.getHeader("User-Agent");
        String[] loc = ipService.search(ip);

        Map<String, String> parsed = UaParser.parse(ua != null ? ua : "");
        GuestMusicLog log = new GuestMusicLog();
        log.setIp(ip);
        log.setCountry(loc.length > 0 ? loc[0] : "");
        log.setProvince(loc.length > 1 ? loc[1] : "");
        log.setCity(loc.length > 2 ? loc[2] : "");
        log.setBrowser(parsed.getOrDefault("browser", ""));
        log.setOs(parsed.getOrDefault("os", ""));
        log.setDevice(parsed.getOrDefault("device", ""));
        log.setModel(parsed.getOrDefault("model", ""));
        log.setSongTitle(body.getOrDefault("title", ""));
        log.setSongArtist(body.getOrDefault("artist", ""));
        log.setSongUrl(body.getOrDefault("url", ""));
        log.setSource(body.getOrDefault("source", "search"));
        guestMusicLogMapper.insert(log);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ── Merged ranking: admin songs play_count + guest play counts ──
    @GetMapping("/ranking")
    public ResponseEntity<?> ranking() {
        // Admin-added songs with play_count > 0
        List<Song> songs = service.findAll();
        // Guest-played songs grouped by title+artist
        List<Map<String, Object>> guestTop = guestMusicLogMapper.topSongs();

        // Merge by title+artist (case-insensitive)
        java.util.Map<String, Map<String, Object>> merged = new java.util.LinkedHashMap<>();

        for (Song s : songs) {
            String key = (s.getTitle() + "|||" + s.getArtist()).toLowerCase().trim();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("title", s.getTitle());
            entry.put("artist", s.getArtist());
            entry.put("cover", s.getCover() != null ? s.getCover() : "");
            entry.put("adminCount", s.getPlayCount() != null ? s.getPlayCount() : 0);
            entry.put("guestCount", 0);
            entry.put("totalCount", s.getPlayCount() != null ? s.getPlayCount() : 0);
            merged.put(key, entry);
        }

        for (Map<String, Object> g : guestTop) {
            String title = String.valueOf(g.getOrDefault("song_title", ""));
            String artist = String.valueOf(g.getOrDefault("song_artist", ""));
            long cnt = ((Number) g.getOrDefault("cnt", 0)).longValue();
            String key = (title + "|||" + artist).toLowerCase().trim();

            if (merged.containsKey(key)) {
                Map<String, Object> entry = merged.get(key);
                entry.put("guestCount", cnt);
                entry.put("totalCount", ((Number) entry.get("totalCount")).longValue() + cnt);
            } else {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("title", title);
                entry.put("artist", artist);
                entry.put("cover", "");
                entry.put("adminCount", 0);
                entry.put("guestCount", cnt);
                entry.put("totalCount", cnt);
                merged.put(key, entry);
            }
        }

        // Sort by totalCount desc, take top 10
        List<Map<String, Object>> result = new ArrayList<>(merged.values());
        result.sort((a, b) -> Long.compare(
                ((Number) b.get("totalCount")).longValue(),
                ((Number) a.get("totalCount")).longValue()));
        if (result.size() > 10) result = result.subList(0, 10);
        // Only return items with totalCount > 0
        result.removeIf(e -> ((Number) e.get("totalCount")).longValue() <= 0);

        return ResponseEntity.ok(result);
    }

    // Top searched songs (admin)
    @GetMapping("/top-searched")
    public ResponseEntity<?> topSearched() {
        return ResponseEntity.ok(guestMusicLogMapper.topSongs());
    }

    // Recent guest music logs (admin)
    @GetMapping("/guest-logs")
    public ResponseEntity<?> guestLogs(HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));
        return ResponseEntity.ok(guestMusicLogMapper.findRecent());
    }

    // ── Music search (via gequhai.com) ──
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q,
                                     @RequestParam(defaultValue = "20") int limit) {
        if (q == null || q.isBlank()) return ResponseEntity.ok(List.of());
        try {
            List<Map<String, Object>> results = gequhaiService.search(q, limit);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "搜索失败: " + e.getMessage()));
        }
    }

    // ── Get real MP3 play URL, cover, and lyrics for a song ──
    @GetMapping("/play")
    public ResponseEntity<?> getPlayUrl(@RequestParam String mp3Id) {
        if (mp3Id == null || mp3Id.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "mp3Id is required"));
        }
        try {
            Map<String, String> info = gequhaiService.getSongInfo(mp3Id);
            if (info != null && info.get("url") != null && !info.get("url").isEmpty()) {
                return ResponseEntity.ok(info);
            }
            return ResponseEntity.status(404).body(Map.of("error", "播放地址获取失败"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "获取播放地址失败: " + e.getMessage()));
        }
    }

    // ── Import a song (download cover → /music/ → DB, use 163 playUrl) ──
    @PostMapping("/import")
    public ResponseEntity<?> importSong(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));

        String title = str(body, "title");
        String artist = str(body, "artist");
        String coverUrl = str(body, "coverUrl");
        String playUrl = str(body, "playUrl");
        Object songIdObj = body.get("songId");
        Long songId = songIdObj instanceof Number ? ((Number) songIdObj).longValue() : null;

        if (title == null || title.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "歌名不能为空"));
        if (playUrl == null || playUrl.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "播放地址不能为空"));

        Song song = new Song();
        song.setTitle(title);
        song.setArtist(artist != null ? artist : "未知");
        song.setSongId(songId);
        song.setUrl(playUrl);
        song.setPlayUrl(playUrl);
        song.setSourceType("external");

        List<String> errors = new ArrayList<>();

        // Download cover to local
        if (coverUrl != null && !coverUrl.isBlank()) {
            try {
                Map<String, String> r = importService.download(coverUrl, "cover");
                song.setCover(r.get("url"));
            } catch (Exception e) {
                errors.add("封面下载: " + e.getMessage());
            }
        }

        // Save lyrics if provided
        String lyric = str(body, "lyric");
        if (lyric != null && !lyric.isBlank()) {
            song.setLyricUrl(lyric); // store raw LRC text or URL
        }

        Song saved = service.create(song);
        return ResponseEntity.ok(Map.of("song", saved, "errors", errors));
    }

    // ── Batch import ──
    @PostMapping("/import-batch")
    public ResponseEntity<?> importBatch(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> songs = (List<Map<String, Object>>) body.getOrDefault("songs", List.of());
        List<Map<String, Object>> results = new ArrayList<>();
        int success = 0, fail = 0;

        for (Map<String, Object> s : songs) {
            try {
                ResponseEntity<?> res = importSong(s, request);
                if (res.getStatusCode().is2xxSuccessful()) {
                    success++;
                    @SuppressWarnings("unchecked")
                    Map<String, Object> data = (Map<String, Object>) res.getBody();
                    results.add(Map.of("title", str(s, "title"), "status", "ok", "song", data != null ? data.get("song") : null));
                } else {
                    fail++;
                    results.add(Map.of("title", str(s, "title"), "status", "fail"));
                }
            } catch (Exception e) {
                fail++;
                results.add(Map.of("title", str(s, "title"), "status", "error", "error", e.getMessage()));
            }
        }
        return ResponseEntity.ok(Map.of("total", songs.size(), "success", success, "fail", fail, "results", results));
    }

    @GetMapping("/check/{id}")
    public ResponseEntity<?> checkSource(@PathVariable Long id) {
        Song song = service.findById(id);
        if (song == null || song.getUrl() == null) return ResponseEntity.ok(Map.of("alive", false));
        boolean alive = song.getUrl().startsWith("/music/") || song.getUrl().startsWith("/uploads/")
            ? true : importService.checkAlive(song.getUrl());
        return ResponseEntity.ok(Map.of("alive", alive));
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : null;
    }
}
