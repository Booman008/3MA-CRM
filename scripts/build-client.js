const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'client', 'public');
const buildDir = path.join(projectRoot, 'client', 'build');

async function build() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(publicDir, 'app.jsx')],
    outfile: path.join(buildDir, 'app.js'),
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2019'],
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx',
    },
  });

  const indexPath = path.join(publicDir, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8')
    .replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\s*/i, '')
    .replace(/<script type="text\/babel" src="app\.jsx"><\/script>/i, '<script src="app.js"></script>');

  fs.writeFileSync(path.join(buildDir, 'index.html'), indexHtml);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
