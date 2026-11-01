# 部署到阿里云 ECS + OSS

这个项目在服务器上运行后，即使你的电脑关机，网站也会一直在线。

## 你已经有

- 阿里云 ECS 服务器
- 阿里云 OSS 存储桶

## 还需要准备

1. **一个域名**：例如 `insect.example.com`。中国大陆服务器绑定域名需要完成 ICP 备案。
2. **SSL 证书**：可以免费申请阿里云证书，或者服务器上用 Certbot 自动签发。
3. **安全组放行**：在 ECS 安全组放行 `80` 和 `443` 端口。
4. **OSS AccessKey**：在阿里云 RAM 中创建一个只拥有目标 Bucket 权限的子账号，拿到 `AccessKey ID` 和 `AccessKey Secret`。
5. **OSS Bucket 设置为公共读**：因为浏览器需要直接下载 PLY 文件。Bucket ACL 选择“公共读”，或者配置 CDN 域名后公开 CDN。
6. **OSS CORS 规则**：允许你的域名访问。
   - 来源：`https://你的域名.com`，调试阶段可先填 `*`
   - 方法：`GET`、`HEAD`
   - 允许 Headers：`*`
   - 暴露 Headers：`Content-Length`、`Content-Range`、`ETag`

可选：CDN 加速、OSS 生命周期规则、云监控告警。

## 存储方式

服务端默认把上传的 PLY 存在 ECS 本地 `models/` 目录。填好 `.env` 中的 OSS 四项配置后，新上传的模型会自动存到 OSS；没填 OSS 时则继续存本地。两种方式可以混用。

已有的本地模型若想迁到 OSS，最简单的方式是：启用 OSS 后，在管理页重新上传这些 PLY 文件，然后删除旧的本地记录。

## 部署步骤

ECS 建议选择 `Ubuntu 22.04`，并在控制台安全组里放行 `22`、`80`、`443` 端口。

### 1. 安装运行时

ECS 使用 Ubuntu/Debian 时：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
```

### 2. 上传代码

如果你已经把项目推到 Git 仓库，可以在 ECS 上直接执行：

```bash
git clone <你的仓库地址> /opt/insect-splat
cd /opt/insect-splat
cp .env.example .env
chmod 600 .env
# 编辑 .env，填写必填的 ADMIN_KEY，以及按需填写 OSS 配置
nano .env
npm ci
```

如果你没有 Git 仓库，在 Windows 本机先打包，只包含代码和配置，不包含 `node_modules` 和本地模型：

```powershell
cd D:\昆虫高斯溅射映射技术
powershell -ExecutionPolicy Bypass -File .\scripts\package-deploy.ps1
```

然后把 `deploy.zip` 上传到 ECS：

```powershell
scp D:\昆虫高斯溅射映射技术\deploy.zip root@你的ECS公网IP:/opt/
```

在 ECS 上解压并安装依赖：

```bash
sudo mkdir -p /opt/insect-splat
sudo unzip /opt/deploy.zip -d /opt/insect-splat
cd /opt/insect-splat
cp .env.example .env
chmod 600 .env
nano .env
npm ci
```

### 3. 启动并设置开机自启

```bash
pm2 start ecosystem.config.cjs
pm2 startup
# 执行 pm2 startup 输出的 sudo 命令，然后保存当前进程列表
pm2 save
```

启动后可以用下面的地址确认状态：

```text
curl http://127.0.0.1:4173/api/health
```

### 4. 配置 Nginx

把 `nginx.conf` 里的 `your-domain.com` 改成你的域名：

```bash
sudo cp nginx.conf /etc/nginx/conf.d/insect-splat.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 配置 HTTPS

如果域名已完成备案且解析到 ECS，可以自动申请 Let's Encrypt 证书：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com
```

## 管理页

```text
https://你的域名.com/admin.html
```

首次启动前必须在项目的 `.env` 文件中配置非空 `ADMIN_KEY`。请使用独立生成的长随机值，不要复用示例、文档或公开值。未配置时服务器会拒绝启动；修改后需要重启 PM2。

`.env` 必须保留在项目根目录并设置为仅服务账号可读。服务端每次启动都会显式加载该文件；通过系统环境变量设置的同名值优先。修改 `.env` 后执行：

```bash
pm2 restart insect-splat-viewer --update-env
pm2 save
```

如果曾经使用过公开的默认管理密钥，请立即更换线上密钥并重启服务，并将旧值视为已经泄露。

## 用到的开源工具

- `@mkkellogg/gaussian-splats-3d`：浏览器端高斯溅射渲染
- `three`：底层 3D 引擎
- `busboy`：Node.js 上传解析
- `lucide`：界面图标
- `ali-oss`：阿里云 OSS 上传
- `PM2`：Node.js 进程守护
- `Nginx`：反向代理和 HTTPS 入口
- `Certbot`：自动签发证书

## 常见问题

**模型加载失败或 403**：检查 OSS Bucket 是否为公共读，以及 OSS CORS 是否允许当前域名。

**上传失败**：检查 Nginx 的 `client_max_body_size`、OSS 子账号权限，以及 `.env` 是否已经重新加载（改完执行 `pm2 restart insect-splat-viewer`）。

**管理秘钥输对了仍不能操作**：确认服务端 `.env` 中的 `ADMIN_KEY`，修改后需要重启服务。
