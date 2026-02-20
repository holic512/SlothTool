const React = require('react');
const {render, useInput} = require('ink');

function WaitForEnter({children, onDone}) {
    useInput((input, key) => {
        if (key.return || key.escape || input === 'q') {
            onDone();
        }
    });
    return children;
}

function showInkPanel(Component, props) {
    return new Promise(resolve => {
        const app = render(
            React.createElement(
                WaitForEnter,
                {
                    onDone: () => {
                        app.unmount();
                        resolve();
                    }
                },
                React.createElement(Component, props || {})
            )
        );
    });
}

module.exports = {
    showInkPanel
};
