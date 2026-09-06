const path = require('node:path');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'fixture-app.js')],bundle:true,
  outfile:path.join(__dirname,'fixture-bundle.js'),format:'iife',
  define:{'process.env.NODE_ENV':'"production"',__VUE_OPTIONS_API__:'true',
    __VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}});
