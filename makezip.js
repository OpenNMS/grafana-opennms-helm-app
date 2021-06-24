#!/usr/bin/env node

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const spawn = require('child_process').spawnSync;
const copy = require('recursive-copy');
const rimraf = require('rimraf');
const which = require('which');

const pkginfo = require('./package.json');

try {
  which.sync('zip');
} catch (err) {
  console.log('zip executable not found');
  process.exit(1);
}

const topdir = process.cwd();

const version = pkginfo.version;

const pkgname = 'opennms-helm-app';
const srcdir = path.join(topdir, 'dist');
const workdir = path.join(topdir, 'tmp', pkgname);
const packagedir = path.join(srcdir, 'packages');
const zipfile = path.join(packagedir, `${pkgname}-${version}.zip`);

rimraf.sync(workdir);
fs.mkdirsSync(workdir);
fs.mkdirsSync(packagedir);
return copy(path.join(srcdir), workdir, {
  dot: true,
  filter: [
    '**/*',
    '!packages',
    '!packages/*',
  ],
  junk: false,
}).then((results) => {
  console.info(results.length + ' files copied to ' + workdir);

  console.info('* running zip');
  var ret = spawn('zip', ['-r', zipfile, pkgname], {
    cwd: path.join(topdir, 'tmp'),
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  if (ret.error) {
    console.log('zip failed');
    process.exit(1);
  }

  rimraf.sync(workdir);
  process.exit(0);
}).catch((error) => {
  console.log('Copy failed: ' + error);
  process.exit(1);
});
