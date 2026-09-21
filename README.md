# 昆虫高斯溅射模型展示

这个项目用 `@mkkellogg/gaussian-splats-3d` 展示 `ooosplat` 导出的 PLY 高斯溅射模型，并提供管理后台。

## 启动

```powershell
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:4173
```

管理后台：

```text
http://127.0.0.1:4173/admin.html
```

后台支持上传 `.ply` 文件、修改模型显示名称和删除模型。模型元数据保存在 `data/models.json`。

后台编辑操作需要输入管理秘钥，秘钥可通过环境变量 `ADMIN_KEY` 配置。

模型文件通过硬链接放在 `models/` 目录下，不额外占用磁盘空间。
