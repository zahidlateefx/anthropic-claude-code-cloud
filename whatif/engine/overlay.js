// Shared text layer: hook title, HUD counter, captions, end card, fades.
// Every value is a pure function of t so frames render deterministically.

const css = `
@import url('/engine/fonts/fonts.css');
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000}
#stage{position:absolute;inset:0}
#ov{position:absolute;inset:0;pointer-events:none;color:#fff}
.blob{position:absolute;border-radius:50%;filter:blur(28px);background:radial-gradient(ellipse at center,rgba(0,0,0,.42),rgba(0,0,0,0) 70%)}
#hud{position:absolute;left:66px;top:228px}
#hud .blob{left:-120px;top:-110px;width:760px;height:420px}
#hudL,#hudS{font:600 28px Inter,sans-serif;letter-spacing:.22em;text-transform:uppercase;opacity:.85;position:relative}
#hudS{font-weight:500;font-size:24px;opacity:.62;margin-top:6px}
#hudV{font:400 96px/1.1 Fraunces,serif;position:relative;font-variant-numeric:lining-nums;text-shadow:0 2px 18px rgba(0,0,0,.35)}
#title{position:absolute;left:90px;right:90px;top:520px;text-align:center;font:400 70px/1.18 Fraunces,serif;text-shadow:0 2px 24px rgba(0,0,0,.55)}
#cap{position:absolute;left:0;right:0;top:1290px;text-align:center}
#cap .blob{left:140px;right:140px;top:-70px;height:200px}
#capT{position:relative;font:italic 400 50px 'EB Garamond',serif;text-shadow:0 2px 14px rgba(0,0,0,.6)}
#black{position:absolute;inset:0;background:#000}
#end{position:absolute;inset:0;background:#121212;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
#endT{font:400 64px/1.2 Fraunces,serif;max-width:800px}
#endS{margin-top:34px;font:500 22px Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;opacity:.5;max-width:860px;line-height:1.7}
#tint{position:absolute;inset:0}
`;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
// 1 inside [s,e], with fade edges of length f
export const window01 = (t, s, e, f = 0.45) => Math.min(smooth(s, s + f, t), 1 - smooth(e - f, e, t));

export function setupOverlay() {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const ov = document.createElement('div'); ov.id = 'ov';
  ov.innerHTML = `<div id="tint"></div>
  <div id="hud"><div class="blob"></div><div id="hudL"></div><div id="hudV"></div><div id="hudS"></div></div>
  <div id="title"></div>
  <div id="cap"><div class="blob"></div><div id="capT"></div></div>
  <div id="black"></div>
  <div id="end"><div id="endT"></div><div id="endS"></div></div>`;
  document.body.appendChild(ov);
  const $ = id => document.getElementById(id);
  return { hud: $('hud'), L: $('hudL'), V: $('hudV'), S: $('hudS'), title: $('title'), cap: $('cap'), capT: $('capT'), black: $('black'), end: $('end'), endT: $('endT'), endS: $('endS'), tint: $('tint') };
}

// spec: { title:{text,s,e}, hud(t)->{label,value,sub,o}, captions:[[s,e,text]], black:[s,e], end:{s,title,sub}, tint(t)->css }
export function updateOverlay(o, spec, t) {
  o.title.textContent = spec.title.text;
  o.title.style.opacity = window01(t, spec.title.s, spec.title.e, 0.5);

  const h = spec.hud(t);
  o.L.textContent = h.label; o.V.textContent = h.value; o.S.textContent = h.sub;
  o.hud.style.opacity = h.o ?? 1;

  let cap = '', co = 0;
  for (const [s, e, text] of spec.captions) if (t >= s && t < e) { cap = text; co = window01(t, s, e, 0.4); }
  o.capT.textContent = cap; o.cap.style.opacity = co;

  o.black.style.opacity = smooth(spec.black[0], spec.black[1], t);
  o.end.style.opacity = smooth(spec.end.s, spec.end.s + 0.6, t);
  o.endT.textContent = spec.end.title; o.endS.textContent = spec.end.sub;
  o.tint.style.background = spec.tint ? spec.tint(t) : 'none';
}
