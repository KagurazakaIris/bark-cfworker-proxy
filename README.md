# Bark Cloudflare Worker Proxy

这是一个部署在 Cloudflare Workers 上的轻量级反向代理，主要用于增强 Bark 推送服务的隐私性。

## 功能特点

- **隐私保护**：在转发请求前，自动剥离 `X-Forwarded-For`、`CF-Connecting-IP`、`X-Real-IP` 等可能泄露客户端真实 IP 的头部信息。上游服务器（Bark 服务端）只能看到 Cloudflare 的出口 IP。
- **通用转发**：基于环境变量 `UPSTREAM_BASE` 转发所有请求，保留路径、查询参数、请求体和 HTTP 方法。
- **根路径重定向**：访问根路径 `/` 时自动跳转到本 GitHub 仓库。
- **安全头**：添加 `No-Store` 等安全响应头。

## 部署配置

### 1. 环境变量

需要在 Cloudflare Worker 的设置中添加以下环境变量：

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `UPSTREAM_BASE` | `https://api.day.app` | Bark 的官方 API 地址或你自建的 Bark 服务端地址 |

### 2. 本地开发与部署

使用 Wrangler CLI 进行开发和部署。

**安装依赖:**
```bash
npm install
```

**本地测试:**
```bash
npx wrangler dev
```

**发布到 Cloudflare:**
```bash
npx wrangler deploy
```

## `wrangler.toml` 配置示例

```toml
name = "bark-cfworker-proxy"
main = "server.js"
compatibility_date = "2026-01-31"

[vars]
UPSTREAM_BASE = "https://api.day.app"
```

## 隐私说明

本项目作为“哑管道”运行，不记录日志，不检查请求内容，仅负责去除特定的追踪头部并转发请求。

## License

MIT
