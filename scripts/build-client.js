const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const clientDir = path.join(projectRoot, 'client');
const srcDir = path.join(clientDir, 'src');
const assetsDir = path.join(clientDir, 'assets');
const buildDir = path.join(clientDir, 'build');
const watch = process.argv.includes('--watch');

// Recursive folder copy — used to bring static assets (logo, etc.) into build/.
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function build() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const config = {
    entryPoints: [path.join(srcDir, 'main.jsx')],
    outfile: path.join(buildDir, 'app.js'),
    bundle: true,
    minify: !watch,
    sourcemap: watch,
    target: ['es2019'],
    jsx: 'automatic',
    loader: { '.js': 'jsx', '.jsx': 'jsx' },
    define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  };

  fs.copyFileSync(path.join(clientDir, 'index.html'), path.join(buildDir, 'index.html'));

  // Brand assets (logo, etc.) — copied alongside index.html so the
  // client can resolve `assets/logo-mark.png` at runtime.
  copyDir(assetsDir, path.join(buildDir, 'assets'));

  if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('esbuild: watching client/src for changes...');
  } else {
    await esbuild.build(config);
    console.log('esbuild: built client to', buildDir);
  }
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
