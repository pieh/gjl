exports.INTERVAL_TIME = 250;

exports.SOCKET_UNSUBSCRIBE = `projectListEnd`;

exports.SOCKET_PROJECT_LIST = {
  listen: `projectListStart`,
  data: `onProjectList`,
};

exports.SOCKET_PROJECT_INFO = {
  listen: `projectInfoStart`,
  data: `onProjectInfo`,
};

exports.SOCKET_PROJECT_SAMPLES = {
  listen: `projectSamplesStart`,
  data: `onProjectSamples`,
};

exports.SOCKET_PROJECT_RUN_ADD_TAG = `projectRunAddTag`;
exports.SOCKET_PROJECT_RUN_REMOVE_TAG = `projectRemoveAddTag`;

exports.SOCKET_PROJECT_SET_REMOTE_ID = `setRemoteId`;
