package com.qianze.controller;

import com.qianze.config.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class FileController {

    private static final Path UPLOAD_DIR = Path.of("uploads");

    private static final Path MUSIC_DIR = Path.of("music");

    @PostMapping
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));
        return saveFile(file, UPLOAD_DIR, "/uploads/");
    }

    @PostMapping("/public")
    public ResponseEntity<?> uploadPublic(@RequestParam("file") MultipartFile file) {
        String ext = getExt(file.getOriginalFilename());
        if (!ext.matches("jpg|jpeg|png|gif|webp"))
            return ResponseEntity.badRequest().body(Map.of("error", "仅支持 JPG/PNG/GIF/WebP 图片"));
        if (file.getSize() > 5 * 1024 * 1024)
            return ResponseEntity.badRequest().body(Map.of("error", "图片不能超过 5MB"));
        return saveFile(file, UPLOAD_DIR, "/uploads/");
    }

    @PostMapping("/music")
    public ResponseEntity<?> uploadMusic(@RequestParam("file") MultipartFile file,
                                          @RequestParam(value = "type", defaultValue = "audio") String type,
                                          HttpServletRequest request) {
        if (!JwtUtil.isAdmin(request))
            return ResponseEntity.status(403).body(Map.of("error", "无权限"));

        String ext = getExt(file.getOriginalFilename());

        if ("cover".equals(type)) {
            if (!ext.matches("jpg|jpeg|png|gif|webp"))
                return ResponseEntity.badRequest().body(Map.of("error", "不支持的封面格式"));
        } else if ("lyric".equals(type)) {
            if (!ext.matches("lrc|txt"))
                return ResponseEntity.badRequest().body(Map.of("error", "不支持的歌词格式"));
        } else {
            if (!ext.matches("mp3|wav|flac|ogg|m4a|aac|opus|aiff"))
                return ResponseEntity.badRequest().body(Map.of("error", "不支持的音频格式"));
        }

        return saveFile(file, MUSIC_DIR, "/music/");
    }

    private ResponseEntity<?> saveFile(MultipartFile file, Path dir, String urlPrefix) {
        try {
            Files.createDirectories(dir);
            String name = UUID.randomUUID().toString().substring(0, 8) + "." + getExt(file.getOriginalFilename());
            Path target = dir.resolve(name);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return ResponseEntity.ok(Map.of("url", urlPrefix + name));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", "上传失败: " + e.getMessage()));
        }
    }

    private String getExt(String name) {
        if (name == null || !name.contains(".")) return "";
        String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
        return ext.equals("jpeg") ? "jpg" : ext;
    }
}
