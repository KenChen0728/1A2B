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
node tools/test-music.js     # 聲音：音量不爆、觀眾預設開、玩家預設關、遊戲中換曲子、猜到 3A 熱血爆發、切到背景就停；音效只有丟的人和被丟的人聽得到、開關會記住、結算短曲只放一次
node tools/test-sound-lab.js # 試聽頁（tools/sound-lab.html）：第一版、第二到四版（tools/chip-audio.js）每首和每個音效離線算一次，沒有 NaN、不爆音、和現在（音效：和第三版）差不多大聲、回音殘響不會越積越大聲；手機喇叭模擬（500Hz、300Hz 高通）下大鐵盆手機版要聽得到
node tools/make-help.js       # 重新截說明用的真實畫面（畫面改版後跑）
node tools/make-icons.js      # 重新產生全部圖示（不用開伺服器）
```

音樂和音效的新版先放在試聽頁 `tools/sound-lab.html`（第二版以後的程式在 `tools/chip-audio.js`，可以單獨拿去用）（網址 https://kenchen0728.github.io/1A2B/tools/sound-lab.html ），不影響遊戲；使用者用手機聽過選好才搬進 index.html。曲子資料是從 index.html 的 SONGS 複製過去的，改曲子時兩邊要一起改。

畫面改版後要重新產生說明截圖：先跑 `node tools/make-help.js`，再跑 `python3 tools/help-webp.py`。

需要 Node 和 Playwright。截圖放在 `tools/shots/`，不用上傳（已列在 `.gitignore`）。
