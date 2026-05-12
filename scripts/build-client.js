const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const clientDir = path.join(projectRoot, 'client');
const srcDir = path.join(clientDir, 'src');
const buildDir = path.join(clientDir, 'build');
const watch = process.argv.includes('--watch');

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
