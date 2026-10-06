// Shared text layer: hook title, HUD counter, captions, end card, fades.
// Every value is a pure function of t so frames render deterministically.

const css = `
@import url('/engine/fonts/fonts.css');
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000}
#stage{position:absolute;inset:0}
#ov{position:absolute;inset:0;pointer-events:none;color:#f5eee2}
/* Layout measured from the top competitor (1080x1920) and kept inside TikTok's UI safe zone:
   nothing above y=200 (tabs), nothing right of x=880 below y=900 (action icons), nothing below y=1560 (caption/username). */
.blob{position:absolute;border-radius:50%;filter:blur(34px);background:radial-gradient(ellipse at center,rgba(6,9,16,.4),rgba(6,9,16,.18) 45%,rgba(6,9,16,0) 72%)}
#hud{position:absolute;left:66px;top:236px}
#hud .blob{left:-150px;top:-120px;width:720px;height:400px;background:radial-gradient(ellipse at center,rgba(6,9,16,.5),rgba(6,9,16,.24) 45%,rgba(6,9,16,0) 72%)}
#hudL,#hudS{position:relative;font:600 23px Inter,sans-serif;letter-spacing:.21em;text-transform:uppercase;opacity:.9;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.6)}
#hudV{position:relative;margin-top:12px;font:400 68px/1 Fraunces,serif;font-variation-settings:'opsz' 72;font-variant-numeric:lining-nums;text-shadow:0 2px 3px rgba(0,0,0,.45),0 2px 18px rgba(0,0,0,.45);white-space:nowrap}
#hudS{margin-top:14px;font-size:20px;opacity:.68}
#title{position:absolute;left:50%;top:572px;width:720px;transform:translateX(-50%);text-align:center;font:400 86px/1.13 Fraunces,serif;font-variation-settings:'opsz' 96;text-shadow:0 1px 2px rgba(0,0,0,.5),0 3px 22px rgba(0,0,0,.4)}
#title .blob{display:none}
#titleT{position:relative}
#cap{position:absolute;left:50%;top:1300px;width:640px;transform:translateX(-50%);text-align:center}
#cap .blob{left:-60px;right:-60px;top:-62px;height:196px;background:radial-gradient(ellipse at center,rgba(6,9,16,.45),rgba(6,9,16,.2) 45%,rgba(6,9,16,0) 72%)}
#capT{position:relative;font:italic 500 50px/1.18 'EB Garamond',serif;text-shadow:0 1px 2px rgba(0,0,0,.6),0 2px 14px rgba(0,0,0,.45)}
#black{position:absolute;inset:0;background:#000}
#end{position:absolute;inset:0;background:#141414;text-align:center}
#endT{position:absolute;left:50%;top:850px;width:700px;transform:translateX(-50%);font:400 66px/1.18 Fraunces,serif;font-variation-settings:'opsz' 72}
#endS{position:absolute;left:50%;top:1040px;width:780px;transform:translateX(-50%);font:500 20px/1.8 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;opacity:.45}
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
  <div id="title"><div class="blob"></div><div id="titleT"></div></div>
  <div id="cap"><div class="blob"></div><div id="capT"></div></div>
  <div id="black"></div>
  <div id="end"><div id="endT"></div><div id="endS"></div></div>`;
  document.body.appendChild(ov);
  const $ = id => document.getElementById(id);
  return { hud: $('hud'), L: $('hudL'), V: $('hudV'), S: $('hudS'), title: $('title'), titleT: $('titleT'), cap: $('cap'), capT: $('capT'), black: $('black'), end: $('end'), endT: $('endT'), endS: $('endS'), tint: $('tint') };
}

// spec: { title:{text,s,e}, hud(t)->{label,value,sub,o}, captions:[[s,e,text]], black:[s,e], end:{s,title,sub}, tint(t)->css }
export function updateOverlay(o, spec, t) {
  o.titleT.textContent = spec.title.text;
  o.title.style.opacity = window01(t, spec.title.s, spec.title.e, 0.5);

  const h = spec.hud(t);
  o.L.textContent = h.label; o.V.textContent = h.value; o.S.textContent = h.sub;
  o.hud.style.opacity = h.o ?? 1;

  let cap = '', co = 0;
  for (const [s, e, text] of spec.captions) if (t >= s && t < e) { cap = text; co = window01(t, s, e, 0.6); }
  o.capT.textContent = cap; o.cap.style.opacity = co; o.cap.style.transform = `translateX(-50%) translateY(${(1 - co) * 10}px)`;

  o.black.style.opacity = smooth(spec.black[0], spec.black[1], t);
  o.end.style.opacity = smooth(spec.end.s, spec.end.s + 0.6, t);
  o.endT.textContent = spec.end.title; o.endS.textContent = spec.end.sub;
  o.tint.style.background = spec.tint ? spec.tint(t) : 'none';
}
