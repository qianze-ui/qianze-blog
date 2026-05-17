# qianze Blog — Deployment Guide

React + Spring Boot 前后端分离部署方案。

---

# 项目架构

```text
浏览器
   │
   ├── React Frontend
   │      └── Nginx (80)
   │
   └── SpringBoot Backend
          └── Java Jar (8080)
```

---

# 服务端环境

推荐：

* Ubuntu 22.04
* JDK 17
* Node.js 20
* MySQL 8
* Nginx
* PM2（可选）

---

# 1. 部署 SpringBoot 后端

## 本地打包

```bash
cd springboot

./mvnw clean package -DskipTests
```

生成：

```text
target/blog-api-1.0.0.jar
```

---

## 上传到服务器

```bash
scp target/blog-api-1.0.0.jar root@your-server-ip:/app/
```

---

## 启动服务

```bash
ssh root@your-server-ip

cd /app

java -jar blog-api-1.0.0.jar
```

默认端口：

```text
8080
```

---

# 2. 部署 React 前端

## 本地构建

```bash
cd react

npm install

npm run build
```

生成：

```text
dist/
```

---

## 上传到服务器

```bash
scp -r dist/* root@your-server-ip:/var/www/blog/
```

---

# 3. 配置 Nginx

安装：

```bash
apt-get install -y nginx
```

配置：

```bash
cat > /etc/nginx/sites-available/blog << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/blog;
    index index.html;

    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # SpringBoot API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/

nginx -t

systemctl reload nginx
```

---

# 4. HTTPS SSL

安装：

```bash
apt-get install -y certbot python3-certbot-nginx
```

申请证书：

```bash
certbot --nginx -d your-domain.com
```

---

# 5. MySQL 数据库

安装：

```bash
apt-get install -y mysql-server
```

创建数据库：

```bash
mysql -u root -p

CREATE DATABASE blog DEFAULT CHARSET utf8mb4;
```

导入数据：

```bash
mysql -u root -p blog < migrate.sql
```

---

# 6. SpringBoot 配置

修改：

```text
springboot/src/main/resources/application.yml
```

数据库配置：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/blog
    username: root
    password: yourpassword
```

---

# 常用命令

## SpringBoot

```bash
./mvnw spring-boot:run

./mvnw clean package -DskipTests

java -jar target/blog-api-1.0.0.jar
```

---

## React

```bash
npm install

npm run dev

npm run build
```

---

## Nginx

```bash
nginx -t

systemctl restart nginx
```

---

# 默认端口

| 服务         | 端口   |
| ---------- | ---- |
| React      | 80   |
| SpringBoot | 8080 |
| MySQL      | 3306 |

---

# 部署完成

访问：

```text
https://your-domain.com
```
