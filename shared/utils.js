const path = require(`path`);
const os = require(`os`);

function getSamplesPath() {
  return path.join(os.homedir(), `.gatsby`, `samplesV2`);
}

module.exports = {
  getSamplesPath,
};
