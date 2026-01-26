const install = require('./install');
const uninstall = require('./uninstall');
const list = require('./list');
const run = require('./run');
const config = require('./config');
const interactive = require('./interactive');
const uninstallAll = require('./uninstall-all');

module.exports = {
    install,
    uninstall,
    list,
    run,
    config,
    interactive,
    uninstallAll
};
