# Coconut — SSH + SFTP 运维工具

## 项目概述

集 SSH 终端、SFTP 文件管理、服务器资源监控、AI 智能助手于一体的单机 Web 工具。

## 技术栈

| 层       | 技术                                       |
| -------- | ------------------------------------------ |
| 后端     | ASP.NET Core 10 (Controller-based Web API) |
| 实时通信 | SignalR (终端/监控推送)                    |
| AI 流式  | SSE (Server-Sent Events)                   |
| 数据库   | SQLite + EF Core                           |
| SSH/SFTP | SSH.NET (Renci.SshNet)                     |
| 前端     | React 19 + TypeScript + Tailwind CSS v4    |
| 终端     | xterm.js                                   |
| 构建     | Vite (前端) / `dotnet build` (后端)        |

## 项目结构

```
Coconut.slnx         # .NET 解决方案
frontend/            # 前端项目
src/                 # 后端 + 前端源代码
  Coconut.Api/       # ASP.NET Core Web API 项目
tests/               # 测试
docs/PRD.md          # 产品需求文档（完整需求、数据模型、UI 布局见此处）
design/prototype.html # 前端 HTML+Tailwind 原型（含完整交互逻辑）
AGENTS.md            # 本文件
```

## 架构要点

- **通信模型**: SignalR 推终端和监控数据，SSE 推 AI 流式响应，REST 处理 CRUD
- **单机工具**: 无需用户认证，开箱即用
- **加密**: SSH 密码和 AI API Key 均用 DPAPI 加密存储
- **页面路由**: 工作台 (`workspace`) / 设置 (`settings`)，通过 `switchPage()` 切换
- **面板布局**: 三栏 — 监控面板(顶) + 终端(中) + AI Chat/SFTP(底)，均支持收缩，底部可拖拽调整高度
- **终端多会话**: 同一连接支持多个终端 Tab，可动态增删

## 数据模型 (4 实体)

- `SshConnection` — 连接配置
- `AiProvider` — AI 服务商
- `AiChatSession` / `AiChatMessage` — 会话与消息
- `Settings` — 应用设置

详细字段见 [docs/PRD.md](docs/PRD.md#数据模型)。

## UI/UX 约定

- 深色模式，绿色主题色 (`coconut: #22c55e`)
- 界面中文本地化
- 字体: Inter (界面) / JetBrains Mono (终端)
- 操作反馈: hover 过渡 `transition-colors` / `hover:bg-gray-800`
- 所有表单/弹窗使用 `backdrop-blur-sm bg-black/60`
- 开关使用 `sr-only peer` + Tailwind peer 样式

## 开发命令

```bash
# 后端
dotnet restore
dotnet build
dotnet run --project src/Coconut.Api

# 数据库迁移
dotnet ef migrations add <名称> --project src/Coconut.Api
dotnet ef database update --project src/Coconut.Api

# 前端
cd frontend
npm install
npm run dev    # 开发
npm run build  # 构建输出到 wwwroot
```

## 参考文档

- [产品需求文档](docs/PRD.md) — 完整的功能需求、数据模型、UI 布局
- [UI 原型](design/prototype.html) — 可直接在浏览器中打开的交互原型
