export function initStorage() {
  const btnExportarJson = document.getElementById('btnExportarJson');
  const btnImportarJson = document.getElementById('btnImportarJson');
  const fileImportarJson = document.getElementById('fileImportarJson');

  const btnExportarXml = document.getElementById('btnExportarXml');
  const btnImportarXml = document.getElementById('btnImportarXml');
  const fileImportarXml = document.getElementById('fileImportarXml');

  function baixarArquivo(conteudo, nome, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- JSON LOGIC ---
  btnExportarJson.addEventListener('click', () => {
    chrome.storage.local.get(null, (items) => {
      baixarArquivo(JSON.stringify(items, null, 2), 'tatico_config.json', 'application/json');
    });
  });

  btnImportarJson.addEventListener('click', () => fileImportarJson.click());

  fileImportarJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        chrome.storage.local.set(dados, () => location.reload());
      } catch (err) { alert('JSON inválido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // --- XML LOGIC ---
  // serializo recursivamente o objeto do banco para uma string XML controlada
  function objToXmlStr(obj, nodeName) {
    let xml = `<${nodeName}>`;
    for (let key in obj) {
      if (Array.isArray(obj[key])) {
        xml += `<${key}>`;
        obj[key].forEach(item => {
          xml += typeof item === 'object' ? objToXmlStr(item, 'item') : `<item>${item}</item>`;
        });
        xml += `</${key}>`;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        xml += objToXmlStr(obj[key], key);
      } else {
        xml += `<${key}>${obj[key] !== null ? obj[key] : ''}</${key}>`;
      }
    }
    xml += `</${nodeName}>`;
    return xml;
  }

  btnExportarXml.addEventListener('click', () => {
    chrome.storage.local.get(null, (items) => {
      const xmlStr = `<?xml version="1.0" encoding="UTF-8"?>\n${objToXmlStr(items, 'taticoConfig')}`;
      baixarArquivo(xmlStr, 'tatico_config.xml', 'application/xml');
    });
  });

  btnImportarXml.addEventListener('click', () => fileImportarXml.click());

  // faco o parse inverso lendo os nos do DOMParser gerado
  function xmlToJsonObj(node) {
    let obj = {};
    if (node.nodeType === 1 && node.attributes.length > 0) {
      for (let j = 0; j < node.attributes.length; j++) {
        const attribute = node.attributes.item(j);
        obj[attribute.nodeName] = attribute.nodeValue;
      }
    } else if (node.nodeType === 3) {
      obj = node.nodeValue.trim();
    }
    if (node.hasChildNodes()) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const item = node.childNodes.item(i);
        const nodeName = item.nodeName;
        if (nodeName === '#text') {
          const val = item.nodeValue.trim();
          if (val) obj = val;
        } else {
          if (typeof obj[nodeName] === 'undefined') {
            obj[nodeName] = xmlToJsonObj(item);
          } else {
            if (typeof obj[nodeName].push === 'undefined') {
              const old = obj[nodeName];
              obj[nodeName] = [];
              obj[nodeName].push(old);
            }
            obj[nodeName].push(xmlToJsonObj(item));
          }
        }
      }
    }
    // formatacao fina para garantir que nos chamados <item> virem arrays limpos
    if (obj.item) return Array.isArray(obj.item) ? obj.item : [obj.item];
    return obj;
  }

  fileImportarXml.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(ev.target.result, "text/xml");
        const root = xmlDoc.documentElement;
        const resultJson = {};

        // itero sobre os root nodes (perfis, rotinas, playlists) para estruturar corretamente
        Array.from(root.children).forEach(child => {
          resultJson[child.nodeName] = xmlToJsonObj(child);
        });

        chrome.storage.local.set(resultJson, () => location.reload());
      } catch (err) { alert('XML inválido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}
