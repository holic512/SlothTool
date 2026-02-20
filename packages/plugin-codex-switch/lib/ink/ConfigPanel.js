const React = require('react');
const {Box, Text} = require('ink');

function ConfigPanel({title, data, hint}) {
    return React.createElement(
        Box,
        {flexDirection: 'column', borderStyle: 'round', borderColor: 'green', padding: 1},
        React.createElement(Text, {color: 'green'}, title || 'Codex Snapshot'),
        React.createElement(Text, null, `Path: ${data.configPath || ''}`),
        React.createElement(Text, null, `Provider: ${data.model_provider || ''}`),
        React.createElement(Text, null, `Model: ${data.model || ''}`),
        React.createElement(Text, null, `Base URL: ${(data.provider && data.provider.base_url) || ''}`),
        React.createElement(Text, {color: 'gray'}, hint || 'Press Enter to continue')
    );
}

module.exports = ConfigPanel;
