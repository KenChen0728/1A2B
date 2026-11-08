/* =====================================================================
 * chip-audio.js ── 幾A幾B 第三版音樂、第三和第四版音效（試聽中，還沒放進遊戲）
 * 全部用 Web Audio API 當場合成，沒有任何音檔。
 *
 * 用法（手機瀏覽器規定：第一次一定要在「點擊／觸控」的事件裡呼叫才會出聲）：
 *   ChipAudio.playLobbyBGM();          大廳背景音樂（無限循環）
 *   ChipAudio.playBattleBGM();         戰鬥解謎背景音樂（無限循環）
 *   ChipAudio.setBattleIntensity(true) 熱血爆發：戰鬥旋律的低通濾波從 1500Hz 打開到 6000Hz、大聲一點（false 收回）
 *   ChipAudio.stopBGM();               停止背景音樂（0.05 秒內收乾淨，回音殘響也一起收，不會漏拍）
 *   音效：playSlipperSFX() 拖鞋打中、playIronPotSFX() 大鐵盆打中、playEvadeSFX() 閃掉、
 *         playShieldBlockSFX() 鍋蓋擋掉、playKnockoutSFX() 被打倒、playDizzySFX() 眼冒金星、
 *         playLoseSFX() 輸了、playWinSFX() 猜中 4A
 *   第四版音效（試聽中）：ChipAudio.playSfx('pot4')，名字見 render 的說明；上面那些函式現在還是播第三版
 *   ChipAudio.setVolume({music: 1, sfx: 1});
 *   打中類的音效會讓背景音樂瞬間壓低（ducking），音效才不會被蓋過。
 *   試聽頁要比較上一版：playLobbyBGM({version: 2})、playBattleBGM({version: 2})。
 * 也可以直接呼叫 playLobbyBGM()、playBattleBGM()、playWinSFX()、stopBGM() 等同名函式。
 *
 * 旋律、和弦都是原創：只參考指定作品的速度、音色和氣氛，沒有使用原曲的旋律。
 *
 * 架構：
 *   AudioContext
 *    └ 總混音（master）：音樂音量、音效音量 → 壓縮器 → 喇叭
 *        └ 每首曲子一條軌道（lane）：各樂器音軌 → 乾聲＋回音（ping-pong）＋殘響（freeverb）
 *   排程：每 25 毫秒醒來一次，把接下來 0.12 秒內要響的音先排進 AudioContext 的時鐘（look-ahead），
 *         計時器晚到一點也不會掉拍；曲子用「第幾格」一直往下數，除以總格數取餘數就無限循環。
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ================= 基本工具 ================= */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  /** 'F#5' → MIDI 編號（A4 = 69）；不是音名（'.' 休止、'-' 延長）就回傳 null */
  function midi(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name || '');
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  /** MIDI 編號 → 頻率（Hz） */
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  /** 把 'E5 . - G5 | …' 這種譜拆成一格一格；'|' 只是方便閱讀的小節線 */
  const tokens = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/);
  /** 從第 i 格開始，這個音一共延續幾格（後面的 '-' 都算進去） */
  function cells(seq, i) { let n = 1; while (seq[(i + n) % seq.length] === '-' && n < seq.length) n++; return n; }

  /* 和弦：'Dmaj7'、'Bm7'、'A7'、'Asus4'、'D/F#'… → { bass: 低音的音級, pcs: 組成音的音級 }（音級 0＝C … 11＝B） */
  const QUAL = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], sus4: [0, 5, 7], m: [0, 3, 7], '': [0, 4, 7] };
  function chord(name) {
    const m = /^([A-G])(#|b)?(maj7|m7|7|sus4|m)?(?:\/([A-G])(#|b)?)?$/.exec(name);
    const pc = (l, a) => (NOTE[l] + (a === '#' ? 1 : a === 'b' ? -1 : 0) + 12) % 12;
    const root = pc(m[1], m[2]);
    return { bass: m[4] ? pc(m[4], m[5]) : root, pcs: QUAL[m[3] || ''].map((x) => (root + x) % 12) };
  }
  /** 把和弦排在 center（MIDI 編號）附近：每個音都選離中心最近的八度 → 音域集中、換和弦時移動最少 */
  function voicing(pcs, center) {
    return pcs.map((pc) => {
      let best = 0, bd = 99;
      for (let o = 1; o < 9; o++) { const m = 12 * o + pc, d = Math.abs(m - center); if (d < bd) { bd = d; best = m; } }
      return best;
    }).sort((a, b) => a - b);
  }
  /** 低音放在 lo ～ lo+11 之間（太低的話手機喇叭放不出來） */
  const bassNote = (pc, lo) => lo + (((pc - (lo % 12)) % 12) + 12) % 12;

  /** 白噪音（鼓用），2 秒，固定種子，每次聽起來一樣 */
  function noiseBuffer(c) {
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; d[i] = s / 2147483648 - 1; }
    return b;
  }
  /** 25% 寬度的方波（紅白機主旋律最亮的音色）；OscillatorNode 內建的 square 是 50% */
  const PULSE = new WeakMap();
  function pulse25(c) {
    if (PULSE.has(c)) return PULSE.get(c);
    const n = 64, re = new Float32Array(n), im = new Float32Array(n), w = 0.25;
    for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * w) / (Math.PI * k); im[k] = (1 - Math.cos(2 * Math.PI * k * w)) / (Math.PI * k); }
    const p = c.createPeriodicWave(re, im); PULSE.set(c, p); return p;
  }
  /** 左右位置：-1 最左、0 中間、1 最右（舊瀏覽器沒有 StereoPanner 就不分左右） */
  function panner(c, v) { if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = v; return p; } return c.createGain(); }

  /* ================= 空間效果：全部用 DelayNode＋GainNode 的反饋迴路做 ================= */
  /**
   * 左右來回的回音（ping-pong echo）
   *   DelayNode（dL、dR）：把聲音晚 time 秒再放出來
   *   BiquadFilter 低通（fL、fR）：每繞一圈就切掉一點高音 → 越後面的回音越暗，像聲音被牆壁吸收
   *   GainNode（gLR、gRL）：回授量，每次回來剩幾成音量；一定要小於 1 才會慢慢消失，越接近 1 拖越長
   *   左邊的回音送到右邊、右邊再送回左邊 → 一個反饋迴路，聲音在左右之間一來一回
   */
  function pingPong(c, time, feedback, damp) {
    const input = c.createGain(), output = c.createGain();
    const dL = c.createDelay(2), dR = c.createDelay(2);
    dL.delayTime.value = time; dR.delayTime.value = time;
    const fL = c.createBiquadFilter(), fR = c.createBiquadFilter();
    fL.type = fR.type = 'lowpass'; fL.frequency.value = fR.frequency.value = damp;
    fL.Q.value = fR.Q.value = -3;   // 低通不要有共振凸起，迴路才不會越繞越大聲
    const gLR = c.createGain(), gRL = c.createGain();
    gLR.gain.value = gRL.gain.value = feedback;
    const pL = panner(c, -0.7), pR = panner(c, 0.7);
    input.connect(dL);
    dL.connect(fL); fL.connect(pL); pL.connect(output);   // 第 1、3、5… 次回音在左邊
    fL.connect(gLR); gLR.connect(dR);                      // 左 → 右
    dR.connect(fR); fR.connect(pR); pR.connect(output);   // 第 2、4、6… 次回音在右邊
    fR.connect(gRL); gRL.connect(dL);                      // 右 → 左：迴路接起來
    return { input, output };
  }

  /**
   * 殘響（照 Freeverb 的做法）：用延遲的反饋迴路做出「房間」
   *   4 個梳狀濾波器（comb）：每個都是「延遲 → 低通 → 回授 → 回到延遲」的迴路，
   *     延遲 25～31 毫秒、彼此錯開，疊起來就是一大片很密的反射
   *   room：回授量（0.7 小房間 ～ 0.92 大廳），越大殘響越長
   *   damp：迴路裡的低通頻率，越低殘響越溫暖、越不刺
   *   2 個全通濾波器（allpass）：不改變音色，只把反射打散，聽起來才不會像彈簧
   *   左右聲道的延遲差 23 個樣本 → 殘響有寬度
   */
  function freeverb(c, room, damp) {
    const input = c.createGain();
    input.channelCount = 1; input.channelCountMode = 'explicit';   // 先混成單聲道再做殘響
    const output = c.createChannelMerger(2), nodes = [input, output];   // nodes：音效用完要全部斷開（迴路才不會一直佔運算）
    const k = c.sampleRate / 44100, COMB = [1116, 1188, 1277, 1356], AP = [556, 441], SPREAD = 23;
    for (let ch = 0; ch < 2; ch++) {
      const sum = c.createGain(); sum.gain.value = 0.25;              // 4 個梳狀濾波平均起來
      nodes.push(sum);
      COMB.forEach((n) => {
        const d = c.createDelay(0.1); d.delayTime.value = (n + ch * SPREAD) * k / c.sampleRate;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = damp; lp.Q.value = -3;
        const fb = c.createGain(); fb.gain.value = room;
        input.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d);   // 反饋迴路
        d.connect(sum); nodes.push(d, lp, fb);
      });
      let node = sum;
      AP.forEach((n) => { node = allpass(c, node, (n + ch * SPREAD) * k / c.sampleRate, 0.5, nodes); });
      node.connect(output, 0, ch);
    }
    return { input, output, nodes };
  }
  /** 全通濾波器：v = 輸入 + g × (延遲後的 v)；輸出 = −g × v + (延遲後的 v) */
  function allpass(c, src, delay, g, nodes) {
    const v = c.createGain(), d = c.createDelay(0.1), fb = c.createGain(), ff = c.createGain(), out = c.createGain();
    d.delayTime.value = delay; fb.gain.value = g; ff.gain.value = -g;
    src.connect(v); v.connect(d); d.connect(fb); fb.connect(v);
    v.connect(ff); ff.connect(out); d.connect(out);
    if (nodes) nodes.push(v, d, fb, ff, out);
    return out;
  }

  /**
   * 一首曲子一條軌道（lane）：樂器 → 音軌（音量、左右、送多少回音和殘響）→ 軌道總音量 → 音樂音量
   * 換曲子時把整條軌道 0.05 秒內收到 0：已經排好的音、回音、殘響全部一起收，不會漏拍
   */
  function makeLane(c, dest, fx, noise) {
    const out = c.createGain(); out.connect(dest);
    const level = c.createGain(); level.gain.value = fx.level; level.connect(out);
    const dry = c.createGain(); dry.connect(level);
    const echo = pingPong(c, fx.echoTime, fx.echoFeedback, fx.echoDamp);
    const echoSend = c.createGain(); echoSend.connect(echo.input);
    const echoRet = c.createGain(); echoRet.gain.value = fx.echoLevel; echo.output.connect(echoRet); echoRet.connect(level);
    const rev = freeverb(c, fx.room, fx.roomDamp);
    const revSend = c.createGain(); revSend.connect(rev.input);
    const revRet = c.createGain(); revRet.gain.value = fx.revLevel; rev.output.connect(revRet); revRet.connect(level);
    const tracks = {};
    /** 取得音軌（第一次用到才建立）：gain 音量、pan 左右、echo／rev 送到回音／殘響的量、
     *  lp：在音軌上串一個低通濾波器（BiquadFilter lowpass），頻率之後可以動態改（存在 .lp） */
    function track(name, o) {
      if (tracks[name]) return tracks[name];
      o = o || {};
      const g = c.createGain(); g.gain.value = o.gain || 1;
      const p = panner(c, o.pan || 0);
      if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = -3; g.connect(f); f.connect(p); g.lp = f; }
      else g.connect(p);
      p.connect(dry);
      if (o.echo) { const s = c.createGain(); s.gain.value = o.echo; p.connect(s); s.connect(echoSend); }
      if (o.rev) { const s = c.createGain(); s.gain.value = o.rev; p.connect(s); s.connect(revSend); }
      return (tracks[name] = g);
    }
    return { c, out, track, noise };
  }

  /* ================= 樂器 ================= */
  /**
   * ADSR 包絡線（音量隨時間的形狀），用指數變化，耳朵聽起來最自然
   *   A（attack）起音：從無聲到最大聲要幾秒；越短越像敲擊，越長越像吹奏
   *   D（decay）衰減：最大聲之後掉到「持續音量」要幾秒
   *   S（sustain）持續：音符還沒結束時，維持最大聲的幾成
   *   R（release）釋放：音符結束後幾秒內消失
   *   end：音符結束的時間；回傳聲音真正結束的時間（給振盪器 stop 用）
   */
  function adsr(param, t, end, peak, A, D, S, R) {
    const sus = Math.max(peak * S, 1e-4);
    param.setValueAtTime(1e-4, t);
    param.exponentialRampToValueAtTime(peak, t + A);                          // 起音
    if (end > t + A + D) { param.exponentialRampToValueAtTime(sus, t + A + D); param.setValueAtTime(sus, end); }   // 衰減 → 持續
    else if (end > t + A) param.exponentialRampToValueAtTime(peak * Math.pow(sus / peak, (end - t - A) / D), end); // 音符太短，衰減到一半就放開
    const e = Math.max(end, t + A);
    param.exponentialRampToValueAtTime(1e-4, e + R);                          // 釋放
    return e + R + 0.02;
  }

  /**
   * 大廳主旋律：方波（亮）＋三角波（圓）混在一起，再用低通把方波最刺的泛音修掉 → 溫暖的晶片音
   * 顫音：一個 5.5Hz 的 LFO（低頻振盪器）接到兩個振盪器的 .frequency，
   *       音高每秒上下晃 5.5 次、幅度 ±0.6%（約 10 音分）；
   *       音符開始 0.12 秒後才慢慢加上去（0.45 秒到最大），像真人吹奏時先吹穩再加顫音
   * ADSR：起音 15 毫秒（柔和）、0.15 秒掉到 75%、結束後 0.18 秒消失（再由回音殘響接著拖尾巴）
   */
  function lobbyLead(L, t, m, dur, vel) {
    const c = L.c, f = hz(m);
    const sq = c.createOscillator(); sq.type = 'square'; sq.frequency.value = f;
    const tr = c.createOscillator(); tr.type = 'triangle'; tr.frequency.value = f;
    const gSq = c.createGain(); gSq.gain.value = 0.5;                         // 方波佔一半：亮度
    const gTr = c.createGain(); gTr.gain.value = 0.5;                         // 三角波佔一半：圓潤
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = -3;
    const amp = c.createGain();                                               // ADSR 控制的音量
    sq.connect(gSq); tr.connect(gTr); gSq.connect(lp); gTr.connect(lp); lp.connect(amp);
    amp.connect(L.track('lead', { pan: -0.1, echo: 0.45, rev: 0.35 }));
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5;               // LFO：每秒 5.5 次
    const depth = c.createGain();                                             // LFO 的幅度（單位 Hz）
    depth.gain.setValueAtTime(0, t); depth.gain.setValueAtTime(0, t + 0.12); depth.gain.linearRampToValueAtTime(f * 0.006, t + 0.45);
    lfo.connect(depth); depth.connect(sq.frequency); depth.connect(tr.frequency);
    const stop = adsr(amp.gain, t, t + dur, vel, 0.015, 0.15, 0.75, 0.18);
    [sq, tr, lfo].forEach((o) => { o.start(t); o.stop(stop); });
  }
  /** 大廳伴奏的分解和弦：三角波短短敲一下（像音樂盒），大量送進回音，製造空氣感 */
  function lobbyArp(L, t, m, vel) {
    const c = L.c, o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
    const amp = c.createGain(); o.connect(amp); amp.connect(L.track('arp', { pan: 0.35, echo: 0.6, rev: 0.4 }));
    const stop = adsr(amp.gain, t, t + 0.02, vel, 0.004, 0.25, 0.3, 0.35);   // 4 毫秒起音、0.35 秒的尾巴
    o.start(t); o.stop(stop);
  }
  /** 和弦鋪底：三角波的長音，0.6 秒慢慢淡入、0.8 秒淡出，音量很小，只是讓背景有溫度 */
  function lobbyPad(L, t, notes, dur, vel) {
    const c = L.c, amp = c.createGain(); amp.connect(L.track('pad', { pan: 0, echo: 0.1, rev: 0.5 }));
    const stop = adsr(amp.gain, t, t + dur, vel, 0.6, 0.4, 0.85, 0.8);
    notes.forEach((m, i) => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m); o.detune.value = i % 2 ? 4 : -4; o.connect(amp); o.start(t); o.stop(stop); });
  }
  /** 三角波低音（紅白機的經典低音）：起音 6 毫秒、0.12 秒掉到 7 成、結束後 0.08 秒消失 */
  function triBass(L, t, m, dur, vel) {
    const c = L.c, o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
    const amp = c.createGain(); o.connect(amp); amp.connect(L.track('bass', { pan: 0, rev: 0.08 }));
    const stop = adsr(amp.gain, t, t + dur, vel, 0.006, 0.12, 0.7, 0.08);
    o.start(t); o.stop(stop);
  }

  /**
   * 戰鬥主旋律：兩個稍微走音（±7 音分）的鋸齒波疊在一起 → 厚、亮、有衝勁
   * 低通濾波器：每個音一開始很亮（5000Hz），0.08 秒內變暗到 2200Hz → 每個音都有「顆粒」
   * 斷音（staccato）：音符在下一格之前 GAP 秒就結束 —— 先維持 6 成音量，
   *   最後 12 毫秒用 exponentialRampToValueAtTime 收到幾乎 0，留下約 10 毫秒的空白，
   *   每個音才會一顆一顆分得很清楚，刺激但不壓迫
   */
  const GAP = 0.010;
  function sawLead(L, t, m, dur, vel) {
    const c = L.c, f = hz(m), end = t + Math.max(0.03, dur - GAP), hot = L.hot;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
    /* 熱血爆發時，每個音自己的濾波也開到 9000 → 5000Hz，鋸齒波才真的亮起來 */
    lp.frequency.setValueAtTime(hot ? 9000 : 5000, t); lp.frequency.exponentialRampToValueAtTime(hot ? 5000 : 2200, t + 0.08);
    const amp = c.createGain(); lp.connect(amp); amp.connect(L.track('lead', { pan: -0.05, echo: 0.22, rev: 0.16 }));
    amp.gain.setValueAtTime(1e-4, t);
    amp.gain.exponentialRampToValueAtTime(vel, t + 0.004);                        // 4 毫秒起音：乾脆
    amp.gain.exponentialRampToValueAtTime(vel * 0.6, Math.min(end - 0.012, t + 0.06)); // 很快掉到 6 成
    amp.gain.setValueAtTime(vel * 0.6, end - 0.012);
    amp.gain.exponentialRampToValueAtTime(1e-4, end);                             // 斷音：12 毫秒收乾淨
    [-7, 7].forEach((dt) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(t); o.stop(end + 0.01); });
  }
  /** 戰鬥的三角波跳躍低音：同樣是斷音，根音和高八度來回跳 */
  function jumpBass(L, t, m, dur, vel) {
    const c = L.c, end = t + Math.max(0.03, dur - GAP);
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
    const amp = c.createGain(); o.connect(amp); amp.connect(L.track('bass', { pan: 0, rev: 0.05 }));
    amp.gain.setValueAtTime(1e-4, t); amp.gain.exponentialRampToValueAtTime(vel, t + 0.004);
    amp.gain.setValueAtTime(vel, end - 0.015); amp.gain.exponentialRampToValueAtTime(1e-4, end);
    o.start(t); o.stop(end + 0.01);
  }
  /** 戰鬥的和弦「切」：25% 方波短短一下，放在反拍，增加衝勁 */
  function stab(L, t, notes, dur, vel) {
    const c = L.c, end = t + Math.max(0.03, dur - GAP);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = -3;
    const amp = c.createGain(); lp.connect(amp); amp.connect(L.track('stab', { pan: 0.3, echo: 0.2, rev: 0.15 }));
    amp.gain.setValueAtTime(1e-4, t); amp.gain.exponentialRampToValueAtTime(vel, t + 0.003); amp.gain.exponentialRampToValueAtTime(1e-4, end);
    notes.forEach((m) => { const o = c.createOscillator(); o.setPeriodicWave(pulse25(c)); o.frequency.value = hz(m); o.connect(lp); o.start(t); o.stop(end + 0.01); });
  }

  /* 鼓（紅白機風格：三角波和雜音做的） */
  /** 大鼓：三角波的音高在 0.09 秒內從 180Hz 掉到 45Hz → 「咚」 */
  function kick(L, t, vel) {
    const c = L.c, o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    const amp = c.createGain(); o.connect(amp); amp.connect(L.track('kick', { pan: 0, rev: 0.04 }));
    amp.gain.setValueAtTime(vel, t); amp.gain.exponentialRampToValueAtTime(1e-4, t + 0.22);
    o.start(t); o.stop(t + 0.25);
  }
  /** 小鼓：雜音過帶通（1900Hz 附近）＋一個往下掉的三角波（鼓皮的聲音） */
  function snare(L, t, vel) {
    const c = L.c, s = c.createBufferSource(); s.buffer = L.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const amp = c.createGain(); s.connect(bp); bp.connect(amp);
    const tr = L.track('snare', { pan: 0.05, echo: 0.05, rev: 0.2 }); amp.connect(tr);
    amp.gain.setValueAtTime(vel, t); amp.gain.exponentialRampToValueAtTime(1e-4, t + 0.16);
    s.start(t, Math.random() * 1.5, 0.2);
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    const g = c.createGain(); o.connect(g); g.connect(tr);
    g.gain.setValueAtTime(vel * 0.6, t); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.08);
    o.start(t); o.stop(t + 0.1);
  }
  /** 鈸：雜音只留 7500Hz 以上，很短 */
  function hat(L, t, vel, len) {
    len = len || 0.04;
    const c = L.c, s = c.createBufferSource(); s.buffer = L.noise;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const amp = c.createGain(); s.connect(hp); hp.connect(amp); amp.connect(L.track('hat', { pan: 0.25, rev: 0.06 }));
    amp.gain.setValueAtTime(vel, t); amp.gain.exponentialRampToValueAtTime(1e-4, t + len);
    s.start(t, Math.random() * 1.5, len + 0.02);
  }

  /* ================= 曲子 ================= */
  /** 準備曲子：拆譜、算每格幾秒、和弦 */
  function prepare(S) {
    if (S.mel) return S;
    S.mel = tokens(S.melody); S.N = S.mel.length; S.per = S.perBeat * 4;
    S.stepDur = 60 / S.bpm / S.perBeat;
    S.ch = S.chords.split('|').map((b) => b.trim().split(/\s+/).map(chord));
    /** 第 k 格的和弦（同一小節寫兩個和弦就是前後各半小節） */
    S.chordAt = (k) => { const b = S.ch[Math.floor(k / S.per) % S.ch.length]; return b[b.length > 1 && (k % S.per) >= S.per / 2 ? 1 : 0]; };
    /** 第 k 格是不是換和弦的地方 */
    S.changeAt = (k) => { const s = k % S.per; return s === 0 || (s === S.per / 2 && S.ch[Math.floor(k / S.per) % S.ch.length].length > 1); };
    return S;
  }

  /**
   * 大廳：D 大調、92 BPM、一格＝八分音符、16 小節（約 42 秒）一循環
   * 溫暖放鬆、有留白：旋律多用長音（顫音才聽得出來），句尾留空拍；
   * 前 4 小節只有旋律、分解和弦、低音；第 5 小節加入和弦鋪底和輕快的節奏（第二版是第 9 小節才有很輕的節奏）
   */
  const LOBBY = {
    bpm: 92, perBeat: 2,
    melody:
      'F#5 - - - E5 - D5 - | C#5 - D5 - - - . . | B4 - D5 - F#5 - A5 - | G5 - F#5 - E5 - - - |' +
      'F#5 - - - E5 - D5 - | C#5 - E5 - A5 - - - | B5 - - - A5 - F#5 - | E5 - - - - - . . |' +
      'D6 - - - C#6 - B5 - | A5 - - - . . E5 - | F#5 - G5 - A5 - B5 - | A5 - - - F#5 - - - |' +
      'G5 - - - F#5 - E5 - | E5 - - - D5 - C#5 - | D5 - - - - - . . | . . A4 - B4 - C#5 -',
    chords: 'Dmaj7|Bm7|Gmaj7|Asus4 A|Dmaj7|F#m7|Gmaj7|Asus4 A|Bm7|F#m7|Gmaj7|D/F#|Em7|A7|Dmaj7|A',
    /* 空間：回音是附點八分音符（0.75 拍）、回授 0.5、2200Hz 以上慢慢變暗；殘響回授 0.9（很大的空間） */
    fx: (S) => ({ level: 0.85, echoTime: 60 / S.bpm * 0.75, echoFeedback: 0.5, echoDamp: 2200, echoLevel: 0.55, room: 0.9, roomDamp: 2600, revLevel: 0.5 }),
    step(L, i, t) {
      const S = this, k = i % S.N, bar = Math.floor(k / S.per), s = k % S.per, ch = S.chordAt(k), dt = S.stepDur;
      // 1. 主旋律
      const m = midi(S.mel[k]);
      if (m != null) lobbyLead(L, t, m, cells(S.mel, k) * dt, 0.15);
      // 2. 分解和弦：每個八分音符一個音，往上再往回，前 4 小節小聲一點
      const v = voicing(ch.pcs, 57), arp = v.length > 3 ? v : v.concat(v[0] + 12), ORDER = [0, 1, 2, 3, 2, 1, 2, 3];
      lobbyArp(L, t, arp[ORDER[s]], bar < 4 ? 0.045 : 0.06);
      // 3. 低音：第 1 拍根音（3 格）、第 3 拍五度（換和弦就彈新的根音）、第 4 拍根音
      const root = bassNote(ch.bass, 45);
      if (s === 0) triBass(L, t, root, 3 * dt, 0.3);
      else if (s === 4) triBass(L, t, S.changeAt(k) ? root : (root + 7 > 56 ? root - 5 : root + 7), 2 * dt, 0.26);
      else if (s === 6) triBass(L, t, root, 2 * dt, 0.24);
      // 4. 和弦鋪底：第 5 小節開始，每次換和弦就放一個
      if (bar >= 4 && S.changeAt(k)) { let n = 1; while (n < S.N && !S.changeAt(k + n)) n++; lobbyPad(L, t, voicing(ch.pcs, 64), n * dt, 0.022); }
      // 5. 節奏
      if (S.v3) {
        // 第三版：前 4 小節空著，第 5 小節帶入輕快的復古節奏（第 1、3 拍大鼓、第 2、4 拍輕小鼓、反拍鈸，第 9 小節起鈸變十六分音符）
        if (bar >= 4) {
          if (s === 0 || s === 4) kick(L, t, 0.22);
          if (s === 2 || s === 6) snare(L, t, 0.09);
          if (s % 2 === 1) hat(L, t, 0.06, 0.04);
          if (bar >= 8 && s % 2 === 0) hat(L, t + dt / 2, 0.025, 0.03);
        }
      } else if (bar >= 8) { if (s === 0) kick(L, t, 0.16); if (s === 3 || s === 7) hat(L, t, 0.05, 0.05); }   // 第二版：第 9 小節才有心跳般的大鼓和反拍鈸
    },
  };

  /**
   * 戰鬥：E 小調、126 BPM、一格＝十六分音符、16 小節（約 30 秒）一循環
   * 熱血、機智：鋸齒波旋律大量用切分音（落在反拍的十六分音符），每個音都是斷音；
   * 三角波低音根音、高八度來回跳；第 5 小節開始反拍加入和弦「切」；第 8、16 小節最後小鼓連打
   * 第三版：鋸齒波旋律先經過一個低通濾波器（音軌上的 lp）——
   *   平時 1500Hz：刺耳的高頻削掉，旋律溫和地退到後面，跳躍的三角波低音比較突出，不搶思考
   *   setBattleIntensity(true)：0.12 秒的時間常數打開到 6000Hz、旋律大聲 4dB，鋸齒波整個亮起來；false 時 0.4 秒慢慢收回
   */
  const BATTLE = {
    bpm: 126, perBeat: 4,
    melody:
      'E5 . E5 . G5 . . A5 . . B5 . A5 . G5 . | E5 . . D5 . . E5 . G5 . . E5 . D5 . . |' +
      'F#5 . F#5 . A5 . . B5 . . D6 . B5 . A5 . | D#5 - - . F#5 . A5 . B5 - - . . . . . |' +
      'E5 . E5 . G5 . . A5 . . B5 . D6 . B5 . | C6 . . B5 . . A5 . G5 . . A5 . B5 . . |' +
      'A5 . A5 . C6 . . B5 . . A5 . G5 . E5 . | F#5 . G5 . A5 . B5 . D#6 - - . B5 . . . |' +
      'G5 . . G5 . . E5 . . . G5 . A5 . . . | F#5 . . F#5 . . D5 . . . F#5 . A5 . . . |' +
      'G5 . . G5 . . B5 . . . A5 . G5 . E5 . | E5 . . . . . . . E5 . G5 . A5 . B5 . |' +
      'C6 . . B5 . . A5 . . . E5 . A5 . . . | B5 . . A5 . . G5 . . . E5 . G5 . . . |' +
      'A5 . . G5 . . F#5 . . . G5 . A5 . B5 . | D#6 . B5 . F#5 . D#5 . B4 . . . . . . .',
    chords: 'Em|C|D|B7|Em|C|Am|B7|C|D|Em|C|Am|Em|C D|B7',
    /* 低音的位置：第幾格 → [R 根音／O 高八度／F 五度, 幾格長] */
    bassPat: { 0: ['R', 2], 2: ['O', 1], 4: ['R', 1], 6: ['O', 1], 8: ['R', 2], 10: ['O', 1], 12: ['F', 1], 14: ['O', 1] },
    /* 空間：回音 3 個十六分音符、回授小（0.3），殘響小房間（0.8），保持顆粒清楚 */
    fx: (S) => ({ level: 1, echoTime: S.stepDur * 3, echoFeedback: 0.3, echoDamp: 2500, echoLevel: 0.35, room: 0.8, roomDamp: 3000, revLevel: 0.3 }),
    step(L, i, t) {
      const S = this, k = i % S.N, bar = Math.floor(k / S.per), s = k % S.per, ch = S.chordAt(k), dt = S.stepDur;
      // 1. 主旋律（鋸齒波斷音）
      const m = midi(S.mel[k]);
      if (m != null) sawLead(L, t, m, cells(S.mel, k) * dt, 0.12);
      // 2. 跳躍低音
      const bp = S.bassPat[s];
      if (bp) { const r = bassNote(ch.bass, 45); jumpBass(L, t, bp[0] === 'R' ? r : bp[0] === 'O' ? r + 12 : r + 7, bp[1] * dt, 0.3); }
      // 3. 和弦切：第 5 小節開始，每拍的後半拍
      if (bar >= 4 && (s === 2 || s === 6 || s === 10 || s === 14)) stab(L, t, voicing(ch.pcs, 64), dt, 0.035);
      // 4. 鼓：大鼓 1、2 拍半、3 拍；小鼓 2、4 拍；第 8、16 小節最後連打；鈸十六分音符，正拍大聲、反拍小聲
      if (s === 0 || s === 6 || s === 8) kick(L, t, 0.5);
      if (s === 4 || s === 12) snare(L, t, 0.32);
      else if (bar % 8 === 7 && s >= 13) snare(L, t, 0.2);
      hat(L, t, s % 2 ? 0.06 : 0.14, 0.03);
    },
  };

  /* 第三版：沿用同一份譜，只改編曲和濾波（v3 旗標） */
  const LOBBY3 = Object.assign(Object.create(LOBBY), { v3: true });
  const BATTLE3 = Object.assign(Object.create(BATTLE), { v3: true });
  const CALM_HZ = 1500, HOT_HZ = 6000, HOT_GAIN = 1.6;   // 熱血時旋律也大聲一點（+4dB），爆發感才明顯

  /**
   * 猜中 4A：一個 25% 方波振盪器，每 33 毫秒換一個音（setValueAtTime 直接跳過去、不滑音 → 紅白機的味道）。
   * 0.4 秒內在 C 大三和弦裡一圈一圈往上爬：C5 E5 G5 C6｜E5 G5 C6 E6｜G5 C6 E6 G6，
   * 最後定格在 C6 的長音，加上 7Hz 的快速顫音閃閃發亮，再慢慢消失；短短的左右回音讓尾巴更亮。
   * 音量：10 毫秒起音、琶音過程越來越大聲、長音維持 0.12 秒、0.8 秒內淡出。
   */
  function winSfx(c, dest, B, t) {
    const SEQ = ['C5', 'E5', 'G5', 'C6', 'E5', 'G5', 'C6', 'E6', 'G5', 'C6', 'E6', 'G6'].map((n) => hz(midi(n)));
    const STEP = 0.033, tEnd = t + SEQ.length * STEP, FINAL = hz(midi('C6'));
    const o = c.createOscillator(); o.setPeriodicWave(pulse25(c));
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = -3;   // 修掉最刺的高音
    const amp = c.createGain(); o.connect(lp); lp.connect(amp); amp.connect(dest);
    const echo = pingPong(c, 0.11, 0.35, 4500), send = c.createGain(); send.gain.value = 0.35;
    amp.connect(send); send.connect(echo.input); echo.output.connect(dest);
    SEQ.forEach((f, i) => o.frequency.setValueAtTime(f, t + i * STEP));     // 每 33 毫秒跳一個音
    o.frequency.setValueAtTime(FINAL, tEnd);                                 // 定格
    const lfo = c.createOscillator(); lfo.frequency.value = 7;               // 長音的閃爍顫音
    const dep = c.createGain(); dep.gain.setValueAtTime(0, t); dep.gain.setValueAtTime(0, tEnd + 0.08); dep.gain.linearRampToValueAtTime(FINAL * 0.008, tEnd + 0.3);
    lfo.connect(dep); dep.connect(o.frequency);
    amp.gain.setValueAtTime(1e-4, t);
    amp.gain.exponentialRampToValueAtTime(0.11, t + 0.01);
    amp.gain.linearRampToValueAtTime(0.16, tEnd);
    amp.gain.setValueAtTime(0.16, tEnd + 0.12);
    amp.gain.exponentialRampToValueAtTime(1e-4, tEnd + 0.9);
    o.start(t); lfo.start(t); o.stop(tEnd + 0.95); lfo.stop(tEnd + 0.95);
    return { end: tEnd + 1.8, nodes: [amp, echo.output, send] };
  }

  /* ================= 音效（第三版規格） =================
   * 每個音效都是 (c, out, B, t)：c＝AudioContext、out＝輸出（音效音量）、B＝總混音（白噪音、壓低音樂用）、t＝開始時間
   * 回傳 { end: 聲音結束的時間, nodes: 結束後要斷開的節點（有反饋迴路的一定要斷，不然會一直佔運算） } */
  /** 播一段循環的白噪音 */
  function noiseSrc(c, B, t, dur) { const s = c.createBufferSource(); s.buffer = B.noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }
  /**
   * 背景音樂瞬間壓低（ducking）：音效打中的那一下，音樂 0.03 秒內壓到 depth，
   * hold 秒後用 0.25 秒的時間常數慢慢回來 → 音效的衝擊感不會被音樂蓋過
   */
  function duck(B, t, depth, hold) {
    const g = B.duck.gain; g.cancelScheduledValues(t); g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(depth, t + 0.03); g.setTargetAtTime(1, t + hold, 0.25);
  }
  /**
   * 拖鞋打中：兩層
   *   ① 白噪音 → 1000Hz 高通（只留清脆的部分）→ 1 毫秒衝到最大、0.03 秒內收到 0 → 「啪」
   *   ② 180Hz 正弦波 → 3 毫秒起音、0.08 秒內收到 0 → 打到肉的悶沉重量
   */
  function slipperSfx(c, out, B, t) {
    const n = noiseSrc(c, B, t, 0.04), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1000;
    const g1 = c.createGain(); g1.gain.setValueAtTime(1e-4, t); g1.gain.exponentialRampToValueAtTime(0.9, t + 0.001); g1.gain.exponentialRampToValueAtTime(1e-4, t + 0.03);
    n.connect(hp); hp.connect(g1); g1.connect(out);
    const o = c.createOscillator(); o.frequency.value = 180;
    const g2 = c.createGain(); g2.gain.setValueAtTime(1e-4, t); g2.gain.exponentialRampToValueAtTime(0.8, t + 0.003); g2.gain.exponentialRampToValueAtTime(1e-4, t + 0.08);
    o.connect(g2); g2.connect(out); o.start(t); o.stop(t + 0.1);
    duck(B, t, 0.5, 0.15);
    return { end: t + 0.12, nodes: [] };
  }
  /**
   * 大鐵盆打中：375、513、741、985Hz 四個不成倍數（不協和）的頻率一起響 → 金屬聲
   *   低的兩個（375 正弦、513 方波）留下來，1.6／1.2 秒慢慢消失；高的兩個（741 正弦、985 方波）0.15 秒內收掉
   *   方波的高次泛音太刺 → 4500Hz 低通修掉一點；敲到的瞬間加一點 2500Hz 以上的雜音
   *   延遲迴路：延遲 31 毫秒 → 低通 2200Hz → 回授 0.8 → 回到延遲；每 31 毫秒回來一次、每次剩 8 成，
   *   聲音在迴路裡繞，變成空心的「鏜ーー」嗡嗡長尾巴（約 1 秒）
   */
  function potSfx(c, out, B, t) {
    const mix = c.createGain(); mix.gain.value = 0.5;
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 4500; tone.Q.value = -3;
    mix.connect(tone); tone.connect(out);
    [[375, 'sine', 1.0, 1.6], [513, 'square', 0.22, 1.2], [741, 'sine', 0.6, 0.15], [985, 'square', 0.16, 0.15]].forEach(([f, type, a, dec]) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(a, t + 0.002); g.gain.exponentialRampToValueAtTime(1e-4, t + dec);
      o.connect(g); g.connect(mix); o.start(t); o.stop(t + dec + 0.02);
    });
    const n = noiseSrc(c, B, t, 0.02), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.4, t); gn.gain.exponentialRampToValueAtTime(1e-4, t + 0.015);
    n.connect(hp); hp.connect(gn); gn.connect(out);
    const d = c.createDelay(1); d.delayTime.value = 0.031;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = -3;
    const fb = c.createGain(); fb.gain.value = 0.8;
    const wet = c.createGain(); wet.gain.value = 0.5;
    tone.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(out);
    duck(B, t, 0.35, 0.5);
    return { end: t + 2.4, nodes: [d, lp, fb, wet] };
  }
  /**
   * 閃掉：白噪音 → 很窄的帶通（Q＝6，只留一小段頻率）
   *   0.1 秒內中心頻率 300 → 2500Hz，再 0.05 秒急速掉回 700Hz；音量跟著先大後小；左邊滑到右邊
   *   → 東西「咻」地擦過身邊
   */
  function evadeSfx(c, out, B, t) {
    const n = noiseSrc(c, B, t, 0.17), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2500, t + 0.1); bp.frequency.exponentialRampToValueAtTime(700, t + 0.15);
    const g = c.createGain(); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(2.2, t + 0.08); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.15);
    const p = panner(c, 0); if (p.pan) { p.pan.setValueAtTime(-0.6, t); p.pan.linearRampToValueAtTime(0.6, t + 0.15); }
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(out);
    return { end: t + 0.2, nodes: [] };
  }
  /**
   * 鍋蓋擋掉：2200Hz、2850Hz 兩個三角波＋一點點 4000Hz 以上的雜音
   *   0.01 秒衝到最大、0.1 秒內收到 0 → 硬物碰撞的「叮！」；0.06 秒後再輕輕彈一下（三分之一音量）
   */
  function shieldSfx(c, out, B, t) {
    const hit = (t0, v) => {
      [2200, 2850].forEach((f) => {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = c.createGain(); g.gain.setValueAtTime(1e-4, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(1e-4, t0 + 0.1);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.12);
      });
      const n = noiseSrc(c, B, t0, 0.03), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
      const gn = c.createGain(); gn.gain.setValueAtTime(v * 0.25, t0); gn.gain.exponentialRampToValueAtTime(1e-4, t0 + 0.025);
      n.connect(hp); hp.connect(gn); gn.connect(out);
    };
    hit(t, 0.35); hit(t + 0.06, 0.12);
    duck(B, t, 0.6, 0.1);
    return { end: t + 0.2, nodes: [] };
  }
  /**
   * 被打倒：三層
   *   ① 底層：三角波 0.3 秒內從 120Hz 滑到 40Hz → 重重落地（手機喇叭放不太出來，耳機聽得到）
   *   ② 中層：白噪音 → 400Hz 低通，3 毫秒爆開、0.25 秒收掉 → 撞擊的衝擊
   *   ③ 高層：25% 方波 C6 G5 D#5 C5 G4（C 小調）每 40 毫秒往下跳 → 8-bit 的潰敗感，手機上主要聽這一層
   */
  function knockSfx(c, out, B, t) {
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const g = c.createGain(); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.005); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.38);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
    const n = noiseSrc(c, B, t, 0.3), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const gn = c.createGain(); gn.gain.setValueAtTime(1e-4, t); gn.gain.exponentialRampToValueAtTime(1.4, t + 0.003); gn.gain.exponentialRampToValueAtTime(1e-4, t + 0.25);
    n.connect(lp); lp.connect(gn); gn.connect(out);
    const NOTES = ['C6', 'G5', 'D#5', 'C5', 'G4'].map((x) => hz(midi(x))), t0 = t + 0.02, tE = t0 + NOTES.length * 0.04;
    const a = c.createOscillator(); a.setPeriodicWave(pulse25(c));
    NOTES.forEach((f, i) => a.frequency.setValueAtTime(f, t0 + i * 0.04));
    const la = c.createBiquadFilter(); la.type = 'lowpass'; la.frequency.value = 5000; la.Q.value = -3;
    const ga = c.createGain(); ga.gain.setValueAtTime(1e-4, t); ga.gain.setValueAtTime(1e-4, t0); ga.gain.exponentialRampToValueAtTime(0.17, t0 + 0.008);
    ga.gain.exponentialRampToValueAtTime(0.06, tE); ga.gain.exponentialRampToValueAtTime(1e-4, tE + 0.08);
    a.connect(la); la.connect(ga); ga.connect(out); a.start(t); a.stop(tE + 0.1);
    duck(B, t, 0.35, 0.35);
    return { end: tE + 0.12, nodes: [] };
  }
  /**
   * 眼冒金星：方波 0.5 秒內每 15 毫秒隨機跳一個音（整體趨勢 1200Hz → 300Hz 往下走，每次在趨勢上下 ±22% 亂跳），
   *   再掛一個 13Hz 的正弦 LFO 在頻率上（幅度 ±70Hz）→ 用力晃的暈眩感；3500Hz 低通讓方波不刺耳
   */
  function dizzySfx(c, out, B, t) {
    const o = c.createOscillator(); o.type = 'square';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500; lp.Q.value = -3;
    const g = c.createGain(); o.connect(lp); lp.connect(g); g.connect(out);
    const STEP = 0.015, N = Math.round(0.5 / STEP);
    for (let i = 0; i < N; i++) { const base = 1200 * Math.pow(300 / 1200, i / (N - 1)); o.frequency.setValueAtTime(base * (0.78 + Math.random() * 0.44), t + i * STEP); }
    const lfo = c.createOscillator(); lfo.frequency.value = 13;
    const dep = c.createGain(); dep.gain.value = 70; lfo.connect(dep); dep.connect(o.frequency);
    g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.01); g.gain.setValueAtTime(0.07, t + 0.35); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.5);
    o.start(t); lfo.start(t); o.stop(t + 0.52); lfo.stop(t + 0.52);
    return { end: t + 0.55, nodes: [] };
  }
  /**
   * 輸了：方波＋三角波（一半一半，2600Hz 低通讓它不刺），每個音 0.15 秒：C5 → G#4 → G4 → F#4
   *   每個音 8 毫秒起音、結束前 25 毫秒收掉（音和音之間分開）；
   *   最後一個音唱 0.1 秒後往下滑（Pitch Drop）到大約低一個八度多，0.7 秒內淡出
   */
  function loseSfx(c, out, B, t) {
    const NOTES = ['C5', 'G#4', 'G4', 'F#4'].map((x) => hz(midi(x))), D = 0.15;
    const sq = c.createOscillator(); sq.type = 'square';
    const tr = c.createOscillator(); tr.type = 'triangle';
    const gs = c.createGain(); gs.gain.value = 0.45; const gt = c.createGain(); gt.gain.value = 0.55;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = -3;
    const g = c.createGain(); sq.connect(gs); tr.connect(gt); gs.connect(lp); gt.connect(lp); lp.connect(g); g.connect(out);
    NOTES.forEach((f, i) => {
      const t0 = t + i * D; sq.frequency.setValueAtTime(f, t0); tr.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(1e-4, t0); g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.008);
      if (i < NOTES.length - 1) { g.gain.setValueAtTime(0.11, t0 + D - 0.025); g.gain.exponentialRampToValueAtTime(1e-4, t0 + D - 0.005); }
    });
    const tl = t + (NOTES.length - 1) * D, last = NOTES[NOTES.length - 1];
    [sq, tr].forEach((x) => { x.frequency.setValueAtTime(last, tl + 0.1); x.frequency.exponentialRampToValueAtTime(last / 2.2, tl + 0.75); });
    g.gain.setValueAtTime(0.13, tl + 0.1); g.gain.exponentialRampToValueAtTime(1e-4, tl + 0.8);
    sq.start(t); tr.start(t); sq.stop(tl + 0.82); tr.stop(tl + 0.82);
    return { end: tl + 0.85, nodes: [] };
  }
  /* ================= 第四版音效（11/09：使用者用手機聽完第三版的回饋＋Google 的修正） =================
   * 使用者：大鐵盆太清脆，大鐵鍋應該更低沉、有吸音擴散感；整體有點像電子蜂鳴器、廉價；贏了 OK，輸了有點無趣
   * 改法：
   *   ① 解諧（Google）：同一個音用兩個振盪器 +8／−8 音分（音分＝半音的百分之一）一起響，兩個波形慢慢互相干涉，
   *      聲音變厚、微微晃動，不像單一振盪器那麼乾淨（金屬被敲時本來就有兩個很接近的頻率互相拍打）
   *   ② 手機喇叭（Claude 加的）：手機放不出 300Hz 以下，150Hz 以下幾乎沒有聲音。要低沉又要手機聽得到，
   *      就讓低音帶著 2～5 倍頻的泛音（疊高八度的音，或微幅失真）→ 手機放得出泛音，耳朵會自己把很低的基音補回來
   *   贏了（4A）使用者說 OK，沒有改；閃掉只有雜音、沒有振盪器，也沒有改
   */
  const DET = 8;
  /**
   * 解諧的一對振盪器（type：'sine'、'square'、'triangle'、'pulse'＝25% 方波）；out 是兩個合起來。改頻率時 os 兩個都要改
   *   bal：第二個的音量比例（預設 1＝一樣大）。注意：一樣大的兩個方波或三角波，每隔 1／(2×頻率差) 秒會完全抵消一次（瞬間沒聲音），
   *   短而高的音（例如 2200Hz 的鍋蓋，每秒抵消 20 次）用 bal 0.5，最多只小聲 10dB，聽起來是閃爍而不是斷掉
   */
  function pair(c, type, f, cents, bal) {
    const out = c.createGain(); bal = bal == null ? 1 : bal;
    const os = [-1, 1].map((s, i) => {
      const o = c.createOscillator(), g = c.createGain();
      if (type === 'pulse') o.setPeriodicWave(pulse25(c)); else o.type = type;
      o.frequency.value = f; o.detune.value = s * (cents == null ? DET : cents);
      g.gain.value = (i ? bal : 1) / (1 + bal); o.connect(g); g.connect(out); return o;
    });
    return { os, out, start: (t) => os.forEach((o) => o.start(t)), stop: (t) => os.forEach((o) => o.stop(t)) };
  }
  /** 微幅失真（飽和）：tanh 曲線，小聲幾乎不變、大聲時圓圓地壓扁 → 多出 3、5 倍頻的泛音；drive 越大越髒 */
  const CURVES = {};
  function saturator(c, drive) {
    let cv = CURVES[drive];
    if (!cv) { const n = 1024; cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(drive * x) / drive; } CURVES[drive] = cv; }
    const ws = c.createWaveShaper(); ws.curve = cv; ws.oversample = '2x'; return ws;
  }
  /** 一個音量包絡：t 時 1 毫秒內衝到 peak（at 秒），dec 秒內收到 0 */
  function hitEnv(g, t, peak, at, dec) { g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(peak, t + at); g.gain.exponentialRampToValueAtTime(1e-4, t + dec); }
  /**
   * 大鐵盆打中（第四版）：variant 'g'＝照 Google 的數字；'p'＝手機版（Claude 建議）
   *   四個不協和頻率照第三版的比例一起往下移（÷2.9，低一個半八度）：130、178、257、341Hz，每個都是一對解諧振盪器
   *   快速吸音：低通在敲到的 0.02 秒內全開（「鏗」一下），之後 0.1 秒內關到 350Hz（照 Google）／1200Hz（手機版）→ 只剩悶悶的「咚ーー」
   *   延遲迴路：31 毫秒、回授 0.75，迴路裡只留中低頻（照 Google 600Hz 以下／手機版 1000Hz 以下）→ 空心、低沉的嗡嗡尾巴
   *   手機版另外：① 低音的泛音：260、390Hz（130 的 2、3 倍）、356Hz（178 的 2 倍）、514Hz（257 的 2 倍）一起響，
   *                  手機喇叭放得出來，耳朵聽到這些泛音會自己補回 130Hz 的低音；130Hz 本身小聲一點
   *               ② 敲到時一聲失真過的「咚」（95→55Hz，泛音手機聽得到）③ 一點點很暗的殘響 → 聲音散開（擴散感）
   */
  function potSfx4(c, out, B, t, variant) {
    const ph = variant !== 'g', nodes = [];
    const sum = c.createGain(); sum.gain.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = -3;
    lp.frequency.setValueAtTime(8000, t); lp.frequency.setValueAtTime(8000, t + 0.02); lp.frequency.exponentialRampToValueAtTime(ph ? 1200 : 350, t + 0.12);
    const post = c.createGain(); post.gain.value = ph ? 0.9 : 0.7;
    sum.connect(lp); lp.connect(post); post.connect(out);
    const modes = ph
      ? [[130, 'sine', 0.3, 1.8], [178, 'square', 0.18, 1.4], [257, 'sine', 0.4, 0.35], [341, 'square', 0.16, 0.25],
        [260, 'sine', 0.45, 1.6], [390, 'sine', 1.0, 1.3], [356, 'sine', 0.5, 1.2], [514, 'sine', 0.4, 0.35]]
      : [[130, 'sine', 1.0, 1.8], [178, 'square', 0.22, 1.4], [257, 'sine', 0.6, 0.3], [341, 'square', 0.16, 0.25]];
    modes.forEach(([f, type, a, dec]) => {
      const p = pair(c, type, f), g = c.createGain(); hitEnv(g, t, a, 0.002, dec);
      p.out.connect(g); g.connect(sum); p.start(t); p.stop(t + dec + 0.02);
    });
    const n = noiseSrc(c, B, t, 0.03), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.7;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.6, t); gn.gain.exponentialRampToValueAtTime(1e-4, t + 0.02);   // 敲到的瞬間（跟著低通一起被吸掉）
    n.connect(bp); bp.connect(gn); gn.connect(sum);
    if (ph) {
      const th = pair(c, 'sine', 95), gt = c.createGain(), s = saturator(c, 3);
      th.os.forEach((o) => { o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.15); });
      hitEnv(gt, t, 0.9, 0.004, 0.18); th.out.connect(gt); gt.connect(s); s.connect(sum); th.start(t); th.stop(t + 0.2);
    }
    const d = c.createDelay(1); d.delayTime.value = 0.031;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = ph ? 1000 : 600; fl.Q.value = -3;
    const fh = c.createBiquadFilter(); fh.type = 'highpass'; fh.frequency.value = ph ? 140 : 70; fh.Q.value = -3;
    const fb = c.createGain(); fb.gain.value = 0.75;
    const wet = c.createGain(); wet.gain.value = 0.5;
    post.connect(d); d.connect(fl); fl.connect(fh); fh.connect(fb); fb.connect(d); fh.connect(wet); wet.connect(out);
    nodes.push(d, fl, fh, fb, wet);
    if (ph) {
      const rv = freeverb(c, 0.8, 1400), send = c.createGain(); send.gain.value = 0.3;
      post.connect(send); send.connect(rv.input); rv.output.connect(out); nodes.push(send, ...rv.nodes);
    }
    duck(B, t, 0.35, 0.6);
    return { end: t + 2.8, nodes };
  }
  /**
   * 輸了（第四版）：保留 C5 → G#4 → G4 → F#4 往下走，每個音都變成「哇～」，融合原本「哇哇哇」的滑稽感
   *   節奏：140 BPM 的八分音符（每 0.214 秒一個音），規格裡的 140 BPM 和 0.15 秒這樣就都對得上
   *   滑音：每個音 0.15 秒內往下滑半音（G#4 滑到 G4、G4 滑到 F#4，剛好接到下一個音）
   *   哇：有共振的低通（Q 10dB），每個音 0.04 秒內從 350Hz 打開到 2600Hz（ㄨ→ㄚ），再跟著音高收回來（ㄚ→ㄨ）
   *   最後的 F#4 拉長：滑下來後再慢慢垂下半音，加上 15Hz 的振幅顫音（全身發抖），1 秒內淡出
   *   音色：方波 +8 音分、三角波 −8 音分（照 Google 的寫法：疊在一起的振盪器互相解諧；
   *         用兩個一樣的方波的話，每 0.2 秒會完全抵消一次，「哇」會斷成「哇-ㄚ」；方波 65%、三角波 35%，抵消時最多只小聲 6dB）
   */
  function loseSfx4(c, out, B, t) {
    const NOTES = ['C5', 'G#4', 'G4', 'F#4'].map((x) => hz(midi(x))), STEP = 60 / 140 / 2, GL = 0.15, DN = Math.pow(2, -1 / 12);
    const sq = c.createOscillator(); sq.type = 'square'; sq.detune.value = DET;
    const tr = c.createOscillator(); tr.type = 'triangle'; tr.detune.value = -DET;
    const gs = c.createGain(); gs.gain.value = 0.65; const gt = c.createGain(); gt.gain.value = 0.35;   // 方波大聲一點：兩個基音差比較多，互相抵消時最多只小聲 6dB
    const wah = c.createBiquadFilter(); wah.type = 'lowpass'; wah.Q.value = 10;
    const amp = c.createGain(), trem = c.createGain();
    sq.connect(gs); tr.connect(gt); gs.connect(wah); gt.connect(wah); wah.connect(amp); amp.connect(trem); trem.connect(out);
    const os = [sq, tr], A = 0.125, last = NOTES.length - 1, tl = t + last * STEP;
    NOTES.forEach((f, i) => {
      const t0 = t + i * STEP;
      os.forEach((o) => { o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * DN, t0 + GL); });
      wah.frequency.setValueAtTime(350, t0); wah.frequency.exponentialRampToValueAtTime(2600, t0 + 0.04);
      amp.gain.setValueAtTime(1e-4, t0); amp.gain.exponentialRampToValueAtTime(A, t0 + 0.012);
      if (i < last) {
        wah.frequency.exponentialRampToValueAtTime(450, t0 + GL);
        amp.gain.exponentialRampToValueAtTime(A * 0.5, t0 + GL); amp.gain.exponentialRampToValueAtTime(1e-4, t0 + STEP - 0.005);   // 音和音之間斷開：哇、哇、哇
      }
    });
    const low = NOTES[last] * DN * DN;
    os.forEach((o) => o.frequency.exponentialRampToValueAtTime(low, tl + 1.0));   // 最後再慢慢垂下半音（洩氣）
    wah.frequency.exponentialRampToValueAtTime(600, tl + 1.0);
    amp.gain.setValueAtTime(A, tl + 0.3); amp.gain.exponentialRampToValueAtTime(1e-4, tl + 1.05);
    const lfo = c.createOscillator(); lfo.frequency.value = 15;                    // 15Hz 振幅顫音：最後一個音滑下來後才開始抖
    const dep = c.createGain(); dep.gain.setValueAtTime(0, t); dep.gain.setValueAtTime(0, tl + GL); dep.gain.linearRampToValueAtTime(0.35, tl + GL + 0.08);
    trem.gain.setValueAtTime(1, t); trem.gain.setValueAtTime(1, tl + GL); trem.gain.linearRampToValueAtTime(0.65, tl + GL + 0.08);   // 0.3～1.0 之間抖
    lfo.connect(dep); dep.connect(trem.gain);
    const te = tl + 1.08; sq.start(t); tr.start(t); lfo.start(t); sq.stop(te); tr.stop(te); lfo.stop(te);
    return { end: te + 0.05, nodes: [] };
  }
  /**
   * 拖鞋打中（第四版）：三層
   *   ① 「啪」：白噪音 → 1000Hz 高通，1 毫秒衝到最大、0.03 秒收掉（同第三版）
   *   ② 中頻的聲體：白噪音 → 700Hz 帶通，0.05 秒收掉（手機喇叭最擅長的頻段，第三版沒有）
   *   ③ 打到肉的重量：180Hz 解諧正弦 → 微幅失真（多出 540、900Hz，手機才聽得到）→ 1500Hz 低通，0.08 秒收掉
   */
  function slipperSfx4(c, out, B, t) {
    const n = noiseSrc(c, B, t, 0.06);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1000;
    const g1 = c.createGain(); hitEnv(g1, t, 0.9, 0.001, 0.03); n.connect(hp); hp.connect(g1); g1.connect(out);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.2;
    const g2 = c.createGain(); hitEnv(g2, t, 3.0, 0.002, 0.05); n.connect(bp); bp.connect(g2); g2.connect(out);
    const p = pair(c, 'sine', 180), g3 = c.createGain(), s = saturator(c, 3), lp = c.createBiquadFilter(), go = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = -3; go.gain.value = 1.2;
    hitEnv(g3, t, 0.9, 0.003, 0.08); p.out.connect(g3); g3.connect(s); s.connect(lp); lp.connect(go); go.connect(out);
    p.start(t); p.stop(t + 0.1);
    duck(B, t, 0.5, 0.15);
    return { end: t + 0.12, nodes: [] };
  }
  /**
   * 鍋蓋擋掉（第四版）：同第三版（2200、2850Hz 三角波＋4000Hz 以上雜音，0.06 秒後彈一下），兩個三角波都改成解諧的一對 → 金屬的閃爍感
   *   2200Hz 的解諧一對每秒互相抵消約 20 次 → 第二個只用一半音量（bal 0.5），變成閃爍而不是斷掉；平均小聲一點，音量乘 1.55 補回來
   */
  function shieldSfx4(c, out, B, t) {
    const hit = (t0, v) => {
      [2200, 2850].forEach((f) => {
        const p = pair(c, 'triangle', f, DET, 0.5), g = c.createGain(); hitEnv(g, t0, v * 1.55, 0.01, 0.1);
        p.out.connect(g); g.connect(out); p.start(t0); p.stop(t0 + 0.12);
      });
      const n = noiseSrc(c, B, t0, 0.03), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
      const gn = c.createGain(); gn.gain.setValueAtTime(v * 0.25, t0); gn.gain.exponentialRampToValueAtTime(1e-4, t0 + 0.025);
      n.connect(hp); hp.connect(gn); gn.connect(out);
    };
    hit(t, 0.35); hit(t + 0.06, 0.12);
    duck(B, t, 0.6, 0.1);
    return { end: t + 0.2, nodes: [] };
  }
  /**
   * 被打倒（第四版）：四層
   *   ① 最底層：三角波（解諧）0.3 秒內 120→40Hz → 重重落地（同第三版，耳機聽得到，手機放不出來）
   *   ② 手機聽得到的「嗚—咚」：三角波（解諧）0.18 秒內 220→70Hz → 微幅失真（多出 660→210、1100→350Hz 往下掉的泛音）→ 1200Hz 低通
   *   ③ 中層：白噪音 → 600Hz 低通（第三版 400Hz，手機聽不太到），3 毫秒爆開、0.25 秒收掉
   *   ④ 高層：25% 方波（解諧）C6 G5 D#5 C5 G4 每 40 毫秒往下跳（解諧後平均小聲一點，音量乘 1.4 補回來）
   */
  function knockSfx4(c, out, B, t) {
    const p = pair(c, 'triangle', 120), g = c.createGain();
    p.os.forEach((o) => { o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); });
    hitEnv(g, t, 0.5, 0.005, 0.38); p.out.connect(g); g.connect(out); p.start(t); p.stop(t + 0.4);
    const q = pair(c, 'triangle', 220), gq = c.createGain(), s = saturator(c, 3), lb = c.createBiquadFilter(), gb = c.createGain();
    q.os.forEach((o) => { o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.18); });
    lb.type = 'lowpass'; lb.frequency.value = 1200; lb.Q.value = -3; gb.gain.value = 2.0;
    hitEnv(gq, t, 0.9, 0.004, 0.22); q.out.connect(gq); gq.connect(s); s.connect(lb); lb.connect(gb); gb.connect(out); q.start(t); q.stop(t + 0.25);
    const n = noiseSrc(c, B, t, 0.3), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const gn = c.createGain(); hitEnv(gn, t, 1.1, 0.003, 0.25); n.connect(lp); lp.connect(gn); gn.connect(out);
    const NOTES = ['C6', 'G5', 'D#5', 'C5', 'G4'].map((x) => hz(midi(x))), t0 = t + 0.02, tE = t0 + NOTES.length * 0.04;
    const a = pair(c, 'pulse', NOTES[0]);
    NOTES.forEach((f, i) => a.os.forEach((o) => o.frequency.setValueAtTime(f, t0 + i * 0.04)));
    const la = c.createBiquadFilter(); la.type = 'lowpass'; la.frequency.value = 5000; la.Q.value = -3;
    const ga = c.createGain(); ga.gain.setValueAtTime(1e-4, t); ga.gain.setValueAtTime(1e-4, t0); ga.gain.exponentialRampToValueAtTime(0.24, t0 + 0.008);
    ga.gain.exponentialRampToValueAtTime(0.085, tE); ga.gain.exponentialRampToValueAtTime(1e-4, tE + 0.08);
    a.out.connect(la); la.connect(ga); ga.connect(out); a.start(t); a.stop(tE + 0.1);
    duck(B, t, 0.35, 0.35);
    return { end: tE + 0.12, nodes: [] };
  }
  /** 眼冒金星（第四版）：同第三版（方波每 15 毫秒亂跳、整體 1200→300Hz、13Hz LFO），方波改成解諧的一對（第二個 6 成音量），兩個一起跳 */
  function dizzySfx4(c, out, B, t) {
    const p = pair(c, 'square', 1200, DET, 0.6);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500; lp.Q.value = -3;
    const g = c.createGain(); p.out.connect(lp); lp.connect(g); g.connect(out);
    const STEP = 0.015, N = Math.round(0.5 / STEP);
    for (let i = 0; i < N; i++) { const f = 1200 * Math.pow(300 / 1200, i / (N - 1)) * (0.78 + Math.random() * 0.44); p.os.forEach((o) => o.frequency.setValueAtTime(f, t + i * STEP)); }
    const lfo = c.createOscillator(); lfo.frequency.value = 13;
    const dep = c.createGain(); dep.gain.value = 70; lfo.connect(dep); p.os.forEach((o) => dep.connect(o.frequency));
    g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(0.075, t + 0.01); g.gain.setValueAtTime(0.075, t + 0.35); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.5);
    p.start(t); lfo.start(t); p.stop(t + 0.52); lfo.stop(t + 0.52);
    return { end: t + 0.55, nodes: [] };
  }

  const SFX = {
    slipper: slipperSfx, pot: potSfx, evade: evadeSfx, shield: shieldSfx, knock: knockSfx, dizzy: dizzySfx, lose: loseSfx, win: winSfx,
    slipper4: slipperSfx4, pot4: (c, o, B, t) => potSfx4(c, o, B, t, 'p'), pot4g: (c, o, B, t) => potSfx4(c, o, B, t, 'g'),
    shield4: shieldSfx4, knock4: knockSfx4, dizzy4: dizzySfx4, lose4: loseSfx4,
  };

  /* ================= 播放、排程 ================= */
  const AHEAD = 0.12, TICK_MS = 25;
  let ctx = null, bus = null, cur = null, timer = null, vol = { music: 1, sfx: 1 }, hot = false;
  /** 總混音：音樂、音效各一個音量 → 壓縮器（大聲小聲比較平均，也避免爆音）→ 喇叭 */
  function masterChain(c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(c.destination);
    const music = c.createGain(); music.gain.value = MUSIC_LEVEL * vol.music;
    const duckG = c.createGain(); music.connect(duckG); duckG.connect(comp);       // 音效打中時把音樂壓低（ducking）
    const sfx = c.createGain(); sfx.gain.value = vol.sfx; sfx.connect(comp);
    return { comp, music, duck: duckG, sfx, noise: noiseBuffer(c) };
  }
  const MUSIC_LEVEL = 0.5;
  function ensure() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC(); bus = masterChain(ctx);
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  /** 建一條軌道；第三版戰鬥先把旋律音軌連同低通濾波器建好，熱血開關才有東西可以調 */
  function laneFor(c, dest, S, noise) {
    const L = makeLane(c, dest, S.fx(S), noise);
    if (S.v3 && S.bassPat) { L.hot = hot; L.track('lead', { pan: -0.05, echo: 0.22, rev: 0.16, lp: hot ? HOT_HZ : CALM_HZ, gain: hot ? HOT_GAIN : 1 }); }
    return L;
  }
  function startSong(S) {
    const c = ensure(); if (!c) return;
    stopBGM(); prepare(S);
    cur = { S, L: laneFor(c, bus.music, S, bus.noise), i: 0, t: c.currentTime + 0.06 };
    tick(); timer = setInterval(tick, TICK_MS);
  }
  /**
   * 熱血爆發：true 時戰鬥旋律的低通濾波 0.12 秒時間常數打開到 6000Hz、音量 +4dB（鋸齒波整個亮起來），
   * false 時 0.4 秒時間常數收回 1500Hz、原本音量（溫和、退到後面）。只影響第三版戰鬥；先設好再開始播也可以
   */
  function setBattleIntensity(high) {
    hot = !!high;
    if (!cur || !cur.L.track) return;
    cur.L.hot = hot;
    const tr = cur.L.track('lead'), f = tr.lp; if (!f) return;
    const t = ctx.currentTime, tc = hot ? 0.12 : 0.4;
    f.frequency.cancelScheduledValues(t); f.frequency.setValueAtTime(f.frequency.value, t); f.frequency.setTargetAtTime(hot ? HOT_HZ : CALM_HZ, t, tc);
    tr.gain.cancelScheduledValues(t); tr.gain.setValueAtTime(tr.gain.value, t); tr.gain.setTargetAtTime(hot ? HOT_GAIN : 1, t, tc);
  }
  /** 時鐘排程：把「現在 ～ 現在＋0.12 秒」之間該響的格子都排好 */
  function tick() {
    if (!cur) return;
    if (cur.t < ctx.currentTime) cur.t = ctx.currentTime + 0.02;   // 手機忙的時候計時器會晚到，跳過來不及的部分
    while (cur.t < ctx.currentTime + AHEAD) { cur.S.step(cur.L, cur.i, cur.t); cur.t += cur.S.stepDur; cur.i++; }
  }
  function stopBGM() {
    if (!cur) return;
    clearInterval(timer); timer = null;
    const o = cur.L.out, t = ctx.currentTime;
    o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.05);
    setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 300);
    cur = null;
  }
  /** 播一個音效；結束後把有反饋迴路的節點斷開 */
  function playSfx(name) {
    const c = ensure(); if (!c || !SFX[name]) return;
    const out = c.createGain(); out.connect(bus.sfx);
    const r = SFX[name](c, out, bus, c.currentTime + 0.02);
    setTimeout(() => { [out].concat(r.nodes).forEach((n) => { try { n.disconnect(); } catch (e) {} }); }, (r.end - c.currentTime) * 1000 + 200);
  }
  function setVolume(v) {
    Object.assign(vol, v || {});
    if (bus) { bus.music.gain.value = MUSIC_LEVEL * vol.music; bus.sfx.gain.value = vol.sfx; }
  }
  /**
   * 測試用：離線算出一段聲音，檢查音量、有沒有爆音、熱血開關有沒有變亮
   *   曲子：'lobby'、'battle'（第三版）、'lobby2'、'battle2'（第二版）、'battleHot'（第三版熱血）
   *   音效：'slipper'、'pot'、'evade'、'shield'、'knock'、'dizzy'、'lose'、'win'（第三版）；
   *         'slipper4'、'pot4'（手機版）、'pot4g'（照 Google）、'shield4'、'knock4'、'dizzy4'、'lose4'（第四版）
   */
  async function render(name, sec, sr) {
    sr = sr || 44100;
    const oc = new OfflineAudioContext(2, Math.ceil(sec * sr), sr), b = masterChain(oc);
    if (SFX[name]) { const out = oc.createGain(); out.connect(b.sfx); SFX[name](oc, out, b, 0.05); }
    else {
      const S = prepare({ lobby: LOBBY3, battle: BATTLE3, lobby2: LOBBY, battle2: BATTLE, battleHot: BATTLE3 }[name]);
      const keep = hot; hot = name === 'battleHot';
      const L = laneFor(oc, b.music, S, b.noise); hot = keep;
      for (let i = 0, t = 0.05; t < sec; i++, t += S.stepDur) S.step(L, i, t);
    }
    return oc.startRendering();
  }

  const API = {
    /** opts.version＝2 播上一版（試聽比較用），沒給就是第三版 */
    playLobbyBGM: (opts) => startSong(opts && opts.version === 2 ? LOBBY : LOBBY3),
    playBattleBGM: (opts) => startSong(opts && opts.version === 2 ? BATTLE : BATTLE3),
    stopBGM, setBattleIntensity, setVolume, render,
    /** 用名字播音效（試聽頁比較用）：名字見 render 的說明，例如 'pot4'、'lose4' */
    playSfx,
    playSlipperSFX: () => playSfx('slipper'),
    playIronPotSFX: () => playSfx('pot'),
    playEvadeSFX: () => playSfx('evade'),
    playShieldBlockSFX: () => playSfx('shield'),
    playKnockoutSFX: () => playSfx('knock'),
    playDizzySFX: () => playSfx('dizzy'),
    playLoseSFX: () => playSfx('lose'),
    playWinSFX: () => playSfx('win'),
    get playing() { return cur ? (cur.S.bassPat ? 'battle' : 'lobby') + (cur.S.v3 ? '' : '2') : null; },
    get intensity() { return hot; },
  };
  global.ChipAudio = API;
  ['playLobbyBGM', 'playBattleBGM', 'stopBGM', 'setBattleIntensity', 'playSlipperSFX', 'playIronPotSFX', 'playEvadeSFX',
    'playShieldBlockSFX', 'playKnockoutSFX', 'playDizzySFX', 'playLoseSFX', 'playWinSFX'].forEach((k) => { global[k] = API[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
