import type { DemoOrder } from "./order-types";

type FeishuSyncResult =
  | { status: "skipped"; message: string; recordId?: undefined }
  | { status: "synced"; message: string; recordId?: string }
  | { status: "failed"; message: string; recordId?: undefined };

type FeishuAttachment = {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
};

export type FeishuField = {
  field_id: string;
  field_name: string;
  type: number;
  ui_type: string;
};

export type FeishuCheckResult = {
  configured: boolean;
  missingEnv: string[];
  expectedFields: string[];
  fields: FeishuField[];
  missingFields: string[];
  steps: Array<{
    name: string;
    ok: boolean;
    message: string;
  }>;
};

const requiredEnv = [
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_BITABLE_TABLE_ID",
] as const;

export function getFeishuConfig() {
  const missing: string[] = requiredEnv.filter((key) => !process.env[key]);
  const hasAppToken = Boolean(process.env.FEISHU_BITABLE_APP_TOKEN);
  const hasWikiNodeToken = Boolean(process.env.FEISHU_WIKI_NODE_TOKEN);

  if (!hasAppToken && !hasWikiNodeToken) {
    missing.push("FEISHU_BITABLE_APP_TOKEN 或 FEISHU_WIKI_NODE_TOKEN");
  }

  if (missing.length) {
    return { ok: false as const, missing };
  }

  return {
    ok: true as const,
    appId: process.env.FEISHU_APP_ID!,
    appSecret: process.env.FEISHU_APP_SECRET!,
    appToken: process.env.FEISHU_BITABLE_APP_TOKEN,
    wikiNodeToken: process.env.FEISHU_WIKI_NODE_TOKEN,
    tableId: process.env.FEISHU_BITABLE_TABLE_ID!,
  };
}

export function getFieldNames() {
  return {
    orderId: process.env.FEISHU_FIELD_ORDER_ID ?? "订单号",
    createdAt: process.env.FEISHU_FIELD_CREATED_AT ?? "提交时间",
    customerName: process.env.FEISHU_FIELD_CUSTOMER_NAME ?? "用户姓名",
    contact: process.env.FEISHU_FIELD_CONTACT ?? "联系方式",
    items: process.env.FEISHU_FIELD_ITEMS ?? "商品明细",
    total: process.env.FEISHU_FIELD_TOTAL ?? "总金额",
    screenshot: process.env.FEISHU_FIELD_SCREENSHOT ?? "付款截图",
    status: process.env.FEISHU_FIELD_STATUS ?? "订单状态",
    note: process.env.FEISHU_FIELD_NOTE ?? "备注",
  };
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<T & { code?: number; msg?: string }> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { code?: number; msg?: string };

  if (!response.ok || data.code !== 0) {
    throw new Error(formatFeishuError(data.msg, response.status));
  }

  return data;
}

function formatFeishuError(message?: string, status?: number) {
  if (!message) {
    return `飞书接口请求失败：${status}`;
  }

  if (
    message.includes("node permission denied") ||
    message.includes("tenant needs read permission")
  ) {
    return "应用没有这篇 wiki/多维表格的读取权限：请在飞书文档右上角分享/权限设置里，把“支付app”应用添加为协作者，并给可编辑权限。";
  }

  if (message.includes("Access denied") && message.includes("scope")) {
    return `应用 API 权限不足：${message}`;
  }

  return message;
}

async function getTenantAccessToken(appId: string, appSecret: string) {
  const data = await requestJson<{ tenant_access_token: string }>(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    },
  );

  return data.tenant_access_token;
}

async function resolveBitableAppToken(
  token: string,
  appToken?: string,
  wikiNodeToken?: string,
) {
  if (appToken) {
    return {
      appToken,
      message: "使用 FEISHU_BITABLE_APP_TOKEN",
    };
  }

  if (!wikiNodeToken) {
    throw new Error("缺少 FEISHU_BITABLE_APP_TOKEN 或 FEISHU_WIKI_NODE_TOKEN");
  }

  const data = await requestJson<{
    data?: { node?: { obj_token?: string; obj_type?: string } };
  }>(
    `https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${wikiNodeToken}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
  const resolvedAppToken = data.data?.node?.obj_token;

  if (!resolvedAppToken) {
    throw new Error("未能从 wiki 节点解析出多维表格 app_token");
  }

  return {
    appToken: resolvedAppToken,
    message: `已从 FEISHU_WIKI_NODE_TOKEN 解析 app_token（类型：${
      data.data?.node?.obj_type ?? "unknown"
    }）`,
  };
}

function getFieldByName(fields: FeishuField[], fieldName: string) {
  return fields.find((field) => field.field_name === fieldName);
}

function shouldSkipWrite(field?: FeishuField) {
  return (
    field?.ui_type === "AutoNumber" ||
    field?.ui_type === "Phone"
  );
}

function getStatusLabel(status: DemoOrder["status"]) {
  return {
    pending: "待付款",
    paid: "已完成",
    rejected: "已取消",
  }[status];
}

function buildOrderFields(
  order: DemoOrder,
  feishuFields: FeishuField[],
  attachmentFileToken?: string,
) {
  const fields = getFieldNames();
  const screenshotField = getFieldByName(feishuFields, fields.screenshot);
  const noteParts = [
    `订单号：${order.id}`,
    `联系方式：${order.contact}`,
    order.note,
    attachmentFileToken ? "" : `付款截图：${order.screenshotUrl}`,
  ].filter(Boolean);

  const values: Record<string, string | number | Array<{ file_token: string }>> = {
    [fields.createdAt]: new Date(order.createdAt).getTime(),
    [fields.customerName]: order.customerName,
    [fields.items]: order.items
      .map((item) => `${item.name} x ${item.quantity}`)
      .join("\n"),
    [fields.total]: order.total,
    [fields.status]: getStatusLabel(order.status),
    [fields.note]: noteParts.join("\n"),
  };

  if (!shouldSkipWrite(getFieldByName(feishuFields, fields.orderId))) {
    values[fields.orderId] = order.id;
  }

  if (screenshotField?.ui_type === "Attachment" && attachmentFileToken) {
    values[fields.screenshot] = [{ file_token: attachmentFileToken }];
  } else if (
    screenshotField?.ui_type !== "Attachment" &&
    !shouldSkipWrite(screenshotField)
  ) {
    values[fields.screenshot] = order.screenshotUrl;
  }

  if (!shouldSkipWrite(getFieldByName(feishuFields, fields.contact))) {
    values[fields.contact] = order.contact;
  }

  return values;
}

function getExpectedFieldNames() {
  return Object.values(getFieldNames());
}

async function listFeishuFields(
  token: string,
  appToken: string,
  tableId: string,
) {
  const data = await requestJson<{
    data?: { items?: FeishuField[] };
  }>(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );

  return data.data?.items ?? [];
}

async function uploadFeishuAttachment(
  token: string,
  appToken: string,
  attachment: FeishuAttachment,
) {
  const formData = new FormData();
  formData.append("file_name", attachment.fileName);
  formData.append("parent_type", "bitable_image");
  formData.append("parent_node", appToken);
  formData.append("size", String(attachment.bytes.length));
  formData.append(
    "file",
    new Blob([new Uint8Array(attachment.bytes)], { type: attachment.mimeType }),
    attachment.fileName,
  );

  const data = await requestJson<{ data?: { file_token?: string } }>(
    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  );

  if (!data.data?.file_token) {
    throw new Error("飞书附件上传成功但没有返回 file_token");
  }

  return data.data.file_token;
}

export async function checkFeishuConnection(): Promise<FeishuCheckResult> {
  const expectedFields = getExpectedFieldNames();
  const steps: FeishuCheckResult["steps"] = [];
  const config = getFeishuConfig();

  if (!config.ok) {
    return {
      configured: false,
      missingEnv: config.missing,
      expectedFields,
      fields: [],
      missingFields: expectedFields,
      steps: [
        {
          name: "读取环境变量",
          ok: false,
          message: `缺少：${config.missing.join(", ")}`,
        },
      ],
    };
  }

  steps.push({
    name: "读取环境变量",
    ok: true,
    message: "飞书必填环境变量已配置",
  });

  try {
    const token = await getTenantAccessToken(config.appId, config.appSecret);
    steps.push({
      name: "获取 tenant_access_token",
      ok: true,
      message: "应用凭证有效",
    });

    const resolved = await resolveBitableAppToken(
      token,
      config.appToken,
      config.wikiNodeToken,
    );
    steps.push({
      name: "解析多维表格 app_token",
      ok: true,
      message: resolved.message,
    });

    const fields = await listFeishuFields(token, resolved.appToken, config.tableId);
    const fieldNames = new Set(fields.map((field) => field.field_name));
    const missingFields = expectedFields.filter((field) => !fieldNames.has(field));

    steps.push({
      name: "读取多维表格字段",
      ok: true,
      message: `读取到 ${fields.length} 个字段`,
    });

    steps.push({
      name: "校验字段名",
      ok: missingFields.length === 0,
      message: missingFields.length
        ? `缺少字段：${missingFields.join(", ")}`
        : "字段名完整",
    });

    return {
      configured: true,
      missingEnv: [],
      expectedFields,
      fields,
      missingFields,
      steps,
    };
  } catch (error) {
    steps.push({
      name: "飞书接口请求",
      ok: false,
      message: error instanceof Error ? error.message : "飞书接口请求失败",
    });

    return {
      configured: true,
      missingEnv: [],
      expectedFields,
      fields: [],
      missingFields: expectedFields,
      steps,
    };
  }
}

export async function createFeishuTestRecord() {
  const testImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
  const order: DemoOrder = {
    id: `TEST-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString(),
    customerName: "飞书联调测试",
    contact: "test-contact",
    note: "这是一条由后台飞书联调页写入的测试记录，可以手动删除。",
    items: [
      {
        id: "test",
        name: "测试商品",
        price: 1,
        quantity: 1,
      },
    ],
    total: 1,
    screenshotName: "test.txt",
    screenshotUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    status: "pending",
  };

  return createFeishuOrderRecord(order, {
    bytes: testImage,
    fileName: "feishu-test-payment.png",
    mimeType: "image/png",
  });
}

export async function createFeishuOrderRecord(
  order: DemoOrder,
  attachment?: FeishuAttachment,
): Promise<FeishuSyncResult> {
  const config = getFeishuConfig();
  if (!config.ok) {
    return {
      status: "skipped",
      message: `未配置飞书环境变量：${config.missing.join(", ")}`,
    };
  }

  try {
    const token = await getTenantAccessToken(config.appId, config.appSecret);
    const resolved = await resolveBitableAppToken(
      token,
      config.appToken,
      config.wikiNodeToken,
    );
    const fields = await listFeishuFields(token, resolved.appToken, config.tableId);
    const attachmentFileToken = attachment
      ? await uploadFeishuAttachment(token, resolved.appToken, attachment)
      : undefined;
    const data = await requestJson<{ data?: { record?: { record_id: string } } }>(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${resolved.appToken}/tables/${config.tableId}/records`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          fields: buildOrderFields(order, fields, attachmentFileToken),
        }),
      },
    );

    return {
      status: "synced",
      message: "已同步到飞书多维表格",
      recordId: data.data?.record?.record_id,
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "飞书同步失败",
    };
  }
}

export async function updateFeishuOrderRecord(
  order: DemoOrder,
): Promise<FeishuSyncResult> {
  if (!order.feishuRecordId) {
    return createFeishuOrderRecord(order);
  }

  const config = getFeishuConfig();
  if (!config.ok) {
    return {
      status: "skipped",
      message: `未配置飞书环境变量：${config.missing.join(", ")}`,
    };
  }

  try {
    const token = await getTenantAccessToken(config.appId, config.appSecret);
    const resolved = await resolveBitableAppToken(
      token,
      config.appToken,
      config.wikiNodeToken,
    );
    const fields = await listFeishuFields(token, resolved.appToken, config.tableId);
    await requestJson(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${resolved.appToken}/tables/${config.tableId}/records/${order.feishuRecordId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ fields: buildOrderFields(order, fields) }),
      },
    );

    return {
      status: "synced",
      message: "已更新飞书多维表格记录",
      recordId: order.feishuRecordId,
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "飞书更新失败",
    };
  }
}
