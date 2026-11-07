# 測試工具

不用連 Firebase 就能在本機模擬多人連線（`fake/` 是假的 Firebase，資料放在 `server.js` 的記憶體裡）。

```bash
node tools/server.js          # 開本機伺服器（http://localhost:8123/1A2B/），放著不要關
node tools/test-flows.js      # 單人存檔、多人流程、有人離開、誤觸保護
node tools/test-install.js    # 離線開啟、安裝、LINE 內建瀏覽器、邀請連結、選字 Enter
node tools/test-slow-net.js   # Firebase 很慢時畫面要先出來
node tools/test-sizes.js      # 各種裝置尺寸有沒有超出畫面
node tools/test-stress.js     # 8 個人、超長名字、猜很多次
node tools/test-rooms.js     # 放一天沒動靜的房間自動收掉、首頁改名字
node tools/test-bench.js     # 不等他、場邊看不到答案、回來；戰況抽屜跳出和冷卻
node tools/test-replay.js    # 復盤：每手都有建議、建議符合前面所有線索
node tools/test-start.js     # 開場：VS 進度條、多人等連線（好了才上色）、合作延後開始
node tools/test-fit.js all   # 各種手機尺寸每個畫面要不要滑（FIT=1 時超出算失敗）
node tools/test-join.js      # 換瀏覽器接回位子、合作中途排進輪流、輪到離線的人到場邊、觀眾維持觀眾、舊邀請連結
node tools/test-watch.js     # 大廳改觀戰、重新整理還是觀眾
node tools/test-angel.js     # 小天使：合作全隊共用
node tools/test-music.js     # 背景音樂：曲子格式、音量不爆、觀眾預設開、玩家預設關、遊戲中換曲子、切到背景就停
node tools/make-help.js       # 重新截說明用的真實畫面（畫面改版後跑）
node tools/make-icons.js      # 重新產生全部圖示（不用開伺服器）
```

畫面改版後要重新產生說明截圖：先跑 `node tools/make-help.js`，再跑 `python3 tools/help-webp.py`。

需要 Node 和 Playwright。截圖放在 `tools/shots/`，不用上傳（已列在 `.gitignore`）。
