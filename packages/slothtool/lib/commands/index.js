const install = require('./install');
const uninstall = require('./uninstall');
const list = require('./list');
const run = require('./run');
const config = require('./config');
const interactive = require('./interactive');
const uninstallAll = require('./uninstall-all');
const update = require('./update');
const updateAll = require('./update-all');
const selfUpdate = require('./self-update');

module.exports = {
    install,
    uninstall,
    list,
    run,
    config,
    interactive,
    uninstallAll,
    update,
    updateAll,
    selfUpdate
};
