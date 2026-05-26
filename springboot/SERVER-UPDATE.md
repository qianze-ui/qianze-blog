# 服务器更新教程

每次修改代码后，按以下步骤更新服务器。

---

## 一、本地构建

```bash
# 后端
cd blog/springboot
mvn clean package -DskipTests
# 生成 target/blog-api-2.0.0.jar（版本号以 pom.xml 为准）

# 前端
cd blog/react
npm run build
# 生成 dist/
```

---

## 二、上传到服务器

```bash
# 后端 jar
scp blog/springboot/target/blog-api-*.jar root@服务器IP:/app/

# 前端文件
scp -r blog/react/dist/* root@服务器IP:/var/www/blog/

# ip2region 数据库（首次或更新时）
scp blog/springboot/src/main/resources/ip2region.xdb root@服务器IP:/app/
```

---

## 三、服务器目录结构

```
/app/
  ├── blog-api.jar          # Spring Boot jar
  ├── application.yml       # 生产环境配置
  ├── ip2region.xdb         # IP 地理位置库
  ├── uploads/              # 图片上传目录（自动创建）
  └── music/                # 音乐文件目录（需手动创建）

/var/www/blog/              # 前端静态文件（Nginx 根目录）
  ├── index.html
  └── assets/
```

### 首次部署创建目录

```bash
ssh root@服务器IP
mkdir -p /app/uploads /app/music
```

---

## 四、数据库变更

当修改了表结构（新列、新表）时：

```bash
# 上传 SQL
scp blog/springboot/src/main/resources/alter.sql root@服务器IP:/tmp/

# 执行
ssh root@服务器IP "mysql -u root -p blog < /tmp/alter.sql"
```

> **注意**：`alter.sql` 中的 `DROP TABLE IF EXISTS songs` 会清空音乐列表，需要重新在后台添加歌曲。

---

## 五、Nginx 配置

确保 `/etc/nginx/sites-available/blog` 包含以下配置：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;

    client_max_body_size 50M;       # 允许上传大文件（音乐/图片）

    root /var/www/blog;
    index index.html;

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 上传文件（图片）
    location /uploads/ {
        proxy_pass http://localhost:8080/uploads/;
        proxy_set_header Host $host;
    }

    # 音乐文件
    location /music/ {
        proxy_pass http://localhost:8080/music/;
        proxy_set_header Host $host;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

修改后重载：

```bash
nginx -t && systemctl reload nginx
```

---

## 六、application.yml 生产配置

服务器上的 `/app/application.yml`：

```yaml
server:
  port: 8080
  forward-headers-strategy: framework

spring:
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 50MB
  datasource:
    url: jdbc:mysql://localhost:3306/blog?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
    username: root
    password: 你的MySQL密码

admin:
  password: 你的管理密码      # 支持逗号分隔多密码

jwt:
  secret: 一个长随机字符串
  expiration: 3600000
```

---

## 七、重启服务

```bash
ssh root@服务器IP

# 重启后端
systemctl restart blog-api

# 查看启动日志（检查 ip2region 是否正确加载）
journalctl -u blog-api -n 50 --no-pager
```

---

## 八、验证

```bash
# 后端
curl http://localhost:8080/api/skills

# 图片上传目录（应该返回 200 或 404 而不是 502）
curl -I http://localhost:8080/uploads/

# 音乐目录
curl -I http://localhost:8080/music/

# 前端
curl -I http://服务器IP/
```

---

## 九、快速更新脚本

```bash
#!/bin/bash
SERVER="root@你的服务器IP"

echo "=== 构建 ==="
cd blog/springboot && mvn clean package -DskipTests -q
cd ../react && npm run build

echo "=== 上传 ==="
scp ../springboot/target/blog-api-*.jar $SERVER:/app/
scp -r dist/* $SERVER:/var/www/blog/

echo "=== 重启 ==="
ssh $SERVER "systemctl restart blog-api"

echo "=== 完成 ==="
```

---

## 仅更新前端

```bash
cd blog/react && npm run build
scp -r dist/* root@服务器:/var/www/blog/
```

## 仅更新后端

```bash
cd blog/springboot && mvn clean package -DskipTests -q
scp target/blog-api-*.jar root@服务器:/app/
ssh root@服务器 "systemctl restart blog-api"
```
