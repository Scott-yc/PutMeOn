# PutMeOn

React 前端 + ASP.NET Core 10 API。默认已使用真实 HTTP API，本机 SQLite 持久化；生产 PostgreSQL 适配器与迁移已提供，云端尚未部署。

## 本机启动

日常试用优先从根目录执行 `./scripts/start-local.ps1`：构建后的前端与 API 由同一个后台进程提供，地址仍为 http://127.0.0.1:5173 ，数据库固定使用原 `backend/PutMeOn.Api/putmeon.db`。关闭启动终端不会主动结束后台应用；电脑关机后需再次运行。该模式仍是本机开发邮件，不发送真实邮件，也不是公网部署。更新代码后需停止旧的本地应用再重新执行脚本；进程号和日志保存在忽略提交的 `.local-app` 目录。不要与下方 Vite 开发方式同时启动。

需要 Node.js 22+ 和 .NET 10 SDK。本机已安装项目专用 SDK `.tools/dotnet`，不随源代码分发。

首次在 `frontend/putmeon-web` 执行 `npm ci`，然后从项目根目录执行：

```powershell
./scripts/start-dev.ps1
```

打开 http://127.0.0.1:5173 。API 使用 5080 端口。启动前停止已运行的同端口服务。开发模式使用随机六位验证码，在登录界面显示，不发送邮件。刷新后 Cookie 会话仍有效；数据在 `backend/PutMeOn.Api/putmeon.db`。旧 localStorage 演示数据不会自动导入。

`./scripts/start-dev.ps1 -Demo` 可单独运行旧前端演示，固定验证码 482913；该模式不能作为公开服务。

## 职责划分

- `frontend/putmeon-web/src/features/*/pages`：页面和交互。
- `frontend/putmeon-web/src/state`：异步操作、加载、错误和分页状态。
- `frontend/putmeon-web/src/data/api`：HTTP 客户端和传输类型。
- `backend/PutMeOn.Api/Endpoints`：路由、请求解析、认证入口。
- `backend/PutMeOn.Api/Application`：登录、帖子、联系方式授权和校验。
- `backend/PutMeOn.Api/Domain`：实体。
- `backend/PutMeOn.Api/Infrastructure`：EF Core、数据库迁移、邮件和清理任务。

权限以服务器为准。页面没有数据库访问权限。服务端列表每页 30 条，联系方式通过单独授权接口获取。前后端工种目录由一致性测试约束，更新 `shared/trades.json` 时同步前端 `domain/trades.ts`。

帖子发布时间由服务器生成，168 小时到期，编辑不延期。到期后 API 立即拒绝读取和操作；运行中的后台任务每 5 分钟物理删除帖子和关联报名。主机休眠期间清理延后至唤醒，不能承诺精确到秒物理删除。账号保留。

## 验证

登录验证码有效期为 5 分钟，使用一次即失效，60 秒后可重新发送，每个邮箱每小时最多 15 次。界面显示重发倒计时，服务端限制独立执行。登录 Cookie 为 HttpOnly、固定 30 天有效，生产 HTTPS 下启用 Secure；切换手机应用或刷新不会因验证码过期而退出。主动退出、会话满 30 天或浏览器清除 Cookie 后需重新登录。

```powershell
./scripts/check.ps1
# API 启动后再运行：
node backend/tests/api-smoke.mjs
```

后台完整应用模式下执行 smoke 时设置 `API_URL=http://127.0.0.1:5173`。`node backend/tests/persistence.mjs` 使用独立临时数据库和 5082 端口，验证两个账号发帖、退出、重启和重新登录，包含约 62 秒验证码冷却等待，不修改用户帖子。

API smoke 会创建虚构测试账号，不要指向正式服务。数据库边界检查使用独立内存数据库。

本次本机容量样本：500 个模拟账号、1000 条帖子，10 并发共 200 次列表请求，0 失败，P95 约 47ms。结果在 `backend/tests/capacity-result.json`。这是本机 SQLite 样本，不是免费云主机容量承诺，也不是 500 人同时在线的测试。

云端配置和未验证事项见 [DEPLOYMENT.md](DEPLOYMENT.md)。
