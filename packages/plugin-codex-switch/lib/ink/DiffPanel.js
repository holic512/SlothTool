const React = require('react');
const {Box, Text} = require('ink');

function DiffPanel({title, lines, hint}) {
    const outputLines = Array.isArray(lines) && lines.length > 0
        ? lines
        : ['No changes'];

    return React.createElement(
        Box,
        {flexDirection: 'column', borderStyle: 'round', borderColor: 'yellow', padding: 1},
        React.createElement(Text, {color: 'yellow'}, title || 'Change Preview'),
        ...outputLines.map((line, idx) => React.createElement(Text, {key: String(idx)}, `- ${line}`)),
        React.createElement(Text, {color: 'gray'}, hint || 'Press Enter to continue')
    );
}

module.exports = DiffPanel;
