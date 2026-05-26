package com.qianze.config;

import java.util.Map;

public class UaParser {

    public static Map<String, String> parse(String ua) {
        if (ua == null || ua.isBlank())
            return Map.of("browser", "未知", "os", "未知", "device", "未知", "model", "");

        String browser = detectBrowser(ua);
        String os = detectOs(ua);
        String device = detectDevice(ua, os);
        String model = detectModel(ua, os);

        return Map.of("browser", browser, "os", os, "device", device, "model", model);
    }

    private static String detectBrowser(String ua) {
        // Embedded / 国产 browsers first
        if (ua.contains("MicroMessenger") || ua.contains("WeChat/") || ua.contains("Weixin") || ua.contains("MMWEBSDK"))
            return "微信内置";
        if (ua.contains("QQ/") || ua.contains("MQQBrowser") || ua.contains("QQBrowser"))
            return "QQ浏览器";
        if (ua.contains("UCBrowser") || ua.contains("UCWEB") || ua.contains("U3"))
            return "UC浏览器";
        if (ua.contains("ArkWeb") || ua.contains("HuaweiBrowser"))
            return "华为浏览器";
        if (ua.contains("Baidu") || ua.contains("baiduboxapp") || ua.contains("BIDUBrowser"))
            return "百度浏览器";
        if (ua.contains("DingTalk") || ua.contains("AliApp(DingTalk"))
            return "钉钉";
        if (ua.contains("AlipayClient") || ua.contains("AlipayDefined"))
            return "支付宝";
        if (ua.contains("Toutiao") || ua.contains("NewsArticle"))
            return "今日头条";
        if (ua.contains("Douyin") || ua.contains("aweme"))
            return "抖音";
        // Standard browsers
        if (ua.contains("Edg/") || ua.contains("Edge/"))
            return "Edge";
        if (ua.contains("Firefox/") || ua.contains("FxiOS/"))
            return "Firefox";
        if (ua.contains("OPR/") || ua.contains("Opera") || ua.contains("OPiOS/"))
            return "Opera";
        if (ua.contains("SamsungBrowser"))
            return "三星浏览器";
        if (ua.contains("MiuiBrowser"))
            return "小米浏览器";
        if (ua.contains("Chrome/") && !ua.contains("Edg/"))
            return "Chrome";
        if (ua.contains("Safari/") && !ua.contains("Chrome") && !ua.contains("Android"))
            return "Safari";
        return "其他";
    }

    private static String detectOs(String ua) {
        if (ua.contains("HarmonyOS") || ua.contains("OpenHarmony")) return "HarmonyOS";
        if (ua.contains("iPhone")) return "iOS";
        if (ua.contains("iPad")) return "iPadOS";
        if (ua.contains("Android")) return "Android";
        if (ua.contains("Windows NT 10.0")) {
            // Can't distinguish Win10 vs Win11 from UA alone
            return "Windows 10/11";
        }
        if (ua.contains("Windows NT 6.3")) return "Windows 8.1";
        if (ua.contains("Windows NT 6.1")) return "Windows 7";
        if (ua.contains("Windows")) return "Windows";
        if (ua.contains("Mac OS X") || ua.contains("macOS")) return "macOS";
        if (ua.contains("Linux") && !ua.contains("Android")) return "Linux";
        if (ua.contains("CrOS")) return "ChromeOS";
        return "其他";
    }

    private static String detectDevice(String ua, String os) {
        if ("iOS".equals(os) || "HarmonyOS".equals(os)) return "手机";
        if ("iPadOS".equals(os)) return "平板";
        if ("Android".equals(os))
            return ua.contains("Mobile") || ua.contains("wv") || ua.contains("WV") ? "手机" : "平板";
        return "桌面端";
    }

    private static String detectModel(String ua, String os) {
        if (ua == null) return "";
        if ("iOS".equals(os)) {
            // Try to detect iPhone model (limited from UA)
            if (ua.contains("iPhone")) return "iPhone";
            return "";
        }
        if ("iPadOS".equals(os)) return "iPad";
        if (!"Android".equals(os)) return "";

        // Extract Android model
        String model = extractAndroidModel(ua);
        if (!model.isEmpty()) return model;

        // Brand fallback
        return detectBrand(ua);
    }

    private static String extractAndroidModel(String ua) {
        // Pattern: "Android X; <Model> Build/"
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
            ";\\s*([^;)]+?)\\s+Build/[^\\s;)]+"
        );
        java.util.regex.Matcher m = p.matcher(ua);
        if (m.find()) {
            String raw = m.group(1).trim();
            if (isValidModel(raw)) return raw;
        }

        // Pattern: "Android X.X; <Model> Build/"
        p = java.util.regex.Pattern.compile(
            "Android\\s+[\\d.]+;\\s*([^;)]+?)\\s+Build/"
        );
        m = p.matcher(ua);
        if (m.find()) {
            String raw = m.group(1).trim();
            if (isValidModel(raw)) return raw;
        }

        // Pattern: "Android X; <Model>)"
        p = java.util.regex.Pattern.compile(
            "Android\\s+[\\d.]+;\\s*([^;)]+?)\\)"
        );
        m = p.matcher(ua);
        if (m.find()) {
            String raw = m.group(1).trim();
            if (isValidModel(raw)) return raw;
        }

        return "";
    }

    private static boolean isValidModel(String raw) {
        if (raw.isEmpty()) return false;
        String noise = "^(Linux|Android|wv|WV|Mobile|WAP|NetType|Language|ABI|" +
            "AppleWebKit|KHTML|Gecko|Version|Chrome|Safari|XWEB|MMWEBSDK|MMWEBID|" +
            "MicroMessenger|WeChat|Weixin|Dalvik|en|zh|ja|ko|fr|de|es|pt|ru|ar|th|" +
            "vi|in|ms|tr|it|nl|pl|[A-Z]{2}|K|Mozilla)$";
        if (raw.matches(noise)) return false;
        if (raw.matches("^[A-Z]+\\d{5,}$")) return false; // Build IDs like UP1A...
        if (raw.matches("^\\d+$")) return false;
        return true;
    }

    private static String detectBrand(String ua) {
        if (ua.matches("(?i).*(HUAWEI|HONOR|HW-|EMUI|HarmonyOS|OpenHarmony).*")) return "华为设备";
        if (ua.matches("(?i).*(AL[NP]-|ANA-|BLA-|CLT-|ELE-|EVA-|JNY-|LIO-|NOH-|OCE-|PCT-|TAS-|VOG-|YAL-)\\w*.*")) return "华为设备";
        if (ua.matches("(?i).*(Xiaomi|Redmi|POCO|MI \\d|Mi \\d|M20[01]\\d).*")) return "小米设备";
        if (ua.matches("(?i).*(OPPO|OnePlus|CPH\\d|PG[AE]M|PH[ABW]|RMX\\d|PK[AG]).*")) return "OPPO/一加设备";
        if (ua.matches("(?i).*(vivo|V\\d{4}|iQOO|I\\d{4}).*")) return "vivo设备";
        if (ua.matches("(?i).*(Samsung|SM-[A-Z]\\d|GT-[A-Z]\\d|SC-[A-Z]\\d).*")) return "三星设备";
        if (ua.matches("(?i).*Pixel\\s?\\d.*")) return "Google Pixel";
        if (ua.matches("(?i).*(motorola|Moto\\s|XT\\d{4}|moto\\s|Lenovo|TB-).*")) return "摩托罗拉/联想设备";
        if (ua.matches("(?i).*(Meizu|M\\d{3}[A-Z]|m\\d\\snote).*")) return "魅族设备";
        if (ua.matches("(?i).*(Realme|realme|RMX\\d).*")) return "realme设备";
        return "安卓手机";
    }
}
