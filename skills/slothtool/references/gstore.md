# gstore：Git 同步设置与数据

使用隔离的 Git 仓库缓存，不将用户项目仓库改造成数据仓库。依赖本地 `git`、`gh` 及用户已完成的认证；不读取、展示或存储登录凭据。

## 先明确同步范围

```sh
slothtool gstore doctor --json
slothtool gstore repo status --json
slothtool gstore list --json
slothtool gstore status --json
slothtool gstore conflicts --json
slothtool gstore status mytool default --json
slothtool gstore conflicts mytool default --json
```

不带 `<tool> <name>` 的 status/pull/push/sync/conflicts 面向系统设置、插件配置及数据；带二者时只处理对应绑定，不能将一个目录请求扩大为系统同步。`status`/`conflicts` 可能刷新远端并更新本地缓存，不是完全无副作用的离线读取；网络访问仍需遵循环境权限。

`doctor` 可诊断工具与认证状态。缺依赖/未认证时告知用户；`slothtool gstore auth` 可能安装 gh 并触发登录交互，不能作为静默探测，不由代理自动执行。由用户在独立终端自行完成认证后继续。

## 明确授权后执行修改

```sh
slothtool gstore repo set OWNER/REPO
slothtool gstore repo set OWNER/REPO --create
slothtool gstore bind mytool default ./data-to-sync
slothtool gstore pull mytool default
slothtool gstore push mytool default -m 'sync requested data'
slothtool gstore sync mytool default -m 'sync requested data'
slothtool gstore unbind mytool default
```

替换示例仓库与绑定为用户指定值。`repo set` 修改配置；`--create` 会创建 GitHub 私有仓库。push 上传，pull 写入本地并可能传播删除，sync 同时涉及两侧。先说明仓库、数据范围、上传内容和可能覆盖/删除的影响，确认用户授权；私有仓库不是上传秘密的许可。不要扫描凭据文件内容来“排查同步”。

冲突、远端变化或推送拒绝时停止并报告，不擅自 force push、重置仓库、清除缓存或重试覆盖。只有用户明确选择后，pull 才用 `--prefer-remote`，push 才用 `--prefer-local`，sync 可二选一；二者互斥。不得把冲突策略作为默认参数。需要系统级同步时才省略绑定参数。

源码核对位置：`plugins/gstore/bin/gstore.js`、`plugins/gstore/lib/service.js`；CLI 与服务的状态检测、冲突保护和操作范围以当前安装版本为准。
