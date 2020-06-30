#!/usr/bin/env node
const { spawn } = require(`child_process`);
const path = require(`path`);
const fs = require("fs");

const gatsbyBin = `/Users/misiek/dev/gatsby-inc-build-cli/bin/cli.js`;

const defaultStdio = `inherit`;

const file = `ipc-logs-${new Date().toISOString()}.txt`;

const run = () => {
  let didWriteInitialLines = false;
  // first arg: <node bin>, second arg: <path to this script>, rest: <build|develop> [flags]
  // we want to pass "rest" as args for gatsby bin
  // we don't do any args validation here - we let gatsby bin do it
  const argsToPass = process.argv.slice(2);

  const gatsbyProcess = spawn(gatsbyBin, argsToPass, {
    stdio: [defaultStdio, defaultStdio, defaultStdio, `ipc`],
    env: {
      ...process.env,
      ENABLE_GATSBY_REFRESH_ENDPOINT: true,
    },
  });

  gatsbyProcess.on(`message`, (msg) => {
    if (!didWriteInitialLines) {
      fs.appendFileSync(file, `Running "gatsby-cloud ${argsToPass}"\n`);
      didWriteInitialLines = true;
    }
    fs.appendFileSync(file, JSON.stringify(msg, null, 2) + `\n`);
  });

  gatsbyProcess.on(`exit`, (...args) => {
    console.log(`process exit args`, args);
  });
};

run();
