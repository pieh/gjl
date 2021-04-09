#!/usr/bin/env node
const { spawn } = require(`child_process`);
const path = require(`path`);
const fs = require("fs-extra");
const os = require(`os`);
const pidusage = require(`pidusage`);
const ipc = require("node-ipc");
// const signalExit = require(`signal-exit`);

const { saveMeta } = require(`./server/socket`);

const { INTERVAL_TIME } = require(`./shared/constants`);
const { getSamplesPath } = require(`./shared/utils`);

const gatsbyBin = path.join(`node_modules`, `.bin`, `gatsby`);

const defaultStdio = `inherit`;

const file = `ipc-logs-${new Date().toISOString()}.txt`;

const projectPath = path.relative(os.homedir(), process.cwd());
const projectName = Buffer.from(projectPath)
  .toString(`base64`)
  .replace(/=/g, `_`);

const timestamp = new Date().getTime();

const outputPath = path.join(getSamplesPath(), projectName);
fs.ensureDirSync(outputPath);

const samplesStream = fs.createWriteStream(
  path.join(outputPath, `${timestamp.toString()}.jsonl`),
  {
    flags: `w`,
  }
);
let startTimestamp;
function addEvent(event) {
  if (!startTimestamp) {
    startTimestamp = Date.now();
  }

  if (!event.elapsed) {
    if (event.timestamp) {
      event.elapsed = event.timestamp - startTimestamp;
      event.timestamp = undefined;
    } else {
      event.elapsed = Date.now() - startTimestamp;
    }
  }

  if (elapsedLimit && event.elapsed > elapsedLimit) {
    return;
  }
  samplesStream.write(JSON.stringify(event) + `\n`);
}

let elapsedLimit;
// let r = [];
// let lastSampleTime = null;
const sample = (cb) => {
  if (PIDs.length === 0) {
    if (cb) {
      cb();
    }
    return;
  }
  pidusage(PIDs, (err, aggStats) => {
    if (err) {
      // if (err.message.includes(`No matching pid found`)) {
      //   // PIDs.delete(pid);
      // } else {
      console.log(`error`, err);
      // }
      return;
    }

    // let w = {};
    // r.push(w);

    for (let pid of PIDs) {
      const stats = aggStats[pid];
      if (stats) {
        // w[pid] = stats;
        addEvent({
          type: `CPU_MEM`,
          // timestamp: stats.timestamp,
          pid,
          mem: stats.memory,
          cpu: stats.cpu,
          ctime: stats.ctime,
        });
      }
    }

    if (cb) {
      cb();
    }
  });
};

const PIDs = [];

let processCounter = {};

let samplingInterval;
// per pidusage README
// Avoid using setInterval as they could overlap with asynchronous processing
// seems like it being called in same frame multiple times returns 0
function sampleInterval(time) {
  samplingInterval = setTimeout(function () {
    sample(function () {
      sampleInterval(time);
    });
  }, time);
}

function incrementProcessCounter(type) {
  let count = (processCounter[type] || 0) + 1;
  processCounter[type] = count;
  return count === 1 ? type : `${type} #${count}`;
}

const run = () => {
  const ipc_id = `gjl_${projectName}_${timestamp}`;

  ipc.config.id = ipc_id;
  ipc.config.retry = 1500;
  ipc.config.silent = true;

  ipc.serve(function () {
    ipc.server.on(`gjl.register`, function (data) {
      if (!PIDs.includes(data.pid)) {
        PIDs.push(data.pid);
      }

      const registerEvent = {
        type: `PROCESS_REGISTER`,
        ...data,
        label: data.label || incrementProcessCounter(data.tag),
      };

      addEvent(registerEvent);
    });
    ipc.server.on(`gjl.event_loop_samples`, function (data) {
      if (Array.isArray(data)) {
        data.forEach(addEvent);
      }
    });
  });

  ipc.server.start();

  const envVars = Object.entries(process.env).reduce((acc, [envVar, value]) => {
    if (envVar.startsWith(`GATSBY_`)) {
      acc[envVar] = value;
    }
    return acc;
  }, {});

  const tags = process.env.GJL_TAGS ? process.env.GJL_TAGS.split(`,`) : [];

  saveMeta(projectName, timestamp, (meta) => {
    meta.envVars = envVars;
    meta.tags = tags;
    return meta;
  });

  let didWriteInitialLines = false;
  // first arg: <node bin>, second arg: <path to this script>, rest: <build|develop> [flags]
  // we want to pass "rest" as args for gatsby bin
  // we don't do any args validation here - we let gatsby bin do it
  const argsToPass = process.argv.slice(2);
  const gatsbyProcess = spawn(gatsbyBin, argsToPass, {
    stdio: [defaultStdio, defaultStdio, defaultStdio, `ipc`],
    env: {
      ...process.env,
      NODE_OPTIONS: `${
        process.env.NODE_OPTIONS || ``
      } -r "${__dirname}/shared/register-process.js"`,
      ENABLE_GATSBY_REFRESH_ENDPOINT: true,
      GJL_IPC_ID: ipc_id,
    },
  });
  startTimestamp = Date.now();

  gatsbyProcess.on(`message`, (msg) => {
    if (!didWriteInitialLines) {
      fs.appendFileSync(file, `Running "gatsby ${argsToPass}"\n`);
      didWriteInitialLines = true;
    }

    if (msg.type === `LOG_ACTION`) {
      if (msg.action.type === `ACTIVITY_START`) {
        addEvent({
          type: `ACTIVITY_START`,
          label: msg.action.payload.id,
          uuid: msg.action.payload.uuid,
          timestamp: new Date(msg.action.timestamp).getTime(),
        });
      } else if (msg.action.type === `ACTIVITY_END`) {
        addEvent({
          type: `ACTIVITY_END`,
          label: msg.action.payload.id,
          uuid: msg.action.payload.uuid,
          timestamp: new Date(msg.action.timestamp).getTime(),
        });
      } else if (msg.action.type === `SET_STATUS`) {
        addEvent({
          type: `SET_STATUS`,
          status: msg.action.payload,
          timestamp: new Date(msg.action.timestamp).getTime(),
        });
      }
    }

    fs.appendFileSync(file, JSON.stringify(msg, null, 2) + `\n`);
  });

  // const samplingInterval = setInterval(sample, INTERVAL_TIME);
  sample();
  sampleInterval(INTERVAL_TIME);

  // signalExit(() => {
  //   fs.outputJSONSync(`proc.json`, r, { spaces: 2 });
  // });

  gatsbyProcess.on(`exit`, (...args) => {
    elapsedLimit = Date.now();
    console.log(`process exit args`, args);
    if (samplingInterval) {
      clearTimeout(samplingInterval);
    }

    console.log(`waiting for event loop delay samples ~15 seconds`);
    setTimeout(() => {
      ipc.server.stop();
    }, 15000);
  });
};

run();
