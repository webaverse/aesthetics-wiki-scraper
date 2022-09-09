const path = require('path');
const fs = require('fs');
// const {URL} = require('url');
const {formattedDataDirectory, traverse, parsePage, getPageUrls, getPageName} = require('./util.js');

const mkdirp = require('mkdirp');

//

const _makePageCache = () => ({
  map: new Map(),
  add(name, trope) {
    this.map.set(name, trope);
  },
  toJSON() {
    return Object.fromEntries(this.map);
  },
});
const aestheticsCache = _makePageCache();
const childrenCache = {
  map: new Map(),
  add(parentName, childName) {
    let children = this.map.get(parentName);
    if (children === undefined) {
      children = [];
      this.map.set(parentName, children);
    }
    children.push(childName);
  },
  toJSON() {
    return Object.fromEntries(this.map);
  },
};

//

(async () => {
  mkdirp.sync(formattedDataDirectory);

  let i = 0;
  const _log = () => {
    console.log(JSON.stringify(aestheticsCache, null, 2));
    console.log(JSON.stringify(childrenCache, null, 2));
  };
  const logRate = 100;
  const _tryLog = () => {
    if ((++i) % logRate === 0) {
      _log();
    }
  };

  await traverse((url, depth, $) => {
    if (depth > 0) {
      console.log(url);

      const childUrls = getPageUrls($);
      const name = getPageName(url);

      const page = parsePage($);

      aestheticsCache.add(name, page);

      for (const childUrl of childUrls) {
        const childName = getPageName(childUrl);
        childrenCache.add(name, childName);
      }
      
      // console.log(page);

      // _tryLog();
    }
  }, {
    download: false,
  });

  // write formatted data
  console.log('write 1');
  fs.writeFileSync(path.join(formattedDataDirectory, 'aesthetics.json'), JSON.stringify(aestheticsCache), 'utf8');
  console.log('write 2');
  fs.writeFileSync(path.join(formattedDataDirectory, 'children.json'), JSON.stringify(childrenCache), 'utf8');
  console.log('write done');
})();