# 论文投稿进度追踪器 · Manuscript Desk

[打开在线工具](https://niu866.github.io/paper-status-tracker/)

新增稿件后记录技术审查、编辑处理、外审、返修和录用等阶段变更。时间线与阶段用时根据录入日期计算，同一阶段重复进入的天数会累计。返修期限可导出为 .ics 全天日历事件，在日历应用中导入。

记录使用当前浏览器的本地存储。导出 JSON 可备份并跨浏览器迁移。导入会追加新稿件，同 ID 的已有记录优先。

本地开发使用 python -m http.server 8080，访问 http://localhost:8080/。
