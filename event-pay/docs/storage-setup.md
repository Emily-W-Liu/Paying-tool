# Supabase 存储接入

这个项目现在支持两种存储模式：

- 未配置 Supabase：继续使用 `data/*.json` 和 `public/uploads`，适合本地开发。
- 已配置 Supabase：商品、订单走 Supabase Postgres，付款截图走 Supabase Storage，适合 Vercel 等公网部署。

## 需要创建的资源

1. 创建一个 Supabase project。
2. 在 SQL Editor 里执行 `docs/supabase-setup.sql`。
3. 在 Storage 里创建 bucket：

```text
payment-screenshots
```

4. 把 bucket 设置为 public read。写入仍然由服务端 `SUPABASE_SERVICE_ROLE_KEY` 完成。

## 环境变量

在 `.env.local` 或部署平台环境变量里加入：

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=payment-screenshots
```

`SUPABASE_SERVICE_ROLE_KEY` 只能放服务端环境变量，不要暴露给浏览器。

## 迁移策略

当前代码会根据环境变量自动切换：

- 有 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`：使用 Supabase
- 没有：使用本地 JSON 文件和本地上传目录

这样本地开发不会被云服务卡住，上线时只需要填环境变量。
