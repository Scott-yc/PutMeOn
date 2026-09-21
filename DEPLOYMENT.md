# 免费测试版部署

项目已经部署到 Render，使用 Neon 和 Brevo。本地测试与线上验证分开记录；不能用本地构建成功代替生产验收。

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
2. 从项目根目录执行 `.tools/dotnet/dotnet.exe run --project backend/PutMeOn.Api -- --migrate`，使用目标 PostgreSQL 连接执行迁移。它执行完会退出。当前单实例部署在启动时执行 EF Core 待应用迁移，成功后才接收请求；也可继续显式执行 --migrate。后续包含删改字段的迁移须先备份并审查。
3. 将源码保存到自己的 Git 仓库，Render 使用根目录 Dockerfile 构建；容器同时提供静态前端和 API。启动会自动应用尚未执行的迁移。
4. 验证 `/api/health`、真实邮件登录、跨账号发帖报名、联系方式权限、刷新登录状态、过期清理、分页、冷启动和可信代理限流。健康接口仅证明进程存活，不能替代数据库检查。
5. 配置数据库备份与恢复办法、服务异常及邮件配额监控，再邀请少量用户。逐步扩大到目标人数。

限流目前为单实例内存 IP 限流，验证码邮箱限流和会话在数据库中。需要多实例扩容时再引入共享限流。仓库提供 `.github/workflows/check.yml`：前端检查、浏览器回归和隔离 PostgreSQL 集成测试。首次推送后须确认 Actions 实际通过。

## 申请未读提醒

Applications.Viewed 保存已读状态；升级只增加非空布尔字段（默认 false），已有申请首次显示为未读。仅帖子所有者可确认其已展示的 applicant IDs；并发新申请不会被一起清除。导航计数独立于筛选和分页，仅计有效帖子。页面切换、恢复前台和前台每 60 秒刷新；不是实时推送。

## 发布质量门禁（2026-09-22）

- 本地执行 scripts/check.ps1；前端另执行 npm run test:browser（首次需 npx playwright install chromium）。
- CI 使用独立本机 PostgreSQL putmeon_checks 数据库，禁止使用 Neon 生产连接。测试覆盖迁移重跑、并发申请、重复申请、旧版本编辑拒绝及已读记录。
- Render Blueprint 已声明 autoDeployTrigger: checksPass。当前服务如果是手动创建的，修改 YAML 不会自动改变它：须在 Render 将 Auto-Deploy 改为 After CI Checks Pass；GitHub main 应要求 Quality checks / verify 通过才能合并。
- /api/health 是进程存活，/api/ready 检查数据库表可查询。不要高频外部轮询 /api/ready，以免阻止免费数据库休眠。
- 线上代理配置尚待实际核验：分别用两种网络登录并检查限流日志，按平台可信代理地址配置 Proxy__KnownProxies__0，不得信任任意 X-Forwarded-For。
- 本次修复无数据库结构变更。未来结构升级先备份，审查迁移脚本并在测试数据库执行；先添加兼容字段再迁移数据，最后独立发布删除旧字段。恢复时使用已验证的备份，不直接回滚破坏性迁移。
