# Gequhai API 逆向分析文档

## 数据来源

`https://www.gequhai.com` — 海量高品质 MP3 音乐免费下载站，服务端 PHP 渲染，无 Cloudflare 防护。

实际音频文件托管在酷我（kuwo.cn）CDN 上，gequhai 作为中间层提供搜索和链接解析。

---

## 抓包环境

Chrome 148 DevTools → Network 面板，过滤 XHR/Fetch 请求，配合 Playwright `page.route()` 拦截请求/响应。

---

## 接口流程（3 步）

### 第 1 步：搜索歌曲

```
GET https://www.gequhai.com/s/{keyword}
```

**说明**：直接请求搜索页面，服务端渲染返回 HTML。不是 AJAX 接口，不需要 POST 触发缓存。

**请求头**：
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...
Accept: text/html,application/xhtml+xml,application/xml;q=0.9
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cookie: server_name_session=xxx; PHPSESSID=xxx
```

**响应 HTML 结构**（关键部分）：
```html
<table>
  <tr>
    <th>序号</th>
    <th>歌曲</th>
    <th>歌手</th>
  </tr>
  <tr>
    <td>1</td>
    <td><a href="/play/6221" class="text-info font-weight-bold">牵丝戏</a></td>
    <td style="color: #666;font-size: 15px;">银临&Aki阿杰</td>
  </tr>
  <tr>
    <td>2</td>
    <td><a href="/play/972923">牵丝戏DJ</a></td>
    <td>小九儿</td>
  </tr>
  ...
</table>
```

**解析规则**：
- 跳过 `<th>` 表头行
- 第 2 列 `<td>` 中的 `<a href="/play/{id}">` → 歌曲 ID + 标题
- 第 3 列 `<td>` 文本 → 歌手

**示例返回**：
```json
[
  {"songId":6221,  "mp3Id":"6221",  "title":"牵丝戏",             "artist":"银临&Aki阿杰"},
  {"songId":972923,"mp3Id":"972923","title":"牵丝戏DJ",           "artist":"小九儿"},
  {"songId":553,   "mp3Id":"553",   "title":"青花瓷",             "artist":"周杰伦"}
]
```

---

### 第 2 步：获取加密 play_id

```
GET https://www.gequhai.com/play/{id}
```

**说明**：播放页 HTML 中内嵌了一段 JS，服务端已将歌曲对应的加密标识写入全局变量。

**请求头**：同第 1 步，带上 `Cookie` 和 `Referer`。

**HTML 中的关键 JS**（行内 `<script>`）：
```javascript
$(function () {
    window.mp3_id = '6221';
    window.play_id = 'STaYxFzAng%3D%3D';      // ← 这是关键！加密后的 API ID
    window.mp3_url = '';
    window.mp3_url_a = '';
    window.mp3_title = '牵丝戏';
    window.mp3_author = '银临&Aki阿杰';
    window.mp3_cover = 'https://img3.kuwo.cn/star/albumcover/500/6/48/1406239650.jpg';
    window.mp3_type = 0;
    window.is_white_url = false;
});
```

**`play_id` 特征**：
- Base64 编码 + URL-encode 的字符串，形如 `STaYxFzAng%3D%3D`
- `%3D` 就是 `=`（URL 编码），实际值为 `STaYxFzAng==`
- **无须解密**，直接提取后原样传给第 3 步 API

**提取正则**：
```java
Pattern.compile("window\\.play_id\\s*=\\s*'([^']+)'")
```

---

### 第 3 步：获取真实 MP3 地址

```
POST https://www.gequhai.com/api/music
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

**请求体**：
```
id={URL_ENCODED(play_id)}&type=0
```

**重要**：`play_id` 本身已经包含 `%3D`（即 `=`），在 FormBody 编码时会再次编码：
- 原始 `play_id`：`STaYxFzAng%3D%3D`
- 编码后 body：`id=STaYxFzAng%253D%253D&type=0`
- `%3D` → `%253D`（`%` 编码为 `%25`）

**必须的头**：
```
X-Custom-Header: SecretKey        ← 缺少此头会 403
X-Requested-With: XMLHttpRequest
Origin: https://www.gequhai.com
Referer: https://www.gequhai.com/play/{id}
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Cookie: server_name_session=xxx; PHPSESSID=xxx
```

**成功响应**（200）：
```json
{
    "code": 200,
    "data": {
        "url": "https://car-bj.kuwo.cn/363b9d8e86e4b36a68899aef119b4bb0/6a0ea347/lu/resource/a2/49/14/2012151858.aac",
        "is_while_url": false
    },
    "msg": "ok!"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | int | 200 表示成功 |
| `data.url` | string | 真实播放地址（酷我 CDN直链，支持 mp3/aac/flac） |
| `data.is_while_url` | bool | 是否白名单直链 |
| `msg` | string | 状态消息 |

**错误响应**：
- 403 Forbidden → Session 过期或缺少 `X-Custom-Header`
- `{"code":-1,"msg":"..."}` → play_id 无效

---

## Cookie 与会话管理

### 获取方式

访问首页 `GET https://www.gequhai.com/`，Set-Cookie 响应头会返回两个关键 cookie：

| Cookie | 示例值 | 用途 |
|--------|--------|------|
| `server_name_session` | `4077b1e2fd19d8bd84e7ec4b90620cd0` | 服务端会话，必需 |
| `PHPSESSID` | `7bi2h89hal959a5ljkkd1ej5hn` | PHP 会话，建议携带 |

### 有效期与刷新

- 单个 session 有效期约 1–2 小时（未精确测定）
- 过期后 API 返回 403
- 策略：遇到 403 时丢弃旧 cookie，重新访问首页获取新 session，重试

---

## 错误码

| HTTP 状态 | API code | 原因 | 处理 |
|-----------|----------|------|------|
| 403 | — | Session 过期或反爬拦截 | 刷新 session 重试 |
| 200 | -1 | play_id 无效或歌曲下架 | 返回 null |
| 200 | 200 | 成功 | 提取 `data.url` |

---

## Java 实现要点

```java
@Service
public class GequhaiService {
    private final OkHttpClient client;      // OkHttp 4.12，管理 cookie
    private String sessionCookie;            // server_name_session
    private String phpSessionId;             // PHPSESSID
    private final Cache<String, String> mp3Cache; // Caffeine 30min 缓存

    // 搜索：GET /s/{keyword} → Jsoup 解析 <table> → 提取 /play/{id} 链接
    public List<Map<String, Object>> search(String keyword, int limit) { ... }

    // 解析：GET /play/{id} → 提取 window.play_id → POST /api/music → data.url
    public String getMp3Url(String mp3Id) { ... }

    // Session：GET / → Set-Cookie → 提取两个 cookie
    private void ensureSession() { ... }

    // 重试：403 → sessionCookie = null → ensureSession() → 重试
    // 请求伪装：User-Agent + Accept-Language + Referer + Origin
}
```

完整源码见 `springboot/src/main/java/com/qianze/service/GequhaiService.java`。
