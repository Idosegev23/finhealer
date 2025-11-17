npm error code EPERM
npm error syscall open
npm error path /usr/local/lib/node_modules/npm/node_modules/@sigstore/verify/dist/key/index.js
npm error errno -1
npm error Error: EPERM: operation not permitted, open '/usr/local/lib/node_modules/npm/node_modules/@sigstore/verify/dist/key/index.js'
npm error     at Object.readFileSync (node:fs:448:20)
npm error     at Module._extensions..js (node:internal/modules/cjs/loader:1378:18)
npm error     at Module.load (node:internal/modules/cjs/loader:1208:32)
npm error     at Module._load (node:internal/modules/cjs/loader:1024:12)
npm error     at Module.require (node:internal/modules/cjs/loader:1233:19)
npm error     at require (node:internal/modules/helpers:179:18)
npm error     at Object.<anonymous> (/usr/local/lib/node_modules/npm/node_modules/@sigstore/verify/dist/verifier.js:21:15)
npm error     at Module._compile (node:internal/modules/cjs/loader:1358:14)
npm error     at Module._extensions..js (node:internal/modules/cjs/loader:1416:10)
npm error     at Module.load (node:internal/modules/cjs/loader:1208:32) {
npm error   errno: -1,
npm error   code: 'EPERM',
npm error   syscall: 'open',
npm error   path: '/usr/local/lib/node_modules/npm/node_modules/@sigstore/verify/dist/key/index.js'
npm error }
npm error
npm error The operation was rejected by your operating system.
npm error It is likely you do not have the permissions to access this file as the current user
npm error
npm error If you believe this might be a permissions issue, please double-check the
npm error permissions of the file and its containing directories, or try running
npm error the command again as root/Administrator.

npm error Log files were not written due to an error writing to the directory: /Users/idosegev/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
