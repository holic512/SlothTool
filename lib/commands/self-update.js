const {updateSelf} = require('../plugin-manager');

function selfUpdate() {
    updateSelf();
}

module.exports = selfUpdate;
