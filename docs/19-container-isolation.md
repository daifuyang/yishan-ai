# 19. 容器隔离 (Container Isolation)

## 概述

Yishan AI 的 bash 命令执行在 Docker 容器内进行，实现宿主机与 AI 操作环境的完全隔离。

## 为什么需要容器隔离

| 风险场景 | 无隔离时的后果 | 有隔离时的结果 |
|----------|---------------|---------------|
| AI 执行 `rm -rf /` | 系统文件被删除 | 容器根文件系统只读，操作被阻止 |
| AI 执行 `dd if=/dev/zero of=/dev/sda` | 磁盘数据被覆写 | Permission denied |
| AI 执行 `mount --bind / /tmp` | 突破目录限制 | Operation not permitted |
| 误操作暴露环境变量 | 宿主机敏感信息泄露 | 容器内无宿主机 env |

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     宿主机 (Host)                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Yishan AI Backend                       │   │
│  │   ┌──────────────┐    ┌─────────────────────────┐   │   │
│  │   │ MCP Manager  │───▶│  Docker Run (exec)     │   │   │
│  │   │ (bash tool)  │    └──────────┬──────────────┘   │   │
│  │   └──────────────┘               │                   │   │
│  └──────────────────────────────────┼───────────────────┘   │
│                                      │                       │
│                                      ▼                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Docker Container (isolated)             │   │
│  │                                                      │   │
│  │   Root FS: Read-only                                │   │
│  │   Capabilities: ALL DROPPED                         │   │
│  │   Syscalls: seccomp whitelist                       │   │
│  │   Memory: 512MB limit                               │   │
│  │   PID limit: 64                                    │   │
│  │                                                      │   │
│  │   /workspace ← 宿主机 workspace 挂载                │   │
│  │   ~ ← /workspace                                    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ~/.yishan-ai/config.json  ← 安全目录配置 (动态读取)        │
└─────────────────────────────────────────────────────────────┘
```

## 安全特性

### 多层防护

| 层级 | 防护措施 | 说明 |
|------|----------|------|
| 文件系统 | `--read-only` | 根文件系统只读，无法修改系统文件 |
| Capability | `--cap-drop ALL` | 丢弃所有 Linux capabilities |
| Seccomp | 白名单策略 | 阻止 `mount`, `ptrace`, `kexec_load` 等危险 syscall |
| 资源限制 | `--memory=512m --pids-limit=64` | 防止资源耗尽攻击 |
| 用户映射 | `--user $(id -u):$(id -g)` | 容器内以普通用户运行 |

### Seccomp 白名单

允许的基础 syscall：read, write, openat, close, mmap, munmap, brk, rt_sigreturn, execve, fork, clone, wait4, socket, connect, bind, listen, accept, getdents, stat, fstat, etc.

阻止的危险 syscall：

| Syscall | 原因 |
|---------|------|
| `mount` | 防止挂载新文件系统 |
| `umount` | 防止卸载现有文件系统 |
| `ptrace` | 防止进程调试/注入 |
| `kexec_load` | 防止替换内核 |
| `init_module` | 防止加载内核模块 |
| `delete_module` | 防止卸载内核模块 |
| `reboot` | 防止系统重启 |

## 文件结构

```
~/.yishan-ai/
├── config.json          # 工作目录配置 (workspace.directories)
├── isolated/
│   ├── Dockerfile       # 隔离镜像定义
│   ├── entrypoint.sh   # 容器启动脚本
│   └── seccomp.json    # seccomp 白名单策略
└── ...
```

## 配置说明

### 工作目录配置

```json
{
  "workspace": {
    "directories": [
      "/home/dfy/yishan-workspace"
    ]
  }
}
```

- AI 的所有文件操作限制在 `directories` 列表中的目录
- 支持多目录配置
- 目录路径支持 `~` 简写

### 容器内路径映射

| 宿主机路径 | 容器内路径 | 说明 |
|-----------|-----------|------|
| `/home/dfy/yishan-workspace` | `/workspace` | 第一个目录挂载到 `/workspace` |
| `/home/dfy/other-workspace` | `/workspace/other-workspace` | 后续目录挂载到子目录 |
| `~` | `/workspace` | HOME 环境变量指向 `/workspace` |

## 使用限制

### 可用操作

```bash
ls ~/                    # 查看 workspace 内容
cd ~/project             # 进入 workspace 子目录
cat file.txt             # 读取文件
echo "text" > file.txt   # 写入文件
git status               # git 操作
npm run build             # 构建操作
```

### 被阻止的操作

```bash
rm -rf /                 # rm 自带保护拦截
rm -rf /bin              # Read-only file system
dd of=/dev/sda           # Permission denied
mount --bind / /tmp      # Operation not permitted
chmod 777 /              # Read-only file system
reboot                   # Operation not permitted
```

## 系统提示词

容器限制已在 AI 系统提示词中说明：

```
【路径与权限】
- 路径中的 ~ 会展开为用户主目录
- 所有文件操作限制在 workspace 范围内，超出范围会被拒绝
- bash 命令在 Docker 容器内执行，根文件系统为只读（Read-only）
- 危险操作会被阻止：
  - rm -rf /：rm 自带保护拦截
  - rm -rf /bin /lib /usr：Read-only file system
  - dd of=/dev/sdX：Permission denied
  - mount/chmod/chown 等系统级操作：Operation not permitted
- 建议涉及系统级操作时明确告知用户会被限制
```

## 手动测试

### 使用 ns wrapper (仅用于手动测试)

```bash
# 交互式隔离 shell
ns

# 单条命令
ns ls ~/workspace

# 只读模式
ns --ro cat file.txt
```

### 绕过容器 (不推荐)

```bash
ns --native bash    # 绕过容器，直接在宿主机执行
```

## 重建镜像

如需更新隔离镜像：

```bash
docker build -t isolated:latest ~/.yishan-ai/isolated/
```

镜像会自动在首次使用时构建，无需手动操作。

## 故障排查

### 问题：bash tool 报错 "Directory does not exist"

**原因**：`~` 在容器内展开为 `/workspace`，不是宿主机 home 目录。

**解决**：
- 使用 `ls ~` 或 `ls /workspace` 查看 workspace
- 如果需要指定子目录，用 `ls ~/subdir`

### 问题：命令包含引号时执行失败

**原因**：命令通过 base64 编码传递。

**解决**：系统会自动处理引号，无需特殊操作。

### 问题：需要访问非 workspace 目录

**解决**：在 `config.json` 的 `workspace.directories` 中添加该目录。

## 相关文件

| 文件 | 说明 |
|------|------|
| `packages/backend/src/lib/mcp-manager.ts` | bash tool handler，Docker 执行逻辑 |
| `packages/backend/src/lib/fs-provider.ts` | 文件系统工具，路径验证 |
| `packages/backend/src/routes/chat.ts` | 系统提示词生成 |
| `~/.yishan-ai/isolated/Dockerfile` | 隔离镜像定义 |
| `~/.yishan-ai/isolated/seccomp.json` | seccomp 白名单 |