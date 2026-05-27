# 飞书多维表格接入

## 多维表格字段

默认字段名如下，字段名要和飞书多维表格里的列名一致：

- 订单号
- 提交时间
- 用户姓名
- 联系方式
- 商品明细
- 总金额
- 付款截图
- 订单状态
- 备注

如果你的字段名不同，可以在 `.env.local` 里用 `FEISHU_FIELD_*` 覆盖。

## 环境变量

复制 `.env.example` 为 `.env.local`，然后填写：

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_BITABLE_APP_TOKEN=bascnxxx
FEISHU_BITABLE_TABLE_ID=tblxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

如果你的多维表格链接是 `/wiki/...` 形式，例如：

```text
https://moonshot.feishu.cn/wiki/KG1RwbXlvisykokqfGacKL5Ensc?table=tblZYT91eKkKuzvP&view=vewYguSqyi
```

那么这样填：

```bash
FEISHU_WIKI_NODE_TOKEN=KG1RwbXlvisykokqfGacKL5Ensc
FEISHU_BITABLE_TABLE_ID=tblZYT91eKkKuzvP
```

这种情况下可以不填 `FEISHU_BITABLE_APP_TOKEN`，系统会通过 wiki 节点自动解析真正的多维表格 app_token。

`NEXT_PUBLIC_SITE_URL` 用来生成付款截图链接。正式上线后要改成真实域名。

## 飞书侧权限

在飞书开放平台创建自建应用，开启多维表格记录读写相关权限，并在目标多维表格里把这个应用添加为文档应用，给编辑权限。

## 本地联调

1. 重启开发服务：`npm run dev`
2. 打开 `/admin/feishu`
3. 点击「检查连接和字段」
4. 如果全部通过，再点击「写入测试记录」

常见卡点：

- 缺少环境变量：检查 `.env.local` 是否在项目根目录，改完后必须重启 `npm run dev`
- `tenant_access_token` 失败：`FEISHU_APP_ID` 或 `FEISHU_APP_SECRET` 不对
- `WrongBaseToken` / `BaseTokenNotFound`：`FEISHU_BITABLE_APP_TOKEN` 不对，通常是 URL 里的 `bascn...`
- `WrongTableId` / `TableIdNotFound`：`FEISHU_BITABLE_TABLE_ID` 不对，通常是 URL 里的 `tbl...`
- 权限错误：应用没有开多维表格权限，或没有被添加到这张多维表格协作者里
- 缺字段：表格列名必须和配置完全一致，包含中文和空格

建议先把 `付款截图` 字段建成文本或链接字段；当前代码写入的是付款截图链接，不是飞书附件对象。

代码使用飞书官方的多维表格记录接口：

- 新增记录：`POST /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records`
- 更新记录：`PUT /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/:record_id`
- 列出字段：`GET /open-apis/bitable/v1/apps/:app_token/tables/:table_id/fields`
