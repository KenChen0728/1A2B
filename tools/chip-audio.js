/* =====================================================================
 * chip-audio.js ── 幾A幾B 第二版音樂與音效（試聽中，還沒放進遊戲）
 * 全部用 Web Audio API 當場合成，沒有任何音檔。
 *
 * 用法（手機瀏覽器規定：第一次一定要在「點擊／觸控」的事件裡呼叫才會出聲）：
 *   ChipAudio.playLobbyBGM();    大廳背景音樂（無限循環）
 *   ChipAudio.playBattleBGM();   戰鬥解謎背景音樂（無限循環）
 *   ChipAudio.stopBGM();         停止背景音樂（0.05 秒內收乾淨，回音殘響也一起收，不會漏拍）
 *   ChipAudio.playWinSFX();      猜中 4A 的獲勝音效
 *   ChipAudio.setVolume({music: 1, sfx: 1});
 * 也可以直接呼叫 playLobbyBGM()、playBattleBGM()、playWinSFX()、stopBGM()。
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
    const output = c.createChannelMerger(2);
    const k = c.sampleRate / 44100, COMB = [1116, 1188, 1277, 1356], AP = [556, 441], SPREAD = 23;
    for (let ch = 0; ch < 2; ch++) {
      const sum = c.createGain(); sum.gain.value = 0.25;              // 4 個梳狀濾波平均起來
      COMB.forEach((n) => {
        const d = c.createDelay(0.1); d.delayTime.value = (n + ch * SPREAD) * k / c.sampleRate;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = damp; lp.Q.value = -3;
        const fb = c.createGain(); fb.gain.value = room;
        input.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d);   // 反饋迴路
        d.connect(sum);
      });
      let node = sum;
      AP.forEach((n) => { node = allpass(c, node, (n + ch * SPREAD) * k / c.sampleRate, 0.5); });
      node.connect(output, 0, ch);
    }
    return { input, output };
  }
  /** 全通濾波器：v = 輸入 + g × (延遲後的 v)；輸出 = −g × v + (延遲後的 v) */
  function allpass(c, src, delay, g) {
    const v = c.createGain(), d = c.createDelay(0.1), fb = c.createGain(), ff = c.createGain(), out = c.createGain();
    d.delayTime.value = delay; fb.gain.value = g; ff.gain.value = -g;
    src.connect(v); v.connect(d); d.connect(fb); fb.connect(v);
    v.connect(ff); ff.connect(out); d.connect(out);
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
    /** 取得音軌（第一次用到才建立）：gain 音量、pan 左右、echo／rev 送到回音／殘響的量 */
    function track(name, o) {
      if (tracks[name]) return tracks[name];
      o = o || {};
      const g = c.createGain(); g.gain.value = o.gain || 1;
      const p = panner(c, o.pan || 0); g.connect(p); p.connect(dry);
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
    const c = L.c, f = hz(m), end = t + Math.max(0.03, dur - GAP);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
    lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.08);
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
   * 前 4 小節只有旋律、分解和弦、低音；第 5 小節加入和弦鋪底；第 9 小節才加入很輕的節奏
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
      // 5. 很輕的節奏：第 9 小節開始，像心跳一樣的大鼓和反拍的鈸
      if (bar >= 8) { if (s === 0) kick(L, t, 0.16); if (s === 3 || s === 7) hat(L, t, 0.05, 0.05); }
    },
  };

  /**
   * 戰鬥：E 小調、126 BPM、一格＝十六分音符、16 小節（約 30 秒）一循環
   * 熱血、機智：鋸齒波旋律大量用切分音（落在反拍的十六分音符），每個音都是斷音；
   * 三角波低音根音、高八度來回跳；第 5 小節開始反拍加入和弦「切」；第 8、16 小節最後小鼓連打
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

  /**
   * 猜中 4A：一個 25% 方波振盪器，每 33 毫秒換一個音（setValueAtTime 直接跳過去、不滑音 → 紅白機的味道）。
   * 0.4 秒內在 C 大三和弦裡一圈一圈往上爬：C5 E5 G5 C6｜E5 G5 C6 E6｜G5 C6 E6 G6，
   * 最後定格在 C6 的長音，加上 7Hz 的快速顫音閃閃發亮，再慢慢消失；短短的左右回音讓尾巴更亮。
   * 音量：10 毫秒起音、琶音過程越來越大聲、長音維持 0.12 秒、0.8 秒內淡出。
   */
  function winSfx(c, dest, t) {
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
    amp.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    amp.gain.linearRampToValueAtTime(0.24, tEnd);
    amp.gain.setValueAtTime(0.24, tEnd + 0.12);
    amp.gain.exponentialRampToValueAtTime(1e-4, tEnd + 0.9);
    o.start(t); lfo.start(t); o.stop(tEnd + 0.95); lfo.stop(tEnd + 0.95);
    return { end: tEnd + 1.8, nodes: [amp, echo.output, send] };
  }

  /* ================= 播放、排程 ================= */
  const AHEAD = 0.12, TICK_MS = 25;
  let ctx = null, bus = null, cur = null, timer = null, vol = { music: 1, sfx: 1 };
  /** 總混音：音樂、音效各一個音量 → 壓縮器（大聲小聲比較平均，也避免爆音）→ 喇叭 */
  function masterChain(c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(c.destination);
    const music = c.createGain(); music.gain.value = MUSIC_LEVEL * vol.music; music.connect(comp);
    const sfx = c.createGain(); sfx.gain.value = vol.sfx; sfx.connect(comp);
    return { comp, music, sfx, noise: noiseBuffer(c) };
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
  function startSong(S) {
    const c = ensure(); if (!c) return;
    stopBGM(); prepare(S);
    cur = { S, L: makeLane(c, bus.music, S.fx(S), bus.noise), i: 0, t: c.currentTime + 0.06 };
    tick(); timer = setInterval(tick, TICK_MS);
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
  function playWinSFX() {
    const c = ensure(); if (!c) return;
    const r = winSfx(c, bus.sfx, c.currentTime + 0.02);
    setTimeout(() => r.nodes.forEach((n) => { try { n.disconnect(); } catch (e) {} }), (r.end - c.currentTime) * 1000);
  }
  function setVolume(v) {
    Object.assign(vol, v || {});
    if (bus) { bus.music.gain.value = MUSIC_LEVEL * vol.music; bus.sfx.gain.value = vol.sfx; }
  }
  /** 測試用：離線算出一段聲音（'lobby'、'battle'、'win'），檢查音量、有沒有爆音 */
  async function render(name, sec, sr) {
    sr = sr || 44100;
    const oc = new OfflineAudioContext(2, Math.ceil(sec * sr), sr), b = masterChain(oc);
    if (name === 'win') winSfx(oc, b.sfx, 0.05);
    else {
      const S = prepare(name === 'lobby' ? LOBBY : BATTLE), L = makeLane(oc, b.music, S.fx(S), b.noise);
      for (let i = 0, t = 0.05; t < sec; i++, t += S.stepDur) S.step(L, i, t);
    }
    return oc.startRendering();
  }

  const API = {
    playLobbyBGM: () => startSong(LOBBY),
    playBattleBGM: () => startSong(BATTLE),
    stopBGM, playWinSFX, setVolume, render,
    get playing() { return cur ? (cur.S === LOBBY ? 'lobby' : 'battle') : null; },
  };
  global.ChipAudio = API;
  global.playLobbyBGM = API.playLobbyBGM;
  global.playBattleBGM = API.playBattleBGM;
  global.playWinSFX = API.playWinSFX;
  global.stopBGM = API.stopBGM;
})(typeof window !== 'undefined' ? window : globalThis);
