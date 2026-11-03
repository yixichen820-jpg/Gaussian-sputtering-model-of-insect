# 昆虫高斯溅射模型展示

这个项目用 `@mkkellogg/gaussian-splats-3d` 展示高斯溅射 PLY 模型，并提供管理后台。前台支持旋转、缩放、平移、模型切换和昆虫介绍；后台支持上传、改名、编辑介绍和删除。

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

模型元数据保存在 `data/models.json`，分类数据保存在 `data/taxonomy.json`，静态缩略图保存在 `thumbs/`。仓库只保存这些程序所需的元数据和预览资源，不提交 `.ply`、`.splat`、`.ksplat`、`.spz` 等 3D 模型文件。

实际模型文件保存在阿里云 OSS，或在未配置 OSS 时保存到 ECS 的 `models/` 目录。模型二进制已被 `.gitignore` 排除，便于以后独立批量替换模型而不改动代码仓库。

后台编辑操作需要输入管理秘钥，秘钥可通过环境变量 `ADMIN_KEY` 配置。

部署到阿里云 ECS 的完整步骤见 [DEPLOY.md](./DEPLOY.md)。
