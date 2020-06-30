const http = require(`http`);
const IO = require(`socket.io`);
const chokidar = require(`chokidar`);
const fs = require(`fs-extra`);
const path = require(`path`);
const mitt = require(`mitt`);

const {
  SOCKET_UNSUBSCRIBE,
  SOCKET_PROJECT_LIST,
  SOCKET_PROJECT_INFO,
  SOCKET_PROJECT_SAMPLES,
  SOCKET_PROJECT_RUN_ADD_TAG,
  SOCKET_PROJECT_RUN_REMOVE_TAG,
  SOCKET_PROJECT_SET_REMOTE_ID,
} = require(`../shared/constants`);

const { getSamplesPath } = require(`../shared/utils`);

const emitter = mitt();

const outputPath = getSamplesPath();
const projects = {};

const bite_size = 8 * 256;

function getMetaFileLocation(projectId, timestamp) {
  return path.join(outputPath, projectId, `${timestamp}.meta.json`);
}

function readMeta(projectID, timestamp) {
  const filePath = getMetaFileLocation(projectID, timestamp);
  let meta = {
    tags: [],
  };
  if (fs.existsSync(filePath)) {
    meta = JSON.parse(fs.readFileSync(filePath, `utf-8`));
  }

  return {
    filePath,
    meta,
  };
}

function saveMeta(projectID, timestamp, handler) {
  const { meta, filePath } = readMeta(projectID, timestamp);
  fs.outputJSONSync(filePath, handler(meta), { spaces: 2 });

  projects[projectID].runs[timestamp].meta = meta;

  emitter.emit(`${projectID}/newRun`);
}

function fileWithSamplesToProjectMeta(filePath) {
  const rel = path.relative(outputPath, filePath);

  const parsed = path.parse(rel);
  const projectID = parsed.dir;

  const projectName = Buffer.from(
    projectID.replace(/_/g, `=`),
    `base64`
  ).toString(`utf-8`);

  const timestamp = parseInt(parsed.name);

  const { meta } = readMeta(projectID, timestamp);

  const run = {
    timestamp,
    label: new Date(timestamp).toLocaleString(),
    filePath,
    meta,
  };

  return { projectID, projectName, run, timestamp };
}

function handleNewSamplesFile(filePath) {
  const { projectID, projectName, run } = fileWithSamplesToProjectMeta(
    filePath
  );

  if (!projects[projectID]) {
    projects[projectID] = {
      name: projectName,
      id: projectID,
      runs: {},
    };

    // new project
    emitter.emit(`newProject`);
  }

  if (!projects[projectID].runs[run.timestamp]) {
    projects[projectID].runs[run.timestamp] = run;

    // new run
    emitter.emit(`${projectID}/newRun`);
  }
}

function handleRemovedSamplesFile(filePath) {
  const { projectID, run } = fileWithSamplesToProjectMeta(filePath);

  const project = projects[projectID];
  if (project) {
    if (project.runs[run.timestamp]) {
      delete project.runs[run.timestamp];
      emitter.emit(`${projectID}/newRun`);
    }

    if (Object.keys(project.runs).length === 0) {
      delete projects[projectID];
      emitter.emit(`newProject`);
    }
  }
}

function handleNewSocketIOConnection(client) {
  console.log(`on socket connection`);
  const subscriptions = new Map();

  const subscribeTo = (event, identifier, handler) => {
    emitter.on(event, handler);
    subscriptions.set(identifier, function unsubscribe() {
      emitter.off(event, handler);
    });
  };

  function unsubscribeFrom(identifier) {
    const unsubscribe = subscriptions.get(identifier);
    if (unsubscribe) {
      unsubscribe();
      subscriptions.delete(identifier);
    }
  }

  client.on(`disconnect`, (s) => {
    for (let identifier of subscriptions.keys()) {
      unsubscribeFrom(identifier);
    }
  });

  client.on(SOCKET_UNSUBSCRIBE, ({ uuid }) => {
    unsubscribeFrom(uuid);
  });

  client.on(SOCKET_PROJECT_LIST.listen, ({ uuid }) => {
    const update = () => {
      client.emit(SOCKET_PROJECT_LIST.data, Object.values(projects));
    };

    update();
    subscribeTo(`newProject`, uuid, update);
  });

  client.on(SOCKET_PROJECT_INFO.listen, ({ project, uuid }) => {
    const update = () => {
      client.emit(SOCKET_PROJECT_INFO.data, projects[project]);
    };

    update();
    subscribeTo(`${project}/newRun`, uuid, update);
  });

  client.on(SOCKET_PROJECT_SAMPLES.listen, ({ project, timestamp, uuid }) => {
    const runInfo = projects[project].runs[timestamp];

    fs.open(runInfo.filePath, `r`, (err, fd) => {
      let readbytes = 0;
      let buffer = ``;
      let bufferedLines = [];

      function flush() {
        // console.log(`emit`);
        client.emit(SOCKET_PROJECT_SAMPLES.data, bufferedLines);
        bufferedLines = [];
      }

      const processChunk = (err, bytecount, buff) => {
        const chunk = buff.toString("utf-8", 0, bytecount);
        buffer += chunk;

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();

        if (lines.length > 0) {
          bufferedLines.push(...lines.map(JSON.parse));
        }

        readbytes += bytecount;
        // if (bufferedLines.length > 250) {
        //   flush();
        // }
        process.nextTick(read);
      };

      let timeout;

      const read = () => {
        if (!fd) {
          return;
        }
        timeout = null;
        const stats = fs.fstatSync(fd);
        if (stats.size < readbytes + 1) {
          if (bufferedLines.length > 0) {
            flush();
          }
          timeout = setTimeout(read, 500);
        } else {
          fs.read(
            fd,
            Buffer.alloc(bite_size),
            0,
            bite_size,
            readbytes,
            processChunk
          );
        }
      };

      // unlisten = () => {
      //   console.log("not listening anymore");
      //   if (timeout) {
      //     clearTimeout(timeout);
      //   }
      //   fs.closeSync(fd);
      // };

      subscriptions.set(uuid, function unsubscribe() {
        console.log("not listening anymore");
        if (timeout) {
          clearTimeout(timeout);
        }
        fs.closeSync(fd);
        fd = null;
      });

      read();
    });
  });

  client.on(SOCKET_PROJECT_RUN_ADD_TAG, ({ project, timestamp, tag }) => {
    saveMeta(project, timestamp, (meta) => {
      if (!meta.tags) {
        meta.tags = [];
      }

      if (!meta.tags.includes(tag)) {
        meta.tags.push(tag);
      }
      return meta;
    });
  });

  client.on(SOCKET_PROJECT_RUN_REMOVE_TAG, ({ project, timestamp, tag }) => {
    saveMeta(project, timestamp, (meta) => {
      if (!meta.tags) {
        meta.tags = [];
      }

      meta.tags = meta.tags.filter((ctag) => ctag !== tag);
      return meta;
    });
  });

  client.on(
    SOCKET_PROJECT_SET_REMOTE_ID,
    ({ project, timestamp, remoteID }) => {
      saveMeta(project, timestamp, (meta) => {
        meta.remoteID = remoteID;
        return meta;
      });
    }
  );
}

function startDataServer(server) {
  console.log(`start data servcer`);
  if (!server) {
    server = http.createServer();
    server.listen(3010);
  }

  chokidar
    .watch(outputPath, {
      ignored: [`**/*.un~`, `**/.DS_Store`, `**/*.meta.json`],
    })
    .on("add", handleNewSamplesFile)
    .on("unlink", handleRemovedSamplesFile);

  const websocketServer = IO(server);
  websocketServer.on(`connection`, handleNewSocketIOConnection);
}

module.exports = {
  startDataServer,
};
