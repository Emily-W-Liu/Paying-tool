# 部署到公网

推荐部署方式：Vercel + Supabase + 飞书。

## Vercel 配置

1. 把 `event-pay` 项目推到 GitHub。
2. 在 Vercel 新建项目，Root Directory 选择 `event-pay`。
3. Framework preset 选择 Next.js。
4. Build command 保持 `npm run build`。
5. 添加环境变量。

## 必填环境变量

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_WIKI_NODE_TOKEN=xxx
FEISHU_BITABLE_TABLE_ID=tblxxx

ADMIN_PASSWORD=change-this-password
ADMIN_SESSION_SECRET=change-this-random-session-secret

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=payment-screenshots

NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

`NEXT_PUBLIC_SITE_URL` 要在拿到正式域名后改成真实域名，否则飞书里的备用截图链接会指向本地。

## 上线后测试

1. 打开公网商品页。
2. 提交一笔测试订单并上传付款截图。
3. 检查 Supabase `orders` 表是否新增记录。
4. 检查 Supabase Storage 是否新增图片。
5. 检查飞书多维表格是否新增记录和附件。
6. 登录 `/admin`，点击确认付款。
7. 检查飞书订单状态是否变成 `已完成`。

## 二维码

当前活动商品页：

```text
https://paying-tool.vercel.app/
```

二维码文件：

```text
public/paying-tool-shop-qr.png
```
