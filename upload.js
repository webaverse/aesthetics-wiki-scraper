const path = require('path');
const fs = require('fs');
const weaviate = require('weaviate-client');
// const mkdirp = require('mkdirp');
const uuidByString = require('uuid-by-string');
const {formattedDataDirectory, traverse, parse, getUrls, getPageName} = require('./util.js');

//

/* const _makePageCache = () => ({
  map: new Map(),
  add(name, trope) {
    this.map.set(name, trope);
  },
  toJSON() {
    return Object.fromEntries(this.map);
  },
});
const tropesCache = _makePageCache();
const examplesCache = _makePageCache();
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
}; */

//

const schemas = [
  {
    "class": "Aesthetic",
    "description": "An aesthetics wiki page",
    "properties": [
      {
        "dataType": [
          "string"
        ],
        "description": "Title of the page",
        "name": "title"
      },
      {
        "dataType": [
          "string"
        ],
        "description": "Content of the page",
        "name": "content"
      },
      {
        "dataType": [
          "string[]"
        ],
        "description": "Properties in the infobox",
        "name": "properties"
      },
      {
        "dataType": [
          "string[]"
        ],
        "description": "Captions in the page",
        "name": "captions"
      },
    ],
  },
];

const aesthetics = (() => {
  const s = fs.readFileSync(path.join(formattedDataDirectory, 'aesthetics.json'), 'utf8');
  const j = JSON.parse(s);
  return Object.keys(j).map(k => {
    const v = j[k];
    return {
      class: 'Aesthetic',
      id: uuidByString(k),
      properties: v,
    };
  });
})();

// console.log('got example', examples[0]);

const batchSize = 100;

const client = weaviate.client({
  scheme: 'http',
  host: 'weaviate-server.webaverse.com',
});
(async () => {
  await client
    .schema
    .getter()
    .do();
  for (const schema of schemas) {
    try {
      await client.schema
        .classCreator()
        .withClass(schema)
        .do();
    } catch(err) {
      if (!/422/.test(err)) { // already exists
        throw err;
      }
    }
  }

  const numRetries = 3;
  const _uploadDatas = async datas => {
    const batcher = client.batch.objectsBatcher();
    for (const data of datas) {
      batcher.withObject(data);
    }
    const result = await batcher.do();
    let ok = true;
    for (const item of result) {
      if (item.result.errors) {
        console.warn(item.result.errors);
        ok = false;
      }
    }
    return ok;
  };
  for (let i = 0; i < aesthetics.length; i += batchSize) {
    console.log(`uploading aesthetics (${i}/${aesthetics.length})...`);
    for (let j = 0; j < numRetries; j++) {
      const ok = await _uploadDatas(aesthetics.slice(i, i + batchSize));
      if (ok) {
        break;
      }
    }
  }
})().catch(err => {
  console.error(err)
})