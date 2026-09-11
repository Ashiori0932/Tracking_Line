# 十线赛况记录仪


一个无需后端与第三方依赖的全屏赛事积分可视化页面。图表以十支队伍为样本，连续更新积分，并在比赛推进后平滑滚动横轴、对称缩放纵轴。

## 本地预览

```bash
python3 -m http.server 8000
```

打开 <http://localhost:8000>。

## 部署


推送到 `main` 分支后，GitHub Actions 会自动启用并将仓库内容部署至 GitHub Pages。也可以在 Actions 页面手动运行 **Deploy static site to Pages** 工作流。
