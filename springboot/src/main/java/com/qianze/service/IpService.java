package com.qianze.service;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.lionsoul.ip2region.xdb.Searcher;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class IpService {
    private Searcher searcher;
    private boolean ready = false;

    @PostConstruct
    public void init() {
        try {
            byte[] data;
            // Try classpath first (works inside fat jar)
            InputStream is = getClass().getClassLoader().getResourceAsStream("ip2region.xdb");
            if (is != null) {
                data = is.readAllBytes();
                is.close();
                System.out.println("IpService: loaded ip2region.xdb from classpath (" + (data.length / 1024 / 1024) + " MB)");
            } else {
                // Fallback: try file system next to jar
                Path file = Path.of("ip2region.xdb");
                if (Files.exists(file)) {
                    data = Files.readAllBytes(file);
                    System.out.println("IpService: loaded ip2region.xdb from working dir (" + (data.length / 1024 / 1024) + " MB)");
                } else {
                    System.err.println("IpService: ip2region.xdb NOT FOUND (checked classpath and working dir)");
                    return;
                }
            }
            searcher = Searcher.newWithBuffer(data);
            // Self-test
            String test = searcher.search("8.8.8.8");
            ready = true;
            System.out.println("IpService: searcher ready, self-test 8.8.8.8 → " + test);
        } catch (Exception e) {
            System.err.println("IpService: init FAILED - " + e.getClass().getSimpleName() + ": " + e.getMessage());
            e.printStackTrace();
        }
    }

    /** Extract the real client IP from request, skipping private/internal IPs */
    public static String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // X-Forwarded-For: client, proxy1, proxy2 ...
            // Take the first non-private IP from left to right
            for (String part : forwarded.split(",")) {
                String candidate = part.trim();
                if (!candidate.isEmpty() && !isPrivateIp(candidate)) {
                    return candidate;
                }
            }
            // All private — fall back to first entry
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) return first;
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();

        return request.getRemoteAddr();
    }

    private static boolean isPrivateIp(String ip) {
        if (ip == null || ip.isEmpty()) return true;
        // Loopback / IPv6 loopback
        if (ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) return true;
        if (ip.startsWith("0.")) return true;
        // Class A private: 10.0.0.0/8
        if (ip.startsWith("10.")) return true;
        // Class C private: 192.168.0.0/16
        if (ip.startsWith("192.168.")) return true;
        // Class B private: 172.16.0.0/12
        if (ip.startsWith("172.")) {
            try {
                int second = Integer.parseInt(ip.split("\\.")[1]);
                if (second >= 16 && second <= 31) return true;
            } catch (Exception e) { return true; }
        }
        // Link-local: 169.254.0.0/16
        if (ip.startsWith("169.254.")) return true;
        return false;
    }

    public String[] search(String ip) {
        if (!ready || ip == null || ip.isBlank() || isPrivateIp(ip))
            return new String[]{"", "", "", ""};
        try {
            String region = searcher.search(ip);
            // Format: "国家|区域|省份|城市|ISP"
            String[] parts = region.split("\\|", -1);
            return new String[]{
                parts.length > 0 ? clean(parts[0]) : "",
                parts.length > 2 ? clean(parts[2]) : "",
                parts.length > 3 ? clean(parts[3]) : "",
                parts.length > 4 ? clean(parts[4]) : ""
            };
        } catch (Exception e) {
            return new String[]{"", "", "", ""};
        }
    }

    private String clean(String s) {
        return (s == null || s.isBlank() || s.equals("0")) ? "" : s.trim();
    }
}
