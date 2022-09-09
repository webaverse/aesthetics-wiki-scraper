const path = require('path');
const fs = require('fs');
// const {URL} = require('url');
const murmur = require('murmurhash-js');
const cheerio = require('cheerio');
// const fetch = require('cross-fetch');
const mkdirp = require('mkdirp');

const u = `https://aesthetics.fandom.com/wiki/List_of_Aesthetics`;
const maxDepth = 20;
const dataDirectory = `data`;
const mainRegex = /^\/wiki\//;
const nameRegex = /\/wiki\/(.*)$/;

const formattedDataDirectory = 'formatted-data';

const _getKey = s => murmur.murmur3(s);
const _getPath = (dataDirectory, key) => path.join(dataDirectory, `${key}.html`);
const getUrlPath = u => _getPath('data', _getKey(u));

const pageCache = {
  get(u) {
    const key = _getKey(u);
    const _tryGetKey = (key, dataDirectory) => {
      try {
        const p = _getPath(dataDirectory, key);
        let result = fs.readFileSync(p, 'utf8');
        /* if (result) {
          // check that it's not a 403 page
          const $ = cheerio.load(result);
          const {title} = parse($);
          if (title === '403') {
            console.log('unlink 403 page', u, p);
            fs.unlinkSync(p);
            result = null;
          }
        } */
        return result;
      } catch (err) {
        if (err.code === 'ENOENT') {
          return null;
        } else {
          throw err;
        }
      }
    };
    let result = _tryGetKey(key, dataDirectory);
    /* if (!result) {
      for (const extraDataDirectory of extraDataDirectories) {
        result = _tryGetKey(key, extraDataDirectory);
        if (result) {
          this.set(u, result);
          break;
        }
      }
    } */
    return result;
  },
  set(u, d) {
    const key = _getKey(u);
    fs.writeFileSync(path.join(dataDirectory, `${key}.html`), d);
  },
};
const seenSet = new Set();

const _wait = (t = 0) => new Promise(accept => {
  setTimeout(() => {
    accept();
  }, t);
});

mkdirp.sync(dataDirectory);
const traverse = async (fn, {
  download = false,
} = {}) => {
  const _recurse = async (u, depth = 0) => {
    if (!seenSet.has(u)) {
      seenSet.add(u);

      const text = await (async () => {
        let cachedText = pageCache.get(u);
        if (cachedText !== null) {
          return cachedText;
        } else {
          if (download) {
            console.log(`${u} ${_getPath(dataDirectory, _getKey(u))} (${depth})`);
            const _fetchText = async () => {
              try {
                /* if (depth > 0) {
                  await _wait(100);
                } */
                const res = await fetch(u);
                if (res.ok || res.status === 404 || res.status >= 300 && res.status < 400) {
                  const text = await res.text();

                  pageCache.set(u, text);
                  return text;
                } else {
                  console.log('delaying request due to error:', res.status, res.statusText);
                  await _wait(60 * 1000);
                  console.log('trying again');
                  return await _fetchText();
                }
              } catch(err) {
                if (/redirect/i.test(err.message)) {
                  // console.log('got redirect error, trying again');
                  // return await _fetchText();
                  console.log('ignoring redirect error', err);
                  return '';
                } else {
                  throw err;
                }
              }
            };
            return await _fetchText();
          } else {
            return null;
          }
        }
      })();

      const $ = cheerio.load(text.replace(/<br\s*\/?>/g, '\n'));
      const urls = depth === 0 ? getMainUrls($) : getPageUrls($);
      const shouldContinue = depth < maxDepth;

      fn && fn(u, depth, $);

      // console.log('got urls', urls, text);

      if (shouldContinue) {
        for (const u2 of urls) {
          await _recurse(u2, depth + 1);
        }
      }
    }
  };
  await _recurse(u);
};
const parseMain = $ => {
  $('#toc').remove();
  $('table').remove();
  $('iframe').remove();

  const title = $('h1').first().text().trim().replace(/(\s)+/g, '$1');
  const content = $('.mw-parser-output').text().trim().replace(/(\s)+/g, '$1').replace(/\t/g, '\n');
  
  return {
    title,
    content,
  };
};
const parsePage = $ => {
  $('#toc').remove();
  $('table').remove();
  $('iframe').remove();

  const title = $('h1').first().text().trim();
  const captions = Array.from($('.pi-caption')).map(el => $(el).text().trim());
  const properties = Array.from($('aside .pi-item')).map(el => {
    const $el = $(el);
    const key = $el.find('.pi-data-label').text().trim();
    const value = $el.find('.pi-data-value').text().trim();
    return key && value && `${key}: ${value}`;
    /* return key && value && {
      key,
      value,
    }; */
  }).filter(o => !!o);
  $('aside').remove();
  const content = $('.mw-parser-output').text().trim().replace(/(\s)+/g, '$1').replace(/\t/g, '\n');
  
  return {
    title,
    captions,
    properties,
    content,
  };
};
const getAnchors = ($, selector) => {
  const els = $(selector);
  const elsArray = Array.from(els);
  const urls = elsArray.map(el => {
    return el.attribs.href;
  })
    .filter(u2 => !!u2)
    .map(u2 => {
      try {
        return new URL(u2, u);
      } catch(err) {
        return new URL('https://example.com/');
      }
    })
    .filter(u2 =>
      u2.origin === `https://aesthetics.fandom.com` &&
      mainRegex.test(u2.pathname)
    )
    .map(u2 => u2 + '');
  return urls;
};
const getMainUrls = $ => getAnchors($, `#content table > tbody > tr > td > ul > li > a`);
const getPageUrls = $ => getAnchors($, 'div[data-source="related_aesthetics"] > .pi-data-value > a');
const getPageName = u => u.match(nameRegex)?.[1] ?? '';
module.exports = {
  formattedDataDirectory,
  getUrlPath,
  traverse,
  parseMain,
  parsePage,
  getMainUrls,
  getPageUrls,
  getPageName,
};