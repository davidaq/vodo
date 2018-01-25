require('babel-register')({
  plugins: [
    'transform-react-jsx',
    'transform-decorators-legacy',
    'transform-react-jsx',
    'transform-es2015-modules-commonjs',
    'transform-class-properties',
    'transform-object-rest-spread'
  ],
  highlightCode: false
})

const { UPDATER, SERVICE, HEADLESS } = process.env

if (UPDATER) {
  require('./update').prepare()
} else if (typeof nw !== 'undefined' && !SERVICE && !HEADLESS) {
  require('./update').startup()
  .then(() => {
    require('./globals')
    require('./gui')
  })
} else {
  console.error('Start worker service:', SERVICE || 'index')
  let modName = './service'
  if (SERVICE) {
    modName += '/' + SERVICE
  }
  require('./globals')
  require(modName).main()
}

