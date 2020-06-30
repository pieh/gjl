if (process.env.GJL_IPC_ID) {
  const ipc = require("node-ipc");
  const signalExit = require(`signal-exit`);
  const { INTERVAL_TIME } = require(`./constants`);
  const loopDelay = require("event-loop-delay");
  const fs = require(`fs-extra`);

  const ipc_id = process.env.GJL_IPC_ID;

  ipc.config.id = `${ipc_id}_${process.pid}`;
  ipc.config.retry = 1000;
  ipc.config.silent = true;

  let samples = [];

  // we don't want to be permanently connected because it would keep processes alive
  // so instead we collect samples and flush periodically (unreffed interval)
  // and when process is about to exit
  function ipcSend(type, data, cb) {
    ipc.connectTo(ipc_id, function () {
      ipc.of[ipc_id].on("connect", function () {
        ipc.of[ipc_id].emit(type, data);
        ipc.disconnect(ipc_id);
        if (cb) {
          cb();
        }
      });
    });
  }

  // flush once every ~5s
  const flushWhenSamplesAbove = (1 * 1000) / INTERVAL_TIME;

  const sampler = loopDelay();
  lastDelay = 0;
  function sample() {
    const delay = sampler.delay - lastDelay;
    lastDelay = sampler.delay;

    samples.push({
      type: `EVENT_LOOP_DELAY`,
      delay,
      timestamp: Date.now(),
      pid: process.pid,
    });

    if (samples.length >= flushWhenSamplesAbove) {
      flush();
    }
  }

  function flush() {
    if (samples.length > 0) {
      ipcSend(`gjl.event_loop_samples`, samples);
    }
    samples = [];
  }

  function registerProcess(meta = {}) {
    ipcSend(
      "gjl.register",
      {
        pid: process.pid,
        argv: process.argv,
        ...meta,
      },
      () => {
        lastDelay = sampler.delay;

        sample();
        // set interval for sampling, but don't keep process alive because of it (unref)
        setInterval(sample, INTERVAL_TIME).unref();
      }
    );
  }

  const entryFile = process.argv[1];

  let meta = {
    tag: `N/A`,
  };
  let registerImmediately = true;
  if (entryFile.includes(`.bin`) && entryFile.includes(`gatsby`)) {
    meta.label = meta.tag = `Gatsby main`;
    meta.command = process.argv[2];
  } else if (entryFile.includes(`.cache`)) {
    // gatsby develop child processes
    meta.tag = `Gatsby child`;
    const entryFileContent = fs.readFileSync(entryFile, `utf-8`);
    if (entryFileContent.includes(`develop-process`)) {
      meta.label = meta.tag = `Gatsby develop child`;
    } else if (entryFileContent.includes(`telemetry-server`)) {
      meta.label = meta.tag = `Gatsby telemetry server child`;
    }
  } else if (
    entryFile.includes(`gatsby-telemetry`) &&
    entryFile.includes(`send`)
  ) {
    meta.tag = `Gatsby telemetry send`;
  } else if (
    entryFile.includes(`gatsby-recipes`) &&
    entryFile.includes(`graphql-server`)
  ) {
    meta.tag = `Gatsby recipes graphql server`;
  } else if (entryFile.includes(`jest-worker`)) {
    registerImmediately = false;
    meta.tag = `jest-worker`;
    function messageHandler(data) {
      if (Array.isArray(data) && data.length > 0 && data[0] === 0) {
        const workerPath = data[2];
        meta.command = workerPath;
        if (
          workerPath.includes(`gatsby`) &&
          workerPath.includes(`worker`) &&
          workerPath.includes(`child`)
        ) {
          meta.tag = `Gatsby default pool worker`;
        } else if (
          workerPath.includes(`gatsby`) &&
          workerPath.includes(`dev-ssr`) &&
          workerPath.includes(`render-dev-html`)
        ) {
          meta.tag = `Gatsby dev ssr pool worker`;
        } else if (
          workerPath.includes(`terser-webpack-plugin`) &&
          workerPath.includes(`worker`)
        ) {
          meta.tag = `Terser webpack plugin pool worker`;
        }

        registerProcess(meta);

        process.off(`message`, messageHandler);
      }
    }
    process.on(`message`, messageHandler);
  }

  if (registerImmediately) {
    registerProcess(meta);
  }
  signalExit(flush);
}
