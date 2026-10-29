process.on('unhandledRejection', e => console.error('UNHANDLED REJECTION:', e));
process.on('uncaughtException', e => console.error('UNCAUGHT EXCEPTION:', e));

const { purgeStaleBuildCache, buildApplicationInternal } = require('./node_modules/@angular/build/src/builders/dev-server/internal.js');
const { normalizeOptions } = require('./node_modules/@angular/build/src/builders/dev-server/options.js');
const { checkPort } = require('./node_modules/@angular/build/src/utils/check-port.js');
const { serveWithVite } = require('./node_modules/@angular/build/src/builders/dev-server/vite/index.js');

async function test() {
  console.log('1. Starting test...');
  const fakeContext = {
    target: { project: 'web-app', target: 'serve' },
    workspaceRoot: process.cwd(),
    currentDirectory: process.cwd(),
    logger: {
      info: (...args) => console.log('[INFO]', ...args),
      warn: (...args) => console.warn('[WARN]', ...args),
      error: (...args) => console.error('[ERROR]', ...args),
      createChild: () => fakeContext.logger,
    },
    getBuilderNameForTarget: async () => '@angular/build:application',
    getTargetOptions: async () => ({
      browser: 'src/main.ts',
      tsConfig: 'tsconfig.app.json',
    }),
    getProjectMetadata: async () => ({ root: '', sourceRoot: 'src' }),
    validateOptions: async (options) => options,
    addTeardown: (fn) => {},
  };

  console.log('2. Purging stale cache...');
  await purgeStaleBuildCache(fakeContext);
  console.log('3. Normalizing options...');
  const normalizedOptions = await normalizeOptions(fakeContext, 'web-app', { port: 4201, host: 'localhost' });
  console.log('4. Normalized options:', normalizedOptions);
  console.log('5. Checking port...');
  normalizedOptions.port = await checkPort(normalizedOptions.port, normalizedOptions.host);
  console.log('6. Port checked:', normalizedOptions.port);
  console.log('7. Calling serveWithVite...');
  const iterator = serveWithVite(
    normalizedOptions,
    '@angular/build:application',
    (opts, ctx, plugins) => {
      console.log('-> buildApplicationInternal called');
      return buildApplicationInternal(opts, ctx, { codePlugins: plugins });
    },
    fakeContext,
    {},
    {}
  );
  console.log('8. Iterating serveWithVite...');
  for await (const res of iterator) {
    console.log('9. Received:', res);
  }
}

test().catch(e => console.error('FATAL:', e));
