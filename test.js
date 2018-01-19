require('babel-register')
require('./globals')

global.React = require('react')
global.CSS = require('./gui/js-css').default
require('./gui/components/title-bar')
