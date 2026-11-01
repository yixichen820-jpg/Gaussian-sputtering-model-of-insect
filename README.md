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

模型元数据保存在 `data/models.json`。上传的 PLY 默认保存在 `models/`，配置阿里云 OSS 后会自动切换到 OSS。

仓库初始模型列表为空，不包含测试模型。首次启动后可在管理后台上传新的 PLY 模型。

后台编辑操作需要输入管理秘钥，秘钥可通过环境变量 `ADMIN_KEY` 配置。

部署到阿里云 ECS 的完整步骤见 [DEPLOY.md](./DEPLOY.md)。
