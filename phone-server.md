# 用红米 Note 11 SE 做临时服务器

不要刷机，优先使用 Termux。

## 1. 安装 Termux

建议从 F-Droid 安装 Termux，Play Store 版本可能过旧。

## 2. 安装 Node.js

```bash
pkg update
pkg upgrade
pkg install nodejs-lts openssh
```

## 3. 把项目传到手机

方式一：USB 复制到手机存储，再移动到 Termux：

```bash
termux-setup-storage
cp -r /sdcard/insect-splat ~/insect-splat
```

方式二：在同一局域网下使用 SSH：

Termux 中启动 SSH：

```bash
sshd
```

电脑上执行：

```powershell
scp -r -P 8022 D:\昆虫高斯溅射映射技术 u0_a***@手机IP:~/insect-splat
```

## 4. 启动服务

```bash
cd ~/insect-splat
npm install
npm start
```

## 5. 保持手机不休眠

安装 Termux API 后执行：

```bash
termux-wake-lock
```

同时在系统设置中关闭 Termux 的电池优化。

其他设备访问：

```text
http://手机局域网IP:4173
```
