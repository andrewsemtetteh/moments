// Renders one illustration big (optionally cropped) to inspect small details like hands.
// Usage: node marketing/carousels/_tools/zoom.mjs marketing/carousels/_tools <illustration> out.png ["x y w h"]
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const [,, toolsDir, name, out, vb] = process.argv;
const { ILLUSTRATIONS } = await import(pathToFileURL(toolsDir + '/illustrations.mjs').href);
let svg = ILLUSTRATIONS[name]({ a: '#FF4D6D', pop: '#FFE7A0', card: '#FFFFFF', back1: '#9686F0', back2: '#5E4CCB' });
if (vb) svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${vb}"`).replace(/width="\d+" height="\d+"/, 'width="900" height="600"');
const html = out.replace(/\.png$/, '.html');
writeFileSync(html, `<!doctype html><body style="margin:0;background:#7B69E8">${svg.replace(/<svg /, '<svg style="display:block" ')}</body>`);
execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--hide-scrollbars','--run-all-compositor-stages-before-draw','--window-size=900,600',`--screenshot=${out}`, pathToFileURL(html).href], { stdio: 'ignore' });
console.log(out);
