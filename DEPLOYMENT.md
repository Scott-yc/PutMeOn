# 免费测试版部署

当前已跑通本机前后端，尚未创建云账号、连接 Neon 或发送真实邮件。Docker 配置和 PostgreSQL 迁移已生成；本机 Docker 引擎未运行，容器构建及真实 PostgreSQL 联调尚未验证。

## 服务选择与费用边界

- API 和前端：Render 免费 Docker Web Service，根目录 `render.yaml` 是待部署配置。免费实例闲置 15 分钟休眠，唤醒可能约一分钟；官方不建议用于生产。只适合允许冷启动的小规模测试，无法保证持续可用。[官方说明](https://render.com/docs/free)
- 数据库：Neon PostgreSQL Free，额度内免费，须在创建时核对存储、计算和流量配额。不要把 SQLite 放到 Render 临时文件系统，也不要把会到期的 Render 免费 PostgreSQL 当长期数据库。[Neon 额度](https://neon.com/pricing)
- 邮件：优先使用 Brevo 免费事务邮件，每日 300 封（与其他发信共享额度）。验证发信邮箱并取得事务邮件开通许可后使用 HTTP API；免费邮箱无法认证自有域名，Brevo 可能替换发信域名，是否获准发送及实际收件需要账号内验证，不能保证无需审核。自有域名仍适合后续正式运营。备选 Resend 支持保留，需自有域名。[Brevo 额度](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)、[域名处理](https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability)

目标按 300–500 个注册用户、低并发设计。上线后根据错误率、延迟、邮件额度和数据库用量判断是否升级；免费方案不能承诺无限用户或企业级 SLA。不要开启自动付费升级。

## 配置

通过平台私密环境变量设置，密钥不写源码或聊天：

| 变量 | 值 |
| --- | --- |
| ASPNETCORE_ENVIRONMENT | Production |
| Database__Provider | Postgres |
| ConnectionStrings__Database | Npgsql 格式：Host=…;Database=…;Username=…;Password=…;SSL Mode=VerifyFull |
| Auth__CodeSecret | 安全随机生成，至少 32 字符 |
| Email__Mode | Brevo（也支持 Resend） |
| Email__ApiKey | Brevo HTTP API key，不能填 SMTP key |
| Email__From | Brevo 已验证的发信邮箱，纯邮箱地址 |
| Proxy__KnownProxies__0 | 可信反向代理 IP；按真实平台网络配置，多项递增编号 |

同域部署前端与 API，使用 HTTPS。生产 Cookie 为 Secure、HttpOnly、SameSite=Strict。未启用跨域 CORS。必须在真实平台验证转发头和来源 IP：没有正确的可信代理配置时，多个用户可能共用同一个 IP 限流桶；不要通过信任任意来源转发头来绕过。

## 初始化和发布顺序

1. 创建 Neon 免费数据库和 Brevo 免费账号，验证发信邮箱并开通事务邮件，在私密环境中设置上表变量。
2. 从项目根目录执行 `.tools/dotnet/dotnet.exe run --project backend/PutMeOn.Api -- --migrate`，使用目标 PostgreSQL 连接执行迁移。它执行完会退出。生产启动不会自动改表；后续升级先备份，再显式迁移。
3. 将源码保存到自己的 Git 仓库，Render 使用根目录 Dockerfile 构建；容器同时提供静态前端和 API。`render.yaml` 不会自动执行第 2 步迁移。
4. 验证 `/api/health`、真实邮件登录、跨账号发帖报名、联系方式权限、刷新登录状态、过期清理、分页、冷启动和可信代理限流。健康接口仅证明进程存活，不能替代数据库检查。
5. 配置数据库备份与恢复办法、服务异常及邮件配额监控，再邀请少量用户。逐步扩大到目标人数。

限流目前为单实例内存 IP 限流，验证码邮箱限流和会话在数据库中。需要多实例扩容时再引入共享限流。当前没有 CI 云平台配置；仓库接好后应执行 `scripts/check.ps1` 和数据库/HTTP 集成检查。
