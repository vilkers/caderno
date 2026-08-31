/* palettes.js — paletas completas (cada uma define o look inteiro) */

export const PALETTES = [
  { id:'noir',   name:'Noir',    vars:{ bg:'#0c0c0c', surface:'#151515', surface2:'#1e1e1e', fg:'#f4f2ee', dim:'#918d88', line:'rgba(244,242,238,.23)', line2:'rgba(244,242,238,.36)', accent:'#ff4d17', accentTxt:'#ff4d17', ink:'#0c0c0c', ok:'#3ecf8e', erro:'#e85e62' } },
  { id:'papel',  name:'Papel',   vars:{ bg:'#f3f1eb', surface:'#ffffff', surface2:'#e9e6de', fg:'#131210', dim:'#5b5751', line:'rgba(19,18,16,.29)',     line2:'rgba(19,18,16,.46)',     accent:'#1f3bff', accentTxt:'#1e39f1', ink:'#ffffff', ok:'#1e6344', erro:'#a03236' } },
  { id:'acido',  name:'Ácido',   vars:{ bg:'#0d0f0a', surface:'#151810', surface2:'#1d2117', fg:'#eef3e2', dim:'#9fa58e', line:'rgba(238,243,226,.23)', line2:'rgba(238,243,226,.36)', accent:'#ccff00', accentTxt:'#ccff00', ink:'#0d0f0a', ok:'#3ecf8e', erro:'#ed7f82' } },
  { id:'neon',   name:'Neon',    vars:{ bg:'#0a0910', surface:'#131120', surface2:'#1b1830', fg:'#f0edff', dim:'#8c87ad', line:'rgba(240,237,255,.24)', line2:'rgba(240,237,255,.37)', accent:'#d946ef', accentTxt:'#da4df0', ink:'#0a0910', ok:'#3ecf8e', erro:'#e85a5f' } },
  { id:'oceano', name:'Oceano',  vars:{ bg:'#061018', surface:'#0c1a24', surface2:'#122430', fg:'#e6f2f7', dim:'#889daa', line:'rgba(230,242,247,.23)', line2:'rgba(230,242,247,.36)', accent:'#22d3ee', accentTxt:'#22d3ee', ink:'#061018', ok:'#3ecf8e', erro:'#eb7478' } },
  { id:'terra',  name:'Terra',   vars:{ bg:'#efe6da', surface:'#f8f2e9', surface2:'#e3d7c6', fg:'#241c14', dim:'#5f5243', line:'rgba(36,28,20,.29)',     line2:'rgba(36,28,20,.50)',     accent:'#c2410c', accentTxt:'#93350d', ink:'#fdf7f0', ok:'#1e6344', erro:'#9c3134' } },
  { id:'rosa',   name:'Rosa',    vars:{ bg:'#f7ecef', surface:'#fffafb', surface2:'#eddfe3', fg:'#1c1013', dim:'#695257', line:'rgba(28,16,19,.29)',     line2:'rgba(28,16,19,.46)',     accent:'#e11d48', accentTxt:'#a81838', ink:'#fff9fa', ok:'#1e6344', erro:'#a03236' } },
  { id:'mono',   name:'Mono',    vars:{ bg:'#000000', surface:'#0b0b0b', surface2:'#141414', fg:'#ffffff', dim:'#9a9a9a', line:'rgba(255,255,255,.25)',  line2:'rgba(255,255,255,.38)',  accent:'#ffffff', accentTxt:'#ffffff', ink:'#000000', ok:'#3ecf8e', erro:'#ea6d71' } },
];

export const getPalette = id => PALETTES.find(p => p.id === id) || PALETTES[0];

export function applyPalette(id) {
  const p = getPalette(id);
  const r = document.documentElement.style;
  r.setProperty('--bg', p.vars.bg);
  r.setProperty('--surface', p.vars.surface);
  r.setProperty('--surface-2', p.vars.surface2);
  r.setProperty('--fg', p.vars.fg);
  r.setProperty('--dim', p.vars.dim);
  r.setProperty('--line', p.vars.line);
  r.setProperty('--line-2', p.vars.line2);
  r.setProperty('--accent', p.vars.accent);
  r.setProperty('--accent-txt', p.vars.accentTxt);
  r.setProperty('--ink', p.vars.ink);
  /* verde e vermelho não são o acento, mas também não podem ser fixos: o
     mesmo #3ecf8e some no Papel. Cada paleta carrega o seu, medido. */
  r.setProperty('--ok', p.vars.ok);
  r.setProperty('--erro', p.vars.erro);
  document.documentElement.dataset.palette = p.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = p.vars.bg;
  return p;
}
