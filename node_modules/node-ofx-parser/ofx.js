const parser = require('fast-xml-parser')

function sgml2Xml(sgml) {
    return sgml
        .replace(/>\s+</g, '><')    // remove whitespace inbetween tag close/open
        .replace(/\s+</g, '<')      // remove whitespace before a close tag
        .replace(/>\s+/g, '>')      // remove whitespace after a close tag
        .replace(/<([A-Z0-9_]*)+\.+([A-Z0-9_]*)>([^<]+)/g, '<\$1\$2>\$3' )
        .replace(/<(\w+?)>([^<]+)/g, '<\$1>\$2</\$1>');
}

// Preparing data fixing issues with special characters
function prepareData (content) {
  return content
    .replace(/&/g, '&amp;amp;')
}

function parseXml(content) {
  const options = {
    ignoreAttributes : true,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : false,
    parseAttributeValue : false,
    trimValues: true,
    parseTrueNumberOnly: false
};


  if (parser.validate(content) === true) {
    return parser.parse(content, options)
  }

  throw new Error('Error while parsing content')
}

function parse(data) {
    // firstly, split into the header attributes and the footer sgml
    const ofx = data.split('<OFX>', 2);

    // firstly, parse the headers
    const headerString = ofx[0].split(/\r?\n/);
    const header = {};
    headerString.forEach((attrs) => {
        const headAttr = attrs.split(/:/,2);
        header[headAttr[0]] = headAttr[1];
    });

    // make the SGML and the XML
    const content = `<OFX>${ofx[1]}`;

    // Parse the XML/SGML portion of the file into an object
    // Try as XML first, and if that fails do the SGML->XML mangling
    let dataParsed = null;
    try {
      dataParsed = parseXml(prepareData(content));
    } catch (e) {
      dataParsed = parseXml(prepareData(sgml2Xml(content)));
    }

    // put the headers into the returned data
    dataParsed.header = header;

    return dataParsed;
}

function serialize(header, body) {
    let out = '';
    // header order could matter
    const headers = ['OFXHEADER', 'DATA', 'VERSION', 'SECURITY', 'ENCODING', 'CHARSET',
        'COMPRESSION', 'OLDFILEUID', 'NEWFILEUID'];

    headers.forEach((name) => {
        out += `${name}:${header[name]}\n`;
    });
    out += '\n';

    out += objToOfx({ OFX: body });
    return out;
}

const objToOfx = (obj) => {
  let out = '';

  Object.keys(obj).forEach((name) => {
    const item = obj[name];
    const start = `<${name}>`;
    const end = `</${name}>`;

    if (item instanceof Object) {
        if (item instanceof Array) {
            item.forEach((it) => {
                out += `${start}\n${objToOfx(it)}${end}\n`;
            });
            return;
        }
        return out += `${start}\n${objToOfx(item)}${end}\n`
    }
    out += start + item + '\n';
  });

  return out;
}

module.exports = {
  parse,
  serialize
}
