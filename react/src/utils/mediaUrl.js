/**
 * 音频/图片/歌词 URL 解析工具
 *
 * 原则：
 * 1. 数据库只存相对路径  /music/xxx.mp3  或  /uploads/xxx.jpg
 * 2. 外链保持完整 URL     https://example.com/song.mp3
 * 3. 前端不硬编码 localhost 或域名
 * 4. 浏览器自动基于当前页面 origin 解析相对路径
 * 5. 开发环境：Vite 代理 /music /uploads 到 localhost:8080
 * 6. 生产环境：nginx 代理 /music /uploads 到 Spring Boot
 *
 * 结果：无论开发还是生产，相对路径都能正确加载。
 */

const EXTERNAL_RE = /^https?:\/\//i
const DATA_RE = /^data:/i
const BLOB_RE = /^blob:/i

/**
 * 判断是否为外链（完整 URL）
 */
export function isExternal(url) {
  if (!url) return false
  return EXTERNAL_RE.test(url) || DATA_RE.test(url) || BLOB_RE.test(url)
}

/**
 * 获取可用于 <audio src> <img src> 的 URL
 *
 * - 外链：直接返回
 * - 相对路径（/music/xxx.mp3）：直接返回，浏览器基于页面 origin 解析
 * - 开发时 Vite 把 /music/* 代理到 localhost:8080
 * - 生产时 nginx 把 /music/* 代理到 Spring Boot
 */
export function getMediaUrl(url) {
  if (!url) return ''
  if (isExternal(url)) return url
  // 相对路径：确保以 / 开头
  return url.startsWith('/') ? url : '/' + url
}

/**
 * 构建上传后的存储路径（相对路径，不包含域名）
 * 存入数据库时使用此函数
 */
export function getStoragePath(url) {
  if (!url) return ''
  // 如果返回的是完整 URL，提取路径部分
  if (isExternal(url)) {
    try {
      const u = new URL(url)
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return u.pathname  // 去掉开发环境的 localhost 前缀
      }
      return url  // 真正的外链保持完整
    } catch {
      return url
    }
  }
  return getMediaUrl(url)
}

/**
 * 上传后从服务器响应中提取可存储的相对路径
 */
export function normalizeUploadUrl(serverUrl) {
  return getStoragePath(serverUrl)
}
