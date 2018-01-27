export BABEL_ENV=dist

mkdir -p dist/build
cp -r app dist/build
cp -r node_modules dist/build
cp package.json dist/build
cd dist/build

compile () {
  mv $1 $1.tmp
  babel $1.tmp > $1
  rm $1.tmp
}

find app -type f -name \*.js -exec compile {} \;

#build --tasks win-x64,mac-x64 --mirror https://npm.taobao.org/mirrors/nwjs/ .
