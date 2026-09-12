const path = require('node:path');
const fs = require('node:fs');
const {compile} = require('@vue/compiler-dom');
const {code} = compile(`<template v-if="!enabled"><template v-for="(item,index) in items" :key="itemKey(item,index)"><slot :item="item" :index="index" /></template></template><div v-else class="history-window"><template v-for="(item,index) in nativeItems" :key="itemKey(item,index)"><slot :item="item" :index="index" /></template></div>`,{mode:'function',prefixIdentifiers:true});
const source = fs.readFileSync(path.join(__dirname,'fixture-app.js'),'utf8').replace('/* COMPILED_HISTORY_WINDOW */ null',`(()=>{${code}})()`);
require('esbuild').buildSync({stdin:{contents:source,resolveDir:__dirname,sourcefile:'fixture-app.js'},bundle:true,
  outfile:path.join(__dirname,'fixture-bundle.js'),format:'iife',
  define:{'process.env.NODE_ENV':'"production"',__VUE_OPTIONS_API__:'true',
    __VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}});
