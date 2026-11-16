# 更新检测 · 真实链路人工验证

> 用「真实 registry + 低版本包」跑完整更新流程，不伪造任何检测结果。
> 适用：修改 `UpdateButton` / 更新调度 / `/update` 路由后的人工回归。

## 一、为什么这样做

E2E 里把 `TOKEN_DASH_CURRENT_VERSION` 压到 `2.1.0`，对 npm 上真实存在的 `2.2.0` 判定「可更新」，
检测源、版本比较、安装 spec 全部是生产代码。人工验证再进一步：**真的装一个低版本包**，
连「安装后的包版本」也是真实的。

## 二、准备

已生成低版本包：`build/dsh-token-dash-2.1.0.tgz`（源码与当前一致，仅 `package.json.version` 为 `2.1.0`）。

重新生成（源码改动后需要重做，否则验证的不是最新代码）：

```powershell
# 复制源码到临时目录，改版本号后打包
$src = 'D:\MyProjects\dsh-tokenDash'; $tmp = Join-Path $env:TEMP 'td-lowver'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item (Join-Path $src 'index.js'),(Join-Path $src 'client.js'),(Join-Path $src 'cordis.patch.yml'),(Join-Path $src 'README.md'),(Join-Path $src 'LICENSE') $tmp
Copy-Item (Join-Path $src 'src') -Destination $tmp -Recurse
Copy-Item (Join-Path $src 'locale') -Destination $tmp -Recurse
$pkg = Get-Content (Join-Path $src 'package.json') -Raw | ConvertFrom-Json
$pkg.version = '2.1.0'
$pkg.files = @('index.js','client.js','src','locale','cordis.patch.yml','README.md','LICENSE')
$pkg | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $tmp 'package.json') -Encoding utf8
Push-Location $tmp; npm pack --pack-destination "$src\build"; Pop-Location
```

## 三、验证步骤

### 1. 装低版本包

```powershell
$cli = 'C:\Users\Admin\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $cli plugin --profile desktop remove dsh-token-dash
& $cli plugin --profile desktop add 'D:\MyProjects\dsh-tokenDash\build\dsh-token-dash-2.1.0.tgz'
```

### 2. 重启 DSH，等 30 秒

启动检测无条件执行，30 秒后应自动请求 registry 并判定可更新。

**预期**：看板「版本」行右侧按钮变为 accent 色，文案「更新」，右侧常显 `2.2.0`。**无需点击**。

### 3. 确认条

点按钮 → 出现「发现 **2.2.0**」「立即更新」「取消」。

**预期**：点「取消」回到 `available` 态；不点取消则可继续第 4 步。

### 4. 真实安装（可选，会改本机插件）

点「立即更新」。

**预期**：提示「已更新到 2.2.0，重启 DSH 后生效」，安装完成后本机插件变成 npm 上的 `2.2.0`。

> ⚠️ 这一步会用 npm 上的正式版覆盖本地包。验证完要装回本地构建：
> `& $cli plugin --profile desktop add 'D:\MyProjects\dsh-tokenDash\build\dsh-token-dash-2.2.1-local.5.tgz'`

### 5. 失败可感知

断开网络（或关掉代理），回到看板点按钮。

**预期**：手动检测显示「检查失败」且按钮变为「重试」可点击；后台自动检测失败只显示「更新检查失败」并在 5 秒后消失，按钮外观不变。

### 6. 日志核对

```powershell
Get-Content "$env:USERPROFILE\.dsh\logs\dsh-token-dash\*.log" | Select-String -Pattern 'update' | Select-Object -Last 20
```

应能看到：

| event | 含义 |
|---|---|
| `armed` | 调度器已启动（带 `delay` 与 `lastAt`） |
| `startup.run` | 启动检测已执行 |
| `check.ok` | registry 请求成功（带 `current` / `latest` / `hasUpdate`） |
| `check.fail` | 请求失败（带 `errorKind` / `httpStatus`） |
| `visible.run` | 恢复可见时补检 |
| `install.ok` / `install.fail` | 安装结果 |

## 四、验证完收尾

```powershell
$cli = 'C:\Users\Admin\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $cli plugin --profile desktop remove dsh-token-dash
& $cli plugin --profile desktop add 'D:\MyProjects\dsh-tokenDash\build\dsh-token-dash-2.2.1-local.5.tgz'
```

## 五、自动化覆盖了什么

| 项 | 覆盖 |
|---|---|
| 真实 registry 判定（2.1.0 → 2.2.0） | E2E L2 |
| 5min 缓存生效 | E2E L2 |
| 版本比较（含 local ↔ 正式版） | L1 `isNewer`（复用生产实现） |
| 启动无条件检测 | E2E L3 |
| `available` / `confirm` / `error` 态渲染与尺寸 | E2E L3 |
| 自动失败可见且按钮不变红 | E2E L3 |
| 安装链路 | **不覆盖**，只能人工（会改本机插件） |
