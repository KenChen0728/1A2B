# 測試工具

不用連 Firebase 就能在本機模擬多人連線（`fake/` 是假的 Firebase，資料放在 `server.js` 的記憶體裡）。

```bash
node tools/server.js          # 開本機伺服器（http://localhost:8123/1A2B/），放著不要關
node tools/test-flows.js      # 單人存檔、多人流程、有人離開、誤觸保護
node tools/test-install.js    # 離線開啟、安裝、LINE 內建瀏覽器、邀請連結、選字 Enter
node tools/test-slow-net.js   # Firebase 很慢時畫面要先出來
node tools/test-sizes.js      # 各種裝置尺寸有沒有超出畫面
node tools/test-stress.js     # 8 個人、超長名字、猜很多次
node tools/make-help.js       # 重新截說明用的真實畫面（畫面改版後跑）
node tools/make-icons.js      # 重新產生全部圖示（不用開伺服器）
```

需要 Node 和 Playwright。截圖放在 `tools/shots/`，不用上傳（已列在 `.gitignore`）。
