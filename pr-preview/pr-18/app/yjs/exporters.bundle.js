(() => {
  // node_modules/fast-xml-parser/src/ignoreAttributes.js
  function getIgnoreAttributesFn(ignoreAttributes) {
    if (typeof ignoreAttributes === "function") {
      return ignoreAttributes;
    }
    if (Array.isArray(ignoreAttributes)) {
      return (attrName) => {
        for (const pattern of ignoreAttributes) {
          if (typeof pattern === "string" && attrName === pattern) {
            return true;
          }
          if (pattern instanceof RegExp && pattern.test(attrName)) {
            return true;
          }
        }
      };
    }
    return () => false;
  }

  // node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js
  var EOL = "\n";
  function toXml(jArray, options) {
    let indentation = "";
    if (options.format && options.indentBy.length > 0) {
      indentation = EOL;
    }
    return arrToStr(jArray, options, "", indentation);
  }
  function arrToStr(arr, options, jPath, indentation) {
    let xmlStr = "";
    let isPreviousElementTag = false;
    for (let i = 0; i < arr.length; i++) {
      const tagObj = arr[i];
      const tagName = propName(tagObj);
      if (tagName === void 0) continue;
      let newJPath = "";
      if (jPath.length === 0) newJPath = tagName;
      else newJPath = `${jPath}.${tagName}`;
      if (tagName === options.textNodeName) {
        let tagText = tagObj[tagName];
        if (!isStopNode(newJPath, options)) {
          tagText = options.tagValueProcessor(tagName, tagText);
          tagText = replaceEntitiesValue(tagText, options);
        }
        if (isPreviousElementTag) {
          xmlStr += indentation;
        }
        xmlStr += tagText;
        isPreviousElementTag = false;
        continue;
      } else if (tagName === options.cdataPropName) {
        if (isPreviousElementTag) {
          xmlStr += indentation;
        }
        xmlStr += `<![CDATA[${tagObj[tagName][0][options.textNodeName]}]]>`;
        isPreviousElementTag = false;
        continue;
      } else if (tagName === options.commentPropName) {
        xmlStr += indentation + `<!--${tagObj[tagName][0][options.textNodeName]}-->`;
        isPreviousElementTag = true;
        continue;
      } else if (tagName[0] === "?") {
        const attStr2 = attr_to_str(tagObj[":@"], options);
        const tempInd = tagName === "?xml" ? "" : indentation;
        let piTextNodeName = tagObj[tagName][0][options.textNodeName];
        piTextNodeName = piTextNodeName.length !== 0 ? " " + piTextNodeName : "";
        xmlStr += tempInd + `<${tagName}${piTextNodeName}${attStr2}?>`;
        isPreviousElementTag = true;
        continue;
      }
      let newIdentation = indentation;
      if (newIdentation !== "") {
        newIdentation += options.indentBy;
      }
      const attStr = attr_to_str(tagObj[":@"], options);
      const tagStart = indentation + `<${tagName}${attStr}`;
      const tagValue = arrToStr(tagObj[tagName], options, newJPath, newIdentation);
      if (options.unpairedTags.indexOf(tagName) !== -1) {
        if (options.suppressUnpairedNode) xmlStr += tagStart + ">";
        else xmlStr += tagStart + "/>";
      } else if ((!tagValue || tagValue.length === 0) && options.suppressEmptyNode) {
        xmlStr += tagStart + "/>";
      } else if (tagValue && tagValue.endsWith(">")) {
        xmlStr += tagStart + `>${tagValue}${indentation}</${tagName}>`;
      } else {
        xmlStr += tagStart + ">";
        if (tagValue && indentation !== "" && (tagValue.includes("/>") || tagValue.includes("</"))) {
          xmlStr += indentation + options.indentBy + tagValue + indentation;
        } else {
          xmlStr += tagValue;
        }
        xmlStr += `</${tagName}>`;
      }
      isPreviousElementTag = true;
    }
    return xmlStr;
  }
  function propName(obj) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!obj.hasOwnProperty(key)) continue;
      if (key !== ":@") return key;
    }
  }
  function attr_to_str(attrMap, options) {
    let attrStr = "";
    if (attrMap && !options.ignoreAttributes) {
      for (let attr in attrMap) {
        if (!attrMap.hasOwnProperty(attr)) continue;
        let attrVal = options.attributeValueProcessor(attr, attrMap[attr]);
        attrVal = replaceEntitiesValue(attrVal, options);
        if (attrVal === true && options.suppressBooleanAttributes) {
          attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}`;
        } else {
          attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
        }
      }
    }
    return attrStr;
  }
  function isStopNode(jPath, options) {
    jPath = jPath.substr(0, jPath.length - options.textNodeName.length - 1);
    let tagName = jPath.substr(jPath.lastIndexOf(".") + 1);
    for (let index in options.stopNodes) {
      if (options.stopNodes[index] === jPath || options.stopNodes[index] === "*." + tagName) return true;
    }
    return false;
  }
  function replaceEntitiesValue(textValue, options) {
    if (textValue && textValue.length > 0 && options.processEntities) {
      for (let i = 0; i < options.entities.length; i++) {
        const entity = options.entities[i];
        textValue = textValue.replace(entity.regex, entity.val);
      }
    }
    return textValue;
  }

  // node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js
  var defaultOptions = {
    attributeNamePrefix: "@_",
    attributesGroupName: false,
    textNodeName: "#text",
    ignoreAttributes: true,
    cdataPropName: false,
    format: false,
    indentBy: "  ",
    suppressEmptyNode: false,
    suppressUnpairedNode: true,
    suppressBooleanAttributes: true,
    tagValueProcessor: function(key, a) {
      return a;
    },
    attributeValueProcessor: function(attrName, a) {
      return a;
    },
    preserveOrder: false,
    commentPropName: false,
    unpairedTags: [],
    entities: [
      { regex: new RegExp("&", "g"), val: "&amp;" },
      //it must be on top
      { regex: new RegExp(">", "g"), val: "&gt;" },
      { regex: new RegExp("<", "g"), val: "&lt;" },
      { regex: new RegExp("'", "g"), val: "&apos;" },
      { regex: new RegExp('"', "g"), val: "&quot;" }
    ],
    processEntities: true,
    stopNodes: [],
    // transformTagName: false,
    // transformAttributeName: false,
    oneListGroup: false
  };
  function Builder(options) {
    this.options = Object.assign({}, defaultOptions, options);
    if (this.options.ignoreAttributes === true || this.options.attributesGroupName) {
      this.isAttribute = function() {
        return false;
      };
    } else {
      this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
      this.attrPrefixLen = this.options.attributeNamePrefix.length;
      this.isAttribute = isAttribute;
    }
    this.processTextOrObjNode = processTextOrObjNode;
    if (this.options.format) {
      this.indentate = indentate;
      this.tagEndChar = ">\n";
      this.newLine = "\n";
    } else {
      this.indentate = function() {
        return "";
      };
      this.tagEndChar = ">";
      this.newLine = "";
    }
  }
  Builder.prototype.build = function(jObj) {
    if (this.options.preserveOrder) {
      return toXml(jObj, this.options);
    } else {
      if (Array.isArray(jObj) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1) {
        jObj = {
          [this.options.arrayNodeName]: jObj
        };
      }
      return this.j2x(jObj, 0, []).val;
    }
  };
  Builder.prototype.j2x = function(jObj, level, ajPath) {
    let attrStr = "";
    let val = "";
    const jPath = ajPath.join(".");
    for (let key in jObj) {
      if (!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
      if (typeof jObj[key] === "undefined") {
        if (this.isAttribute(key)) {
          val += "";
        }
      } else if (jObj[key] === null) {
        if (this.isAttribute(key)) {
          val += "";
        } else if (key === this.options.cdataPropName) {
          val += "";
        } else if (key[0] === "?") {
          val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
        } else {
          val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
        }
      } else if (jObj[key] instanceof Date) {
        val += this.buildTextValNode(jObj[key], key, "", level);
      } else if (typeof jObj[key] !== "object") {
        const attr = this.isAttribute(key);
        if (attr && !this.ignoreAttributesFn(attr, jPath)) {
          attrStr += this.buildAttrPairStr(attr, "" + jObj[key]);
        } else if (!attr) {
          if (key === this.options.textNodeName) {
            let newval = this.options.tagValueProcessor(key, "" + jObj[key]);
            val += this.replaceEntitiesValue(newval);
          } else {
            val += this.buildTextValNode(jObj[key], key, "", level);
          }
        }
      } else if (Array.isArray(jObj[key])) {
        const arrLen = jObj[key].length;
        let listTagVal = "";
        let listTagAttr = "";
        for (let j = 0; j < arrLen; j++) {
          const item = jObj[key][j];
          if (typeof item === "undefined") {
          } else if (item === null) {
            if (key[0] === "?") val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
            else val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
          } else if (typeof item === "object") {
            if (this.options.oneListGroup) {
              const result = this.j2x(item, level + 1, ajPath.concat(key));
              listTagVal += result.val;
              if (this.options.attributesGroupName && item.hasOwnProperty(this.options.attributesGroupName)) {
                listTagAttr += result.attrStr;
              }
            } else {
              listTagVal += this.processTextOrObjNode(item, key, level, ajPath);
            }
          } else {
            if (this.options.oneListGroup) {
              let textValue = this.options.tagValueProcessor(key, item);
              textValue = this.replaceEntitiesValue(textValue);
              listTagVal += textValue;
            } else {
              listTagVal += this.buildTextValNode(item, key, "", level);
            }
          }
        }
        if (this.options.oneListGroup) {
          listTagVal = this.buildObjectNode(listTagVal, key, listTagAttr, level);
        }
        val += listTagVal;
      } else {
        if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
          const Ks = Object.keys(jObj[key]);
          const L = Ks.length;
          for (let j = 0; j < L; j++) {
            attrStr += this.buildAttrPairStr(Ks[j], "" + jObj[key][Ks[j]]);
          }
        } else {
          val += this.processTextOrObjNode(jObj[key], key, level, ajPath);
        }
      }
    }
    return { attrStr, val };
  };
  Builder.prototype.buildAttrPairStr = function(attrName, val) {
    val = this.options.attributeValueProcessor(attrName, "" + val);
    val = this.replaceEntitiesValue(val);
    if (this.options.suppressBooleanAttributes && val === "true") {
      return " " + attrName;
    } else return " " + attrName + '="' + val + '"';
  };
  function processTextOrObjNode(object, key, level, ajPath) {
    const result = this.j2x(object, level + 1, ajPath.concat(key));
    if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
      return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
    } else {
      return this.buildObjectNode(result.val, key, result.attrStr, level);
    }
  }
  Builder.prototype.buildObjectNode = function(val, key, attrStr, level) {
    if (val === "") {
      if (key[0] === "?") return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
      else {
        return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
      }
    } else {
      let tagEndExp = "</" + key + this.tagEndChar;
      let piClosingChar = "";
      if (key[0] === "?") {
        piClosingChar = "?";
        tagEndExp = "";
      }
      if ((attrStr || attrStr === "") && val.indexOf("<") === -1) {
        return this.indentate(level) + "<" + key + attrStr + piClosingChar + ">" + val + tagEndExp;
      } else if (this.options.commentPropName !== false && key === this.options.commentPropName && piClosingChar.length === 0) {
        return this.indentate(level) + `<!--${val}-->` + this.newLine;
      } else {
        return this.indentate(level) + "<" + key + attrStr + piClosingChar + this.tagEndChar + val + this.indentate(level) + tagEndExp;
      }
    }
  };
  Builder.prototype.closeTag = function(key) {
    let closeTag = "";
    if (this.options.unpairedTags.indexOf(key) !== -1) {
      if (!this.options.suppressUnpairedNode) closeTag = "/";
    } else if (this.options.suppressEmptyNode) {
      closeTag = "/";
    } else {
      closeTag = `></${key}`;
    }
    return closeTag;
  };
  Builder.prototype.buildTextValNode = function(val, key, attrStr, level) {
    if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
      return this.indentate(level) + `<![CDATA[${val}]]>` + this.newLine;
    } else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
      return this.indentate(level) + `<!--${val}-->` + this.newLine;
    } else if (key[0] === "?") {
      return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
    } else {
      let textValue = this.options.tagValueProcessor(key, val);
      textValue = this.replaceEntitiesValue(textValue);
      if (textValue === "") {
        return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
      } else {
        return this.indentate(level) + "<" + key + attrStr + ">" + textValue + "</" + key + this.tagEndChar;
      }
    }
  };
  Builder.prototype.replaceEntitiesValue = function(textValue) {
    if (textValue && textValue.length > 0 && this.options.processEntities) {
      for (let i = 0; i < this.options.entities.length; i++) {
        const entity = this.options.entities[i];
        textValue = textValue.replace(entity.regex, entity.val);
      }
    }
    return textValue;
  };
  function indentate(level) {
    return this.options.indentBy.repeat(level);
  }
  function isAttribute(name) {
    if (name.startsWith(this.options.attributeNamePrefix) && name !== this.options.textNodeName) {
      return name.substr(this.attrPrefixLen);
    } else {
      return false;
    }
  }

  // src/services/xml/xml-builder.ts
  var builder = new Builder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    format: true,
    indentBy: "  ",
    suppressEmptyNode: true,
    cdataPropName: "__cdata",
    suppressBooleanAttributes: false,
    attributeValueProcessor: (_attrName, attrValue) => String(attrValue)
  });
  var DEBUG = false;
  function buildFromStructure(structure) {
    if (DEBUG) console.log("[XmlBuilder] Building XML from structure");
    const navigation = buildNavigationFromPages(structure.pages);
    const document2 = {
      exe_document: {
        meta: structure.meta,
        navigation
      }
    };
    const xml = builder.build(document2);
    const xmlWithDeclaration = `<?xml version="1.0" encoding="UTF-8"?>
${xml}`;
    console.log("[XmlBuilder] Successfully built XML document");
    return xmlWithDeclaration;
  }
  function buildNavigationFromPages(pages) {
    const rootPages = pages.filter((page) => page.level === 0 || page.parent_id === null);
    if (rootPages.length === 0) {
      throw new Error("No root pages found in structure");
    }
    const pageTree = rootPages.map((rootPage) => buildPageTree(rootPage, pages));
    return {
      page: pageTree.length === 1 ? pageTree[0] : pageTree
    };
  }
  function buildPageTree(page, allPages) {
    const children = allPages.filter((p) => p.parent_id === page.id).sort((a, b) => a.position - b.position);
    const xmlPage = {
      "@_id": page.id,
      "@_title": page.title
    };
    if (page.components && page.components.length > 0) {
      const components = page.components.map((comp) => ({
        "@_type": comp.type,
        "@_id": comp.id,
        "@_position": comp.order || 0,
        content: comp.content || void 0,
        properties: comp.data || void 0,
        data: comp.data || void 0
      }));
      xmlPage.component = components.length === 1 ? components[0] : components;
    }
    if (children.length > 0) {
      const childPages = children.map((child) => buildPageTree(child, allPages));
      xmlPage.page = childPages.length === 1 ? childPages[0] : childPages;
    }
    return xmlPage;
  }

  // src/shared/export/adapters/YjsDocumentAdapter.ts
  var YjsDocumentAdapter = class {
    /**
     * Create adapter from YjsDocumentManager
     * @param manager - Active YjsDocumentManager instance
     */
    constructor(manager) {
      this.manager = manager;
    }
    /**
     * Get export metadata from Y.Map
     * @returns Export metadata
     */
    getMetadata() {
      const meta = this.manager.getMetadata();
      return {
        title: meta.get("title") || "eXeLearning",
        subtitle: meta.get("subtitle") || "",
        author: meta.get("author") || "",
        description: meta.get("description") || "",
        language: meta.get("language") || "en",
        license: meta.get("license") || "",
        keywords: meta.get("keywords") || "",
        theme: meta.get("theme") || "base",
        exelearningVersion: meta.get("exelearning_version") || void 0,
        createdAt: meta.get("createdAt") || (/* @__PURE__ */ new Date()).toISOString(),
        modified: meta.get("modifiedAt") || (/* @__PURE__ */ new Date()).toISOString(),
        // Custom styles support
        customStyles: meta.get("customStyles") || void 0,
        // Export options (values stored as strings 'true'/'false' in Yjs)
        addExeLink: this.parseBoolean(meta.get("addExeLink"), true),
        // Default: true
        addPagination: this.parseBoolean(meta.get("addPagination"), false),
        addSearchBox: this.parseBoolean(meta.get("addSearchBox"), false),
        addAccessibilityToolbar: this.parseBoolean(meta.get("addAccessibilityToolbar"), false),
        addMathJax: this.parseBoolean(meta.get("addMathJax"), false),
        exportSource: this.parseBoolean(meta.get("exportSource"), true),
        // Default: true
        // Custom content
        extraHeadContent: meta.get("extraHeadContent") || void 0,
        footer: meta.get("footer") || void 0
      };
    }
    /**
     * Parse boolean value from Yjs storage
     * Values may be stored as strings 'true'/'false' or actual booleans
     * @param value - Value to parse
     * @param defaultValue - Default value if not found
     * @returns Boolean value
     */
    parseBoolean(value, defaultValue) {
      if (value === void 0 || value === null) return defaultValue;
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.toLowerCase() === "true";
      return defaultValue;
    }
    /**
     * Get navigation structure as flat array of pages
     *
     * Note: The Yjs navigation stores pages in a FLAT structure where each page
     * has a `parentId` attribute referencing its parent (not nested `children` arrays).
     * This matches how ElpxImporter.js stores pages in the browser.
     *
     * @returns Array of export pages with parentId references
     */
    getNavigation() {
      const navigation = this.manager.getNavigation();
      const pages = [];
      navigation.forEach((pageMap) => {
        const page = this.convertPage(pageMap);
        pages.push(page);
      });
      return this.sortPagesHierarchically(pages);
    }
    /**
     * Sort pages in hierarchical reading order
     * Root pages come first (sorted by order), children follow their parent (also sorted by order)
     * @param pages - Flat array of pages with parentId references
     * @returns Pages sorted in reading order
     */
    sortPagesHierarchically(pages) {
      const childrenMap = /* @__PURE__ */ new Map();
      for (const page of pages) {
        const parentId = page.parentId;
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId).push(page);
      }
      for (const children of childrenMap.values()) {
        children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      const result = [];
      const addPageAndChildren = (parentId) => {
        const children = childrenMap.get(parentId) || [];
        for (const child of children) {
          result.push(child);
          addPageAndChildren(child.id);
        }
      };
      addPageAndChildren(null);
      return result;
    }
    /**
     * Convert a Y.Map page to ExportPage format
     * @param pageMap - Y.Map representing a page
     * @returns Export page
     */
    convertPage(pageMap) {
      const blocksArray = pageMap.get("blocks");
      const blocks = [];
      if (blocksArray) {
        blocksArray.forEach((blockMap, index) => {
          blocks.push(this.convertBlock(blockMap, index));
        });
        blocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      const propsMap = pageMap.get("properties");
      const properties = propsMap ? propsMap.toJSON() : {};
      return {
        id: pageMap.get("id") || pageMap.get("pageId") || "",
        title: pageMap.get("title") || pageMap.get("pageName") || "Page",
        parentId: pageMap.get("parentId") || null,
        order: pageMap.get("order") || 0,
        blocks,
        properties
      };
    }
    /**
     * Convert a Y.Map block to ExportBlock format
     * @param blockMap - Y.Map representing a block
     * @param index - Block index for ordering
     * @returns Export block
     */
    convertBlock(blockMap, index) {
      const componentsArray = blockMap.get("components");
      const components = [];
      if (componentsArray) {
        componentsArray.forEach((compMap, compIndex) => {
          components.push(this.convertComponent(compMap, compIndex));
        });
        components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      const propsMap = blockMap.get("properties");
      const rawProps = propsMap ? propsMap.toJSON() : {};
      const properties = {
        visibility: rawProps.visibility,
        teacherOnly: rawProps.teacherOnly,
        allowToggle: rawProps.allowToggle,
        minimized: rawProps.minimized,
        identifier: rawProps.identifier,
        cssClass: rawProps.cssClass
      };
      const iconName = blockMap.get("iconName") || "";
      return {
        id: blockMap.get("id") || blockMap.get("blockId") || `block-${index}`,
        name: blockMap.get("name") || blockMap.get("blockName") || "",
        order: blockMap.get("order") || index,
        components,
        iconName,
        properties
      };
    }
    /**
     * Convert a Y.Map component to ExportComponent format
     * @param compMap - Y.Map representing a component (iDevice)
     * @param index - Component index for ordering
     * @returns Export component
     */
    convertComponent(compMap, index) {
      let content = compMap.get("content") || compMap.get("htmlContent") || compMap.get("htmlView") || "";
      if (content && typeof content === "object" && "toString" in content) {
        content = content.toString();
      }
      const rawJsonProps = compMap.get("jsonProperties");
      let properties = {};
      if (rawJsonProps) {
        if (typeof rawJsonProps === "string") {
          try {
            properties = JSON.parse(rawJsonProps);
          } catch {
          }
        } else if (typeof rawJsonProps === "object" && "toJSON" in rawJsonProps) {
          properties = rawJsonProps.toJSON();
        } else if (typeof rawJsonProps === "object") {
          properties = rawJsonProps;
        }
      }
      const structPropsMap = compMap.get("properties");
      const rawStructProps = structPropsMap ? structPropsMap.toJSON() : {};
      const structureProperties = {
        visibility: rawStructProps.visibility,
        teacherOnly: rawStructProps.teacherOnly,
        identifier: rawStructProps.identifier,
        cssClass: rawStructProps.cssClass
      };
      return {
        id: compMap.get("id") || compMap.get("ideviceId") || `comp-${index}`,
        type: compMap.get("type") || compMap.get("ideviceType") || "FreeTextIdevice",
        order: compMap.get("order") || index,
        content,
        properties,
        structureProperties
      };
    }
    /**
     * Get all unique iDevice types used in the document
     * @returns Array of iDevice type names
     */
    getUsedIdeviceTypes() {
      const types = /* @__PURE__ */ new Set();
      const pages = this.getNavigation();
      for (const page of pages) {
        for (const block of page.blocks) {
          for (const comp of block.components) {
            if (comp.type) {
              types.add(comp.type);
            }
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get combined HTML content from all pages (for library detection)
     * @returns Combined HTML string
     */
    getAllHtmlContent() {
      const htmlParts = [];
      const pages = this.getNavigation();
      for (const page of pages) {
        for (const block of page.blocks) {
          for (const comp of block.components) {
            if (comp.content) {
              htmlParts.push(comp.content);
            }
          }
        }
      }
      return htmlParts.join("\n");
    }
    /**
     * Generate content.xml from Yjs document structure
     * This enables SCORM exports to include the ODE XML for re-editing
     * @returns ODE-format XML string
     */
    async getContentXml() {
      const metadata = this.getMetadata();
      const pages = this.getNavigation();
      const meta = {
        title: metadata.title,
        subtitle: metadata.subtitle || "",
        author: metadata.author,
        description: metadata.description || "",
        language: metadata.language,
        license: metadata.license || "",
        keywords: metadata.keywords || "",
        theme: metadata.theme || "base",
        version: "3.0",
        exelearning_version: metadata.exelearningVersion || "3.0",
        created: metadata.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        modified: (/* @__PURE__ */ new Date()).toISOString(),
        // Export options
        addExeLink: metadata.addExeLink,
        addPagination: metadata.addPagination,
        addSearchBox: metadata.addSearchBox,
        addAccessibilityToolbar: metadata.addAccessibilityToolbar,
        addMathJax: metadata.addMathJax,
        exportSource: metadata.exportSource,
        // Custom content
        extraHeadContent: metadata.extraHeadContent,
        footer: metadata.footer
      };
      const pageLevels = this.calculatePageLevels(pages);
      const normalizedPages = pages.map((page, idx) => ({
        id: page.id,
        title: page.title,
        level: pageLevels.get(page.id) || 0,
        parent_id: page.parentId,
        position: page.order ?? idx,
        components: this.flattenBlocksToComponents(page.blocks)
      }));
      return buildFromStructure({
        meta,
        pages: normalizedPages,
        navigation: { page: [] },
        raw: { ode: {} }
      });
    }
    /**
     * Calculate page levels based on parent hierarchy
     */
    calculatePageLevels(pages) {
      const levels = /* @__PURE__ */ new Map();
      const pageMap = /* @__PURE__ */ new Map();
      for (const page of pages) {
        pageMap.set(page.id, page);
      }
      const getLevel = (pageId) => {
        if (levels.has(pageId)) {
          return levels.get(pageId);
        }
        const page = pageMap.get(pageId);
        if (!page || !page.parentId) {
          levels.set(pageId, 0);
          return 0;
        }
        const parentLevel = getLevel(page.parentId);
        const level = parentLevel + 1;
        levels.set(pageId, level);
        return level;
      };
      for (const page of pages) {
        getLevel(page.id);
      }
      return levels;
    }
    /**
     * Flatten blocks and their components into NormalizedComponent array
     */
    flattenBlocksToComponents(blocks) {
      const components = [];
      for (const block of blocks) {
        for (const comp of block.components) {
          components.push({
            id: comp.id,
            type: comp.type,
            content: comp.content,
            order: comp.order,
            blockId: block.id,
            blockName: block.name,
            blockIconName: block.iconName,
            blockProperties: block.properties,
            properties: comp.structureProperties,
            data: comp.properties
          });
        }
      }
      return components;
    }
  };

  // src/shared/export/browser/idevice-config-browser.ts
  function getIdeviceConfig(type) {
    const normalized = type.replace(/Idevice$/i, "").replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
    const typeMap = {
      "text": "text",
      "freetext": "text",
      "freetextfpd": "text",
      "generic": "text",
      "reflection": "text",
      "reflectionfpd": "text",
      "multi-choice": "multi-choice",
      "multichoice": "multi-choice",
      "true-false": "true-false",
      "truefalse": "true-false",
      "cloze": "cloze",
      "clozeactivity": "cloze",
      "case-study": "casestudy",
      "casestudy": "casestudy"
    };
    const cssClass = typeMap[normalized] || normalized || "text";
    const jsonIdevices = [
      // Text-type iDevices
      "text",
      "freetext",
      "freetextfpd",
      "generic",
      "reflection",
      "reflectionfpd",
      // iDevices with <component-type>json</component-type> in config.xml
      "image-gallery",
      "form",
      "casestudy",
      "case-study",
      "example",
      "trueorfalse",
      "true-or-false",
      "scrambled-list",
      "magnifier"
    ];
    const isJson = jsonIdevices.includes(cssClass) || jsonIdevices.includes(normalized);
    return {
      cssClass,
      componentType: isJson ? "json" : "html",
      template: `${cssClass}.html`
    };
  }
  var IDEVICE_JS_DEPENDENCIES = {
    checklist: ["html2canvas.js"],
    "progress-report": ["html2canvas.js"],
    "select-media-files": ["mansory-jq.js"],
    "image-gallery": ["simple-lightbox.min.js"]
  };
  var IDEVICE_CSS_DEPENDENCIES = {
    "image-gallery": ["simple-lightbox.min.css"]
  };
  function getIdeviceExportFiles(typeName, extension) {
    const mainFile = `${typeName}${extension}`;
    if (extension === ".js") {
      const dependencies = IDEVICE_JS_DEPENDENCIES[typeName] || [];
      return [mainFile, ...dependencies];
    }
    const cssDependencies = IDEVICE_CSS_DEPENDENCIES[typeName] || [];
    return [mainFile, ...cssDependencies];
  }

  // src/shared/export/constants.ts
  var LIBRARY_PATTERNS = [
    // Effects library (animations, transitions)
    {
      name: "exe_effects",
      type: "class",
      pattern: "exe-fx",
      files: ["exe_effects/exe_effects.js", "exe_effects/exe_effects.css"]
    },
    // Games library
    {
      name: "exe_games",
      type: "class",
      pattern: "exe-game",
      files: ["exe_games/exe_games.js", "exe_games/exe_games.css"]
    },
    // Code highlighting
    {
      name: "exe_highlighter",
      type: "class",
      pattern: "highlighted-code",
      files: ["exe_highlighter/exe_highlighter.js", "exe_highlighter/exe_highlighter.css"]
    },
    // Lightbox for images
    // isDirectory: true to include sprite images (PNG, GIF) referenced from CSS
    {
      name: "exe_lightbox",
      type: "rel",
      pattern: "lightbox",
      files: ["exe_lightbox/exe_lightbox.js", "exe_lightbox/exe_lightbox.css"],
      isDirectory: true
    },
    // Lightbox for image galleries
    // isDirectory: true to include sprite images (PNG, GIF) referenced from CSS
    {
      name: "exe_lightbox_gallery",
      type: "class",
      pattern: "imageGallery",
      files: ["exe_lightbox/exe_lightbox.js", "exe_lightbox/exe_lightbox.css"],
      isDirectory: true
    },
    // Tooltips (qTip2)
    {
      name: "exe_tooltips",
      type: "class",
      pattern: "exe-tooltip",
      files: [
        "exe_tooltips/exe_tooltips.js",
        "exe_tooltips/jquery.qtip.min.js",
        "exe_tooltips/jquery.qtip.min.css",
        "exe_tooltips/imagesloaded.pkg.min.js"
      ]
    },
    // Image magnifier
    {
      name: "exe_magnify",
      type: "class",
      pattern: "ImageMagnifierIdevice",
      files: ["exe_magnify/mojomagnify.js"]
    },
    // Wikipedia content styling
    {
      name: "exe_wikipedia",
      type: "class",
      pattern: "exe-wikipedia-content",
      files: ["exe_wikipedia/exe_wikipedia.css"]
    },
    // Media player (MediaElement.js)
    {
      name: "exe_media",
      type: "class",
      pattern: "mediaelement",
      files: [
        "exe_media/exe_media.js",
        "exe_media/exe_media.css",
        "exe_media/exe_media_background.png",
        "exe_media/exe_media_bigplay.png",
        "exe_media/exe_media_bigplay.svg",
        "exe_media/exe_media_controls.png",
        "exe_media/exe_media_controls.svg",
        "exe_media/exe_media_loading.gif"
      ]
    },
    // Media player via audio/video file links with lightbox
    {
      name: "exe_media_link",
      type: "regex",
      pattern: /href="[^"]*\.(mp3|mp4|flv|ogg|ogv)"[^>]*rel="[^"]*lightbox/i,
      files: [
        "exe_media/exe_media.js",
        "exe_media/exe_media.css",
        "exe_media/exe_media_background.png",
        "exe_media/exe_media_bigplay.png",
        "exe_media/exe_media_bigplay.svg",
        "exe_media/exe_media_controls.png",
        "exe_media/exe_media_controls.svg",
        "exe_media/exe_media_loading.gif"
      ]
    },
    // ABC Music notation (abcjs)
    {
      name: "abcjs",
      type: "class",
      pattern: "abc-music",
      files: ["abcjs/abcjs-basic-min.js", "abcjs/exe_abc_music.js", "abcjs/abcjs-audio.css"]
    },
    // LaTeX math expressions (MathJax)
    // Includes entire exe_math directory for dynamic extension loading and context menu
    {
      name: "exe_math",
      type: "regex",
      pattern: /\\\(|\\\[/,
      files: ["exe_math"],
      isDirectory: true
    },
    // DataGame with encrypted LaTeX (special case)
    {
      name: "exe_math_datagame",
      type: "class",
      pattern: "DataGame",
      files: ["exe_math"],
      isDirectory: true,
      requiresLatexCheck: true
    },
    // Pre-rendered math with MathML (already converted from LaTeX to SVG+MathML)
    // This enables MathJax accessibility features (right-click menu, screen reader support)
    {
      name: "exe_math_mathml",
      type: "regex",
      pattern: /<math[\s>]/i,
      files: ["exe_math"],
      isDirectory: true
    },
    // Mermaid diagrams
    {
      name: "mermaid",
      type: "class",
      pattern: "mermaid",
      files: ["mermaid/mermaid.min.js"]
    },
    // jQuery UI for sortable/draggable iDevices
    {
      name: "jquery_ui_ordena",
      type: "class",
      pattern: "ordena-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_clasifica",
      type: "class",
      pattern: "clasifica-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_relaciona",
      type: "class",
      pattern: "relaciona-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_dragdrop",
      type: "class",
      pattern: "dragdrop-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_completa",
      type: "class",
      pattern: "completa-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    // Accessibility toolbar
    // isDirectory: true to include font files (woff, woff2) and icon (png) referenced from CSS
    {
      name: "exe_atools",
      type: "class",
      pattern: "exe-atools",
      files: ["exe_atools/exe_atools.js", "exe_atools/exe_atools.css"],
      isDirectory: true
    },
    // ELPX download support (for download-source-file iDevice)
    // Includes fflate for client-side ZIP generation
    {
      name: "exe_elpx_download",
      type: "class",
      pattern: "exe-download-package-link",
      files: ["fflate/fflate.umd.js", "exe_elpx_download/exe_elpx_download.js"]
    },
    // ELPX download support for manual links using exe-package:elp protocol
    {
      name: "exe_elpx_download_protocol",
      type: "regex",
      pattern: /exe-package:elp/,
      files: ["fflate/fflate.umd.js", "exe_elpx_download/exe_elpx_download.js"]
    }
  ];
  var BASE_LIBRARIES = [
    // jQuery
    "jquery/jquery.min.js",
    // Common eXe scripts
    "common_i18n.js",
    "common.js",
    "exe_export.js",
    // Bootstrap (JS bundle includes Popper)
    "bootstrap/bootstrap.bundle.min.js",
    "bootstrap/bootstrap.bundle.min.js.map",
    "bootstrap/bootstrap.min.css",
    "bootstrap/bootstrap.min.css.map"
  ];
  var SCORM_LIBRARIES = ["scorm/SCORM_API_wrapper.js", "scorm/SCOFunctions.js"];
  var SCORM_12_NAMESPACES = {
    imscp: "http://www.imsproject.org/xsd/imscp_rootv1p1p2",
    adlcp: "http://www.adlnet.org/xsd/adlcp_rootv1p2",
    imsmd: "http://www.imsglobal.org/xsd/imsmd_v1p2",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var SCORM_2004_NAMESPACES = {
    imscp: "http://www.imsglobal.org/xsd/imscp_v1p1",
    adlcp: "http://www.adlnet.org/xsd/adlcp_v1p3",
    adlseq: "http://www.adlnet.org/xsd/adlseq_v1p3",
    adlnav: "http://www.adlnet.org/xsd/adlnav_v1p3",
    imsss: "http://www.imsglobal.org/xsd/imsss",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var IMS_NAMESPACES = {
    imscp: "http://www.imsglobal.org/xsd/imscp_v1p1",
    imsmd: "http://www.imsglobal.org/xsd/imsmd_v1p2",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var LOM_NAMESPACES = {
    lom: "http://ltsc.ieee.org/xsd/LOM",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var IDEVICE_TYPE_MAP = {
    // Text/FreeText variations
    freetext: "text",
    text: "text",
    freetextidevice: "text",
    textidevice: "text",
    // Spanish → English mappings
    adivina: "guess",
    "adivina-activity": "guess",
    listacotejo: "checklist",
    "listacotejo-activity": "checklist",
    ordena: "sort",
    clasifica: "classify",
    relaciona: "relate",
    completa: "complete",
    // Plural → singular
    rubrics: "rubric",
    // Alternative names
    "download-package": "download-source-file",
    "pbl-tools": "udl-content",
    // PBL tools maps to UDL content
    // Quiz variants
    selecciona: "quick-questions-multiple-choice",
    "selecciona-activity": "quick-questions-multiple-choice",
    quiz: "quick-questions",
    "quiz-activity": "quick-questions",
    // Game variants
    "quiz-game": "az-quiz-game",
    trivialquiz: "trivial",
    // Interactive variants
    "before-after": "beforeafter",
    "image-magnifier": "magnifier",
    "word-puzzle": "word-search",
    "palabras-puzzle": "word-search",
    "sopa-de-letras": "word-search",
    // Case study variants
    "case-study": "casestudy",
    "estudio-de-caso": "casestudy",
    // Example/model variants
    ejemplo: "example",
    modelo: "example",
    // Challenge variants
    reto: "challenge",
    desafio: "challenge",
    // External website variants
    "sitio-externo": "external-website",
    "web-externa": "external-website",
    // Form variants
    formulario: "form",
    // Flipcards variants
    tarjetas: "flipcards",
    "flash-cards": "flipcards",
    // Image gallery variants
    galeria: "image-gallery",
    "galeria-imagenes": "image-gallery",
    // Crossword variants
    crucigrama: "crossword",
    // Puzzle variants
    rompecabezas: "puzzle",
    // Map variants
    mapa: "map",
    // Discover variants
    descubre: "discover",
    // Identify variants
    identifica: "identify",
    // Hidden image variants
    "imagen-oculta": "hidden-image",
    // Padlock variants
    candado: "padlock",
    // Periodic table variants
    "tabla-periodica": "periodic-table",
    // Progress report variants
    "informe-progreso": "progress-report",
    // Scrambled list variants
    "lista-desordenada": "scrambled-list",
    // True/false variants
    verdaderofalso: "trueorfalse",
    "verdadero-falso": "trueorfalse",
    // Interactive video variants
    "video-interactivo": "interactive-video",
    // Collaborative editing
    "edicion-colaborativa": "collaborative-editing",
    // Dragdrop variants
    "arrastrar-soltar": "dragdrop",
    // Attached files variants
    "archivos-adjuntos": "attached-files",
    // Select media files variants
    "seleccionar-archivos": "select-media-files",
    // Math operations variants
    "operaciones-matematicas": "mathematicaloperations",
    // Math problems variants
    "problemas-matematicos": "mathproblems",
    // GeoGebra variants
    geogebra: "geogebra-activity"
  };
  function normalizeIdeviceType(typeName) {
    if (!typeName) return "text";
    let normalized = typeName.toLowerCase();
    normalized = normalized.replace(/-?idevice$/i, "");
    return IDEVICE_TYPE_MAP[normalized] || normalized || "text";
  }
  var ODE_DTD_FILENAME = "content.dtd";
  var ODE_DTD_CONTENT = `<!--
    ODE Content DTD
    Document Type Definition for eXeLearning ODE XML format (content.xml)
    Version: 2.0
    Namespace: http://www.intef.es/xsd/ode
    Copyright (C) 2025 eXeLearning - License: AGPL-3.0
-->

<!ELEMENT ode (userPreferences?, odeResources?, odeProperties?, odeNavStructures)>
<!ATTLIST ode
    xmlns CDATA #FIXED "http://www.intef.es/xsd/ode"
    version CDATA #IMPLIED>

<!-- User Preferences -->
<!ELEMENT userPreferences (userPreference*)>
<!ELEMENT userPreference (key, value)>

<!-- ODE Resources -->
<!ELEMENT odeResources (odeResource*)>
<!ELEMENT odeResource (key, value)>

<!-- ODE Properties -->
<!ELEMENT odeProperties (odeProperty*)>
<!ELEMENT odeProperty (key, value)>

<!-- Shared Key-Value Elements -->
<!ELEMENT key (#PCDATA)>
<!ELEMENT value (#PCDATA)>

<!-- Navigation Structures (Pages) -->
<!ELEMENT odeNavStructures (odeNavStructure+)>
<!ELEMENT odeNavStructure (odePageId, odeParentPageId, pageName, odeNavStructureOrder, odeNavStructureProperties?, odePagStructures?)>

<!ELEMENT odePageId (#PCDATA)>
<!ELEMENT odeParentPageId (#PCDATA)>
<!ELEMENT pageName (#PCDATA)>
<!ELEMENT odeNavStructureOrder (#PCDATA)>

<!ELEMENT odeNavStructureProperties (odeNavStructureProperty*)>
<!ELEMENT odeNavStructureProperty (key, value)>

<!-- Block Structures -->
<!ELEMENT odePagStructures (odePagStructure*)>
<!ELEMENT odePagStructure (odePageId, odeBlockId, blockName, iconName?, odePagStructureOrder, odePagStructureProperties?, odeComponents?)>

<!ELEMENT odeBlockId (#PCDATA)>
<!ELEMENT blockName (#PCDATA)>
<!ELEMENT iconName (#PCDATA)>
<!ELEMENT odePagStructureOrder (#PCDATA)>

<!ELEMENT odePagStructureProperties (odePagStructureProperty*)>
<!ELEMENT odePagStructureProperty (key, value)>

<!-- Components (iDevices) -->
<!ELEMENT odeComponents (odeComponent*)>
<!ELEMENT odeComponent (odePageId, odeBlockId, odeIdeviceId, odeIdeviceTypeName, htmlView?, jsonProperties?, odeComponentsOrder, odeComponentsProperties?)>

<!ELEMENT odeIdeviceId (#PCDATA)>
<!ELEMENT odeIdeviceTypeName (#PCDATA)>
<!ELEMENT htmlView (#PCDATA)>
<!ELEMENT jsonProperties (#PCDATA)>
<!ELEMENT odeComponentsOrder (#PCDATA)>

<!ELEMENT odeComponentsProperties (odeComponentsProperty*)>
<!ELEMENT odeComponentsProperty (key, value)>
`;

  // src/shared/export/adapters/BrowserResourceProvider.ts
  var BrowserResourceProvider = class {
    /**
     * Create provider with ResourceFetcher instance
     * @param fetcher - ResourceFetcher instance
     */
    constructor(fetcher) {
      this.fetcher = fetcher;
    }
    /**
     * Fetch theme files
     * @param themeName - Theme name (e.g., 'base', 'blue')
     * @returns Map of path -> content
     */
    async fetchTheme(themeName) {
      const blobMap = await this.fetcher.fetchTheme(themeName);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch iDevice resources
     * @param ideviceType - iDevice type name
     * @returns Map of path -> content (excluding test files)
     */
    async fetchIdeviceResources(ideviceType) {
      const blobMap = await this.fetcher.fetchIdevice(ideviceType);
      const files = await this.convertBlobMapToUint8ArrayMap(blobMap);
      for (const filePath of files.keys()) {
        if (filePath.endsWith(".test.js") || filePath.endsWith(".spec.js")) {
          files.delete(filePath);
        }
      }
      return files;
    }
    /**
     * Fetch base libraries (jQuery, common.js, etc.)
     * @returns Map of path -> content
     */
    async fetchBaseLibraries() {
      const blobMap = await this.fetcher.fetchBaseLibraries();
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch SCORM API wrapper files
     * @param version - SCORM version: '1.2' or '2004' (files are the same for both)
     * @returns Map of path -> content
     */
    async fetchScormFiles(_version = "1.2") {
      const blobMap = await this.fetcher.fetchScormFiles();
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch SCORM schema XSD files
     * @param version - SCORM version: '1.2' or '2004'
     * @returns Map of path -> content
     */
    async fetchScormSchemas(version) {
      const format = version === "1.2" ? "scorm12" : "scorm2004";
      const blobMap = await this.fetcher.fetchSchemas(format);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch specific library files by path
     * @param files - Array of file paths
     * @param patterns - Optional library patterns to identify directory-based libraries
     * @returns Map of path -> content
     */
    async fetchLibraryFiles(files, patterns) {
      const directoriesToInclude = /* @__PURE__ */ new Set();
      if (patterns) {
        for (const lib of patterns) {
          if (lib.isDirectory) {
            for (const file of lib.files) {
              const dirName = file.split("/")[0];
              directoriesToInclude.add(dirName);
            }
          }
        }
      }
      const regularFiles = [];
      const directoriesToFetch = /* @__PURE__ */ new Set();
      for (const file of files) {
        const dirName = file.split("/")[0];
        if (directoriesToInclude.has(dirName)) {
          directoriesToFetch.add(dirName);
        } else {
          regularFiles.push(file);
        }
      }
      const result = /* @__PURE__ */ new Map();
      if (regularFiles.length > 0) {
        const blobMap = await this.fetcher.fetchLibraryFiles(regularFiles);
        const converted = await this.convertBlobMapToUint8ArrayMap(blobMap);
        for (const [filePath, content] of converted) {
          result.set(filePath, content);
        }
      }
      for (const dir of directoriesToFetch) {
        const blobMap = await this.fetcher.fetchLibraryDirectory(dir);
        const converted = await this.convertBlobMapToUint8ArrayMap(blobMap);
        for (const [filePath, content] of converted) {
          if (!filePath.endsWith(".test.js") && !filePath.endsWith(".spec.js")) {
            result.set(filePath, content);
          }
        }
      }
      return result;
    }
    /**
     * Fetch all files in a library directory
     * @param libraryName - Library name (e.g., 'exe_effects')
     * @returns Map of path -> content
     */
    async fetchLibraryDirectory(libraryName) {
      const blobMap = await this.fetcher.fetchLibraryDirectory(libraryName);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch schema files for a format
     * @param format - Format name (scorm12, scorm2004, ims, epub3)
     * @returns Map of path -> content
     */
    async fetchSchemas(format) {
      const blobMap = await this.fetcher.fetchSchemas(format);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Normalize iDevice type name to directory name
     * @param ideviceType - Raw iDevice type name (e.g., 'FreeTextIdevice')
     * @returns Normalized directory name (e.g., 'text')
     */
    normalizeIdeviceType(ideviceType) {
      return normalizeIdeviceType(ideviceType);
    }
    /**
     * Fetch the eXeLearning "powered by" logo
     * @returns Logo image as Uint8Array, or null if not found
     */
    async fetchExeLogo() {
      const blob = await this.fetcher.fetchExeLogo();
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
      return null;
    }
    /**
     * Fetch content CSS files (base.css, etc.)
     * @returns Map of path -> content
     */
    async fetchContentCss() {
      const blobMap = await this.fetcher.fetchContentCss();
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Convert Map<string, Blob> to Map<string, Uint8Array>
     * In browser, we convert Blob to ArrayBuffer then to Uint8Array
     * @param blobMap - Map of path -> Blob
     * @returns Map of path -> Uint8Array
     */
    async convertBlobMapToUint8ArrayMap(blobMap) {
      const result = /* @__PURE__ */ new Map();
      const entries = Array.from(blobMap.entries());
      const conversions = entries.map(async ([path, blob]) => {
        const arrayBuffer = await blob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        return { path, data };
      });
      const converted = await Promise.all(conversions);
      for (const { path, data } of converted) {
        result.set(path, data);
      }
      return result;
    }
  };

  // src/shared/export/adapters/BrowserAssetProvider.ts
  var BrowserAssetProvider = class {
    /**
     * Create provider with AssetCacheManager and/or AssetManager instance
     * @param assetCache - AssetCacheManager instance (legacy, optional)
     * @param assetManager - AssetManager instance (preferred, optional)
     *
     * Note: At least one of assetCache or assetManager should be provided.
     * AssetManager is preferred for getAllAssets() as it contains the actual imported assets.
     */
    constructor(assetCache, assetManager = null) {
      this.assetCache = assetCache;
      this.assetManager = assetManager;
    }
    /**
     * Get asset data by path/id
     * @param assetId - Asset path or ID (e.g., 'abc123/image.png')
     * @returns ExportAsset or null if not found
     */
    async getAsset(assetId) {
      try {
        if (this.assetManager?.getAsset) {
          const asset = await this.assetManager.getAsset(assetId);
          if (asset?.blob) {
            const arrayBuffer = await asset.blob.arrayBuffer();
            return {
              id: asset.id,
              filename: assetId.split("/").pop() || "unknown",
              originalPath: assetId,
              mime: asset.mime || "application/octet-stream",
              data: new Uint8Array(arrayBuffer)
            };
          }
        }
        if (this.assetCache) {
          const cached = await this.assetCache.getAssetByPath(assetId);
          if (cached?.blob) {
            const arrayBuffer = await cached.blob.arrayBuffer();
            const filename = cached.metadata?.filename || assetId.split("/").pop() || "unknown";
            return {
              id: assetId,
              filename,
              originalPath: assetId,
              mime: cached.metadata?.mimeType || "application/octet-stream",
              data: new Uint8Array(arrayBuffer)
            };
          }
        }
        return null;
      } catch (error) {
        console.warn(`[BrowserAssetProvider] Failed to get asset: ${assetId}`, error);
        return null;
      }
    }
    /**
     * Check if an asset exists
     * @param assetPath - Asset path
     * @returns true if asset exists
     */
    async hasAsset(assetPath) {
      try {
        if (this.assetManager?.getAsset) {
          const asset = await this.assetManager.getAsset(assetPath);
          if (asset?.blob) {
            return true;
          }
        }
        if (this.assetCache) {
          const cached = await this.assetCache.getAssetByPath(assetPath);
          return cached !== null && cached.blob !== void 0;
        }
        return false;
      } catch {
        return false;
      }
    }
    /**
     * List all available assets
     * @returns Array of asset paths
     */
    async listAssets() {
      try {
        if (this.assetManager) {
          const assets = await this.assetManager.getProjectAssets();
          return assets.filter((a) => a.originalPath || a.filename).map((a) => a.originalPath || `${a.id}/${a.filename}`);
        }
        if (this.assetCache) {
          const assets = await this.assetCache.getAllAssets();
          return assets.filter((a) => a.metadata?.originalPath).map((a) => a.metadata.originalPath);
        }
        return [];
      } catch (error) {
        console.warn("[BrowserAssetProvider] Failed to list assets:", error);
        return [];
      }
    }
    /**
     * Get all assets as ExportAsset array
     * This is the main method used for exports - it retrieves all project assets
     * and converts them to the ExportAsset format.
     *
     * @returns Array of ExportAsset
     */
    async getAllAssets() {
      const result = [];
      try {
        if (this.assetManager) {
          const projectId = this.assetManager.projectId;
          console.log(`[BrowserAssetProvider] AssetManager available, projectId: ${projectId}`);
          console.log(`[BrowserAssetProvider] Calling getProjectAssets...`);
          const assets = await this.assetManager.getProjectAssets();
          console.log(`[BrowserAssetProvider] Found ${assets.length} assets from AssetManager`);
          if (assets.length > 0) {
            console.log(
              `[BrowserAssetProvider] First asset:`,
              JSON.stringify({
                id: assets[0].id,
                filename: assets[0].filename,
                mime: assets[0].mime,
                hasBlob: !!assets[0].blob
              })
            );
          }
          for (const asset of assets) {
            if (asset.blob) {
              const arrayBuffer = await asset.blob.arrayBuffer();
              const assetId = String(asset.id);
              const filename = asset.filename || `asset-${assetId}`;
              let originalPath;
              if (asset.folderPath) {
                originalPath = `${asset.folderPath}/${filename}`;
              } else if (asset.originalPath?.includes(assetId)) {
                originalPath = asset.originalPath;
              } else {
                originalPath = `${assetId}/${filename}`;
              }
              result.push({
                id: assetId,
                filename,
                originalPath,
                folderPath: asset.folderPath || "",
                mime: asset.mime || "application/octet-stream",
                data: new Uint8Array(arrayBuffer)
              });
            }
          }
          if (result.length > 0) {
            console.log(`[BrowserAssetProvider] Converted ${result.length} assets for export`);
            return result;
          } else {
            console.log(`[BrowserAssetProvider] AssetManager returned 0 usable assets (no blobs)`);
            if (this.assetManager.getAllAssetsRaw) {
              console.log(`[BrowserAssetProvider] Trying fallback: getAllAssetsRaw...`);
              const allAssets = await this.assetManager.getAllAssetsRaw();
              if (allAssets.length > 0) {
                console.warn(
                  `[BrowserAssetProvider] FALLBACK: Found ${allAssets.length} assets in DB (different projectIds)`
                );
                const projectIds = [...new Set(allAssets.map((a) => a.projectId))];
                console.warn(`[BrowserAssetProvider] ProjectIds in DB: ${projectIds.join(", ")}`);
                console.warn(`[BrowserAssetProvider] Expected projectId: ${projectId}`);
                const filteredAssets = allAssets.filter((a) => a.projectId === projectId);
                if (filteredAssets.length < allAssets.length) {
                  console.warn(
                    `[BrowserAssetProvider] Filtered out ${allAssets.length - filteredAssets.length} assets from other projects`
                  );
                }
                console.log(
                  `[BrowserAssetProvider] FALLBACK filtered to ${filteredAssets.length} assets matching projectId: ${projectId}`
                );
                for (const asset of filteredAssets) {
                  if (asset.blob) {
                    const arrayBuffer = await asset.blob.arrayBuffer();
                    const assetId = String(asset.id);
                    const filename = asset.filename || `asset-${assetId}`;
                    let originalPath;
                    if (asset.folderPath) {
                      originalPath = `${asset.folderPath}/${filename}`;
                    } else if (asset.originalPath?.includes(assetId)) {
                      originalPath = asset.originalPath;
                    } else {
                      originalPath = `${assetId}/${filename}`;
                    }
                    result.push({
                      id: assetId,
                      filename,
                      originalPath,
                      folderPath: asset.folderPath || "",
                      mime: asset.mime || "application/octet-stream",
                      data: new Uint8Array(arrayBuffer)
                    });
                  }
                }
                if (result.length > 0) {
                  console.log(
                    `[BrowserAssetProvider] FALLBACK converted ${result.length} assets for export`
                  );
                  return result;
                }
              }
            }
          }
        } else {
          console.log(`[BrowserAssetProvider] AssetManager not available`);
          if (this.assetCache) {
            console.log(`[BrowserAssetProvider] Trying legacy AssetCacheManager...`);
            try {
              const assets = await this.assetCache.getAllAssets();
              console.log(
                `[BrowserAssetProvider] Found ${assets.length} assets from AssetCacheManager (legacy)`
              );
              for (const asset of assets) {
                if (asset.blob) {
                  const arrayBuffer = await asset.blob.arrayBuffer();
                  const assetId = String(asset.assetId);
                  const filename = asset.metadata?.filename || `asset-${assetId}`;
                  const originalPath = asset.metadata?.originalPath || `${assetId}/${filename}`;
                  result.push({
                    id: assetId,
                    filename,
                    originalPath,
                    mime: asset.metadata?.mimeType || "application/octet-stream",
                    data: new Uint8Array(arrayBuffer)
                  });
                }
              }
            } catch (legacyError) {
              console.warn("[BrowserAssetProvider] Legacy AssetCacheManager failed:", legacyError);
            }
          }
        }
      } catch (error) {
        console.warn("[BrowserAssetProvider] Failed to get all assets:", error);
      }
      return result;
    }
    /**
     * Get all project assets (alias for getAllAssets)
     * @returns Array of ExportAsset
     */
    async getProjectAssets() {
      return this.getAllAssets();
    }
    /**
     * Resolve asset URL for preview (returns blob URL)
     * @param assetPath - Asset path
     * @returns Blob URL or null
     */
    async resolveAssetUrl(assetPath) {
      try {
        if (this.assetManager?.resolveAssetURL) {
          const url = await this.assetManager.resolveAssetURL(assetPath);
          if (url) return url;
        }
        if (this.assetCache) {
          return await this.assetCache.resolveAssetUrl(assetPath);
        }
        return null;
      } catch {
        return null;
      }
    }
  };

  // src/shared/export/adapters/ExportAssetResolver.ts
  var ExportAssetResolver = class _ExportAssetResolver {
    constructor(options = {}) {
      this.basePath = options.basePath ?? "";
      this.resourceDir = options.resourceDir ?? "content/resources";
    }
    /**
     * Resolve a single asset URL
     */
    resolve(assetUrl) {
      return this.resolveSync(assetUrl);
    }
    /**
     * Synchronous resolution
     */
    resolveSync(assetUrl) {
      if (assetUrl.startsWith("blob:") || assetUrl.startsWith("data:")) {
        return assetUrl;
      }
      if (assetUrl.startsWith("asset://")) {
        const assetPath = assetUrl.slice("asset://".length);
        return `${this.basePath}${this.resourceDir}/${assetPath}`;
      }
      if (assetUrl.includes("{{context_path}}")) {
        return assetUrl.replace("{{context_path}}/", `${this.basePath}${this.resourceDir}/`);
      }
      return assetUrl;
    }
    /**
     * Process HTML content, resolving all asset URLs
     */
    processHtml(html) {
      return this.processHtmlSync(html);
    }
    /**
     * Synchronous HTML processing
     */
    processHtmlSync(html) {
      if (!html) return "";
      let result = html;
      result = result.replace(/\{\{context_path\}\}\/([^"'\s]+)/g, (_match, assetPath) => {
        if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
          return _match;
        }
        return `${this.basePath}${this.resourceDir}/${assetPath}`;
      });
      result = result.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
        if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
          return _match;
        }
        return `${this.basePath}${this.resourceDir}/${assetPath}`;
      });
      result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
        if (relativePath.startsWith("blob:") || relativePath.startsWith("data:")) {
          return _match;
        }
        return `${this.basePath}${this.resourceDir}/${relativePath}`;
      });
      result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
        if (path.startsWith("blob:") || path.startsWith("data:")) {
          return _match;
        }
        return `"${this.basePath}${this.resourceDir}/${path}"`;
      });
      return result;
    }
    /**
     * Create a new resolver with a different base path
     */
    withBasePath(basePath) {
      return new _ExportAssetResolver({
        basePath,
        resourceDir: this.resourceDir
      });
    }
  };

  // src/shared/export/adapters/PreviewAssetResolver.ts
  var PreviewAssetResolver = class {
    constructor(assetManager, options = {}) {
      this.assetManager = assetManager;
      this.basePath = options.basePath ?? "";
      this.resolvedUrls = /* @__PURE__ */ new Map();
    }
    /**
     * Resolve a single asset URL (async)
     * Looks up the asset in the cache and returns a blob URL
     */
    async resolve(assetUrl) {
      if (assetUrl.startsWith("blob:") || assetUrl.startsWith("data:")) {
        return assetUrl;
      }
      if (assetUrl.startsWith("asset://")) {
        const assetPath = assetUrl.slice("asset://".length);
        const slashIndex = assetPath.indexOf("/");
        const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;
        const cached = this.resolvedUrls.get(assetId);
        if (cached) {
          return cached;
        }
        try {
          const blobUrl = await this.assetManager.resolveAssetUrl(assetId);
          if (blobUrl) {
            this.resolvedUrls.set(assetId, blobUrl);
            return blobUrl;
          }
        } catch {
        }
      }
      return assetUrl;
    }
    /**
     * Synchronous resolution (returns cached blob URL or original URL)
     * Use this when you need sync behavior and assets were pre-resolved
     */
    resolveSync(assetUrl) {
      if (assetUrl.startsWith("blob:") || assetUrl.startsWith("data:")) {
        return assetUrl;
      }
      if (assetUrl.startsWith("asset://")) {
        const assetPath = assetUrl.slice("asset://".length);
        const slashIndex = assetPath.indexOf("/");
        const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;
        const cached = this.resolvedUrls.get(assetId);
        if (cached) {
          return cached;
        }
        const syncUrl = this.assetManager.getAssetBlobUrl?.(assetId);
        if (syncUrl) {
          this.resolvedUrls.set(assetId, syncUrl);
          return syncUrl;
        }
      }
      return assetUrl;
    }
    /**
     * Process HTML content, resolving all asset URLs (async)
     */
    async processHtml(html) {
      if (!html) return "";
      const assetUrlPattern = /asset:\/\/([^"']+)/g;
      const assetUrls = /* @__PURE__ */ new Set();
      let match;
      while ((match = assetUrlPattern.exec(html)) !== null) {
        assetUrls.add(match[0]);
      }
      const resolutions = await Promise.all(
        Array.from(assetUrls).map(async (url) => ({
          original: url,
          resolved: await this.resolve(url)
        }))
      );
      let result = html;
      for (const { original, resolved } of resolutions) {
        if (original !== resolved) {
          result = result.split(original).join(resolved);
        }
      }
      return result;
    }
    /**
     * Synchronous HTML processing (uses cached URLs only)
     */
    processHtmlSync(html) {
      if (!html) return "";
      return html.replace(/asset:\/\/([^"']+)/g, (fullMatch, assetPath) => {
        const slashIndex = assetPath.indexOf("/");
        const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;
        const cached = this.resolvedUrls.get(assetId);
        if (cached) {
          return cached;
        }
        const syncUrl = this.assetManager.getAssetBlobUrl?.(assetId);
        if (syncUrl) {
          this.resolvedUrls.set(assetId, syncUrl);
          return syncUrl;
        }
        return fullMatch;
      });
    }
    /**
     * Pre-resolve a list of asset IDs (call before processHtmlSync)
     */
    async preResolve(assetIds) {
      await Promise.all(
        assetIds.map(async (assetId) => {
          if (!this.resolvedUrls.has(assetId)) {
            try {
              const url = await this.assetManager.resolveAssetUrl(assetId);
              if (url) {
                this.resolvedUrls.set(assetId, url);
              }
            } catch {
            }
          }
        })
      );
    }
    /**
     * Clear the resolution cache
     */
    clearCache() {
      this.resolvedUrls.clear();
    }
  };

  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  var fltn = function(d, p, t, o) {
    for (var k in d) {
      var val = d[k], n = p + k, op = o;
      if (Array.isArray(val))
        op = mrg(o, val[1]), val = val[0];
      if (val instanceof u8)
        t[n] = [val, op];
      else {
        t[n += "/"] = [new u8(0), op];
        fltn(val, n, t, o);
      }
    }
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i = 0; i < str.length; ++i)
        ar_1[i] = str.charCodeAt(i);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i = 0; i < l; ++i) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  function zipSync(data, opts) {
    if (!opts)
      opts = {};
    var r = {};
    var files = [];
    fltn(data, "", r, opts);
    var o = 0;
    var tot = 0;
    for (var fn in r) {
      var _a2 = r[fn], file = _a2[0], p = _a2[1];
      var compression = p.level == 0 ? 0 : 8;
      var f = strToU8(fn), s = f.length;
      var com = p.comment, m = com && strToU8(com), ms = m && m.length;
      var exl = exfl(p.extra);
      if (s > 65535)
        err(11);
      var d = compression ? deflateSync(file, p) : file, l = d.length;
      var c = crc();
      c.p(file);
      files.push(mrg(p, {
        size: file.length,
        crc: c.d(),
        c: d,
        f,
        m,
        u: s != fn.length || m && com.length != ms,
        o,
        compression
      }));
      o += 30 + s + exl + l;
      tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (var i = 0; i < files.length; ++i) {
      var f = files[i];
      wzh(out, f.o, f, f.f, f.u, f.c.length);
      var badd = 30 + f.f.length + exfl(f.extra);
      out.set(f.c, f.o + badd);
      wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
  }

  // src/shared/export/providers/FflateZipProvider.ts
  function toUint8Array(content) {
    if (content instanceof Uint8Array) {
      return content;
    }
    if (typeof content === "string") {
      return new TextEncoder().encode(content);
    }
    throw new Error("Blob content must be converted to Uint8Array before adding to ZIP");
  }
  var FflateZipProvider = class {
    constructor() {
      this.files = /* @__PURE__ */ new Map();
    }
    /**
     * Create a new ZIP archive (returns self for compatibility)
     */
    createZip() {
      this.reset();
      return this;
    }
    /**
     * Add a file to the archive
     */
    addFile(path, content) {
      const data = toUint8Array(content);
      this.files.set(path, data);
    }
    /**
     * Add multiple files from a Map
     */
    addFiles(files) {
      for (const [path, content] of files) {
        this.addFile(path, content);
      }
    }
    /**
     * Generate the ZIP archive (async version for compatibility)
     */
    async generateAsync() {
      return this.generate();
    }
    /**
     * Generate the ZIP archive
     */
    async generate() {
      const zipData = {};
      for (const [path, data] of this.files) {
        zipData[path] = [data, { level: 6 }];
      }
      return zipSync(zipData);
    }
    /**
     * Reset the archive for reuse
     */
    reset() {
      this.files.clear();
    }
    /**
     * Get the number of files in the archive
     */
    getFileCount() {
      return this.files.size;
    }
    /**
     * Check if a file exists in the archive
     */
    hasFile(path) {
      return this.files.has(path);
    }
    /**
     * Get file content (for testing)
     */
    getFile(path) {
      return this.files.get(path);
    }
    /**
     * Get file content as string (for testing)
     */
    getFileAsString(path) {
      const data = this.files.get(path);
      if (!data) return void 0;
      return new TextDecoder().decode(data);
    }
  };

  // src/shared/export/renderers/IdeviceRenderer.ts
  var IdeviceRenderer = class {
    /**
     * Render a single iDevice component to HTML
     * @param component - Component data
     * @param options - Rendering options
     * @returns HTML string
     */
    render(component, options = { basePath: "", includeDataAttributes: true }) {
      const { basePath = "", includeDataAttributes = true } = options;
      const type = component.type || "text";
      const config = getIdeviceConfig(type);
      const ideviceId = component.id;
      const htmlContent = component.content || "";
      const properties = component.properties || {};
      const classes = ["idevice_node", config.cssClass];
      if (!htmlContent) {
        classes.push("db-no-data");
      }
      if (properties.visibility === false || properties.visibility === "false") {
        classes.push("novisible");
      }
      if (properties.teacherOnly === true || properties.teacherOnly === "true" || properties.visibilityType === "teacher") {
        classes.push("teacher-only");
      }
      if (properties.cssClass && typeof properties.cssClass === "string") {
        classes.push(properties.cssClass);
      }
      let dataAttrs = "";
      if (includeDataAttributes) {
        const isPreviewModeForPath = basePath.startsWith("/") || basePath.includes("://");
        const normalizedType = config.cssClass;
        const idevicePath = isPreviewModeForPath ? `${basePath}${normalizedType}/export/` : `${basePath}idevices/${normalizedType}/`;
        dataAttrs = ` data-idevice-path="${this.escapeAttr(idevicePath)}"`;
        dataAttrs += ` data-idevice-type="${this.escapeAttr(normalizedType)}"`;
        const isPreviewModeForUrls = basePath.startsWith("/") || basePath.includes("://");
        if (config.componentType === "json") {
          dataAttrs += ` data-idevice-component-type="json"`;
          if (Object.keys(properties).length > 0) {
            const transformedProps = this.transformPropertiesUrls(properties, basePath, isPreviewModeForUrls);
            const jsonData = JSON.stringify(transformedProps);
            dataAttrs += ` data-idevice-json-data="${this.escapeAttr(jsonData)}"`;
          }
          if (config.template) {
            dataAttrs += ` data-idevice-template="${this.escapeAttr(config.template)}"`;
          }
        }
      }
      const isPreviewMode = basePath.startsWith("/") || basePath.includes("://");
      const fixedContent = this.fixAssetUrls(htmlContent, basePath, isPreviewMode);
      const escapedContent = this.escapePreCodeContent(fixedContent);
      const isTextIdevice = type === "text" || type === "FreeTextIdevice" || type === "TextIdevice";
      const contentHtml = isTextIdevice && escapedContent ? `<div class="exe-text">${escapedContent}</div>` : escapedContent;
      return `<div id="${this.escapeAttr(ideviceId)}" class="${classes.join(" ")}"${dataAttrs}>
${contentHtml}
</div>`;
    }
    /**
     * Render a block with multiple iDevices
     * @param block - Block data
     * @param options - Rendering options
     * @returns HTML string
     */
    renderBlock(block, options = { basePath: "", includeDataAttributes: true }) {
      const { basePath = "", includeDataAttributes = true, themeIconBasePath } = options;
      const blockId = block.id;
      const blockName = block.name || "";
      const components = block.components || [];
      const properties = block.properties || {};
      const iconName = block.iconName || "";
      const classes = ["box"];
      const hasHeader = blockName && blockName.trim() !== "";
      if (!hasHeader) {
        classes.push("no-header");
      }
      if (properties.minimized === true || properties.minimized === "true") {
        classes.push("minimized");
      }
      if (properties.visibility === false || properties.visibility === "false") {
        classes.push("novisible");
      }
      if (properties.teacherOnly === true || properties.teacherOnly === "true" || properties.visibilityType === "teacher") {
        classes.push("teacher-only");
      }
      if (properties.cssClass) {
        classes.push(properties.cssClass);
      }
      let headerHtml = "";
      if (hasHeader) {
        const hasIcon = iconName && iconName.trim() !== "";
        const headerClass = hasIcon ? "box-head" : "box-head no-icon";
        let iconHtml = "";
        if (hasIcon) {
          const iconPath = themeIconBasePath ? `${themeIconBasePath}${iconName}.png` : `${basePath}theme/icons/${iconName}.png`;
          iconHtml = `<div class="box-icon exe-icon">
<img src="${this.escapeAttr(iconPath)}" alt="">
</div>
`;
        }
        let toggleHtml = "";
        if (properties.allowToggle === true || properties.allowToggle === "true") {
          const toggleClass = properties.minimized === true || properties.minimized === "true" ? "box-toggle box-toggle-off" : "box-toggle box-toggle-on";
          toggleHtml = `<button class="${toggleClass}" title="Toggle content">
<span>Toggle content</span>
</button>`;
        }
        headerHtml = `<header class="${headerClass}">
${iconHtml}<h1 class="box-title">${this.escapeHtml(blockName)}</h1>
${toggleHtml}</header>`;
      } else {
        headerHtml = '<div class="box-head"></div>';
      }
      let contentHtml = "";
      for (const component of components) {
        contentHtml += this.render(component, { basePath, includeDataAttributes });
      }
      let extraAttrs = "";
      if (properties.identifier) {
        extraAttrs += ` identifier="${this.escapeAttr(properties.identifier)}"`;
      }
      return `<article id="${this.escapeAttr(blockId)}" class="${classes.join(" ")}"${extraAttrs}>
${headerHtml}
<div class="box-content">
${contentHtml}
</div>
</article>`;
    }
    /**
     * Fix asset URLs in HTML content
     * @param content - HTML content
     * @param basePath - Base path prefix
     * @param isPreviewMode - If true, skip asset:// transformation (keep for blob resolution)
     * @param assetExportPathMap - Optional map of asset UUID to export path (for new URL format)
     * @returns Fixed HTML content
     */
    fixAssetUrls(content, basePath, isPreviewMode = false, assetExportPathMap) {
      if (!content) return "";
      let result = content;
      if (!isPreviewMode) {
        result = result.replace(/\{\{context_path\}\}\/([^"'\s]+)/g, (_match, assetPath) => {
          if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
            return _match;
          }
          return `${basePath}content/resources/${assetPath}`;
        });
      }
      if (!isPreviewMode) {
        result = result.replace(/asset:\/\/([^"']+)/gi, (_match, fullPath) => {
          if (fullPath.startsWith("blob:") || fullPath.startsWith("data:")) {
            return _match;
          }
          const newFormatMatch = fullPath.match(/^([a-f0-9-]{36})(?:\.([a-z0-9]+))?$/i);
          if (newFormatMatch) {
            const uuid = newFormatMatch[1];
            if (assetExportPathMap?.has(uuid)) {
              const exportPath2 = assetExportPathMap.get(uuid);
              return `${basePath}content/resources/${exportPath2}`;
            }
            return _match;
          }
          const slashIndex = fullPath.indexOf("/");
          if (slashIndex === -1) {
            return _match;
          }
          const exportPath = fullPath.substring(slashIndex + 1);
          return `${basePath}content/resources/${exportPath}`;
        });
      }
      result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
        if (relativePath.startsWith("blob:") || relativePath.startsWith("data:")) {
          return _match;
        }
        return `${basePath}content/resources/${relativePath}`;
      });
      result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
        if (path.startsWith("blob:") || path.startsWith("data:")) {
          return _match;
        }
        return `"${basePath}content/resources/${path}"`;
      });
      result = result.replace(/(src|href)=(["'])resources\/([^"']+)\2/g, (_match, attr, quote, assetPath) => {
        if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
          return _match;
        }
        return `${attr}=${quote}${basePath}content/resources/${assetPath}${quote}`;
      });
      result = result.replace(
        /http:\/\/localhost:\d+\/(files|scripts)\/(perm\/)?([^"'\s]+)/g,
        (_match, prefix, _perm, path) => {
          return `${basePath}files/perm/${path}`;
        }
      );
      return result;
    }
    /**
     * Escape HTML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Unescape HTML entities
     * @param str - String with HTML entities
     * @returns Unescaped string
     */
    unescapeHtml(str) {
      if (!str) return "";
      const map = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#039;": "'",
        "&#39;": "'"
      };
      return String(str).replace(/&(amp|lt|gt|quot|#0?39);/gi, (m) => map[m.toLowerCase()] || m);
    }
    /**
     * Escape HTML entities inside <pre><code>...</code></pre> blocks
     * while preserving the rest of the HTML content.
     * This prevents script tags and other HTML from being executed
     * when shown as example code.
     *
     * @param content - HTML content string
     * @returns HTML with escaped content inside pre>code blocks
     */
    escapePreCodeContent(content) {
      if (!content) return "";
      const PRE_CODE_REGEX = /(<pre[^>]*>\s*<code[^>]*>)([\s\S]*?)(<\/code>\s*<\/pre>)/gi;
      return content.replace(PRE_CODE_REGEX, (_match, openTags, innerContent, closeTags) => {
        if (!innerContent.trim()) return openTags + innerContent + closeTags;
        const decoded = this.unescapeHtml(innerContent);
        const escaped = this.escapeHtml(decoded);
        return openTags + escaped + closeTags;
      });
    }
    /**
     * Escape attribute value
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeAttr(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    /**
     * Transform asset URLs in properties object recursively
     * Applies same URL transformation as fixAssetUrls to all string values in the object
     * @param obj - Properties object (can contain nested objects and arrays)
     * @param basePath - Base path prefix
     * @param isPreviewMode - If true, skip asset:// transformation (keep for blob resolution)
     * @param assetExportPathMap - Optional map of asset UUID to export path (for new URL format)
     * @returns Transformed properties object with fixed URLs
     */
    transformPropertiesUrls(obj, basePath, isPreviewMode, assetExportPathMap) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          result[key] = this.fixAssetUrls(value, basePath, isPreviewMode, assetExportPathMap);
        } else if (Array.isArray(value)) {
          result[key] = value.map((item) => {
            if (typeof item === "string") {
              return this.fixAssetUrls(item, basePath, isPreviewMode, assetExportPathMap);
            } else if (typeof item === "object" && item !== null) {
              return this.transformPropertiesUrls(
                item,
                basePath,
                isPreviewMode,
                assetExportPathMap
              );
            }
            return item;
          });
        } else if (typeof value === "object" && value !== null) {
          result[key] = this.transformPropertiesUrls(
            value,
            basePath,
            isPreviewMode,
            assetExportPathMap
          );
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    /**
     * Get list of CSS link tags needed for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of CSS link tags as strings
     */
    getCssLinks(ideviceTypes, basePath = "") {
      const links = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const cssFiles = getIdeviceExportFiles(typeName, ".css");
          for (const cssFile of cssFiles) {
            links.push(`<link rel="stylesheet" href="${basePath}idevices/${typeName}/${cssFile}">`);
          }
        }
      }
      return links;
    }
    /**
     * Get list of JS script tags needed for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of script tags as strings
     */
    getJsScripts(ideviceTypes, basePath = "") {
      const scripts = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const jsFiles = getIdeviceExportFiles(typeName, ".js");
          for (const jsFile of jsFiles) {
            scripts.push(`<script src="${basePath}idevices/${typeName}/${jsFile}"><\/script>`);
          }
        }
      }
      return scripts;
    }
    /**
     * Get list of CSS link info (without full tag) for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of link info objects
     */
    getCssLinkInfo(ideviceTypes, basePath = "") {
      const links = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const cssFiles = getIdeviceExportFiles(typeName, ".css");
          for (const cssFile of cssFiles) {
            const href = `${basePath}idevices/${typeName}/${cssFile}`;
            links.push({
              href,
              tag: `<link rel="stylesheet" href="${href}">`
            });
          }
        }
      }
      return links;
    }
    /**
     * Get list of JS script info (without full tag) for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of script info objects
     */
    getJsScriptInfo(ideviceTypes, basePath = "") {
      const scripts = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const jsFiles = getIdeviceExportFiles(typeName, ".js");
          for (const jsFile of jsFiles) {
            const src = `${basePath}idevices/${typeName}/${jsFile}`;
            scripts.push({
              src,
              tag: `<script src="${src}"><\/script>`
            });
          }
        }
      }
      return scripts;
    }
  };

  // src/shared/export/renderers/PageRenderer.ts
  var NAV_TRANSLATIONS = {
    es: { previous: "Anterior", next: "Siguiente" },
    en: { previous: "Previous", next: "Next" },
    ca: { previous: "Anterior", next: "Seg\xFCent" },
    eu: { previous: "Aurrekoa", next: "Hurrengoa" },
    gl: { previous: "Anterior", next: "Seguinte" },
    pt: { previous: "Anterior", next: "Pr\xF3ximo" },
    fr: { previous: "Pr\xE9c\xE9dent", next: "Suivant" },
    de: { previous: "Zur\xFCck", next: "Weiter" },
    it: { previous: "Precedente", next: "Successivo" },
    nl: { previous: "Vorige", next: "Volgende" },
    zh: { previous: "\u4E0A\u4E00\u9875", next: "\u4E0B\u4E00\u9875" },
    ja: { previous: "\u524D\u3078", next: "\u6B21\u3078" },
    ar: { previous: "\u0627\u0644\u0633\u0627\u0628\u0642", next: "\u0627\u0644\u062A\u0627\u0644\u064A" }
  };
  function getNavTranslations(language) {
    return NAV_TRANSLATIONS[language] || NAV_TRANSLATIONS.en;
  }
  var PageRenderer = class {
    /**
     * @param ideviceRenderer - Renderer for iDevice content
     */
    constructor(ideviceRenderer = null) {
      this.ideviceRenderer = ideviceRenderer || new IdeviceRenderer();
    }
    /**
     * Render a complete HTML page
     * @param page - Page data
     * @param options - Rendering options
     * @returns Complete HTML document
     */
    render(page, options) {
      const {
        projectTitle = "eXeLearning",
        language = "en",
        customStyles = "",
        allPages = [],
        basePath = "",
        isIndex = false,
        usedIdevices = [],
        license = "creative commons: attribution - share alike 4.0",
        description = "",
        licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/",
        // Page counter options
        totalPages,
        currentPageIndex,
        userFooterContent = "",
        // Export options (with defaults)
        addExeLink = true,
        addPagination = false,
        addSearchBox = false,
        addAccessibilityToolbar = false,
        addMathJax = false,
        // Custom head content
        extraHeadContent = "",
        // SCORM-specific options
        isScorm = false,
        scormVersion = "",
        bodyClass = "",
        extraHeadScripts = "",
        onLoadScript = "",
        onUnloadScript = "",
        // Theme files (CSS/JS from theme root directory)
        themeFiles = []
      } = options;
      const pageTitle = isIndex ? projectTitle : page.title || "Page";
      const originalContent = this.collectPageContent(page);
      const detectedLibraries = this.detectContentLibraries(originalContent);
      const pageContent = this.renderPageContent(page, basePath, projectTitle);
      const total = totalPages ?? allPages.length;
      const currentIdx = currentPageIndex ?? allPages.findIndex((p) => p.id === page.id);
      const bodyClassStr = bodyClass || "exe-export exe-web-site";
      const onLoadAttr = onLoadScript ? ` onload="${onLoadScript}"` : "";
      const onUnloadAttr = onUnloadScript ? ` onunload="${onUnloadScript}" onbeforeunload="${onUnloadScript}"` : "";
      const pageHeaderHtml = this.renderPageHeader(page, {
        projectTitle,
        projectSubtitle: options.projectSubtitle,
        currentPageIndex: currentIdx,
        totalPages: total,
        addPagination
      });
      const searchBoxHtml = addSearchBox ? `<div id="exe-client-search" data-block-order-string="Caja %e" data-no-results-string="Sin resultados.">
</div>` : "";
      const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe() : "";
      return `<!DOCTYPE html>
<html lang="${language}" id="exe-${isIndex ? "index" : page.id}">
<head>
${this.renderHead({ pageTitle, basePath, usedIdevices, customStyles, extraHeadScripts, isScorm, scormVersion, description, licenseUrl, addAccessibilityToolbar, addMathJax, extraHeadContent, addSearchBox, detectedLibraries, themeFiles })}
</head>
<body class="${bodyClassStr}" lang="${language}"${onLoadAttr}${onUnloadAttr}>
<script>document.body.className+=" js"<\/script>
<div class="exe-content exe-export pre-js siteNav-hidden"> ${this.renderNavigation(allPages, page.id, basePath)}<main id="${page.id}" class="page"> ${searchBoxHtml}
${pageHeaderHtml}<div id="page-content-${page.id}" class="page-content">
${pageContent}
</div></main>${this.renderNavButtons(page, allPages, basePath, language)}
${this.renderFooterSection({ license, licenseUrl, userFooterContent })}
</div>
${madeWithExeHtml}
</body>
</html>`;
    }
    /**
     * Render HTML head section
     * Legacy order: SCRIPTS first, then CSS (required for proper initialization)
     * @param options - Head render options
     * @returns HTML head content
     */
    renderHead(options) {
      const {
        pageTitle,
        basePath,
        usedIdevices,
        customStyles,
        extraHeadScripts = "",
        isScorm: _isScorm = false,
        description = "",
        licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/",
        addAccessibilityToolbar = false,
        addMathJax = false,
        extraHeadContent = "",
        addSearchBox = false,
        detectedLibraries = [],
        themeFiles = []
      } = options;
      let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning v3.0.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="license" type="text/html" href="${licenseUrl}">
<title>${this.escapeHtml(pageTitle)}</title>`;
      if (description) {
        head += `
<meta name="description" content="${this.escapeAttr(description)}">`;
      }
      head += `
<script>document.querySelector("html").classList.add("js");<\/script>`;
      head += `<script src="${basePath}libs/jquery/jquery.min.js"> <\/script>`;
      head += `<script src="${basePath}libs/common_i18n.js"> <\/script>`;
      head += `<script src="${basePath}libs/common.js"> <\/script>`;
      head += `<script src="${basePath}libs/exe_export.js"> <\/script>`;
      if (addSearchBox) {
        head += `<script src="${basePath}search_index.js"> <\/script>`;
      }
      head += `<script src="${basePath}libs/bootstrap/bootstrap.bundle.min.js"> <\/script>`;
      head += `<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">`;
      const jsScripts = this.ideviceRenderer.getJsScripts(usedIdevices, basePath);
      const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, basePath);
      for (let i = 0; i < jsScripts.length; i++) {
        head += `
${jsScripts[i]}`;
        if (cssLinks[i]) {
          head += cssLinks[i];
        }
      }
      for (const libName of detectedLibraries) {
        const libPattern = LIBRARY_PATTERNS.find((p) => p.name === libName);
        if (!libPattern) continue;
        const jsFiles = libPattern.files.filter((f) => f.endsWith(".js"));
        const cssFiles = libPattern.files.filter((f) => f.endsWith(".css"));
        for (const jsFile of jsFiles) {
          head += `
<script src="${basePath}libs/${jsFile}"> <\/script>`;
        }
        for (const cssFile of cssFiles) {
          head += `
<link rel="stylesheet" href="${basePath}libs/${cssFile}">`;
        }
      }
      head += `
<link rel="stylesheet" href="${basePath}content/css/base.css">`;
      if (themeFiles.length > 0) {
        const sortedFiles = [...themeFiles].sort();
        const jsFiles = sortedFiles.filter((f) => f.endsWith(".js"));
        const cssFiles = sortedFiles.filter((f) => f.endsWith(".css"));
        for (const jsFile of jsFiles) {
          head += `<script src="${basePath}theme/${jsFile}"> <\/script>`;
        }
        for (const cssFile of cssFiles) {
          head += `<link rel="stylesheet" href="${basePath}theme/${cssFile}">`;
        }
      } else {
        head += `<script src="${basePath}theme/default.js"> <\/script>`;
        head += `<link rel="stylesheet" href="${basePath}theme/content.css">`;
      }
      if (customStyles) {
        head += `
<style>
${customStyles}
</style>`;
      }
      if (addAccessibilityToolbar) {
        head += `
<script src="${basePath}libs/exe_atools/exe_atools.js"> <\/script>`;
        head += `<link rel="stylesheet" href="${basePath}libs/exe_atools/exe_atools.css">`;
      }
      if (addMathJax) {
        head += `
<script src="${basePath}libs/exe_math/tex-mml-svg.js"> <\/script>`;
      }
      if (extraHeadContent) {
        head += `
${extraHeadContent}`;
      }
      if (extraHeadScripts) {
        head += `
${extraHeadScripts}`;
      }
      return head;
    }
    /**
     * Render navigation menu
     * @param allPages - All pages in the project
     * @param currentPageId - ID of the current page
     * @param basePath - Base path for links
     * @returns Navigation HTML
     */
    renderNavigation(allPages, currentPageId, basePath) {
      const rootPages = allPages.filter((p) => !p.parentId);
      let html = '<nav id="siteNav">\n<ul>\n';
      for (const page of rootPages) {
        html += this.renderNavItem(page, allPages, currentPageId, basePath);
      }
      html += "</ul>\n</nav>";
      return html;
    }
    /**
     * Render a single navigation item (recursive for children)
     * @param page - Page to render
     * @param allPages - All pages
     * @param currentPageId - Current page ID
     * @param basePath - Base path
     * @returns Navigation item HTML
     */
    renderNavItem(page, allPages, currentPageId, basePath) {
      if (!this.isPageVisible(page, allPages)) {
        return "";
      }
      const children = allPages.filter((p) => p.parentId === page.id && this.isPageVisible(p, allPages));
      const isCurrent = page.id === currentPageId;
      const hasChildren = children.length > 0;
      const isAncestor = this.isAncestorOf(page.id, currentPageId, allPages);
      const isFirstPage = page.id === allPages[0]?.id;
      const liClass = isCurrent ? ' id="active" class="active"' : isAncestor ? ' class="current-page-parent"' : "";
      const link = this.getPageLink(page, allPages, basePath);
      const linkClasses = [];
      if (isCurrent) linkClasses.push("active");
      if (isFirstPage) linkClasses.push("main-node");
      linkClasses.push(hasChildren ? "daddy" : "no-ch");
      if (this.isPageHighlighted(page)) {
        linkClasses.push("highlighted-link");
      }
      let html = `<li${liClass}>`;
      html += ` <a href="${link}" class="${linkClasses.join(" ")}">${this.escapeHtml(page.title)}</a>
`;
      if (hasChildren) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
          html += this.renderNavItem(child, allPages, currentPageId, basePath);
        }
        html += "</ul>\n";
      }
      html += "</li>\n";
      return html;
    }
    /**
     * Check if a page is an ancestor of another
     * @param ancestorId - Potential ancestor ID
     * @param childId - Child ID
     * @param allPages - All pages
     * @returns True if ancestorId is an ancestor of childId
     */
    isAncestorOf(ancestorId, childId, allPages) {
      const child = allPages.find((p) => p.id === childId);
      if (!child || !child.parentId) return false;
      if (child.parentId === ancestorId) return true;
      return this.isAncestorOf(ancestorId, child.parentId, allPages);
    }
    /**
     * Check if a page is visible in export
     * First page is always visible regardless of visibility setting.
     * If a parent is hidden, all its children are also hidden.
     * @param page - Page to check
     * @param allPages - All pages
     * @returns True if page should be visible
     */
    isPageVisible(page, allPages) {
      if (page.id === allPages[0]?.id) {
        return true;
      }
      const visibility = page.properties?.visibility;
      if (visibility === false || visibility === "false") {
        return false;
      }
      if (page.parentId) {
        const parent = allPages.find((p) => p.id === page.parentId);
        if (parent && !this.isPageVisible(parent, allPages)) {
          return false;
        }
      }
      return true;
    }
    /**
     * Filter pages to only include visible ones
     * @param pages - All pages
     * @returns Pages that should be visible in navigation and exports
     */
    getVisiblePages(pages) {
      return pages.filter((page) => this.isPageVisible(page, pages));
    }
    /**
     * Check if a page has highlight property enabled
     * @param page - Page to check
     * @returns True if page should be highlighted in navigation
     */
    isPageHighlighted(page) {
      const highlight = page.properties?.highlight;
      return highlight === true || highlight === "true";
    }
    /**
     * Check if a page's title should be hidden
     * @param page - Page to check
     * @returns True if page title should be hidden
     */
    shouldHidePageTitle(page) {
      const hideTitle = page.properties?.hidePageTitle;
      return hideTitle === true || hideTitle === "true";
    }
    /**
     * Get effective page title (respects editableInPage + titlePage properties)
     * If editableInPage is true and titlePage is set, use titlePage
     * Otherwise use the default page title
     * @param page - Page to get title for
     * @returns Effective title string
     */
    getEffectivePageTitle(page) {
      const editableInPage = page.properties?.editableInPage;
      if (editableInPage === true || editableInPage === "true") {
        const titlePage = page.properties?.titlePage;
        if (titlePage) return titlePage;
      }
      return page.title;
    }
    /**
     * Get page link URL
     * @param page - Page
     * @param allPages - All pages
     * @param basePath - Base path
     * @returns Link URL
     */
    getPageLink(page, allPages, basePath) {
      const isFirstPage = page.id === allPages[0]?.id;
      if (isFirstPage) {
        return basePath ? `${basePath}index.html` : "index.html";
      }
      const filename = this.sanitizeFilename(page.title);
      return `${basePath}html/${filename}.html`;
    }
    /**
     * Sanitize title for use as filename
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
    /**
     * Render page header with page counter, package title (h1), subtitle, and page title (h2)
     * @param page - Page
     * @param options - Header options including counter info
     * @returns Header HTML
     */
    renderPageHeader(page, options) {
      const { projectTitle, projectSubtitle, currentPageIndex, totalPages, addPagination } = options;
      const pageCounterHtml = addPagination ? ` <p class="page-counter"> <span class="page-counter-label">P\xE1gina </span><span class="page-counter-content"> <strong class="page-counter-current-page">${currentPageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalPages}</strong></span></p>
` : "";
      const hideTitle = this.shouldHidePageTitle(page);
      const effectiveTitle = this.getEffectivePageTitle(page);
      const pageHeaderStyle = hideTitle ? ' style="display:none"' : "";
      const subtitleHtml = projectSubtitle ? `
<p class="package-subtitle">${this.escapeHtml(projectSubtitle)}</p>` : "";
      return `${pageCounterHtml}<header class="main-header">
<div class="package-header package-node"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>${subtitleHtml}</div>
<div class="page-header"${pageHeaderStyle}><h2 class="page-title">${this.escapeHtml(effectiveTitle)}</h2></div>
</header>`;
    }
    /**
     * Render page content (blocks with iDevices)
     * @param page - Page
     * @param basePath - Base path
     * @param projectTitle - Project title (for exe-package:elp transformation)
     * @returns Content HTML
     */
    renderPageContent(page, basePath, projectTitle) {
      let html = "";
      for (const block of page.blocks || []) {
        html += this.ideviceRenderer.renderBlock(block, {
          basePath,
          includeDataAttributes: true
        });
      }
      if (projectTitle) {
        html = this.replaceElpxProtocol(html, projectTitle);
      }
      return html;
    }
    /**
     * Collect all content from a page's components (for library detection)
     * @param page - Page to collect content from
     * @returns Combined HTML content from all components
     */
    collectPageContent(page) {
      const parts = [];
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.content) {
            parts.push(component.content);
          }
        }
      }
      return parts.join("\n");
    }
    /**
     * Replace exe-package:elp protocol with client-side download handler
     * This enables the download-source-file iDevice to generate ELPX files on-the-fly
     *
     * @param content - HTML content
     * @param projectTitle - Project title for the download filename
     * @returns Content with exe-package:elp replaced with onclick handler
     */
    replaceElpxProtocol(content, projectTitle) {
      if (!content || !content.includes("exe-package:elp")) {
        return content;
      }
      let result = content.replace(
        /href="exe-package:elp"/g,
        `href="#" onclick="if(typeof downloadElpx==='function')downloadElpx();return false;"`
      );
      const safeTitle = this.escapeHtml(projectTitle);
      result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);
      return result;
    }
    /**
     * Render navigation buttons (prev/next links)
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @param language - Language for button text translation
     * @returns Navigation buttons HTML
     */
    renderNavButtons(page, allPages, basePath, language = "en") {
      const currentIndex = allPages.findIndex((p) => p.id === page.id);
      const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
      const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
      const t = getNavTranslations(language);
      let html = '<div class="nav-buttons">';
      if (prevPage) {
        const link = this.getPageLink(prevPage, allPages, basePath);
        html += ` <a href="${link}" title="${t.previous}" class="nav-button nav-button-left"> <span>${t.previous}</span></a>`;
      } else {
        html += ` <span class="nav-button nav-button-left" aria-hidden="true"> <span>${t.previous}</span></span>`;
      }
      if (nextPage) {
        const link = this.getPageLink(nextPage, allPages, basePath);
        html += `<a href="${link}" title="${t.next}" class="nav-button nav-button-right"> <span>${t.next}</span></a>`;
      } else {
        html += `<span class="nav-button nav-button-right" aria-hidden="true"> <span>${t.next}</span></span>`;
      }
      html += "\n</div>";
      return html;
    }
    /**
     * Render pagination (prev/next links) - legacy method kept for backward compatibility
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @param language - Language for button text translation
     * @returns Pagination HTML
     * @deprecated Use renderNavButtons instead
     */
    renderPagination(page, allPages, basePath, language = "en") {
      return this.renderNavButtons(page, allPages, basePath, language);
    }
    /**
     * Render complete footer section with license and optional user content
     * @param options - Footer options
     * @returns Footer HTML with siteFooter wrapper
     */
    renderFooterSection(options) {
      const { license, licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/", userFooterContent } = options;
      let userFooterHtml = "";
      if (userFooterContent) {
        userFooterHtml = `<div id="siteUserFooter"> <div>${userFooterContent}</div>
</div>`;
      }
      return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${this.escapeHtml(license)}</a></p>
</div>
${userFooterHtml}</div></footer>`;
    }
    /**
     * Render "Made with eXeLearning" credit
     * @returns Made with eXe HTML
     */
    renderMadeWithEXe() {
      return `<p id="made-with-eXe"> <a href="https://exelearning.net/" target="_blank" rel="noopener"> <span>Creado con eXeLearning <span>(nueva ventana)</span></span></a></p>`;
    }
    /**
     * Render license div (inside main, before pagination)
     * @param options - License options
     * @returns License HTML
     * @deprecated Use renderFooterSection instead
     */
    renderLicense(options) {
      const { license, licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/" } = options;
      return `<div id="packageLicense" class="cc cc-by-sa">
<p><span>Licensed under the</span> <a rel="license" href="${licenseUrl}">${this.escapeHtml(license)}</a></p>
</div>`;
    }
    /**
     * Render footer section (legacy method, kept for backward compatibility)
     * @param options - Footer options
     * @returns Footer HTML
     * @deprecated Use renderFooterSection instead
     */
    renderFooter(options) {
      return this.renderLicense({ ...options, licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" });
    }
    /**
     * Generate search data JSON for client-side search functionality
     * @param allPages - All pages in the project
     * @param basePath - Base path for URLs
     * @returns JSON string with page structure
     */
    generateSearchData(allPages, _basePath) {
      const pagesData = {};
      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i];
        const isIndex = i === 0;
        const prevPage = i > 0 ? allPages[i - 1] : null;
        const nextPage = i < allPages.length - 1 ? allPages[i + 1] : null;
        const fileName = isIndex ? "index.html" : `${this.sanitizeFilename(page.title)}.html`;
        const fileUrl = isIndex ? "index.html" : `html/${fileName}`;
        const blocksData = {};
        for (const block of page.blocks || []) {
          const idevicesData = {};
          for (let j = 0; j < (block.components || []).length; j++) {
            const component = block.components[j];
            idevicesData[component.id] = {
              order: j + 1,
              htmlView: component.content || "",
              jsonProperties: JSON.stringify(component.properties || {})
            };
          }
          blocksData[block.id] = {
            name: block.name || "",
            order: block.order || 1,
            idevices: idevicesData
          };
        }
        pagesData[page.id] = {
          name: page.title,
          isIndex,
          fileName,
          fileUrl,
          prePageId: prevPage?.id || null,
          nextPageId: nextPage?.id || null,
          blocks: blocksData
        };
      }
      return JSON.stringify(pagesData);
    }
    /**
     * Generate the content for search_index.js file
     * @param allPages - All pages in the project
     * @param basePath - Base path for URLs
     * @returns JavaScript file content with window.exeSearchData assignment
     */
    generateSearchIndexFile(allPages, basePath) {
      const searchDataJson = this.generateSearchData(allPages, basePath);
      return `window.exeSearchData = ${searchDataJson};`;
    }
    /**
     * Render a single-page HTML document with all pages
     * @param allPages - All pages in the project
     * @param options - Rendering options
     * @returns Complete HTML document
     */
    renderSinglePage(allPages, options = {}) {
      const {
        projectTitle = "eXeLearning",
        projectSubtitle = "",
        language = "en",
        customStyles = "",
        usedIdevices = [],
        author = "",
        license = "CC-BY-SA"
      } = options;
      let contentHtml = "";
      for (const page of allPages) {
        const hideTitle = this.shouldHidePageTitle(page);
        const effectiveTitle = this.getEffectivePageTitle(page);
        const pageHeaderStyle = hideTitle ? ' style="display:none"' : "";
        contentHtml += `<section id="section-${page.id}" class="single-page-section">
<header class="page-header"${pageHeaderStyle}>
<h2 class="page-title">${this.escapeHtml(effectiveTitle)}</h2>
</header>
<div class="page-content">
${this.renderPageContent(page, "", projectTitle)}
</div>
</section>
`;
      }
      const jsScripts = this.ideviceRenderer.getJsScripts(usedIdevices, "");
      const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, "");
      let ideviceIncludes = "";
      for (let i = 0; i < jsScripts.length; i++) {
        ideviceIncludes += `
${jsScripts[i]}`;
        if (cssLinks[i]) {
          ideviceIncludes += cssLinks[i];
        }
      }
      return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="generator" content="eXeLearning v3.0.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)}</title>
<script>document.querySelector("html").classList.add("js");<\/script>
<script src="libs/jquery/jquery.min.js"> <\/script>
<script src="libs/common_i18n.js"> <\/script>
<script src="libs/common.js"> <\/script>
<script src="libs/exe_export.js"> <\/script>
<script src="libs/bootstrap/bootstrap.bundle.min.js"> <\/script>
<link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css">${ideviceIncludes}
<link rel="stylesheet" href="content/css/base.css">
<script src="theme/style.js"> <\/script>
<link rel="stylesheet" href="theme/style.css">
${customStyles ? `<style>
${customStyles}
</style>` : ""}
</head>
<body class="exe-export exe-single-page" lang="${language}">
<script>document.body.className+=" js"<\/script>
<div class="exe-content exe-export pre-js siteNav-hidden">
<main class="single-page-content">
<header class="package-header package-node"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>${projectSubtitle ? `
<p class="package-subtitle">${this.escapeHtml(projectSubtitle)}</p>` : ""}</header>
${contentHtml}
</main>
${this.renderLicense({ author, license })}
</div>
</body>
</html>`;
    }
    /**
     * Render navigation for single-page export (anchor links)
     * @param allPages - All pages
     * @returns Navigation HTML
     */
    renderSinglePageNav(allPages) {
      const rootPages = allPages.filter((p) => !p.parentId);
      let html = '<nav id="siteNav" class="single-page-nav">\n<ul>\n';
      for (const page of rootPages) {
        html += this.renderSinglePageNavItem(page, allPages);
      }
      html += "</ul>\n</nav>";
      return html;
    }
    /**
     * Render a single navigation item for single-page (anchor links)
     * @param page - Page
     * @param allPages - All pages
     * @returns Navigation item HTML
     */
    renderSinglePageNavItem(page, allPages) {
      if (!this.isPageVisible(page, allPages)) {
        return "";
      }
      const children = allPages.filter((p) => p.parentId === page.id && this.isPageVisible(p, allPages));
      const hasChildren = children.length > 0;
      const linkClasses = [];
      linkClasses.push(hasChildren ? "daddy" : "no-ch");
      if (this.isPageHighlighted(page)) {
        linkClasses.push("highlighted-link");
      }
      let html = "<li>";
      html += ` <a href="#section-${page.id}" class="${linkClasses.join(" ")}">${this.escapeHtml(page.title)}</a>
`;
      if (hasChildren) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
          html += this.renderSinglePageNavItem(child, allPages);
        }
        html += "</ul>\n";
      }
      html += "</li>\n";
      return html;
    }
    /**
     * Detect content-based libraries from HTML content
     * Scans the content for patterns that indicate specific libraries are needed
     * @param html - HTML content to scan
     * @returns Array of library names detected
     */
    detectContentLibraries(html) {
      const detectedLibs = /* @__PURE__ */ new Set();
      for (const lib of LIBRARY_PATTERNS) {
        let found = false;
        switch (lib.type) {
          case "class":
            found = html.includes(`class="${lib.pattern}"`) || html.includes(`class='${lib.pattern}'`) || new RegExp(`class="[^"]*\\b${lib.pattern}\\b[^"]*"`, "i").test(html) || new RegExp(`class='[^']*\\b${lib.pattern}\\b[^']*'`, "i").test(html);
            break;
          case "rel":
            found = html.includes(`rel="${lib.pattern}"`) || html.includes(`rel='${lib.pattern}'`);
            break;
          case "data":
            found = html.includes(`data-${lib.pattern}`) || html.includes(`data-${lib.pattern}=`);
            break;
          case "regex":
            found = lib.pattern.test(html);
            break;
        }
        if (found) {
          detectedLibs.add(lib.name);
        }
      }
      return Array.from(detectedLibs);
    }
    /**
     * Escape HTML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Escape attribute value for use in HTML attributes
     * @param str - String to escape
     * @returns Escaped string safe for attribute values
     */
    escapeAttr(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  };

  // src/shared/export/utils/LibraryDetector.ts
  var LibraryDetector = class {
    constructor() {
      this.detectedLibraries = /* @__PURE__ */ new Set();
      this.filesToInclude = /* @__PURE__ */ new Set();
      this.detectedPatterns = [];
    }
    /**
     * Detect all required libraries by scanning HTML content
     * @param html - HTML content to scan
     * @param options - Detection options
     * @returns Detected libraries info
     */
    detectLibraries(html, options = {}) {
      this.detectedLibraries.clear();
      this.filesToInclude.clear();
      this.detectedPatterns = [];
      if (!html || typeof html !== "string") {
        return this._buildResult();
      }
      for (const lib of LIBRARY_PATTERNS) {
        if (options.skipMathJax && (lib.name === "exe_math" || lib.name === "exe_math_datagame")) {
          continue;
        }
        if (options.skipMermaid && lib.name === "mermaid") {
          continue;
        }
        if (this._matchesPattern(html, lib)) {
          if (lib.requiresLatexCheck) {
            if (!this._hasLatexInDataGame(html)) {
              continue;
            }
          }
          this._addLibrary(lib);
        }
      }
      if (options.includeAccessibilityToolbar) {
        const atoolsLib = LIBRARY_PATTERNS.find((l) => l.name === "exe_atools");
        if (atoolsLib) {
          this._addLibrary(atoolsLib);
        }
      }
      if (options.includeMathJax) {
        const mathLib = LIBRARY_PATTERNS.find((l) => l.name === "exe_math");
        if (mathLib) {
          this._addLibrary(mathLib);
        }
      }
      return this._buildResult();
    }
    /**
     * Check if HTML matches a library pattern
     * @param html - HTML content
     * @param lib - Library pattern definition
     * @returns True if pattern matches
     */
    _matchesPattern(html, lib) {
      switch (lib.type) {
        case "class":
          return new RegExp(`class="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, "i").test(html);
        case "rel":
          return new RegExp(`rel="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, "i").test(html);
        case "regex":
          return lib.pattern.test(html);
        default:
          return false;
      }
    }
    /**
     * Check if DataGame content contains LaTeX after decryption
     * @param html - HTML content
     * @returns True if LaTeX is found in decrypted DataGame content
     */
    _hasLatexInDataGame(html) {
      const match = html.match(/<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>(.*?)<\/div>/s);
      if (!match) return false;
      const decrypted = this._decrypt(match[1]);
      return /\\\(|\\\[/.test(decrypted);
    }
    /**
     * Decrypt XOR-encoded string (matches Symfony's decrypt method)
     * @param str - Encrypted string
     * @returns Decrypted string
     */
    _decrypt(str) {
      if (!str || str === "undefined" || str === "null") return "";
      try {
        str = decodeURIComponent(str);
        const key = 146;
        let result = "";
        for (let i = 0; i < str.length; i++) {
          result += String.fromCharCode(key ^ str.charCodeAt(i));
        }
        return result;
      } catch {
        return "";
      }
    }
    /**
     * Add a library and its files to the detected set
     * @param lib - Library pattern
     */
    _addLibrary(lib) {
      if (this.detectedLibraries.has(lib.name)) return;
      this.detectedLibraries.add(lib.name);
      this.detectedPatterns.push(lib);
      for (const file of lib.files) {
        this.filesToInclude.add(file);
      }
    }
    /**
     * Build the result object
     * @returns Detection result
     */
    _buildResult() {
      const libraries = [];
      for (const lib of LIBRARY_PATTERNS) {
        if (this.detectedLibraries.has(lib.name)) {
          libraries.push({
            name: lib.name,
            files: lib.files
          });
        }
      }
      return {
        libraries,
        files: Array.from(this.filesToInclude),
        count: libraries.length,
        patterns: this.detectedPatterns
      };
    }
    /**
     * Get base libraries (always included)
     * @returns Array of base library file paths
     */
    getBaseLibraries() {
      return [...BASE_LIBRARIES];
    }
    /**
     * Get SCORM-specific libraries
     * @returns Array of SCORM library file paths
     */
    getScormLibraries() {
      return [...SCORM_LIBRARIES];
    }
    /**
     * Get all files needed for export (base + detected)
     * @param html - HTML content to scan
     * @param options - Options
     * @returns Array of file paths
     */
    getAllRequiredFiles(html, options = {}) {
      return this.getAllRequiredFilesWithPatterns(html, options).files;
    }
    /**
     * Get all files needed for export with pattern information
     * @param html - HTML content to scan
     * @param options - Options
     * @returns Object with files and patterns for directory-based libraries
     */
    getAllRequiredFilesWithPatterns(html, options = {}) {
      const detected = this.detectLibraries(html, options);
      const files = new Set(this.getBaseLibraries());
      for (const file of detected.files) {
        files.add(file);
      }
      if (options.includeScorm) {
        for (const file of this.getScormLibraries()) {
          files.add(file);
        }
      }
      return {
        files: Array.from(files),
        patterns: detected.patterns
      };
    }
    /**
     * Group files by type for HTML head generation
     * @param files - Array of file paths
     * @returns Object with js and css arrays
     */
    groupFilesByType(files) {
      const js = [];
      const css = [];
      for (const file of files) {
        const ext = file.split(".").pop()?.toLowerCase();
        if (ext === "js") {
          js.push(file);
        } else if (ext === "css") {
          css.push(file);
        }
      }
      return { js, css };
    }
    /**
     * Escape special regex characters in a string
     * @param str - String to escape
     * @returns Escaped string
     */
    _escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };

  // src/shared/export/exporters/BaseExporter.ts
  var BaseExporter = class {
    constructor(document2, resources, assets, zip2) {
      // Cache for asset filename lookups
      this.assetFilenameMap = null;
      // Cache for asset export path lookups (folderPath-based)
      this.assetExportPathMap = null;
      this.document = document2;
      this.resources = resources;
      this.assets = assets;
      this.zip = zip2;
      this.ideviceRenderer = new IdeviceRenderer();
      this.pageRenderer = new PageRenderer(this.ideviceRenderer);
      this.libraryDetector = new LibraryDetector();
    }
    // =========================================================================
    // Structure Access Methods
    // =========================================================================
    /**
     * Get project metadata
     */
    getMetadata() {
      return this.document.getMetadata();
    }
    /**
     * Get navigation structure (pages)
     */
    getNavigation() {
      return this.document.getNavigation();
    }
    /**
     * Build a flat list of pages from the navigation structure
     */
    buildPageList() {
      return this.getNavigation();
    }
    /**
     * Get list of unique iDevice types used in the project
     */
    getUsedIdevices(pages) {
      const types = /* @__PURE__ */ new Set();
      for (const page of pages) {
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            if (component.type) {
              types.add(component.type);
            }
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get list of iDevice types used in a specific page
     */
    getUsedIdevicesForPage(page) {
      const types = /* @__PURE__ */ new Set();
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.type) {
            types.add(component.type);
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get root pages (pages without parent)
     */
    getRootPages(pages) {
      return pages.filter((p) => !p.parentId);
    }
    /**
     * Get child pages of a given page
     */
    getChildPages(parentId, pages) {
      return pages.filter((p) => p.parentId === parentId);
    }
    // =========================================================================
    // String Utilities
    // =========================================================================
    /**
     * Escape XML special characters
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    }
    /**
     * Escape content for use in CDATA sections
     * CDATA cannot contain the sequence ]]> as it closes the CDATA block.
     * We split it into multiple CDATA sections when this sequence appears.
     */
    escapeCdata(str) {
      if (!str) return "";
      return String(str).replace(/\]\]>/g, "]]]]><![CDATA[>");
    }
    /**
     * Escape HTML special characters
     */
    escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Sanitize string for use as filename (with accent normalization)
     */
    sanitizeFilename(str, maxLength = 50) {
      if (!str) return "export";
      return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, maxLength);
    }
    /**
     * Sanitize page title for use as filename (with accent normalization)
     */
    sanitizePageFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
    /**
     * Generate unique identifier with optional prefix
     */
    generateId(prefix = "") {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      return `${prefix}${timestamp}${random}`.toUpperCase();
    }
    // =========================================================================
    // File Handling
    // =========================================================================
    /**
     * Build export filename from metadata
     */
    buildFilename() {
      const meta = this.getMetadata();
      const title = meta.title || "export";
      const sanitized = this.sanitizeFilename(title);
      return `${sanitized}${this.getFileSuffix()}${this.getFileExtension()}`;
    }
    /**
     * Add assets to ZIP
     */
    async addAssetsToZip(prefix = "") {
      let assetsAdded = 0;
      try {
        const assets = await this.assets.getAllAssets();
        for (const asset of assets) {
          const assetId = asset.id;
          const filename = asset.filename || `asset-${assetId}`;
          const assetPath = asset.originalPath || `${assetId}/${filename}`;
          const zipPath = prefix ? `${prefix}${assetPath}` : assetPath;
          this.zip.addFile(zipPath, asset.data);
          assetsAdded++;
        }
      } catch (e) {
        console.warn("[BaseExporter] Failed to add assets to ZIP:", e);
      }
      return assetsAdded;
    }
    /**
     * Add assets to ZIP with content/resources/ prefix
     * Uses folderPath-based structure for cleaner exports
     * @param trackingList - Optional array to track added file paths (for ELPX manifest)
     */
    async addAssetsToZipWithResourcePath(trackingList) {
      let assetsAdded = 0;
      try {
        const assets = await this.assets.getAllAssets();
        const exportPathMap = await this.buildAssetExportPathMap();
        console.log(`[BaseExporter] addAssetsToZipWithResourcePath: Found ${assets.length} assets to add`);
        for (const asset of assets) {
          const exportPath = exportPathMap.get(asset.id);
          if (!exportPath) {
            console.warn(`[BaseExporter] No export path for asset: ${asset.id}`);
            continue;
          }
          console.log(`[BaseExporter] Adding asset: ${asset.id} -> content/resources/${exportPath}`);
          const zipPath = `content/resources/${exportPath}`;
          this.zip.addFile(zipPath, asset.data);
          if (trackingList) trackingList.push(zipPath);
          assetsAdded++;
        }
      } catch (e) {
        console.warn("[BaseExporter] Failed to add assets to ZIP:", e);
      }
      return assetsAdded;
    }
    // =========================================================================
    // Navigation Helpers
    // =========================================================================
    /**
     * Check if a page is an ancestor of another page
     */
    isAncestorOf(potentialAncestor, childId, allPages) {
      const child = allPages.find((p) => p.id === childId);
      if (!child || !child.parentId) return false;
      if (child.parentId === potentialAncestor.id) return true;
      return this.isAncestorOf(potentialAncestor, child.parentId, allPages);
    }
    /**
     * Get page link (index.html for first page, id.html for others)
     */
    getPageLink(page, allPages, extension = ".html") {
      if (page.id === allPages[0]?.id) {
        return `index${extension}`;
      }
      return `${page.id}${extension}`;
    }
    /**
     * Get previous page in flat list
     */
    getPreviousPage(currentPage, allPages) {
      const currentIndex = allPages.findIndex((p) => p.id === currentPage.id);
      return currentIndex > 0 ? allPages[currentIndex - 1] : null;
    }
    /**
     * Get next page in flat list
     */
    getNextPage(currentPage, allPages) {
      const currentIndex = allPages.findIndex((p) => p.id === currentPage.id);
      return currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
    }
    // =========================================================================
    // Asset URL Transformation
    // =========================================================================
    /**
     * Get file extension from MIME type
     */
    getExtensionFromMime(mime) {
      const mimeToExt = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "image/bmp": ".bmp",
        "image/tiff": ".tiff",
        "image/x-icon": ".ico",
        "application/pdf": ".pdf",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/ogg": ".ogv",
        "video/quicktime": ".mov",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/webm": ".weba",
        "application/zip": ".zip",
        "application/json": ".json",
        "text/plain": ".txt",
        "text/html": ".html",
        "text/css": ".css",
        "application/javascript": ".js",
        "application/octet-stream": ".bin"
      };
      return mimeToExt[mime] || ".bin";
    }
    /**
     * Build asset filename map for URL transformation
     */
    async buildAssetFilenameMap() {
      if (this.assetFilenameMap) {
        return this.assetFilenameMap;
      }
      this.assetFilenameMap = /* @__PURE__ */ new Map();
      try {
        const assets = await this.assets.getAllAssets();
        for (const asset of assets) {
          const id = asset.id;
          let filename = asset.filename;
          if (!filename) {
            const ext = this.getExtensionFromMime(asset.mimeType || "application/octet-stream");
            filename = `asset-${id.substring(0, 8)}${ext}`;
          }
          this.assetFilenameMap.set(id, filename);
        }
      } catch (e) {
        console.warn("[BaseExporter] Failed to build asset map:", e);
      }
      return this.assetFilenameMap;
    }
    /**
     * Build asset export path map for URL transformation
     * Uses folderPath instead of UUID for cleaner export structure
     * Handles filename collisions by appending counter
     *
     * @returns Map of asset UUID to export path (e.g., "images/photo.jpg" or "photo.jpg" for root)
     */
    async buildAssetExportPathMap() {
      if (this.assetExportPathMap) {
        return this.assetExportPathMap;
      }
      this.assetExportPathMap = /* @__PURE__ */ new Map();
      const usedPaths = /* @__PURE__ */ new Set();
      try {
        const assets = await this.assets.getAllAssets();
        for (const asset of assets) {
          const folderPath = asset.folderPath || "";
          const filename = asset.filename || `asset-${asset.id.substring(0, 8)}`;
          const basePath = folderPath ? `${folderPath}/${filename}` : filename;
          let finalPath = basePath;
          let counter = 1;
          while (usedPaths.has(finalPath.toLowerCase())) {
            const ext = filename.includes(".") ? "." + filename.split(".").pop() : "";
            const nameWithoutExt = ext ? filename.slice(0, -ext.length) : filename;
            finalPath = folderPath ? `${folderPath}/${nameWithoutExt}_${counter}${ext}` : `${nameWithoutExt}_${counter}${ext}`;
            counter++;
          }
          usedPaths.add(finalPath.toLowerCase());
          this.assetExportPathMap.set(asset.id, finalPath);
        }
      } catch (e) {
        console.warn("[BaseExporter] Failed to build asset export path map:", e);
      }
      return this.assetExportPathMap;
    }
    /**
     * Add export paths to asset:// URLs without changing the protocol
     * Transforms asset://uuid or asset://uuid.ext to asset://uuid/exportPath
     * Uses folderPath-based export paths for cleaner structure
     *
     * Supported input formats:
     * - asset://uuid (simple UUID)
     * - asset://uuid.ext (new format with extension)
     * - asset://uuid/oldPath (legacy format with old path, which gets replaced)
     */
    async addFilenamesToAssetUrls(content) {
      if (!content) return "";
      const assetMap = await this.buildAssetExportPathMap();
      if (assetMap.size === 0) {
        return content;
      }
      return content.replace(/asset:\/\/([a-f0-9-]+)(?:\.[a-z0-9]+|\/[^"'\s)]+)?/gi, (match, uuid) => {
        const exportPath = assetMap.get(uuid);
        if (exportPath) {
          return `asset://${uuid}/${exportPath}`;
        }
        return match;
      });
    }
    /**
     * Pre-process pages to add filenames to asset URLs in all component content
     * And converts internal links (exe-node:) to proper page URLs
     *
     * Note: exe-package:elp protocol transformation is now done in PageRenderer.renderPageContent()
     * so the XML content keeps the original protocol for re-import compatibility
     */
    async preprocessPagesForExport(pages) {
      const clonedPages = JSON.parse(JSON.stringify(pages));
      const pageUrlMap = this.buildPageUrlMap(clonedPages);
      for (let pageIndex = 0; pageIndex < clonedPages.length; pageIndex++) {
        const page = clonedPages[pageIndex];
        const isIndex = pageIndex === 0;
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            if (component.content) {
              component.content = await this.addFilenamesToAssetUrls(component.content);
              component.content = this.replaceInternalLinks(component.content, pageUrlMap, isIndex);
            }
          }
        }
      }
      return clonedPages;
    }
    /**
     * Build a map of page IDs to their export URLs
     * Used for internal link (exe-node:) conversion
     */
    buildPageUrlMap(pages) {
      const map = /* @__PURE__ */ new Map();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const isFirstPage = i === 0;
        if (isFirstPage) {
          map.set(page.id, {
            url: "index.html",
            urlFromSubpage: "../index.html"
          });
        } else {
          const filename = this.sanitizePageFilename(page.title);
          map.set(page.id, {
            url: `html/${filename}.html`,
            urlFromSubpage: `${filename}.html`
          });
        }
      }
      return map;
    }
    /**
     * Replace exe-node: internal links with proper page URLs
     *
     * @param content - HTML content
     * @param pageUrlMap - Map of page IDs to their export URLs
     * @param isFromIndex - Whether the content is from the index page (affects relative paths)
     * @returns Content with internal links replaced
     */
    replaceInternalLinks(content, pageUrlMap, isFromIndex) {
      if (!content || !content.includes("exe-node:")) {
        return content;
      }
      return content.replace(/href=["']exe-node:([^"']+)["']/gi, (match, pageId) => {
        const pageUrls = pageUrlMap.get(pageId);
        if (pageUrls) {
          const url = isFromIndex ? pageUrls.url : pageUrls.urlFromSubpage;
          return `href="${url}"`;
        }
        console.warn(`[BaseExporter] Internal link target not found: ${pageId}`);
        return match;
      });
    }
    /**
     * Replace exe-package:elp protocol with client-side download handler
     * This enables the download-source-file iDevice to generate ELPX files on-the-fly
     *
     * @param content - HTML content
     * @param projectTitle - Project title for the download filename
     * @returns Content with exe-package:elp replaced with onclick handler
     */
    replaceElpxProtocol(content, projectTitle) {
      if (!content) return "";
      if (!content.includes("exe-package:elp")) {
        return content;
      }
      let result = content.replace(
        /href="exe-package:elp"/g,
        `href="#" onclick="if(typeof downloadElpx==='function')downloadElpx();return false;"`
      );
      const safeTitle = this.escapeXml(projectTitle);
      result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);
      return result;
    }
    /**
     * Collect all HTML content from all pages (for library detection)
     */
    collectAllHtmlContent(pages) {
      const htmlParts = [];
      for (const page of pages) {
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            if (component.content) {
              htmlParts.push(component.content);
            }
          }
        }
      }
      return htmlParts.join("\n");
    }
    // =========================================================================
    // Download Source File iDevice Detection
    // =========================================================================
    /**
     * Check if any page contains the download-source-file iDevice
     * (needs ELPX manifest for client-side ZIP recreation)
     */
    needsElpxDownloadSupport(pages) {
      return pages.some((page) => this.pageHasDownloadSourceFile(page));
    }
    /**
     * Check if a specific page contains the download-source-file iDevice
     * or a manual link using exe-package:elp protocol
     */
    pageHasDownloadSourceFile(page) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          const type = (component.type || "").toLowerCase();
          if (type.includes("download-source-file") || type.includes("downloadsourcefile")) {
            return true;
          }
          if (component.content?.includes("exe-download-package-link")) {
            return true;
          }
          if (component.content?.includes("exe-package:elp")) {
            return true;
          }
        }
      }
      return false;
    }
    // =========================================================================
    // ELPX Manifest Generation (for download-source-file iDevice)
    // =========================================================================
    /**
     * Generate ELPX manifest as a standalone JS file
     * Used for HTML5 exports where the manifest is a separate file
     *
     * @param fileList - List of file paths in the export
     * @returns JavaScript file content
     */
    generateElpxManifestFile(fileList) {
      const manifest = {
        version: 1,
        files: fileList,
        projectTitle: this.getMetadata().title || "eXeLearning-project"
      };
      return `/**
 * ELPX Manifest - Auto-generated for download-source-file iDevice
 * Used by exe_elpx_download.js to recreate the complete export package
 */
window.__ELPX_MANIFEST__=${JSON.stringify(manifest, null, 2)};
`;
    }
    // =========================================================================
    // Content XML Generation (for re-import capability)
    // =========================================================================
    /**
     * Generate content.xml from document structure
     */
    generateContentXml() {
      const metadata = this.getMetadata();
      const pages = this.getNavigation();
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
      xml += this.generatePropertiesXml(metadata);
      xml += "<odeNavStructures>\n";
      for (let i = 0; i < pages.length; i++) {
        xml += this.generatePageXml(pages[i], i);
      }
      xml += "</odeNavStructures>\n";
      xml += "</ode>";
      return xml;
    }
    /**
     * Generate properties XML section
     */
    generatePropertiesXml(metadata) {
      let xml = "<odeProperties>\n";
      const props = {
        pp_title: metadata.title || "Untitled",
        pp_subtitle: metadata.subtitle || "",
        pp_author: metadata.author || "",
        pp_lang: metadata.language || "en",
        pp_description: metadata.description || "",
        pp_license: metadata.license || "",
        pp_theme: metadata.theme || "base",
        // Export options
        pp_addExeLink: String(metadata.addExeLink ?? true),
        pp_addPagination: String(metadata.addPagination ?? false),
        pp_addSearchBox: String(metadata.addSearchBox ?? false),
        pp_addAccessibilityToolbar: String(metadata.addAccessibilityToolbar ?? false),
        pp_addMathJax: String(metadata.addMathJax ?? false),
        exportSource: String(metadata.exportSource ?? true)
      };
      if (metadata.extraHeadContent) {
        props["pp_extraHeadContent"] = metadata.extraHeadContent;
      }
      if (metadata.footer) {
        props["footer"] = metadata.footer;
      }
      for (const [key, value] of Object.entries(props)) {
        xml += `  <${key}>${this.escapeXml(value)}</${key}>
`;
      }
      xml += "</odeProperties>\n";
      return xml;
    }
    /**
     * Generate page XML
     */
    generatePageXml(page, index) {
      const pageId = page.id;
      const pageName = page.title || "Page";
      const parentId = page.parentId || "";
      const order = page.order ?? index;
      let xml = `<odeNavStructure odeNavStructureId="${this.escapeXml(pageId)}" `;
      xml += `odePageName="${this.escapeXml(pageName)}" odeNavStructureOrder="${order}" `;
      if (parentId) {
        xml += `parentOdeNavStructureId="${this.escapeXml(parentId)}" `;
      }
      xml += `>
`;
      for (let i = 0; i < (page.blocks || []).length; i++) {
        xml += this.generateBlockXml(page.blocks[i], i);
      }
      xml += "</odeNavStructure>\n";
      return xml;
    }
    /**
     * Generate block XML
     */
    generateBlockXml(block, index) {
      const blockId = block.id;
      const blockName = block.name || "";
      const order = block.order ?? index;
      let xml = `  <odePagStructure odePagStructureId="${this.escapeXml(blockId)}" `;
      xml += `blockName="${this.escapeXml(blockName)}" odePagStructureOrder="${order}">
`;
      for (let i = 0; i < (block.components || []).length; i++) {
        xml += this.generateComponentXml(block.components[i], i);
      }
      xml += "  </odePagStructure>\n";
      return xml;
    }
    /**
     * Generate component XML
     */
    generateComponentXml(component, index) {
      const compId = component.id;
      const ideviceType = component.type || "FreeTextIdevice";
      const order = component.order ?? index;
      let xml = `    <odeComponent odeComponentId="${this.escapeXml(compId)}" `;
      xml += `odeIdeviceTypeDirName="${this.escapeXml(ideviceType)}" odeComponentOrder="${order}">
`;
      if (component.content) {
        xml += `      <htmlView><![CDATA[${this.escapeCdata(component.content)}]]></htmlView>
`;
      }
      if (component.properties && Object.keys(component.properties).length > 0) {
        xml += `      <jsonProperties><![CDATA[${this.escapeCdata(JSON.stringify(component.properties))}]]></jsonProperties>
`;
      }
      xml += "    </odeComponent>\n";
      return xml;
    }
    // =========================================================================
    // Fallback Styles (used when resources can't be fetched)
    // =========================================================================
    /**
     * Get fallback theme CSS
     */
    getFallbackThemeCss() {
      return `/* Default theme CSS */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}
`;
    }
    /**
     * Get fallback theme JS
     */
    getFallbackThemeJs() {
      return `// Default theme JS
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Theme initialization
    console.log('[Theme] Default theme loaded');
  });
})();
`;
    }
  };

  // src/shared/export/exporters/Html5Exporter.ts
  var Html5Exporter = class extends BaseExporter {
    /**
     * Get file extension for HTML5 format
     */
    getFileExtension() {
      return ".zip";
    }
    /**
     * Get file suffix for HTML5 format
     */
    getFileSuffix() {
      return "_web";
    }
    /**
     * Export to HTML5 ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      const html5Options = options;
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = html5Options?.theme || meta.theme || "base";
        const needsElpxDownload = this.needsElpxDownloadSupport(pages);
        pages = await this.preprocessPagesForExport(pages);
        const fileList = needsElpxDownload ? [] : null;
        const addFile = (path, content) => {
          this.zip.addFile(path, content);
          if (fileList) fileList.push(path);
        };
        const themeRootFiles = [];
        let themeFilesMap = null;
        try {
          themeFilesMap = await this.resources.fetchTheme(themeName);
          console.log(`[Html5Exporter] Theme '${themeName}' files count: ${themeFilesMap.size}`);
          for (const [filePath] of themeFilesMap) {
            if (!filePath.includes("/") && (filePath.endsWith(".css") || filePath.endsWith(".js"))) {
              themeRootFiles.push(filePath);
            }
          }
        } catch (e) {
          console.warn(`[Html5Exporter] Failed to pre-fetch theme: ${themeName}`, e);
          themeRootFiles.push("style.css", "style.js");
        }
        const pageHtmlMap = /* @__PURE__ */ new Map();
        let latexWasRendered = false;
        let mermaidWasRendered = false;
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          let html = this.generatePageHtml(page, pages, meta, i === 0, i, themeRootFiles);
          if (!meta.addMathJax) {
            if (options?.preRenderDataGameLatex) {
              try {
                const result = await options.preRenderDataGameLatex(html);
                if (result.count > 0) {
                  html = result.html;
                  latexWasRendered = true;
                  console.log(
                    `[Html5Exporter] Pre-rendered LaTeX in ${result.count} DataGame(s) on page: ${page.title}`
                  );
                }
              } catch (error) {
                console.warn(
                  "[Html5Exporter] DataGame LaTeX pre-render failed for page:",
                  page.title,
                  error
                );
              }
            }
            if (options?.preRenderLatex) {
              try {
                const result = await options.preRenderLatex(html);
                if (result.latexRendered) {
                  html = result.html;
                  latexWasRendered = true;
                  console.log(
                    `[Html5Exporter] Pre-rendered ${result.count} LaTeX expressions on page: ${page.title}`
                  );
                }
              } catch (error) {
                console.warn("[Html5Exporter] LaTeX pre-render failed for page:", page.title, error);
              }
            }
          }
          if (options?.preRenderMermaid) {
            try {
              const result = await options.preRenderMermaid(html);
              if (result.mermaidRendered) {
                html = result.html;
                mermaidWasRendered = true;
                console.log(
                  `[Html5Exporter] Pre-rendered ${result.count} Mermaid diagram(s) on page: ${page.title}`
                );
              }
            } catch (error) {
              console.warn("[Html5Exporter] Mermaid pre-render failed for page:", page.title, error);
            }
          }
          const pageFilename = i === 0 ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          pageHtmlMap.set(pageFilename, html);
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          addFile("search_index.js", searchIndexContent);
        }
        if (meta.exportSource !== false) {
          const contentXml = this.generateContentXml();
          addFile("content.xml", contentXml);
          addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);
        }
        const contentCssFiles = await this.resources.fetchContentCss();
        let baseCss = contentCssFiles.get("content/css/base.css");
        if (!baseCss) {
          throw new Error("Failed to fetch content/css/base.css");
        }
        if (latexWasRendered || mermaidWasRendered) {
          const decoder = new TextDecoder();
          let baseCssText = decoder.decode(baseCss);
          if (latexWasRendered) {
            baseCssText += "\n" + this.getPreRenderedLatexCss();
          }
          if (mermaidWasRendered) {
            baseCssText += "\n" + this.getPreRenderedMermaidCss();
          }
          const encoder = new TextEncoder();
          baseCss = encoder.encode(baseCssText);
        }
        addFile("content/css/base.css", baseCss);
        try {
          const logoData = await this.resources.fetchExeLogo();
          if (logoData) {
            addFile("content/img/exe_powered_logo.png", logoData);
          }
        } catch {
        }
        if (themeFilesMap) {
          for (const [filePath, content] of themeFilesMap) {
            console.log(`[Html5Exporter] Adding theme file: theme/${filePath}`);
            addFile(`theme/${filePath}`, content);
          }
        } else {
          addFile("theme/style.css", this.getFallbackThemeCss());
          addFile("theme/style.js", this.getFallbackThemeJs());
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [libPath, content] of baseLibs) {
            addFile(`libs/${libPath}`, content);
          }
        } catch {
        }
        const allHtmlContent = this.collectAllHtmlContent(pages);
        const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
          allHtmlContent,
          {
            includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
            includeMathJax: meta.addMathJax === true,
            skipMathJax: latexWasRendered && !meta.addMathJax,
            // Don't skip if explicitly requested
            skipMermaid: mermaidWasRendered
          }
        );
        if (latexWasRendered) {
          console.log("[Html5Exporter] LaTeX pre-rendered - skipping MathJax library (~1MB saved)");
        }
        if (mermaidWasRendered) {
          console.log("[Html5Exporter] Mermaid pre-rendered - skipping Mermaid library (~2.7MB saved)");
        }
        try {
          const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
          for (const [libPath, content] of libFiles) {
            const zipPath = `libs/${libPath}`;
            if (!this.zip.hasFile(zipPath)) {
              addFile(zipPath, content);
            }
          }
        } catch {
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const normalizedType = this.resources.normalizeIdeviceType(idevice);
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [filePath, content] of ideviceFiles) {
              addFile(`idevices/${normalizedType}/${filePath}`, content);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath(fileList);
        if (needsElpxDownload && fileList) {
          for (const [htmlFile] of pageHtmlMap) {
            if (!fileList.includes(htmlFile)) {
              fileList.push(htmlFile);
            }
          }
          const manifestJs = this.generateElpxManifestFile(fileList);
          addFile("libs/elpx-manifest.js", manifestJs);
        }
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const filename = i === 0 ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          let html = pageHtmlMap.get(filename) || "";
          if (needsElpxDownload && this.pageHasDownloadSourceFile(page)) {
            const basePath = i === 0 ? "" : "../";
            const manifestScriptTag = `<script src="${basePath}libs/elpx-manifest.js"> <\/script>`;
            html = html.replace(/<\/body>/i, `${manifestScriptTag}
</body>`);
          }
          this.zip.addFile(filename, html);
        }
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate complete HTML for a page
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param pageIndex - Page index for page counter
     * @param themeFiles - List of root-level theme CSS/JS files
     */
    generatePageHtml(page, allPages, meta, isIndex, pageIndex, themeFiles) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      const currentPageIndex = pageIndex ?? allPages.findIndex((p) => p.id === page.id);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        projectSubtitle: meta.subtitle || "",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "creative commons: attribution - share alike 4.0",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Page counter options
        totalPages: allPages.length,
        currentPageIndex,
        userFooterContent: meta.footer,
        // Export options
        addExeLink: meta.addExeLink ?? true,
        addPagination: meta.addPagination ?? false,
        addSearchBox: meta.addSearchBox ?? false,
        addAccessibilityToolbar: meta.addAccessibilityToolbar ?? false,
        // Custom head content
        extraHeadContent: meta.extraHeadContent,
        // Theme files for HTML head includes
        themeFiles: themeFiles || []
      });
    }
    /**
     * Get page link for HTML5 export
     */
    getPageLinkForHtml5(page, allPages, basePath) {
      const isFirstPage = page.id === allPages[0]?.id;
      if (isFirstPage) {
        return basePath ? `${basePath}index.html` : "index.html";
      }
      const filename = this.sanitizePageFilename(page.title);
      return `${basePath}html/${filename}.html`;
    }
    /**
     * Get CSS for pre-rendered LaTeX (SVG+MathML)
     * This CSS is needed when LaTeX is pre-rendered instead of using MathJax at runtime
     */
    getPreRenderedLatexCss() {
      return `/* Pre-rendered LaTeX (SVG+MathML) - MathJax not included */
.exe-math-rendered { display: inline-block; vertical-align: middle; }
.exe-math-rendered[data-display="block"] { display: block; text-align: center; margin: 1em 0; }
.exe-math-rendered svg { vertical-align: middle; max-width: 100%; height: auto; }
/* Fix for MathJax array/table borders - SVG has stroke-width:0 which hides lines */
.exe-math-rendered svg line.mjx-solid { stroke-width: 60 !important; }
.exe-math-rendered svg rect[data-frame="true"] { fill: none; stroke-width: 60 !important; }
/* Hide MathML visually but keep accessible for screen readers */
.exe-math-rendered math { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }`;
    }
    /**
     * Get CSS for pre-rendered Mermaid diagrams (static SVG)
     * This CSS is needed when Mermaid is pre-rendered instead of using the library at runtime
     */
    getPreRenderedMermaidCss() {
      return `/* Pre-rendered Mermaid (static SVG) - Mermaid library not included */
.exe-mermaid-rendered { display: block; text-align: center; margin: 1.5em 0; }
.exe-mermaid-rendered svg { max-width: 100%; height: auto; }`;
    }
  };

  // src/shared/export/exporters/PageExporter.ts
  var PageExporter = class extends Html5Exporter {
    /**
     * Get file suffix for PAGE format
     */
    getFileSuffix() {
      return "_page";
    }
    /**
     * Export to single-page HTML ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        pages = await this.preprocessPagesForExport(pages);
        const usedIdevices = this.getUsedIdevices(pages);
        const html = this.generateSinglePageHtml(pages, meta, usedIdevices);
        this.zip.addFile("index.html", html);
        const contentCssFiles = await this.resources.fetchContentCss();
        const baseCss = contentCssFiles.get("content/css/base.css");
        if (!baseCss) {
          throw new Error("Failed to fetch content/css/base.css");
        }
        this.zip.addFile("content/css/base.css", baseCss);
        this.zip.addFile("content/css/single-page.css", this.getSinglePageCss());
        try {
          const themeFiles = await this.resources.fetchTheme(themeName);
          for (const [path, content] of themeFiles) {
            this.zip.addFile(`theme/${path}`, content);
          }
        } catch {
          this.zip.addFile("theme/style.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/style.js", this.getFallbackThemeJs());
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
          }
        } catch {
        }
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate single-page HTML with all pages
     */
    generateSinglePageHtml(pages, meta, usedIdevices) {
      return this.pageRenderer.renderSinglePage(pages, {
        projectTitle: meta.title || "eXeLearning",
        projectSubtitle: meta.subtitle || "",
        language: meta.language || "en",
        customStyles: meta.customStyles || "",
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA"
      });
    }
    /**
     * Override page URL map for single-page export
     * Uses anchor fragments instead of file paths
     */
    buildPageUrlMap(pages) {
      const map = /* @__PURE__ */ new Map();
      for (const page of pages) {
        const anchor = `#section-${page.id}`;
        map.set(page.id, {
          url: anchor,
          urlFromSubpage: anchor
          // Same since it's all one page
        });
      }
      return map;
    }
    /**
     * Get CSS specific to single-page layout
     */
    getSinglePageCss() {
      return `/* Single-page specific styles */
.exe-single-page .single-page-section {
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 40px;
  margin-bottom: 40px;
}

.exe-single-page .single-page-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.exe-single-page .single-page-nav {
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
}

.exe-single-page .single-page-content {
  padding: 20px 30px;
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Section target offset for fixed header */
.single-page-section:target {
  scroll-margin-top: 20px;
}

/* Print styles for single page */
@media print {
  .exe-single-page .single-page-nav {
    display: none;
  }
  .exe-single-page .single-page-section {
    page-break-inside: avoid;
  }
}
`;
    }
  };

  // src/shared/export/generators/Scorm12Manifest.ts
  var Scorm12ManifestGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param pages - Pages from navigation structure
     * @param metadata - Project metadata
     */
    constructor(projectId, pages, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.pages = pages || [];
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imsmanifest.xml content
     * @param options - Generation options
     * @returns Complete XML string
     */
    generate(options = {}) {
      const { commonFiles = [], pageFiles = {} } = options;
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateManifestOpen();
      xml += this.generateMetadata();
      xml += this.generateOrganizations();
      xml += this.generateResources(commonFiles, pageFiles);
      xml += "</manifest>\n";
      return xml;
    }
    /**
     * Generate manifest opening tag with namespaces
     * @returns Manifest opening XML
     */
    generateManifestOpen() {
      return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_12_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_12_NAMESPACES.adlcp}"
  xmlns:imsmd="${SCORM_12_NAMESPACES.imsmd}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCORM_12_NAMESPACES.imscp} imscp_rootv1p1p2.xsd
    ${SCORM_12_NAMESPACES.imsmd} imsmd_v1p2p2.xsd
    ${SCORM_12_NAMESPACES.adlcp} adlcp_rootv1p2.xsd">
`;
    }
    /**
     * Generate metadata section
     * @returns Metadata XML
     */
    generateMetadata() {
      let xml = "  <metadata>\n";
      xml += "    <schema>ADL SCORM</schema>\n";
      xml += "    <schemaversion>1.2</schemaversion>\n";
      xml += "    <adlcp:location>imslrm.xml</adlcp:location>\n";
      xml += "  </metadata>\n";
      return xml;
    }
    /**
     * Generate organizations section with hierarchical structure
     * @returns Organizations XML
     */
    generateOrganizations() {
      const orgId = `eXe-${this.projectId}`;
      const title = this.metadata.title || "eXeLearning";
      let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
      xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
      xml += `      <title>${this.escapeXml(title)}</title>
`;
      xml += this.generateItems();
      xml += "    </organization>\n";
      xml += "  </organizations>\n";
      return xml;
    }
    /**
     * Generate item elements for pages in hierarchical structure
     * @returns Items XML
     */
    generateItems() {
      const pageMap = /* @__PURE__ */ new Map();
      for (const page of this.pages) {
        pageMap.set(page.id, page);
      }
      const rootPages = this.pages.filter((p) => !p.parentId);
      let xml = "";
      for (const page of rootPages) {
        xml += this.generateItemRecursive(page, pageMap, 3);
      }
      return xml;
    }
    /**
     * Generate item element recursively for nested pages
     * @param page - Page object
     * @param pageMap - Map of all pages by ID
     * @param indent - Indentation level
     * @returns Item XML
     */
    generateItemRecursive(page, pageMap, indent) {
      const indentStr = "  ".repeat(indent);
      const isVisible = "true";
      let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
      xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
      const children = this.pages.filter((p) => p.parentId === page.id);
      for (const child of children) {
        xml += this.generateItemRecursive(child, pageMap, indent + 1);
      }
      xml += `${indentStr}</item>
`;
      return xml;
    }
    /**
     * Generate resources section
     * @param commonFiles - List of common file paths
     * @param pageFiles - Map of pageId to file info
     * @returns Resources XML
     */
    generateResources(commonFiles, pageFiles) {
      let xml = "  <resources>\n";
      for (const page of this.pages) {
        const pageFile = pageFiles[page.id] || {};
        xml += this.generatePageResource(page, pageFile);
      }
      xml += this.generateCommonFilesResource(commonFiles);
      xml += "  </resources>\n";
      return xml;
    }
    /**
     * Generate resource element for a page
     * @param page - Page object
     * @param pageFile - Page file info
     * @returns Resource XML
     */
    generatePageResource(page, pageFile) {
      const pageId = page.id;
      const isIndex = this.pages.indexOf(page) === 0;
      const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
      let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormtype="sco" href="${this.escapeXml(fileUrl)}">
`;
      xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
      const files = pageFile.files || [];
      for (const file of files) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += '      <dependency identifierref="COMMON_FILES"/>\n';
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Generate COMMON_FILES resource for shared assets
     * @param commonFiles - List of common file paths
     * @returns Resource XML
     */
    generateCommonFilesResource(commonFiles) {
      let xml = '    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormtype="asset">\n';
      for (const file of commonFiles) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    /**
     * Sanitize filename for use in paths
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
  };

  // src/shared/export/generators/LomMetadata.ts
  var TRANSLATIONS = {
    "Metadata creation date": {
      en: "Metadata creation date",
      es: "Fecha de creaci\xF3n de los metadatos",
      fr: "Date de cr\xE9ation des m\xE9tadonn\xE9es",
      de: "Erstellungsdatum der Metadaten",
      pt: "Data de cria\xE7\xE3o dos metadados",
      ca: "Data de creaci\xF3 de les metadades",
      eu: "Metadatuen sorrera data",
      gl: "Data de creaci\xF3n dos metadatos"
    }
  };
  var LomMetadataGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param metadata - Project metadata
     */
    constructor(projectId, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imslrm.xml content
     * @returns Complete XML string
     */
    generate() {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateLomOpen();
      xml += this.generateGeneral();
      xml += this.generateLifeCycle();
      xml += this.generateMetaMetadata();
      xml += this.generateTechnical();
      xml += this.generateEducational();
      xml += this.generateRights();
      xml += "</lom>\n";
      return xml;
    }
    /**
     * Generate lom opening tag with namespaces
     * @returns LOM opening XML
     */
    generateLomOpen() {
      return `<lom xmlns="${LOM_NAMESPACES.lom}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${LOM_NAMESPACES.lom} lomCustom.xsd">
`;
    }
    /**
     * Generate general section
     * @returns General XML
     */
    generateGeneral() {
      const title = this.metadata.title || "eXe-p-" + this.projectId;
      const lang = this.metadata.language || "en";
      const description = this.metadata.description || "";
      const catalogName = this.metadata.catalogName || "none";
      const catalogEntry = this.metadata.catalogEntry || "ODE-" + this.projectId;
      let xml = '  <general uniqueElementName="general">\n';
      xml += "    <identifier>\n";
      xml += `      <catalog uniqueElementName="catalog">${this.escapeXml(catalogName)}</catalog>
`;
      xml += `      <entry uniqueElementName="entry">${this.escapeXml(catalogEntry)}</entry>
`;
      xml += "    </identifier>\n";
      xml += "    <title>\n";
      xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(title)}</string>
`;
      xml += "    </title>\n";
      xml += `    <language>${this.escapeXml(lang)}</language>
`;
      xml += "    <description>\n";
      xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(description)}</string>
`;
      xml += "    </description>\n";
      xml += '    <aggregationLevel uniqueElementName="aggregationLevel">\n';
      xml += '      <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '      <value uniqueElementName="value">2</value>\n';
      xml += "    </aggregationLevel>\n";
      xml += "  </general>\n";
      return xml;
    }
    /**
     * Generate lifeCycle section
     * @returns LifeCycle XML
     */
    generateLifeCycle() {
      const author = this.metadata.author || "";
      const lang = this.metadata.language || "en";
      const dateTime = this.getCurrentDateTime();
      let xml = "  <lifeCycle>\n";
      xml += "    <contribute>\n";
      xml += '      <role uniqueElementName="role">\n';
      xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '        <value uniqueElementName="value">author</value>\n';
      xml += "      </role>\n";
      const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
      xml += `      <entity>${this.escapeXml(vcard)}</entity>
`;
      xml += "      <date>\n";
      xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>
`;
      xml += "        <description>\n";
      xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString("Metadata creation date", lang)}</string>
`;
      xml += "        </description>\n";
      xml += "      </date>\n";
      xml += "    </contribute>\n";
      xml += "  </lifeCycle>\n";
      return xml;
    }
    /**
     * Generate metaMetadata section
     * @returns MetaMetadata XML
     */
    generateMetaMetadata() {
      const author = this.metadata.author || "";
      const lang = this.metadata.language || "en";
      const dateTime = this.getCurrentDateTime();
      let xml = '  <metaMetadata uniqueElementName="metaMetadata">\n';
      xml += "    <contribute>\n";
      xml += '      <role uniqueElementName="role">\n';
      xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '        <value uniqueElementName="value">creator</value>\n';
      xml += "      </role>\n";
      const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
      xml += `      <entity>${this.escapeXml(vcard)}</entity>
`;
      xml += "      <date>\n";
      xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>
`;
      xml += "        <description>\n";
      xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString("Metadata creation date", lang)}</string>
`;
      xml += "        </description>\n";
      xml += "      </date>\n";
      xml += "    </contribute>\n";
      xml += "    <metadataSchema>LOM-ESv1.0</metadataSchema>\n";
      xml += `    <language>${this.escapeXml(lang)}</language>
`;
      xml += "  </metaMetadata>\n";
      return xml;
    }
    /**
     * Generate technical section
     * @returns Technical XML
     */
    generateTechnical() {
      const lang = this.metadata.language || "en";
      let xml = '  <technical uniqueElementName="technical">\n';
      xml += "    <otherPlatformRequirements>\n";
      xml += `      <string language="${this.escapeXml(lang)}">editor: eXe Learning</string>
`;
      xml += "    </otherPlatformRequirements>\n";
      xml += "  </technical>\n";
      return xml;
    }
    /**
     * Generate educational section
     * @returns Educational XML
     */
    generateEducational() {
      const lang = this.metadata.language || "en";
      let xml = "  <educational>\n";
      xml += `    <language>${this.escapeXml(lang)}</language>
`;
      xml += "  </educational>\n";
      return xml;
    }
    /**
     * Generate rights section
     * @returns Rights XML
     */
    generateRights() {
      const license = this.metadata.license || "";
      let xml = '  <rights uniqueElementName="rights">\n';
      xml += '    <copyrightAndOtherRestrictions uniqueElementName="copyrightAndOtherRestrictions">\n';
      xml += '      <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += `      <value uniqueElementName="value">${this.escapeXml(license)}</value>
`;
      xml += "    </copyrightAndOtherRestrictions>\n";
      xml += '    <access uniqueElementName="access">\n';
      xml += '      <accessType uniqueElementName="accessType">\n';
      xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '        <value uniqueElementName="value">universal</value>\n';
      xml += "      </accessType>\n";
      xml += "      <description>\n";
      xml += '        <string language="en">Default</string>\n';
      xml += "      </description>\n";
      xml += "    </access>\n";
      xml += "  </rights>\n";
      return xml;
    }
    /**
     * Get current date/time in ISO format with timezone
     * @returns ISO date time string
     */
    getCurrentDateTime() {
      const now = /* @__PURE__ */ new Date();
      const offset = now.getTimezoneOffset();
      const offsetHours = Math.abs(Math.floor(offset / 60)).toString().padStart(2, "0");
      const offsetMinutes = Math.abs(offset % 60).toString().padStart(2, "0");
      const offsetSign = offset <= 0 ? "+" : "-";
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const day = now.getDate().toString().padStart(2, "0");
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.00${offsetSign}${offsetHours}:${offsetMinutes}`;
    }
    /**
     * Get localized string (basic implementation)
     * @param key - Translation key
     * @param lang - Language code
     * @returns Localized string
     */
    getLocalizedString(key, lang) {
      const langShort = lang.substring(0, 2).toLowerCase();
      if (TRANSLATIONS[key]?.[langShort]) {
        return TRANSLATIONS[key][langShort];
      }
      return TRANSLATIONS[key]?.en || key;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
  };

  // src/shared/export/exporters/Scorm12Exporter.ts
  var Scorm12Exporter = class extends Html5Exporter {
    constructor() {
      super(...arguments);
      this.manifestGenerator = null;
      this.lomGenerator = null;
    }
    /**
     * Get file suffix for SCORM 1.2 format
     */
    getFileSuffix() {
      return "_scorm12";
    }
    /**
     * Export to SCORM 1.2 ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        const projectId = this.generateProjectId();
        pages = await this.preprocessPagesForExport(pages);
        this.manifestGenerator = new Scorm12ManifestGenerator(projectId, pages, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        this.lomGenerator = new LomMetadataGenerator(projectId, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        const commonFiles = [];
        const pageFiles = {};
        const themeRootFiles = [];
        let themeFilesMap = null;
        try {
          themeFilesMap = await this.resources.fetchTheme(themeName);
          for (const [filePath] of themeFilesMap) {
            if (!filePath.includes("/") && (filePath.endsWith(".css") || filePath.endsWith(".js"))) {
              themeRootFiles.push(filePath);
            }
          }
        } catch {
          themeRootFiles.push("style.css", "style.js");
        }
        let latexWasRendered = false;
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const isIndex = i === 0;
          let html = this.generateScormPageHtml(page, pages, meta, isIndex, themeRootFiles);
          if (!meta.addMathJax && options?.preRenderLatex) {
            try {
              const result = await options.preRenderLatex(html);
              if (result.latexRendered) {
                html = result.html;
                latexWasRendered = true;
                console.log(
                  `[Scorm12Exporter] Pre-rendered ${result.count} LaTeX expressions on page: ${page.title}`
                );
              }
            } catch (error) {
              console.warn("[Scorm12Exporter] LaTeX pre-render failed for page:", page.title, error);
            }
          }
          const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
          pageFiles[page.id] = {
            fileUrl: pageFilename,
            files: []
          };
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
          commonFiles.push("search_index.js");
        }
        const contentCssFiles = await this.resources.fetchContentCss();
        let baseCss = contentCssFiles.get("content/css/base.css");
        if (!baseCss) {
          throw new Error("Failed to fetch content/css/base.css");
        }
        if (latexWasRendered) {
          const latexCss = this.getPreRenderedLatexCss();
          const decoder = new TextDecoder();
          const baseCssText = decoder.decode(baseCss);
          const encoder = new TextEncoder();
          baseCss = encoder.encode(baseCssText + "\n" + latexCss);
        }
        this.zip.addFile("content/css/base.css", baseCss);
        commonFiles.push("content/css/base.css");
        if (themeFilesMap) {
          for (const [filePath, content] of themeFilesMap) {
            this.zip.addFile(`theme/${filePath}`, content);
            commonFiles.push(`theme/${filePath}`);
          }
        } else {
          this.zip.addFile("theme/style.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/style.js", this.getFallbackThemeJs());
          commonFiles.push("theme/style.css", "theme/style.js");
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
        }
        try {
          const scormFiles = await this.resources.fetchScormFiles("1.2");
          for (const [filePath, content] of scormFiles) {
            this.zip.addFile(`libs/${filePath}`, content);
            commonFiles.push(`libs/${filePath}`);
          }
        } catch {
          this.zip.addFile("libs/SCORM_API_wrapper.js", this.getScormApiWrapper());
          this.zip.addFile("libs/SCOFunctions.js", this.getScoFunctions());
          commonFiles.push("libs/SCORM_API_wrapper.js", "libs/SCOFunctions.js");
        }
        try {
          const schemaFiles = await this.resources.fetchScormSchemas("1.2");
          for (const [filePath, content] of schemaFiles) {
            this.zip.addFile(filePath, content);
            commonFiles.push(filePath);
          }
        } catch {
        }
        try {
          const contentXml = await this.getContentXml();
          if (contentXml) {
            this.zip.addFile("content.xml", contentXml);
            commonFiles.push("content.xml");
            this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);
            commonFiles.push(ODE_DTD_FILENAME);
          }
        } catch {
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
              commonFiles.push(`idevices/${idevice}/${path}`);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const manifestXml = this.manifestGenerator.generate({
          commonFiles,
          pageFiles
        });
        this.zip.addFile("imsmanifest.xml", manifestXml);
        const lomXml = this.lomGenerator.generate();
        this.zip.addFile("imslrm.xml", lomXml);
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate project ID for SCORM package
     */
    generateProjectId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate SCORM-enabled HTML page
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param themeFiles - List of root-level theme CSS/JS files
     */
    generateScormPageHtml(page, allPages, meta, isIndex, themeFiles) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        projectSubtitle: meta.subtitle || "",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Export options
        addSearchBox: meta.addSearchBox ?? false,
        // SCORM-specific options
        isScorm: true,
        scormVersion: "1.2",
        bodyClass: "exe-scorm exe-scorm12",
        extraHeadScripts: this.getScormHeadScripts(basePath),
        onLoadScript: "loadPage()",
        onUnloadScript: "unloadPage()",
        // Theme files for HTML head includes
        themeFiles: themeFiles || []
      });
    }
    /**
     * Get SCORM-specific head scripts
     */
    getScormHeadScripts(basePath) {
      return `<script src="${basePath}libs/SCORM_API_wrapper.js"><\/script>
<script src="${basePath}libs/SCOFunctions.js"><\/script>`;
    }
    /**
     * Get minimal SCORM API wrapper (fallback)
     */
    getScormApiWrapper() {
      return `/**
 * SCORM API Wrapper
 * Minimal implementation for SCORM 1.2 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "1.2",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.LMSInitialize("");
    if (success) { this.connection.isActive = true; }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSFinish("");
    if (success) { this.connection.isActive = false; }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.LMSGetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSSetValue(parameter, value);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSCommit("");
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
    }
    /**
     * Get minimal SCO Functions (fallback)
     */
    getScoFunctions() {
      return `/**
 * SCO Functions for SCORM 1.2
 * Page load/unload handlers for SCORM communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.core.lesson_status");
    if (status === "not attempted" || status === "") {
      scorm.set("cmi.core.lesson_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    elapsed = Math.round(elapsed / 1000);
    var hours = Math.floor(elapsed / 3600);
    var mins = Math.floor((elapsed - hours * 3600) / 60);
    var secs = elapsed - hours * 3600 - mins * 60;
    hours = hours < 10 ? "0" + hours : hours;
    mins = mins < 10 ? "0" + mins : mins;
    secs = secs < 10 ? "0" + secs : secs;
    var sessionTime = hours + ":" + mins + ":" + secs;
    scorm.set("cmi.core.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.core.lesson_status", "completed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.core.lesson_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  scorm.set("cmi.core.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.core.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.core.score.min", minScore);
  scorm.save();
}
`;
    }
    /**
     * Get content.xml from the document for inclusion in SCORM package
     * This allows the package to be re-edited in eXeLearning
     */
    async getContentXml() {
      if ("getContentXml" in this.document && typeof this.document.getContentXml === "function") {
        return this.document.getContentXml();
      }
      return null;
    }
  };

  // src/shared/export/generators/Scorm2004Manifest.ts
  var Scorm2004ManifestGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param pages - Pages from navigation structure
     * @param metadata - Project metadata
     */
    constructor(projectId, pages, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.pages = pages || [];
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imsmanifest.xml content
     * @param options - Generation options
     * @returns Complete XML string
     */
    generate(options = {}) {
      const { commonFiles = [], pageFiles = {} } = options;
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateManifestOpen();
      xml += this.generateMetadata();
      xml += this.generateOrganizations();
      xml += this.generateResources(commonFiles, pageFiles);
      xml += "</manifest>\n";
      return xml;
    }
    /**
     * Generate manifest opening tag with SCORM 2004 namespaces
     * @returns Manifest opening XML
     */
    generateManifestOpen() {
      return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_2004_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_2004_NAMESPACES.adlcp}"
  xmlns:adlseq="${SCORM_2004_NAMESPACES.adlseq}"
  xmlns:adlnav="${SCORM_2004_NAMESPACES.adlnav}"
  xmlns:imsss="${SCORM_2004_NAMESPACES.imsss}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCORM_2004_NAMESPACES.imscp} imscp_v1p1.xsd
    ${SCORM_2004_NAMESPACES.adlcp} adlcp_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlseq} adlseq_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlnav} adlnav_v1p3.xsd
    ${SCORM_2004_NAMESPACES.imsss} imsss_v1p0.xsd">
`;
    }
    /**
     * Generate metadata section
     * @returns Metadata XML
     */
    generateMetadata() {
      let xml = "  <metadata>\n";
      xml += "    <schema>ADL SCORM</schema>\n";
      xml += "    <schemaversion>2004 4th Edition</schemaversion>\n";
      xml += "    <adlcp:location>imslrm.xml</adlcp:location>\n";
      xml += "  </metadata>\n";
      return xml;
    }
    /**
     * Generate organizations section with sequencing
     * @returns Organizations XML
     */
    generateOrganizations() {
      const orgId = `eXe-${this.projectId}`;
      const title = this.metadata.title || "eXeLearning";
      let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
      xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
      xml += `      <title>${this.escapeXml(title)}</title>
`;
      xml += this.generateItems();
      xml += this.generateOrganizationSequencing();
      xml += "    </organization>\n";
      xml += "  </organizations>\n";
      return xml;
    }
    /**
     * Generate organization-level sequencing rules
     * @returns Sequencing XML
     */
    generateOrganizationSequencing() {
      return `      <imsss:sequencing>
        <imsss:controlMode choice="true" choiceExit="true" flow="true" forwardOnly="false"/>
      </imsss:sequencing>
`;
    }
    /**
     * Generate item elements for pages in hierarchical structure
     * @returns Items XML
     */
    generateItems() {
      const pageMap = /* @__PURE__ */ new Map();
      for (const page of this.pages) {
        pageMap.set(page.id, page);
      }
      const rootPages = this.pages.filter((p) => !p.parentId);
      let xml = "";
      for (const page of rootPages) {
        xml += this.generateItemRecursive(page, pageMap, 3);
      }
      return xml;
    }
    /**
     * Generate item element recursively for nested pages
     * @param page - Page object
     * @param pageMap - Map of all pages by ID
     * @param indent - Indentation level
     * @returns Item XML
     */
    generateItemRecursive(page, pageMap, indent) {
      const indentStr = "  ".repeat(indent);
      const isVisible = "true";
      const children = this.pages.filter((p) => p.parentId === page.id);
      const hasChildren = children.length > 0;
      let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
      xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
      for (const child of children) {
        xml += this.generateItemRecursive(child, pageMap, indent + 1);
      }
      if (hasChildren) {
        xml += this.generateItemSequencing(indentStr + "  ");
      }
      xml += `${indentStr}</item>
`;
      return xml;
    }
    /**
     * Generate sequencing rules for a parent item (cluster)
     * @param indentStr - Indentation string
     * @returns Sequencing XML
     */
    generateItemSequencing(indentStr) {
      return `${indentStr}<imsss:sequencing>
${indentStr}  <imsss:controlMode choice="true" choiceExit="true" flow="true"/>
${indentStr}</imsss:sequencing>
`;
    }
    /**
     * Generate resources section
     * @param commonFiles - List of common file paths
     * @param pageFiles - Map of pageId to file info
     * @returns Resources XML
     */
    generateResources(commonFiles, pageFiles) {
      let xml = "  <resources>\n";
      for (const page of this.pages) {
        const pageFile = pageFiles[page.id] || {};
        xml += this.generatePageResource(page, pageFile);
      }
      xml += this.generateCommonFilesResource(commonFiles);
      xml += "  </resources>\n";
      return xml;
    }
    /**
     * Generate resource element for a page
     * @param page - Page object
     * @param pageFile - Page file info
     * @returns Resource XML
     */
    generatePageResource(page, pageFile) {
      const pageId = page.id;
      const isIndex = this.pages.indexOf(page) === 0;
      const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
      let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormType="sco" href="${this.escapeXml(fileUrl)}">
`;
      xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
      const files = pageFile.files || [];
      for (const file of files) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += '      <dependency identifierref="COMMON_FILES"/>\n';
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Generate COMMON_FILES resource for shared assets
     * @param commonFiles - List of common file paths
     * @returns Resource XML
     */
    generateCommonFilesResource(commonFiles) {
      let xml = '    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormType="asset">\n';
      for (const file of commonFiles) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    /**
     * Sanitize filename for use in paths
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
  };

  // src/shared/export/exporters/Scorm2004Exporter.ts
  var Scorm2004Exporter = class extends Html5Exporter {
    constructor() {
      super(...arguments);
      this.manifestGenerator = null;
      this.lomGenerator = null;
    }
    /**
     * Get file suffix for SCORM 2004 format
     */
    getFileSuffix() {
      return "_scorm2004";
    }
    /**
     * Export to SCORM 2004 ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        const projectId = this.generateProjectId();
        pages = await this.preprocessPagesForExport(pages);
        this.manifestGenerator = new Scorm2004ManifestGenerator(projectId, pages, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        this.lomGenerator = new LomMetadataGenerator(projectId, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        const commonFiles = [];
        const pageFiles = {};
        const themeRootFiles = [];
        let themeFilesMap = null;
        try {
          themeFilesMap = await this.resources.fetchTheme(themeName);
          for (const [filePath] of themeFilesMap) {
            if (!filePath.includes("/") && (filePath.endsWith(".css") || filePath.endsWith(".js"))) {
              themeRootFiles.push(filePath);
            }
          }
        } catch {
          themeRootFiles.push("style.css", "style.js");
        }
        let latexWasRendered = false;
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const isIndex = i === 0;
          let html = this.generateScorm2004PageHtml(page, pages, meta, isIndex, themeRootFiles);
          if (!meta.addMathJax && options?.preRenderLatex) {
            try {
              const result = await options.preRenderLatex(html);
              if (result.latexRendered) {
                html = result.html;
                latexWasRendered = true;
                console.log(
                  `[Scorm2004Exporter] Pre-rendered ${result.count} LaTeX expressions on page: ${page.title}`
                );
              }
            } catch (error) {
              console.warn("[Scorm2004Exporter] LaTeX pre-render failed for page:", page.title, error);
            }
          }
          const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
          pageFiles[page.id] = {
            fileUrl: pageFilename,
            files: []
          };
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
          commonFiles.push("search_index.js");
        }
        const contentCssFiles = await this.resources.fetchContentCss();
        let baseCss = contentCssFiles.get("content/css/base.css");
        if (!baseCss) {
          throw new Error("Failed to fetch content/css/base.css");
        }
        if (latexWasRendered) {
          const latexCss = this.getPreRenderedLatexCss();
          const decoder = new TextDecoder();
          const baseCssText = decoder.decode(baseCss);
          const encoder = new TextEncoder();
          baseCss = encoder.encode(baseCssText + "\n" + latexCss);
        }
        this.zip.addFile("content/css/base.css", baseCss);
        commonFiles.push("content/css/base.css");
        if (themeFilesMap) {
          for (const [filePath, content] of themeFilesMap) {
            this.zip.addFile(`theme/${filePath}`, content);
            commonFiles.push(`theme/${filePath}`);
          }
        } else {
          this.zip.addFile("theme/style.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/style.js", this.getFallbackThemeJs());
          commonFiles.push("theme/style.css", "theme/style.js");
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
        }
        try {
          const scormFiles = await this.resources.fetchScormFiles("2004");
          for (const [filePath, content] of scormFiles) {
            this.zip.addFile(`libs/${filePath}`, content);
            commonFiles.push(`libs/${filePath}`);
          }
        } catch {
          this.zip.addFile("libs/SCORM_API_wrapper.js", this.getScorm2004ApiWrapper());
          this.zip.addFile("libs/SCOFunctions.js", this.getSco2004Functions());
          commonFiles.push("libs/SCORM_API_wrapper.js", "libs/SCOFunctions.js");
        }
        try {
          const schemaFiles = await this.resources.fetchScormSchemas("2004");
          for (const [filePath, content] of schemaFiles) {
            this.zip.addFile(filePath, content);
            commonFiles.push(filePath);
          }
        } catch {
        }
        try {
          const contentXml = await this.getContentXml();
          if (contentXml) {
            this.zip.addFile("content.xml", contentXml);
            commonFiles.push("content.xml");
            this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);
            commonFiles.push(ODE_DTD_FILENAME);
          }
        } catch {
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
              commonFiles.push(`idevices/${idevice}/${path}`);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const manifestXml = this.manifestGenerator.generate({
          commonFiles,
          pageFiles
        });
        this.zip.addFile("imsmanifest.xml", manifestXml);
        const lomXml = this.lomGenerator.generate();
        this.zip.addFile("imslrm.xml", lomXml);
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate project ID for SCORM package
     */
    generateProjectId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate SCORM 2004-enabled HTML page
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param themeFiles - List of root-level theme CSS/JS files
     */
    generateScorm2004PageHtml(page, allPages, meta, isIndex, themeFiles) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        projectSubtitle: meta.subtitle || "",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Export options
        addSearchBox: meta.addSearchBox ?? false,
        // SCORM 2004-specific options
        isScorm: true,
        scormVersion: "2004",
        bodyClass: "exe-scorm exe-scorm2004",
        extraHeadScripts: this.getScorm2004HeadScripts(basePath),
        onLoadScript: "loadPage()",
        onUnloadScript: "unloadPage()",
        // Theme files for HTML head includes
        themeFiles: themeFiles || []
      });
    }
    /**
     * Get SCORM 2004-specific head scripts
     */
    getScorm2004HeadScripts(basePath) {
      return `<script src="${basePath}libs/SCORM_API_wrapper.js"><\/script>
<script src="${basePath}libs/SCOFunctions.js"><\/script>`;
    }
    /**
     * Get SCORM 2004 API wrapper (fallback)
     */
    getScorm2004ApiWrapper() {
      return `/**
 * SCORM 2004 API Wrapper
 * Minimal implementation for SCORM 2004 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "2004",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API_1484_11 && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API_1484_11 || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.Initialize("");
    if (success === "true" || success === true) {
      this.connection.isActive = true;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Terminate("");
    if (success === "true" || success === true) {
      this.connection.isActive = false;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.GetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.SetValue(parameter, value);
    success = (success === "true" || success === true);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Commit("");
    success = (success === "true" || success === true);
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
    }
    /**
     * Get SCO Functions for SCORM 2004 (fallback)
     */
    getSco2004Functions() {
      return `/**
 * SCO Functions for SCORM 2004
 * Page load/unload handlers for SCORM 2004 communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.completion_status");
    if (status === "not attempted" || status === "unknown" || status === "") {
      scorm.set("cmi.completion_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.set("cmi.exit", "suspend");
    scorm.save();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    // SCORM 2004 uses ISO 8601 duration format
    var seconds = Math.round(elapsed / 1000);
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds - hours * 3600) / 60);
    var secs = seconds - hours * 3600 - mins * 60;
    // Format: PT#H#M#S
    var sessionTime = "PT" + hours + "H" + mins + "M" + secs + "S";
    scorm.set("cmi.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.completion_status", "completed");
  scorm.set("cmi.success_status", "passed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.completion_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  // SCORM 2004 score must be between 0 and 1
  var scaledScore = maxScore ? score / maxScore : score / 100;
  scorm.set("cmi.score.scaled", scaledScore);
  scorm.set("cmi.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.score.min", minScore);
  scorm.save();
}
`;
    }
    /**
     * Get content.xml from the document for inclusion in SCORM package
     * This allows the package to be re-edited in eXeLearning
     */
    async getContentXml() {
      if ("getContentXml" in this.document && typeof this.document.getContentXml === "function") {
        return this.document.getContentXml();
      }
      return null;
    }
  };

  // src/shared/export/generators/ImsManifest.ts
  var ImsManifestGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param pages - Pages from navigation structure
     * @param metadata - Project metadata
     */
    constructor(projectId, pages, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.pages = pages || [];
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imsmanifest.xml content
     * @param options - Generation options
     * @returns Complete XML string
     */
    generate(options = {}) {
      const { commonFiles = [], pageFiles = {} } = options;
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateManifestOpen();
      xml += this.generateMetadata();
      xml += this.generateOrganizations();
      xml += this.generateResources(commonFiles, pageFiles);
      xml += "</manifest>\n";
      return xml;
    }
    /**
     * Generate manifest opening tag with IMS CP namespaces
     * @returns Manifest opening XML
     */
    generateManifestOpen() {
      return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${IMS_NAMESPACES.imscp}"
  xmlns:imsmd="${IMS_NAMESPACES.imsmd}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${IMS_NAMESPACES.imscp} imscp_v1p1.xsd
    ${IMS_NAMESPACES.imsmd} imsmd_v1p2p2.xsd">
`;
    }
    /**
     * Generate metadata section with inline LOM
     * @returns Metadata XML
     */
    generateMetadata() {
      const title = this.metadata.title || "eXeLearning";
      const description = this.metadata.description || "";
      const language = this.metadata.language || "en";
      const author = this.metadata.author || "";
      let xml = "  <metadata>\n";
      xml += "    <schema>IMS Content</schema>\n";
      xml += "    <schemaversion>1.1.3</schemaversion>\n";
      xml += "    <imsmd:lom>\n";
      xml += "      <imsmd:general>\n";
      xml += `        <imsmd:title>
`;
      xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(title)}</imsmd:langstring>
`;
      xml += `        </imsmd:title>
`;
      if (description) {
        xml += `        <imsmd:description>
`;
        xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(description)}</imsmd:langstring>
`;
        xml += `        </imsmd:description>
`;
      }
      xml += `        <imsmd:language>${this.escapeXml(language)}</imsmd:language>
`;
      xml += "      </imsmd:general>\n";
      if (author) {
        xml += "      <imsmd:lifecycle>\n";
        xml += "        <imsmd:contribute>\n";
        xml += "          <imsmd:role>\n";
        xml += "            <imsmd:value>Author</imsmd:value>\n";
        xml += "          </imsmd:role>\n";
        xml += "          <imsmd:centity>\n";
        xml += `            <imsmd:vcard>BEGIN:VCARD\\nFN:${this.escapeXml(author)}\\nEND:VCARD</imsmd:vcard>
`;
        xml += "          </imsmd:centity>\n";
        xml += "        </imsmd:contribute>\n";
        xml += "      </imsmd:lifecycle>\n";
      }
      xml += "    </imsmd:lom>\n";
      xml += "  </metadata>\n";
      return xml;
    }
    /**
     * Generate organizations section
     * @returns Organizations XML
     */
    generateOrganizations() {
      const orgId = `eXe-${this.projectId}`;
      const title = this.metadata.title || "eXeLearning";
      let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
      xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
      xml += `      <title>${this.escapeXml(title)}</title>
`;
      xml += this.generateItems();
      xml += "    </organization>\n";
      xml += "  </organizations>\n";
      return xml;
    }
    /**
     * Generate item elements for pages in hierarchical structure
     * @returns Items XML
     */
    generateItems() {
      const pageMap = /* @__PURE__ */ new Map();
      for (const page of this.pages) {
        pageMap.set(page.id, page);
      }
      const rootPages = this.pages.filter((p) => !p.parentId);
      let xml = "";
      for (const page of rootPages) {
        xml += this.generateItemRecursive(page, pageMap, 3);
      }
      return xml;
    }
    /**
     * Generate item element recursively for nested pages
     * @param page - Page object
     * @param pageMap - Map of all pages by ID
     * @param indent - Indentation level
     * @returns Item XML
     */
    generateItemRecursive(page, pageMap, indent) {
      const indentStr = "  ".repeat(indent);
      const isVisible = "true";
      const children = this.pages.filter((p) => p.parentId === page.id);
      let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
      xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
      for (const child of children) {
        xml += this.generateItemRecursive(child, pageMap, indent + 1);
      }
      xml += `${indentStr}</item>
`;
      return xml;
    }
    /**
     * Generate resources section
     * @param commonFiles - List of common file paths
     * @param pageFiles - Map of pageId to file info
     * @returns Resources XML
     */
    generateResources(commonFiles, pageFiles) {
      let xml = "  <resources>\n";
      for (const page of this.pages) {
        const pageFile = pageFiles[page.id] || {};
        xml += this.generatePageResource(page, pageFile);
      }
      xml += this.generateCommonFilesResource(commonFiles);
      xml += "  </resources>\n";
      return xml;
    }
    /**
     * Generate resource element for a page
     * @param page - Page object
     * @param pageFile - Page file info
     * @returns Resource XML
     */
    generatePageResource(page, pageFile) {
      const pageId = page.id;
      const isIndex = this.pages.indexOf(page) === 0;
      const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
      let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" href="${this.escapeXml(fileUrl)}">
`;
      xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
      const files = pageFile.files || [];
      for (const file of files) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += '      <dependency identifierref="COMMON_FILES"/>\n';
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Generate COMMON_FILES resource for shared assets
     * @param commonFiles - List of common file paths
     * @returns Resource XML
     */
    generateCommonFilesResource(commonFiles) {
      let xml = '    <resource identifier="COMMON_FILES" type="webcontent">\n';
      for (const file of commonFiles) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    /**
     * Sanitize filename for use in paths
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
  };

  // src/shared/export/exporters/ImsExporter.ts
  var ImsExporter = class extends Html5Exporter {
    constructor() {
      super(...arguments);
      this.manifestGenerator = null;
    }
    /**
     * Get file suffix for IMS CP format
     */
    getFileSuffix() {
      return "_ims";
    }
    /**
     * Export to IMS Content Package ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        const projectId = this.generateProjectId();
        pages = await this.preprocessPagesForExport(pages);
        this.manifestGenerator = new ImsManifestGenerator(projectId, pages, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        const commonFiles = [];
        const pageFiles = {};
        const themeRootFiles = [];
        let themeFilesMap = null;
        try {
          themeFilesMap = await this.resources.fetchTheme(themeName);
          for (const [filePath] of themeFilesMap) {
            if (!filePath.includes("/") && (filePath.endsWith(".css") || filePath.endsWith(".js"))) {
              themeRootFiles.push(filePath);
            }
          }
        } catch {
          themeRootFiles.push("style.css", "style.js");
        }
        let latexWasRendered = false;
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const isIndex = i === 0;
          let html = this.generateImsPageHtml(page, pages, meta, isIndex, themeRootFiles);
          if (!meta.addMathJax && options?.preRenderLatex) {
            try {
              const result = await options.preRenderLatex(html);
              if (result.latexRendered) {
                html = result.html;
                latexWasRendered = true;
                console.log(
                  `[ImsExporter] Pre-rendered ${result.count} LaTeX expressions on page: ${page.title}`
                );
              }
            } catch (error) {
              console.warn("[ImsExporter] LaTeX pre-render failed for page:", page.title, error);
            }
          }
          const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
          pageFiles[page.id] = {
            fileUrl: pageFilename,
            files: []
          };
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
          commonFiles.push("search_index.js");
        }
        const contentCssFiles = await this.resources.fetchContentCss();
        let baseCss = contentCssFiles.get("content/css/base.css");
        if (!baseCss) {
          throw new Error("Failed to fetch content/css/base.css");
        }
        if (latexWasRendered) {
          const latexCss = this.getPreRenderedLatexCss();
          const decoder = new TextDecoder();
          const baseCssText = decoder.decode(baseCss);
          const encoder = new TextEncoder();
          baseCss = encoder.encode(baseCssText + "\n" + latexCss);
        }
        this.zip.addFile("content/css/base.css", baseCss);
        commonFiles.push("content/css/base.css");
        if (themeFilesMap) {
          for (const [filePath, content] of themeFilesMap) {
            this.zip.addFile(`theme/${filePath}`, content);
            commonFiles.push(`theme/${filePath}`);
          }
        } else {
          this.zip.addFile("theme/style.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/style.js", this.getFallbackThemeJs());
          commonFiles.push("theme/style.css", "theme/style.js");
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
              commonFiles.push(`idevices/${idevice}/${path}`);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const manifestXml = this.manifestGenerator.generate({
          commonFiles,
          pageFiles
        });
        this.zip.addFile("imsmanifest.xml", manifestXml);
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate project ID for IMS package
     */
    generateProjectId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate IMS CP HTML page (standard website, no SCORM)
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param themeFiles - List of root-level theme CSS/JS files
     */
    generateImsPageHtml(page, allPages, meta, isIndex, themeFiles) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        projectSubtitle: meta.subtitle || "",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Export options
        addSearchBox: meta.addSearchBox ?? false,
        bodyClass: "exe-web-site exe-ims",
        // Theme files for HTML head includes
        themeFiles: themeFiles || []
      });
    }
  };

  // src/shared/export/exporters/Epub3Exporter.ts
  var EPUB3_NAMESPACES = {
    OPF: "http://www.idpf.org/2007/opf",
    DC: "http://purl.org/dc/elements/1.1/",
    XHTML: "http://www.w3.org/1999/xhtml",
    EPUB: "http://www.idpf.org/2007/ops",
    CONTAINER: "urn:oasis:names:tc:opendocument:xmlns:container"
  };
  var EPUB3_MIMETYPE = "application/epub+zip";
  var VOID_ELEMENTS = [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ];
  var MIME_TYPES = {
    ".xhtml": "application/xhtml+xml",
    ".html": "application/xhtml+xml",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".ogg": "audio/ogg",
    ".ogv": "video/ogg",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject"
  };
  var Epub3Exporter = class extends BaseExporter {
    constructor() {
      super(...arguments);
      this.manifestItems = [];
      this.spineItems = [];
      this.usedIds = /* @__PURE__ */ new Set();
    }
    /**
     * Get file extension for EPUB3 format
     */
    getFileExtension() {
      return ".epub";
    }
    /**
     * Get file suffix for EPUB3 format
     */
    getFileSuffix() {
      return "";
    }
    /**
     * Export to EPUB3
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      const epub3Options = options;
      try {
        this.manifestItems = [];
        this.spineItems = [];
        this.usedIds = /* @__PURE__ */ new Set();
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = epub3Options?.theme || meta.theme || "base";
        const bookId = epub3Options?.bookId || this.generateBookId();
        pages = await this.preprocessPagesForExport(pages);
        const themeRootFiles = [];
        let themeFilesMap = null;
        try {
          themeFilesMap = await this.resources.fetchTheme(themeName);
          for (const [filePath] of themeFilesMap) {
            if (!filePath.includes("/") && (filePath.endsWith(".css") || filePath.endsWith(".js"))) {
              themeRootFiles.push(filePath);
            }
          }
        } catch {
          themeRootFiles.push("style.css", "style.js");
        }
        this.zip.addFile("mimetype", EPUB3_MIMETYPE);
        this.zip.addFile("META-INF/container.xml", this.generateContainerXml());
        const navXhtml = this.generateNavXhtml(pages, meta);
        this.zip.addFile("EPUB/nav.xhtml", navXhtml);
        this.addManifestItem("nav", "nav.xhtml", "application/xhtml+xml", "nav");
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const xhtml = this.generatePageXhtml(page, pages, meta, i === 0, themeRootFiles);
          const filename = i === 0 ? "index.xhtml" : `html/${this.sanitizePageFilename(page.title)}.xhtml`;
          this.zip.addFile(`EPUB/${filename}`, xhtml);
          const pageId = this.generateUniqueId(`page-${i}`);
          this.addManifestItem(pageId, filename, "application/xhtml+xml", "scripted");
          this.spineItems.push({ idref: pageId });
        }
        if (meta.exportSource !== false) {
          const contentXml = this.generateContentXml();
          this.zip.addFile("EPUB/content.xml", contentXml);
          this.addManifestItem("content-xml", "content.xml", "application/xml");
          this.zip.addFile(`EPUB/${ODE_DTD_FILENAME}`, ODE_DTD_CONTENT);
        }
        const contentCssFiles = await this.resources.fetchContentCss();
        const fetchedBaseCss = contentCssFiles.get("content/css/base.css");
        if (!fetchedBaseCss) {
          throw new Error("Failed to fetch content/css/base.css");
        }
        const baseCssContent = typeof fetchedBaseCss === "string" ? fetchedBaseCss : new TextDecoder().decode(fetchedBaseCss);
        const baseCss = baseCssContent + "\n" + this.getEpubSpecificCss();
        this.zip.addFile("EPUB/content/css/base.css", baseCss);
        this.addManifestItem("css-base", "content/css/base.css", "text/css");
        try {
          const logoData = await this.resources.fetchExeLogo();
          if (logoData) {
            this.zip.addFile("EPUB/content/img/exe_powered_logo.png", logoData);
            this.addManifestItem("exe-logo", "content/img/exe_powered_logo.png", "image/png");
          }
        } catch {
        }
        if (themeFilesMap) {
          for (const [filePath, content] of themeFilesMap) {
            this.zip.addFile(`EPUB/theme/${filePath}`, content);
            const ext = this.getFileExtensionFromPath(filePath);
            const mimeType = MIME_TYPES[ext] || "application/octet-stream";
            this.addManifestItem(this.generateUniqueId(`theme-${filePath}`), `theme/${filePath}`, mimeType);
          }
        } else {
          this.zip.addFile("EPUB/theme/style.css", this.getFallbackThemeCss());
          this.addManifestItem("theme-css", "theme/style.css", "text/css");
        }
        const allHtmlContent = this.collectAllHtmlContent(pages);
        const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
          allHtmlContent,
          {
            includeAccessibilityToolbar: meta.addAccessibilityToolbar === true
          }
        );
        try {
          const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
          for (const [path, content] of libFiles) {
            this.zip.addFile(`EPUB/libs/${path}`, content);
            const ext = this.getFileExtensionFromPath(path);
            const mimeType = MIME_TYPES[ext] || "application/octet-stream";
            this.addManifestItem(this.generateUniqueId(`lib-${path}`), `libs/${path}`, mimeType);
          }
        } catch {
          try {
            const baseLibs = await this.resources.fetchBaseLibraries();
            for (const [path, content] of baseLibs) {
              this.zip.addFile(`EPUB/libs/${path}`, content);
              const ext = this.getFileExtensionFromPath(path);
              const mimeType = MIME_TYPES[ext] || "application/octet-stream";
              this.addManifestItem(this.generateUniqueId(`lib-${path}`), `libs/${path}`, mimeType);
            }
          } catch {
          }
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [filePath, content] of ideviceFiles) {
              if (filePath.endsWith(".html")) {
                continue;
              }
              if (filePath.endsWith(".test.js") || filePath.endsWith(".spec.js")) {
                continue;
              }
              this.zip.addFile(`EPUB/idevices/${idevice}/${filePath}`, content);
              const ext = this.getFileExtensionFromPath(filePath);
              const mimeType = MIME_TYPES[ext] || "application/octet-stream";
              this.addManifestItem(
                this.generateUniqueId(`idevice-${idevice}-${filePath}`),
                `idevices/${idevice}/${filePath}`,
                mimeType
              );
            }
          } catch {
          }
        }
        const _assetsAdded = await this.addEpubAssets();
        const packageOpf = this.generatePackageOpf(meta, bookId);
        this.zip.addFile("EPUB/package.opf", packageOpf);
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate unique book ID (URN UUID format)
     */
    generateBookId() {
      return `urn:uuid:${crypto.randomUUID()}`;
    }
    /**
     * Generate unique manifest ID
     */
    generateUniqueId(base) {
      const sanitized = base.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").substring(0, 50);
      if (!this.usedIds.has(sanitized)) {
        this.usedIds.add(sanitized);
        return sanitized;
      }
      let counter = 1;
      while (this.usedIds.has(`${sanitized}-${counter}`)) {
        counter++;
      }
      const uniqueId = `${sanitized}-${counter}`;
      this.usedIds.add(uniqueId);
      return uniqueId;
    }
    /**
     * Add item to manifest
     */
    addManifestItem(id, href, mediaType, properties) {
      this.manifestItems.push({ id, href, mediaType, properties });
    }
    /**
     * Get file extension from path
     */
    getFileExtensionFromPath(filePath) {
      const lastDot = filePath.lastIndexOf(".");
      return lastDot > 0 ? filePath.substring(lastDot).toLowerCase() : "";
    }
    /**
     * Generate container.xml
     */
    generateContainerXml() {
      return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="${EPUB3_NAMESPACES.CONTAINER}">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    }
    /**
     * Generate package.opf (OPF manifest)
     */
    generatePackageOpf(meta, bookId) {
      const modified = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="pub-id" xmlns="${EPUB3_NAMESPACES.OPF}">
  <metadata xmlns:dc="${EPUB3_NAMESPACES.DC}">
    <dc:identifier id="pub-id">${this.escapeXml(bookId)}</dc:identifier>
    <dc:title>${this.escapeXml(meta.title || "eXeLearning")}</dc:title>
    <dc:language>${this.escapeXml(meta.language || "en")}</dc:language>
    <dc:creator>${this.escapeXml(meta.author || "")}</dc:creator>`;
      if (meta.description) {
        xml += `
    <dc:description>${this.escapeXml(meta.description)}</dc:description>`;
      }
      if (meta.license) {
        xml += `
    <dc:rights>${this.escapeXml(meta.license)}</dc:rights>`;
      }
      xml += `
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>`;
      for (const item of this.manifestItems) {
        const props = item.properties ? ` properties="${item.properties}"` : "";
        xml += `
    <item id="${this.escapeXml(item.id)}" href="${this.escapeXml(item.href)}" media-type="${item.mediaType}"${props}/>`;
      }
      xml += `
  </manifest>
  <spine>`;
      for (const item of this.spineItems) {
        xml += `
    <itemref idref="${this.escapeXml(item.idref)}"/>`;
      }
      xml += `
  </spine>
</package>`;
      return xml;
    }
    /**
     * Generate nav.xhtml (EPUB3 navigation document)
     */
    generateNavXhtml(pages, meta) {
      const lang = meta.language || "en";
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="${EPUB3_NAMESPACES.XHTML}" xmlns:epub="${EPUB3_NAMESPACES.EPUB}" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" href="content/css/base.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${this.escapeXml(meta.title || "Table of Contents")}</h1>
    <ol>`;
      xml += this.buildNavList(pages, pages);
      xml += `
    </ol>
  </nav>
</body>
</html>`;
      return xml;
    }
    /**
     * Build navigation list recursively
     */
    buildNavList(pages, allPages, parentId = null) {
      const children = parentId === null ? pages.filter((p) => !p.parentId) : pages.filter((p) => p.parentId === parentId);
      if (children.length === 0) return "";
      let html = "";
      for (const page of children) {
        const filename = this.getPageFilename(page, allPages);
        const grandchildren = pages.filter((p) => p.parentId === page.id);
        html += `
      <li><a href="${filename}">${this.escapeXml(page.title)}</a>`;
        if (grandchildren.length > 0) {
          html += `
        <ol>${this.buildNavList(pages, allPages, page.id)}
        </ol>`;
        }
        html += `</li>`;
      }
      return html;
    }
    /**
     * Get page filename for navigation
     */
    getPageFilename(page, allPages) {
      const isFirst = page.id === allPages[0]?.id;
      if (isFirst) {
        return "index.xhtml";
      }
      return `html/${this.sanitizePageFilename(page.title)}.xhtml`;
    }
    /**
     * Generate XHTML page
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param themeFiles - List of root-level theme CSS/JS files
     */
    generatePageXhtml(page, allPages, meta, isIndex, themeFiles) {
      const lang = meta.language || "en";
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      const pageHtml = this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        projectSubtitle: meta.subtitle || "",
        language: lang,
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        bodyClass: "exe-export exe-epub",
        // Theme files for HTML head includes
        themeFiles: themeFiles || []
      });
      return this.htmlToXhtml(pageHtml, lang);
    }
    /**
     * Convert HTML to XHTML
     */
    htmlToXhtml(html, lang) {
      let xhtml = html;
      if (!xhtml.startsWith("<?xml")) {
        xhtml = `<?xml version="1.0" encoding="UTF-8"?>
${xhtml}`;
      }
      if (!xhtml.includes("<!DOCTYPE")) {
        xhtml = xhtml.replace(
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>'
        );
      }
      xhtml = xhtml.replace(/<html([^>]*)>/i, (match, attrs) => {
        const cleanAttrs = attrs.replace(/\s+xml:lang=["'][^"']*["']/gi, "").replace(/\s+lang=["'][^"']*["']/gi, "");
        return `<html xmlns="${EPUB3_NAMESPACES.XHTML}" xml:lang="${lang}" lang="${lang}"${cleanAttrs}>`;
      });
      for (const element of VOID_ELEMENTS) {
        const regex = new RegExp(`<(${element})\\b([^>]*[^/])>`, "gi");
        xhtml = xhtml.replace(regex, "<$1$2/>");
        const simpleRegex = new RegExp(`<(${element})>`, "gi");
        xhtml = xhtml.replace(simpleRegex, "<$1/>");
      }
      xhtml = xhtml.replace(/&(?!(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
      xhtml = xhtml.replace(/(\s)([a-zA-Z][a-zA-Z0-9-]*)=(true|false|[a-zA-Z0-9_-]+)(?=[\s>/])/g, '$1$2="$3"');
      xhtml = xhtml.replace(/(\s[a-zA-Z][a-zA-Z0-9-]*)=""([^"<>/]+)>/g, '$1="$2">');
      xhtml = xhtml.replace(/\.html(['"#\s])/g, ".xhtml$1");
      xhtml = xhtml.replace(/\.html$/g, ".xhtml");
      xhtml = xhtml.replace(/\s+style=["']\s*["']/g, "");
      return xhtml;
    }
    /**
     * Add assets to EPUB with manifest entries
     */
    async addEpubAssets() {
      let assetsAdded = 0;
      try {
        const assets = await this.assets.getAllAssets();
        for (const asset of assets) {
          const assetId = asset.id;
          const filename = asset.filename || `asset-${assetId}`;
          const zipPath = `content/resources/${assetId}/${filename}`;
          this.zip.addFile(`EPUB/${zipPath}`, asset.data);
          const ext = this.getFileExtensionFromPath(filename);
          const mimeType = MIME_TYPES[ext] || asset.mime || "application/octet-stream";
          this.addManifestItem(this.generateUniqueId(`asset-${assetId}`), zipPath, mimeType);
          assetsAdded++;
        }
      } catch (e) {
        console.warn("[Epub3Exporter] Failed to add assets:", e);
      }
      return assetsAdded;
    }
    /**
     * Get EPUB-specific CSS additions
     */
    getEpubSpecificCss() {
      return `
/* EPUB3 Specific Styles */
body {
  margin: 0;
  padding: 1em;
}

/* Page breaks */
.page-break-before {
  page-break-before: always;
}
.page-break-after {
  page-break-after: always;
}
.avoid-page-break {
  page-break-inside: avoid;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
}

/* Hide navigation in EPUB (handled by reader) */
#siteNav {
  display: none;
}

/* Pagination links hidden in EPUB */
.pagination {
  display: none;
}

/* Tables */
table {
  max-width: 100%;
  border-collapse: collapse;
}
td, th {
  padding: 0.5em;
  border: 1px solid #ccc;
}
`;
    }
  };

  // src/shared/export/browser/xml-validator-shim.ts
  function validateXml(_xmlContent) {
    return { valid: true, errors: [], warnings: [] };
  }
  function formatValidationErrors(_result) {
    return "";
  }

  // src/shared/export/exporters/ElpxExporter.ts
  var ODE_VERSION = "4.0";
  var ElpxExporter = class extends Html5Exporter {
    /**
     * Get file extension for ELPX format
     */
    getFileExtension() {
      return ".elpx";
    }
    /**
     * Get file suffix for ELPX format (no suffix for ELPX)
     */
    getFileSuffix() {
      return "";
    }
    /**
     * Export to ELPX format
     *
     * ELPX is a complete HTML5 export + content.xml (ODE format) + DTD for re-import.
     * This method generates all HTML5 content (index.html, html/*.html, libs/, theme/, etc.)
     * and then adds the content.xml with full ODE structure and DTD.
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      const elpxOptions = options;
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = elpxOptions?.theme || meta.theme || "base";
        pages = await this.preprocessPagesForExport(pages);
        const themeRootFiles = [];
        let themeFilesMap = null;
        try {
          themeFilesMap = await this.resources.fetchTheme(themeName);
          for (const [filePath] of themeFilesMap) {
            if (!filePath.includes("/") && (filePath.endsWith(".css") || filePath.endsWith(".js"))) {
              themeRootFiles.push(filePath);
            }
          }
        } catch (e) {
          console.warn(`[ElpxExporter] Failed to pre-fetch theme: ${themeName}`, e);
          themeRootFiles.push("style.css", "style.js");
        }
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const html = this.generatePageHtml(page, pages, meta, i === 0, i, themeRootFiles);
          const pageFilename = i === 0 ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
        }
        const contentCssFiles = await this.resources.fetchContentCss();
        const baseCss = contentCssFiles.get("content/css/base.css");
        if (!baseCss) {
          throw new Error("Failed to fetch content/css/base.css");
        }
        this.zip.addFile("content/css/base.css", baseCss);
        try {
          const logoData = await this.resources.fetchExeLogo();
          if (logoData) {
            this.zip.addFile("content/img/exe_powered_logo.png", logoData);
          }
        } catch {
        }
        if (themeFilesMap) {
          for (const [filePath, content] of themeFilesMap) {
            this.zip.addFile(`theme/${filePath}`, content);
          }
        } else {
          this.zip.addFile("theme/style.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/style.js", this.getFallbackThemeJs());
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [libPath, content] of baseLibs) {
            this.zip.addFile(`libs/${libPath}`, content);
          }
        } catch {
        }
        const allHtmlContent = this.collectAllHtmlContent(pages);
        const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
          allHtmlContent,
          {
            includeAccessibilityToolbar: meta.addAccessibilityToolbar === true
          }
        );
        try {
          const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
          for (const [libPath, content] of libFiles) {
            const zipPath = `libs/${libPath}`;
            if (!this.zip.hasFile(zipPath)) {
              this.zip.addFile(zipPath, content);
            }
          }
        } catch {
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const normalizedType = this.resources.normalizeIdeviceType(idevice);
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [filePath, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${normalizedType}/${filePath}`, content);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const contentXml = this.generateOdeXml(meta, pages);
        const validation = validateXml(contentXml);
        if (!validation.valid) {
          const errorMsg = formatValidationErrors(validation);
          console.error(`[ElpxExporter] Generated XML failed validation:
${errorMsg}`);
          throw new Error(`Generated content.xml is invalid:
${errorMsg}`);
        }
        if (validation.warnings.length > 0) {
          console.warn(`[ElpxExporter] XML validation warnings:
${formatValidationErrors(validation)}`);
        }
        this.zip.addFile("content.xml", contentXml);
        this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);
        this.zip.addFile("custom/.gitkeep", "");
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate complete ODE XML document
     */
    generateOdeXml(meta, pages) {
      const odeId = meta.odeIdentifier || this.generateOdeId();
      const versionId = this.generateOdeId();
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += `<!DOCTYPE ode SYSTEM "${ODE_DTD_FILENAME}">
`;
      xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
      xml += this.generateUserPreferencesXml(meta);
      xml += this.generateOdeResourcesXml(odeId, versionId);
      xml += this.generateOdePropertiesXml(meta);
      xml += "<odeNavStructures>\n";
      for (let i = 0; i < pages.length; i++) {
        xml += this.generateOdeNavStructureXml(pages[i], i);
      }
      xml += "</odeNavStructures>\n";
      xml += "</ode>";
      return xml;
    }
    /**
     * Generate user preferences section
     */
    generateUserPreferencesXml(meta) {
      let xml = "<userPreferences>\n";
      xml += this.generateUserPreferenceEntry("theme", meta.theme || "base");
      xml += "</userPreferences>\n";
      return xml;
    }
    /**
     * Generate single user preference entry
     */
    generateUserPreferenceEntry(key, value) {
      return `  <userPreference>
    <key>${this.escapeXml(key)}</key>
    <value>${this.escapeXml(value)}</value>
  </userPreference>
`;
    }
    /**
     * Generate ODE resources section (identifiers, version)
     */
    generateOdeResourcesXml(odeId, versionId) {
      let xml = "<odeResources>\n";
      xml += this.generateOdeResourceEntry("odeId", odeId);
      xml += this.generateOdeResourceEntry("odeVersionId", versionId);
      xml += this.generateOdeResourceEntry("exe_version", ODE_VERSION);
      xml += "</odeResources>\n";
      return xml;
    }
    /**
     * Generate single ODE resource entry
     */
    generateOdeResourceEntry(key, value) {
      return `  <odeResource>
    <key>${this.escapeXml(key)}</key>
    <value>${this.escapeXml(value)}</value>
  </odeResource>
`;
    }
    /**
     * Generate ODE properties section (metadata)
     */
    generateOdePropertiesXml(meta) {
      let xml = "<odeProperties>\n";
      const properties = {
        pp_title: meta.title,
        pp_author: meta.author,
        pp_lang: meta.language,
        pp_description: meta.description,
        pp_license: meta.license,
        pp_theme: meta.theme,
        pp_keywords: meta.keywords,
        pp_category: meta.category,
        pp_addAccessibilityToolbar: meta.addAccessibilityToolbar,
        pp_addMathJax: meta.addMathJax,
        pp_customStyles: meta.customStyles,
        pp_exelearning_version: meta.exelearningVersion
      };
      for (const [key, value] of Object.entries(properties)) {
        if (value !== void 0 && value !== null && value !== "") {
          const strValue = typeof value === "boolean" ? value ? "true" : "false" : String(value);
          xml += this.generateOdePropertyEntry(key, strValue);
        }
      }
      xml += "</odeProperties>\n";
      return xml;
    }
    /**
     * Generate single ODE property entry
     */
    generateOdePropertyEntry(key, value) {
      return `  <odeProperty>
    <key>${this.escapeXml(key)}</key>
    <value>${this.escapeXml(value)}</value>
  </odeProperty>
`;
    }
    /**
     * Generate odeNavStructure for a page
     */
    generateOdeNavStructureXml(page, order) {
      const pageId = page.id;
      const parentId = page.parentId || "";
      let xml = `<odeNavStructure>
`;
      xml += `  <odePageId>${this.escapeXml(pageId)}</odePageId>
`;
      xml += `  <odeParentPageId>${this.escapeXml(parentId)}</odeParentPageId>
`;
      xml += `  <pageName>${this.escapeXml(page.title || "Page")}</pageName>
`;
      xml += `  <odeNavStructureOrder>${page.order ?? order}</odeNavStructureOrder>
`;
      xml += "  <odeNavStructureProperties>\n";
      xml += this.generateNavStructurePropertyEntry("titlePage", page.title || "");
      if (page.properties) {
        for (const [key, value] of Object.entries(page.properties)) {
          if (value !== void 0 && value !== null) {
            xml += this.generateNavStructurePropertyEntry(key, String(value));
          }
        }
      }
      xml += "  </odeNavStructureProperties>\n";
      xml += "  <odePagStructures>\n";
      for (let i = 0; i < (page.blocks || []).length; i++) {
        xml += this.generateOdePagStructureXml(page.blocks[i], pageId, i);
      }
      xml += "  </odePagStructures>\n";
      xml += "</odeNavStructure>\n";
      return xml;
    }
    /**
     * Generate navigation structure property entry
     */
    generateNavStructurePropertyEntry(key, value) {
      return `    <odeNavStructureProperty>
      <key>${this.escapeXml(key)}</key>
      <value>${this.escapeXml(value)}</value>
    </odeNavStructureProperty>
`;
    }
    /**
     * Generate odePagStructure for a block
     */
    generateOdePagStructureXml(block, pageId, order) {
      const blockId = block.id;
      let xml = `    <odePagStructure>
`;
      xml += `      <odePageId>${this.escapeXml(pageId)}</odePageId>
`;
      xml += `      <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>
`;
      xml += `      <blockName>${this.escapeXml(block.name || "")}</blockName>
`;
      xml += `      <iconName>${this.escapeXml(block.iconName || "")}</iconName>
`;
      xml += `      <odePagStructureOrder>${block.order ?? order}</odePagStructureOrder>
`;
      xml += "      <odePagStructureProperties>\n";
      if (block.properties) {
        const props = block.properties;
        if (props.visibility !== void 0) {
          xml += this.generatePagStructurePropertyEntry("visibility", String(props.visibility));
        }
        if (props.teacherOnly !== void 0) {
          xml += this.generatePagStructurePropertyEntry("teacherOnly", String(props.teacherOnly));
        }
        if (props.allowToggle !== void 0) {
          xml += this.generatePagStructurePropertyEntry("allowToggle", String(props.allowToggle));
        }
        if (props.minimized !== void 0) {
          xml += this.generatePagStructurePropertyEntry("minimized", String(props.minimized));
        }
        if (props.identifier !== void 0) {
          xml += this.generatePagStructurePropertyEntry("identifier", String(props.identifier));
        }
        if (props.cssClass !== void 0) {
          xml += this.generatePagStructurePropertyEntry("cssClass", String(props.cssClass));
        }
      }
      xml += "      </odePagStructureProperties>\n";
      xml += "      <odeComponents>\n";
      for (let i = 0; i < (block.components || []).length; i++) {
        xml += this.generateOdeComponentXml(block.components[i], pageId, blockId, i);
      }
      xml += "      </odeComponents>\n";
      xml += `    </odePagStructure>
`;
      return xml;
    }
    /**
     * Generate page structure property entry
     */
    generatePagStructurePropertyEntry(key, value) {
      return `        <odePagStructureProperty>
          <key>${this.escapeXml(key)}</key>
          <value>${this.escapeXml(value)}</value>
        </odePagStructureProperty>
`;
    }
    /**
     * Generate odeComponent for an iDevice
     */
    generateOdeComponentXml(component, pageId, blockId, order) {
      const componentId = component.id;
      const ideviceType = component.type || "FreeTextIdevice";
      let xml = `        <odeComponent>
`;
      xml += `          <odePageId>${this.escapeXml(pageId)}</odePageId>
`;
      xml += `          <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>
`;
      xml += `          <odeIdeviceId>${this.escapeXml(componentId)}</odeIdeviceId>
`;
      xml += `          <odeIdeviceTypeName>${this.escapeXml(ideviceType)}</odeIdeviceTypeName>
`;
      const htmlContent = component.content || "";
      xml += `          <htmlView><![CDATA[${this.escapeCdata(htmlContent)}]]></htmlView>
`;
      if (component.properties && Object.keys(component.properties).length > 0) {
        const jsonStr = JSON.stringify(component.properties);
        xml += `          <jsonProperties><![CDATA[${this.escapeCdata(jsonStr)}]]></jsonProperties>
`;
      } else {
        xml += `          <jsonProperties></jsonProperties>
`;
      }
      xml += `          <odeComponentsOrder>${component.order ?? order}</odeComponentsOrder>
`;
      xml += "          <odeComponentsProperties>\n";
      if (component.structureProperties) {
        const props = component.structureProperties;
        if (props.visibility !== void 0) {
          xml += this.generateComponentPropertyEntry("visibility", String(props.visibility));
        }
        if (props.teacherOnly !== void 0) {
          xml += this.generateComponentPropertyEntry("teacherOnly", String(props.teacherOnly));
        }
        if (props.identifier !== void 0) {
          xml += this.generateComponentPropertyEntry("identifier", String(props.identifier));
        }
        if (props.cssClass !== void 0) {
          xml += this.generateComponentPropertyEntry("cssClass", String(props.cssClass));
        }
      } else {
        xml += this.generateComponentPropertyEntry("visibility", "true");
      }
      xml += "          </odeComponentsProperties>\n";
      xml += `        </odeComponent>
`;
      return xml;
    }
    /**
     * Generate component property entry
     */
    generateComponentPropertyEntry(key, value) {
      return `            <odeComponentsProperty>
              <key>${this.escapeXml(key)}</key>
              <value>${this.escapeXml(value)}</value>
            </odeComponentsProperty>
`;
    }
    /**
     * Generate ODE identifier
     * Format: YYYYMMDDHHmmss + 6 random alphanumeric chars
     */
    generateOdeId() {
      const now = /* @__PURE__ */ new Date();
      const timestamp = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let random = "";
      for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return timestamp + random;
    }
  };

  // src/shared/export/exporters/WebsitePreviewExporter.ts
  var WebsitePreviewExporter = class _WebsitePreviewExporter {
    /**
     * Create a WebsitePreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     */
    constructor(document2, resourceProvider) {
      this.document = document2;
      this.ideviceRenderer = new IdeviceRenderer(resourceProvider);
    }
    /**
     * Generate preview HTML
     * @param options - Preview options
     * @returns Preview result with HTML string
     */
    async generatePreview(options = {}) {
      try {
        const pages = this.document.getNavigation();
        const meta = this.document.getMetadata();
        if (pages.length === 0) {
          return { success: false, error: "No pages to preview" };
        }
        const usedIdevices = this.getUsedIdevices(pages);
        const needsElpxDownload = this.needsElpxDownloadSupport(pages);
        let html = await this.generateWebsiteSpaHtml(pages, meta, usedIdevices, options, needsElpxDownload);
        if (needsElpxDownload) {
          const projectTitle = meta.title || "project";
          html = this.replaceElpxProtocol(html, projectTitle);
        }
        return { success: true, html };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }
    }
    /**
     * Check if any page contains the download-source-file iDevice
     * or a manual link using exe-package:elp protocol
     * (needs special handling in preview - postMessage to parent)
     */
    needsElpxDownloadSupport(pages) {
      for (const page of pages) {
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            const type = (component.type || "").toLowerCase();
            if (type.includes("download-source-file") || type.includes("downloadsourcefile")) {
              return true;
            }
            if (component.content?.includes("exe-download-package-link")) {
              return true;
            }
            if (component.content?.includes("exe-package:elp")) {
              return true;
            }
          }
        }
      }
      return false;
    }
    /**
     * Replace exe-package:elp protocol with client-side download handler
     * Enables the download-source-file iDevice to generate ELPX files on-the-fly
     */
    replaceElpxProtocol(content, projectTitle) {
      if (!content || !content.includes("exe-package:elp")) {
        return content;
      }
      let result = content.replace(
        /href="exe-package:elp"/g,
        `href="#" onclick="if(typeof downloadElpx==='function')downloadElpx();return false;"`
      );
      const safeTitle = this.escapeHtml(projectTitle);
      result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);
      return result;
    }
    /**
     * Get all unique iDevice types used in pages
     */
    getUsedIdevices(pages) {
      const types = /* @__PURE__ */ new Set();
      for (const page of pages) {
        for (const block of page.blocks) {
          for (const component of block.components) {
            if (component.type) {
              types.add(component.type);
            }
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get versioned asset path for server resources
     * @param path - The resource path (e.g., '/libs/bootstrap.css')
     * @param options - Preview options with baseUrl and version
     * @returns Versioned URL (or relative path in static mode)
     */
    getVersionedPath(path, options) {
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      if (options.isStaticMode) {
        const basePath2 = options.basePath || ".";
        if (basePath2.endsWith("/")) {
          return `${basePath2}${cleanPath}`;
        }
        return `${basePath2}/${cleanPath}`;
      }
      const baseUrl = options.baseUrl || "";
      const basePath = options.basePath || "";
      const version = options.version || "v1.0.0";
      const cleanBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
      return `${baseUrl}${cleanBasePath}/${version}/${cleanPath}`;
    }
    static {
      /**
       * Libraries that are located in /libs/ instead of /app/common/
       * The LibraryDetector returns files without the base path, so we need to map them correctly
       * Note: mermaid is in /app/common/mermaid/, not /libs/
       */
      this.LIBS_FOLDER_LIBRARIES = /* @__PURE__ */ new Set([
        "jquery-ui",
        "fflate",
        "exe_atools",
        "exe_elpx_download"
        // Folder in /libs/
      ]);
    }
    /**
     * Get the correct server path for a detected library file
     * Some libraries are in /libs/, others in /app/common/
     * @param file - Library file path (e.g., 'jquery-ui/jquery-ui.min.js' or 'exe_lightbox/exe_lightbox.js')
     * @param options - Preview options
     * @returns Versioned URL with correct base path
     */
    getLibraryServerPath(file, options) {
      const firstPart = file.split("/")[0];
      if (_WebsitePreviewExporter.LIBS_FOLDER_LIBRARIES.has(firstPart) || _WebsitePreviewExporter.LIBS_FOLDER_LIBRARIES.has(file)) {
        return this.getVersionedPath(`/libs/${file}`, options);
      }
      return this.getVersionedPath(`/app/common/${file}`, options);
    }
    /**
     * Generate complete SPA HTML with all pages
     */
    async generateWebsiteSpaHtml(pages, meta, usedIdevices, options, needsElpxDownload = false) {
      const lang = meta.language || "en";
      const projectTitle = meta.title || "eXeLearning";
      const customStyles = meta.customStyles || "";
      const license = meta.license || "CC-BY-SA";
      const themeName = meta.theme || "base";
      const userFooterContent = meta.footer || "";
      const addExeLink = meta.addExeLink ?? true;
      const addPagination = meta.addPagination ?? false;
      const addSearchBox = meta.addSearchBox ?? false;
      const addAccessibilityToolbar = meta.addAccessibilityToolbar ?? false;
      const visiblePages = pages.filter((page) => this.isPageVisible(page, pages));
      const searchDataJson = addSearchBox ? this.generateSearchData(visiblePages, options) : "";
      const totalVisiblePages = visiblePages.length;
      let pagesHtml = "";
      for (let i = 0; i < visiblePages.length; i++) {
        const page = visiblePages[i];
        const isFirst = i === 0;
        pagesHtml += this.renderPageArticle(
          page,
          isFirst,
          i,
          totalVisiblePages,
          projectTitle,
          options,
          addPagination,
          themeName
        );
      }
      const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe(lang) : "";
      const searchBoxHtml = addSearchBox ? this.renderSearchBox() : "";
      const searchDataScript = addSearchBox ? this.generateSearchDataScript(searchDataJson) : "";
      const _firstPage = visiblePages[0];
      const firstPageIndex = 0;
      const initialPageCounterHtml = addPagination ? `<p class="page-counter"> <span class="page-counter-label">P\xE1gina </span><span class="page-counter-content"> <strong class="page-counter-current-page">${firstPageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalVisiblePages}</strong></span></p>` : "";
      const projectSubtitle = meta.subtitle || "";
      const subtitleHtml = projectSubtitle ? `
<p class="package-subtitle">${this.escapeHtml(projectSubtitle)}</p>` : "";
      const staticHeaderHtml = `${initialPageCounterHtml}<header class="main-header">
<div class="package-header package-node"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>${subtitleHtml}</div>
<div class="page-header" style="display:none"><h2 id="page-title" class="page-title"></h2></div>
</header>`;
      const bodyContent = `<div class="exe-content exe-export pre-js">
${this.renderSpaNavigation(pages)}
<main class="page">
${searchBoxHtml}
${staticHeaderHtml}
${pagesHtml}
</main>
${this.renderNavButtons(lang)}
${this.renderFooterSection({ license, userFooterContent })}
</div>
${madeWithExeHtml}`;
      let finalBodyContent = bodyContent;
      let latexWasRendered = false;
      let mermaidWasRendered = false;
      if (!meta.addMathJax) {
        if (options.preRenderDataGameLatex) {
          try {
            const result = await options.preRenderDataGameLatex(bodyContent);
            if (result.count > 0) {
              finalBodyContent = result.html;
              latexWasRendered = true;
              console.log(`[Preview] Pre-rendered LaTeX in ${result.count} DataGame(s)`);
            }
          } catch (error) {
            console.warn("[Preview] DataGame LaTeX pre-render failed:", error);
          }
        }
        if (options.preRenderLatex) {
          try {
            const result = await options.preRenderLatex(finalBodyContent);
            if (result.latexRendered) {
              finalBodyContent = result.html;
              latexWasRendered = true;
              console.log(`[Preview] Pre-rendered ${result.count} LaTeX expressions to SVG+MathML`);
            }
          } catch (error) {
            console.warn("[Preview] LaTeX pre-render failed, falling back to MathJax:", error);
          }
        }
      }
      if (options.preRenderMermaid) {
        try {
          const result = await options.preRenderMermaid(finalBodyContent);
          if (result.mermaidRendered) {
            finalBodyContent = result.html;
            mermaidWasRendered = true;
            console.log(`[Preview] Pre-rendered ${result.count} Mermaid diagram(s) to SVG`);
          }
        } catch (error) {
          console.warn("[Preview] Mermaid pre-render failed, falling back to Mermaid library:", error);
        }
      }
      const libraryDetector = new LibraryDetector();
      const detectedLibraries = libraryDetector.detectLibraries(finalBodyContent, {
        includeAccessibilityToolbar: addAccessibilityToolbar,
        includeMathJax: meta.addMathJax === true,
        skipMathJax: latexWasRendered && !meta.addMathJax,
        skipMermaid: mermaidWasRendered
      });
      const elpxDownloadScript = needsElpxDownload ? this.generatePreviewDownloadScript() : "";
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar, detectedLibraries)}
</head>
<body class="exe-web-site exe-preview" lang="${lang}">
<script>document.body.className+=" js"<\/script>
${finalBodyContent}
${searchDataScript}
${elpxDownloadScript}
${this.generateWebsitePreviewScripts(themeName, usedIdevices, options, needsElpxDownload, addAccessibilityToolbar, detectedLibraries)}
</body>
</html>`;
    }
    /**
     * Generate <head> content with versioned server paths
     */
    generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar = false, detectedLibraries = {
      libraries: [],
      files: [],
      count: 0
    }) {
      const bootstrapCss = this.getVersionedPath("/libs/bootstrap/bootstrap.min.css", options);
      const themeBasePath = options.themeUrl ? options.themeUrl.replace(/\/$/, "") : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
      const themeCss = `${themeBasePath}/style.css`;
      const fallbackCss = this.getVersionedPath("/style/content.css", options);
      const jqueryUiRequiredTypes = /* @__PURE__ */ new Set([
        "ordena",
        "sort",
        "clasifica",
        "classify",
        "relaciona",
        "relate",
        "dragdrop",
        "complete",
        "completa"
      ]);
      let needsJqueryUiCss = false;
      for (const idevice of usedIdevices) {
        const typeName = idevice.toLowerCase().replace(/idevice$/i, "").replace(/-idevice$/i, "");
        if (jqueryUiRequiredTypes.has(typeName)) {
          needsJqueryUiCss = true;
          break;
        }
      }
      let jqueryUiCssLink = "";
      if (needsJqueryUiCss) {
        const jqueryUiCss = this.getVersionedPath("/libs/jquery-ui/jquery-ui.min.css", options);
        jqueryUiCssLink = `
<link rel="stylesheet" href="${jqueryUiCss}">`;
      }
      let detectedLibraryCss = "";
      for (const file of detectedLibraries.files) {
        if (file.endsWith(".css")) {
          const serverPath = this.getLibraryServerPath(file, options);
          detectedLibraryCss += `
<link rel="stylesheet" href="${serverPath}" onerror="this.remove()">`;
        }
      }
      let themeCssSection;
      if (options.userThemeCss) {
        themeCssSection = `<!-- User theme CSS (inline) -->
<style>
${options.userThemeCss}
</style>`;
      } else {
        themeCssSection = `<!-- Theme from server (loads AFTER fallback, so theme wins) -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">`;
      }
      let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Preview</title>
<script>document.querySelector("html").classList.add("js");<\/script>
<script>
// jQuery shim - captures $(fn) calls from legacy inline scripts until jQuery loads
(function() {
    var queue = [];
    var jQueryReady = function(fn) {
        if (typeof fn === 'function') queue.push(fn);
        return jQueryReady;
    };
    window.$ = window.jQuery = jQueryReady;
    window.__jQueryShimQueue = queue;
})();
<\/script>

<!-- Server-hosted libraries (versioned paths) -->
<link rel="stylesheet" href="${bootstrapCss}">${jqueryUiCssLink}${detectedLibraryCss}

<!-- Preview-only CSS for SPA behavior -->
<style>
${this.getWebsitePreviewCss()}
</style>

${themeCssSection}`;
      const seen = /* @__PURE__ */ new Set();
      for (const idevice of usedIdevices) {
        const typeName = normalizeIdeviceType(idevice);
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const cssFiles = getIdeviceExportFiles(typeName, ".css");
          for (const cssFile of cssFiles) {
            const ideviceCss = this.getVersionedPath(
              `/files/perm/idevices/base/${typeName}/export/${cssFile}`,
              options
            );
            head += `
<link rel="stylesheet" href="${ideviceCss}" onerror="this.remove()">`;
          }
        }
      }
      if (customStyles) {
        head += `
<style>
${customStyles}
</style>`;
      }
      if (addAccessibilityToolbar) {
        const atoolsCss = this.getVersionedPath("/libs/exe_atools/exe_atools.css", options);
        head += `
<link rel="stylesheet" href="${atoolsCss}">`;
      }
      head += `
<style>
${this.getMadeWithExeCss(options)}
</style>`;
      return head;
    }
    /**
     * Get preview-only CSS for SPA behavior and critical theme fallbacks
     */
    getWebsitePreviewCss() {
      return `/* SPA Preview Styles */
.spa-page { display: none; }
.spa-page.active { display: block; }

/* JavaScript on/off visibility (feedback toggle support) */
.js-hidden { display: none; }
.exe-hidden, .js-required, .js .js-hidden, .exe-mindmap-code { display: none; }
.js .js-required { display: block; }

/* Teacher mode - hide teacher-only content by default */
html:not(.mode-teacher) .js .teacher-only {
    display: none !important;
}

/* Block minimized - hide content */
.exe-export article.minimized .box-content {
    display: none;
}

/* Block novisible - hide entire block */
.exe-export article.novisible.box {
    display: none !important;
}

/* iDevice novisible - hide iDevice within block */
.exe-export article.box .idevice_node.novisible {
    display: none !important;
}

/* Navigation link fixes (theme fallback) */
#siteNav a {
    text-decoration: none;
}

/* Navigation: Expand active sections and parent paths */
#siteNav .other-section {
    display: none;
}
#siteNav li.active > .other-section,
#siteNav li.current-page-parent > .other-section {
    display: block;
}

/* Button text hiding - visually hidden but accessible */
/* Note: .nav-button span text is now visible to match export output */
button.toggler span,
#exe-client-search-reset span {
    position: absolute;
    clip: rect(1px, 1px, 1px, 1px);
    clip-path: inset(50%);
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;
}

/* Search form flex layout */
#exe-client-search-form p {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
}

/* Nav buttons positioning (theme fallback) */
.nav-buttons { display: flex; justify-content: space-between; padding: 1rem; }
.nav-button { cursor: pointer; }
.nav-button.disabled { opacity: 0.5; pointer-events: none; }

/* Pre-rendered LaTeX (SVG+MathML) - when MathJax is not included */
.exe-math-rendered { display: inline-block; vertical-align: middle; }
.exe-math-rendered[data-display="block"] { display: block; text-align: center; margin: 1em 0; }
.exe-math-rendered svg { vertical-align: middle; max-width: 100%; height: auto; }
/* Fix for MathJax array/table borders - SVG has stroke-width:0 which hides lines */
.exe-math-rendered svg line.mjx-solid { stroke-width: 60 !important; }
.exe-math-rendered svg rect[data-frame="true"] { fill: none; stroke-width: 60 !important; }
/* Hide MathML visually but keep accessible for screen readers */
.exe-math-rendered math { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* Pre-rendered Mermaid (static SVG) - when Mermaid library is not included */
.exe-mermaid-rendered { display: block; text-align: center; margin: 1.5em 0; }
.exe-mermaid-rendered svg { max-width: 100%; height: auto; }`;
    }
    /**
     * Get Made-with-eXe CSS (loaded AFTER theme to ensure it overrides)
     */
    getMadeWithExeCss(options) {
      const logoUrl = this.getVersionedPath("/app/common/exe_powered_logo/exe_powered_logo.png", options);
      return `/* Made with eXeLearning - Must load after theme */
#made-with-eXe {
    margin: 0;
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 9999;
}
#made-with-eXe a {
    text-decoration: none;
    box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
    border-top-left-radius: 4px;
    color: #222;
    font-size: 11px;
    font-family: Arial, sans-serif;
    line-height: 35px;
    width: 35px;
    height: 35px;
    background: #fff url(${logoUrl}) no-repeat 3px 50%;
    display: block;
    background-size: auto 20px;
    transition: .5s;
    opacity: .8;
    overflow: hidden;
}
#made-with-eXe span {
    padding-left: 35px;
    padding-right: 5px;
    white-space: nowrap;
}
#made-with-eXe a:hover {
    width: auto;
    padding: 0 5px;
    background-position: 5px 50%;
    opacity: 1;
}
@media print {
    #made-with-eXe { display: none; }
}

`;
    }
    /**
     * Render SPA navigation with JavaScript page switching
     */
    renderSpaNavigation(pages) {
      const rootPages = pages.filter((p) => !p.parentId);
      let html = '<nav id="siteNav">\n<ul>\n';
      for (const page of rootPages) {
        html += this.renderSpaNavItem(page, pages, pages[0]?.id);
      }
      html += "</ul>\n</nav>";
      return html;
    }
    /**
     * Check if a page is visible in export
     * First page is always visible regardless of visibility setting.
     * If a parent is hidden, all its children are also hidden.
     */
    isPageVisible(page, allPages) {
      if (page.id === allPages[0]?.id) {
        return true;
      }
      const visibility = page.properties?.visibility;
      if (visibility === false || visibility === "false") {
        return false;
      }
      if (page.parentId) {
        const parent = allPages.find((p) => p.id === page.parentId);
        if (parent && !this.isPageVisible(parent, allPages)) {
          return false;
        }
      }
      return true;
    }
    /**
     * Check if a page has highlight property enabled
     */
    isPageHighlighted(page) {
      const highlight = page.properties?.highlight;
      return highlight === true || highlight === "true";
    }
    /**
     * Check if a page's title should be hidden
     */
    shouldHidePageTitle(page) {
      const hideTitle = page.properties?.hidePageTitle;
      return hideTitle === true || hideTitle === "true";
    }
    /**
     * Get effective page title (respects editableInPage + titlePage properties)
     * If editableInPage is true and titlePage is set, use titlePage
     * Otherwise use the default page title
     */
    getEffectivePageTitle(page) {
      const editableInPage = page.properties?.editableInPage;
      if (editableInPage === true || editableInPage === "true") {
        const titlePage = page.properties?.titlePage;
        if (titlePage) return titlePage;
      }
      return page.title;
    }
    /**
     * Render a navigation item for SPA
     */
    renderSpaNavItem(page, allPages, currentPageId) {
      if (!this.isPageVisible(page, allPages)) {
        return "";
      }
      const children = allPages.filter((p) => p.parentId === page.id && this.isPageVisible(p, allPages));
      const hasChildren = children.length > 0;
      const isActive = page.id === currentPageId;
      const isFirstPage = page.id === allPages[0]?.id;
      const linkClasses = [];
      if (isActive) linkClasses.push("active");
      if (isFirstPage) linkClasses.push("main-node");
      linkClasses.push(hasChildren ? "daddy" : "no-ch");
      if (this.isPageHighlighted(page)) {
        linkClasses.push("highlighted-link");
      }
      let html = `<li${isActive ? ' id="active" class="active"' : ""}>`;
      const parentAttr = page.parentId ? ` data-parent-id="${page.parentId}"` : "";
      html += ` <a href="#" data-page-id="${page.id}"${parentAttr} class="${linkClasses.join(" ")}">${this.escapeHtml(page.title)}</a>
`;
      if (hasChildren) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
          html += this.renderSpaNavItem(child, allPages, currentPageId);
        }
        html += "</ul>\n";
      }
      html += "</li>\n";
      return html;
    }
    /**
     * Render a page as an article (hidden except first)
     * Note: Header is rendered separately as direct child of .page for CSS selector compatibility
     */
    renderPageArticle(page, isFirst, pageIndex, _totalPages, _projectTitle, options, _addPagination = false, themeName = "base") {
      let blockHtml = "";
      const ideviceBasePath = this.getVersionedPath("/files/perm/idevices/base/", options);
      const themeBase = options.themeUrl ? options.themeUrl.replace(/\/$/, "") : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
      const themeIconBasePath = `${themeBase}/icons/`;
      for (const block of page.blocks || []) {
        blockHtml += this.ideviceRenderer.renderBlock(block, {
          basePath: ideviceBasePath,
          includeDataAttributes: true,
          themeIconBasePath
        });
      }
      const displayStyle = isFirst ? "" : ' style="display:none"';
      const pageId = page.id;
      const effectiveTitle = this.getEffectivePageTitle(page);
      const hideTitle = this.shouldHidePageTitle(page);
      const headerStyle = hideTitle ? ' style="display:none"' : "";
      const pageHeaderHtml = `<header class="page-header page-header-spa"${headerStyle}><h2 class="page-title">${this.escapeHtml(effectiveTitle)}</h2></header>`;
      return `<article id="page-${pageId}" class="spa-page${isFirst ? " active" : ""}"${displayStyle} data-page-index="${pageIndex}" data-page-title="${this.escapeAttr(effectiveTitle)}" data-page-hide-title="${hideTitle}">
<div id="page-content-${pageId}" class="page-content">
${pageHeaderHtml}
${blockHtml}
</div>
</article>
`;
    }
    /**
     * Render navigation buttons (Previous/Next) with translated text
     * @param language - Language for button text translation
     */
    renderNavButtons(language = "en") {
      const t = _WebsitePreviewExporter.NAV_TRANSLATIONS[language] || _WebsitePreviewExporter.NAV_TRANSLATIONS.en;
      return `<div class="nav-buttons">
<a href="#" title="${t.previous}" class="nav-button nav-button-left" data-nav="prev">
<span>${t.previous}</span>
</a>
<a href="#" title="${t.next}" class="nav-button nav-button-right" data-nav="next">
<span>${t.next}</span>
</a>
</div>`;
    }
    /**
     * Render footer section with license and optional user footer content
     * Matches the structure from PageRenderer.renderFooterSection()
     */
    renderFooterSection(options) {
      const { license, licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/", userFooterContent } = options;
      let userFooterHtml = "";
      if (userFooterContent) {
        userFooterHtml = `<div id="siteUserFooter"> <div>${userFooterContent}</div>
</div>`;
      }
      return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${this.escapeHtml(license)}</a></p>
</div>
${userFooterHtml}</div></footer>`;
    }
    static {
      /**
       * Navigation button translations by language
       */
      this.NAV_TRANSLATIONS = {
        es: { previous: "Anterior", next: "Siguiente" },
        en: { previous: "Previous", next: "Next" },
        ca: { previous: "Anterior", next: "Seg\xFCent" },
        eu: { previous: "Aurrekoa", next: "Hurrengoa" },
        gl: { previous: "Anterior", next: "Seguinte" },
        pt: { previous: "Anterior", next: "Pr\xF3ximo" },
        fr: { previous: "Pr\xE9c\xE9dent", next: "Suivant" },
        de: { previous: "Zur\xFCck", next: "Weiter" },
        it: { previous: "Precedente", next: "Successivo" },
        nl: { previous: "Vorige", next: "Volgende" },
        zh: { previous: "\u4E0A\u4E00\u9875", next: "\u4E0B\u4E00\u9875" },
        ja: { previous: "\u524D\u3078", next: "\u6B21\u3078" },
        ar: { previous: "\u0627\u0644\u0633\u0627\u0628\u0642", next: "\u0627\u0644\u062A\u0627\u0644\u064A" }
      };
    }
    static {
      /**
       * Translations for "Made with eXeLearning" text
       */
      this.MADE_WITH_TRANSLATIONS = {
        en: "Made with eXeLearning",
        es: "Creado con eXeLearning",
        ca: "Creat amb eXeLearning",
        eu: "eXeLearning-ekin egina",
        gl: "Creado con eXeLearning",
        pt: "Criado com eXeLearning",
        va: "Creat amb eXeLearning",
        ro: "Creat cu eXeLearning",
        eo: "Kreita per eXeLearning"
      };
    }
    /**
     * Render "Made with eXeLearning" credit with translated text
     * The text is hidden by default and shown on hover via CSS
     */
    renderMadeWithEXe(lang) {
      const text = _WebsitePreviewExporter.MADE_WITH_TRANSLATIONS[lang] || _WebsitePreviewExporter.MADE_WITH_TRANSLATIONS["en"];
      return `<p id="made-with-eXe"><a href="https://exelearning.net/" target="_blank" rel="noopener"><span>${this.escapeHtml(text)} </span></a></p>`;
    }
    /**
     * Generate scripts with SPA navigation logic
     */
    generateWebsitePreviewScripts(themeName, usedIdevices, options, needsElpxDownload = false, addAccessibilityToolbar = false, detectedLibraries = {
      libraries: [],
      files: [],
      count: 0
    }) {
      const jqueryJs = this.getVersionedPath("/libs/jquery/jquery.min.js", options);
      const bootstrapJs = this.getVersionedPath("/libs/bootstrap/bootstrap.bundle.min.js", options);
      const commonJs = this.getVersionedPath("/app/common/common.js", options);
      const commonI18nJs = this.getVersionedPath("/app/common/common_i18n.js", options);
      const exeExportJs = this.getVersionedPath("/app/common/exe_export.js", options);
      const themeBasePath = options.themeUrl ? options.themeUrl.replace(/\/$/, "") : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
      const themeJs = `${themeBasePath}/style.js`;
      const jqueryUiRequiredTypes = /* @__PURE__ */ new Set([
        "ordena",
        "sort",
        "clasifica",
        "classify",
        "relaciona",
        "relate",
        "dragdrop",
        "complete",
        "completa"
      ]);
      let needsJqueryUi = false;
      for (const idevice of usedIdevices) {
        const typeName = idevice.toLowerCase().replace(/idevice$/i, "").replace(/-idevice$/i, "");
        if (jqueryUiRequiredTypes.has(typeName)) {
          needsJqueryUi = true;
          break;
        }
      }
      let jqueryUiScript = "";
      if (needsJqueryUi) {
        const jqueryUiJs = this.getVersionedPath("/libs/jquery-ui/jquery-ui.min.js", options);
        jqueryUiScript = `
<script src="${jqueryUiJs}"><\/script>`;
      }
      const elpxDownloadScripts = "";
      const needsMathJax = detectedLibraries.libraries.some(
        (lib) => lib.name === "exe_math" || lib.name === "exe_math_datagame"
      );
      let mathJaxScripts = "";
      if (needsMathJax) {
        const mathJaxJs = this.getVersionedPath("/app/common/exe_math/tex-mml-svg.js", options);
        mathJaxScripts = `
<script>
window.MathJax = {
    startup: {
        typeset: false,  // Disable auto-typeset on page load
        pageReady: function() {
            // Only typeset the active SPA page (prevents replaceChild errors on hidden pages)
            var activePage = document.querySelector('.spa-page.active');
            if (activePage) {
                return MathJax.typesetPromise([activePage]).catch(function(err) {
                    console.warn('[MathJax] Typeset error:', err.message);
                });
            }
            return Promise.resolve();
        }
    }
};
<\/script>
<script src="${mathJaxJs}"><\/script>`;
      }
      let detectedLibraryScripts = "";
      for (const file of detectedLibraries.files) {
        if (file.endsWith(".js")) {
          if (needsElpxDownload && (file.includes("exe_elpx_download") || file.includes("fflate"))) {
            continue;
          }
          const serverPath = this.getLibraryServerPath(file, options);
          detectedLibraryScripts += `
<script src="${serverPath}" onerror="this.remove()"><\/script>`;
        }
      }
      let ideviceScripts = "";
      const seenJs = /* @__PURE__ */ new Set();
      for (const idevice of usedIdevices) {
        const typeName = normalizeIdeviceType(idevice);
        if (!seenJs.has(typeName)) {
          seenJs.add(typeName);
          const jsFiles = getIdeviceExportFiles(typeName, ".js");
          for (const jsFile of jsFiles) {
            const ideviceJs = this.getVersionedPath(
              `/files/perm/idevices/base/${typeName}/export/${jsFile}`,
              options
            );
            ideviceScripts += `
<script src="${ideviceJs}" onerror="this.remove()"><\/script>`;
          }
        }
      }
      let atoolsScript = "";
      if (addAccessibilityToolbar) {
        const atoolsJs = this.getVersionedPath("/libs/exe_atools/exe_atools.js", options);
        atoolsScript = `
<script src="${atoolsJs}"><\/script>`;
      }
      let themeJsSection;
      if (options.userThemeJs) {
        themeJsSection = `<!-- User theme JS (inline) -->
<script>
${options.userThemeJs}
<\/script>`;
      } else {
        themeJsSection = `<script src="${themeJs}" onerror="this.remove()"><\/script>`;
      }
      return `<script src="${jqueryJs}"><\/script>
<script>
// Execute queued callbacks from jQuery shim (legacy inline scripts)
if (window.__jQueryShimQueue) {
    window.__jQueryShimQueue.forEach(function(fn) { $(fn); });
    delete window.__jQueryShimQueue;
}
<\/script>
<script src="${bootstrapJs}"><\/script>${jqueryUiScript}${elpxDownloadScripts}
<script src="${commonJs}"><\/script>
<script src="${commonI18nJs}"><\/script>
<script src="${exeExportJs}"><\/script>${mathJaxScripts}${detectedLibraryScripts}${ideviceScripts}${atoolsScript}
${themeJsSection}
<script>
// Polyfill for confirm/alert/prompt in sandboxed iframes (preview mode)
// These are blocked by default in blob: URLs, so we provide custom implementations
(function() {
    if (typeof window.confirm === 'undefined' || window.confirm.toString().includes('native code')) {
        var originalConfirm = window.confirm;
        window.confirm = function(message) {
            try {
                return originalConfirm.call(window, message);
            } catch (e) {
                // Sandboxed - show Bootstrap modal if available, otherwise return true
                if (typeof $ !== 'undefined' && $.fn.modal) {
                    return new Promise(function(resolve) {
                        var modalId = 'exeConfirmModal';
                        var $modal = $('#' + modalId);
                        if (!$modal.length) {
                            $modal = $('<div class="modal fade" id="' + modalId + '" tabindex="-1">' +
                                '<div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
                                '<div class="modal-body text-center py-4"></div>' +
                                '<div class="modal-footer justify-content-center">' +
                                '<button type="button" class="btn btn-secondary" data-result="false">Cancelar</button>' +
                                '<button type="button" class="btn btn-primary" data-result="true">Aceptar</button>' +
                                '</div></div></div></div>');
                            $('body').append($modal);
                        }
                        $modal.find('.modal-body').text(message);
                        $modal.find('button').off('click').on('click', function() {
                            var result = $(this).data('result');
                            $modal.modal('hide');
                            resolve(result);
                        });
                        $modal.modal('show');
                    });
                }
                // Fallback: just return true in preview mode
                console.log('[Preview] confirm() blocked by sandbox, returning true:', message);
                return true;
            }
        };
    }
    if (typeof window.alert === 'undefined' || window.alert.toString().includes('native code')) {
        var originalAlert = window.alert;
        window.alert = function(message) {
            try {
                return originalAlert.call(window, message);
            } catch (e) {
                console.log('[Preview] alert():', message);
            }
        };
    }
})();

${this.getSpaNavigationScript()}
${this.getYouTubePreviewTransformScript(options)}
// Initialize iDevices after DOM is ready
if (typeof $exeExport !== 'undefined' && $exeExport.init) {
    $exeExport.init();
}
<\/script>`;
    }
    /**
     * Get SPA navigation JavaScript
     */
    getSpaNavigationScript() {
      return `// SPA Navigation
(function() {
  var pages = document.querySelectorAll('.spa-page');
  var navLinks = document.querySelectorAll('[data-page-id]');
  var prevBtn = document.querySelector('[data-nav="prev"]');
  var nextBtn = document.querySelector('[data-nav="next"]');
  var pageCounterEl = document.querySelector('.page-counter-current-page');
  var currentIndex = 0;

  function showPage(index) {
    if (index < 0 || index >= pages.length) return;
    currentIndex = index;
    var activePage = pages[index];
    pages.forEach(function(p, i) {
      p.style.display = i === index ? 'block' : 'none';
      p.classList.toggle('active', i === index);
    });
    // Build parentId map for ancestor tracking
    var parentMap = {};
    navLinks.forEach(function(link) {
      var pageId = link.getAttribute('data-page-id');
      var parentId = link.getAttribute('data-parent-id');
      if (pageId) parentMap[pageId] = parentId;
    });

    // Find ancestors of current page
    var currentPageId = activePage.id.replace('page-', '');
    var ancestors = {};
    var pid = parentMap[currentPageId];
    while (pid) {
      ancestors[pid] = true;
      pid = parentMap[pid];
    }

    // Update nav classes including ancestor expansion
    navLinks.forEach(function(link) {
      var pageId = link.getAttribute('data-page-id');
      var isActive = currentPageId === pageId;
      var isAncestor = ancestors[pageId] === true;
      link.classList.toggle('active', isActive);
      if (link.parentElement) {
        link.parentElement.classList.toggle('active', isActive);
        link.parentElement.classList.toggle('current-page-parent', isAncestor);
      }
    });
    // Page header is inside each article (page-header-spa class)
    if (pageCounterEl) {
      pageCounterEl.textContent = (index + 1).toString();
    }
    updateNavButtons();
    // Typeset MathJax on the active page if MathJax is loaded
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
      MathJax.typesetPromise([activePage]).catch(function(e) {
        console.warn('[MathJax] Typeset error:', e.message);
      });
    }
  }

  function updateNavButtons() {
    if (prevBtn) prevBtn.classList.toggle('disabled', currentIndex === 0);
    if (nextBtn) nextBtn.classList.toggle('disabled', currentIndex === pages.length - 1);
  }

  navLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var pageId = this.getAttribute('data-page-id');
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === 'page-' + pageId) {
          showPage(i);
          break;
        }
      }
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(currentIndex - 1);
  });

  if (nextBtn) nextBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(currentIndex + 1);
  });

  // Handle hash changes for search result navigation
  function showPageByHash() {
    var hash = window.location.hash;
    if (hash && hash.startsWith('#page-')) {
      var targetId = hash.substring(1); // Remove the #
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === targetId) {
          showPage(i);
          return;
        }
      }
    }
  }

  // Listen for hash changes
  window.addEventListener('hashchange', showPageByHash);

  // Check initial hash on load
  showPageByHash();

  // Enable internal links (exe-node:pageId format)
  // These are links created in the TinyMCE editor that point to other pages
  function enableInternalLinks() {
    var internalLinks = document.querySelectorAll('a[href^="exe-node:"]');
    internalLinks.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      // Extract page ID: exe-node:page-abc123 -> page-abc123
      var pageId = href.replace('exe-node:', '');

      // Find the page index
      var targetIndex = -1;
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === 'page-' + pageId) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex >= 0) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          showPage(targetIndex);
        });
        // Update href for accessibility (shows target in status bar)
        link.setAttribute('href', '#page-' + pageId);
      }
    });
  }

  // Enable internal links after initial render
  enableInternalLinks();

  // MathJax typesets each page when it becomes active (if MathJax is loaded)
  updateNavButtons();
})();`;
    }
    /**
     * Get YouTube preview transform script
     *
     * YOUTUBE EMBEDDING RESTRICTION:
     * YouTube's IFrame Player API requires a valid HTTP/HTTPS origin to function.
     * The preview panel loads content via blob: URLs (e.g., blob:http://localhost:8080/...),
     * which have a null origin that YouTube rejects with "Error 153".
     *
     * SOLUTION:
     * This script detects when running in a blob:/file: context and automatically
     * transforms all YouTube iframe src attributes to point to our HTTP wrapper
     * (youtube-preview.html). The wrapper is served from a valid HTTP origin,
     * so YouTube embeds work correctly inside it.
     *
     * TRANSFORM FLOW:
     * 1. Script detects blob: context
     * 2. Extracts the real HTTP origin from the blob URL
     * 3. Finds all YouTube iframes in the document
     * 4. Replaces their src with: {httpOrigin}/app/common/youtube-preview.html?v={videoId}
     * 5. MutationObserver watches for dynamically added iframes
     *
     * This script only runs in preview mode (blob:/file: contexts).
     * In normal HTTP exports, YouTube embeds work without transformation.
     *
     * @see public/app/common/youtube-preview.html - The HTTP wrapper that loads YouTube
     */
    getYouTubePreviewTransformScript(options) {
      const basePath = options.basePath || "";
      return `// YouTube Preview Transform (for blob:/file: contexts)
(function() {
    'use strict';

    // Only run in blob: or file: contexts where YouTube embeds fail
    var href = window.location.href;
    var isBlob = href.startsWith('blob:');
    var isFile = window.location.protocol === 'file:';

    if (!isBlob && !isFile) {
        return; // Normal HTTP context, YouTube works fine
    }

    // Extract HTTP origin from blob URL
    var httpOrigin = '';
    if (isBlob) {
        var match = href.match(/^blob:(https?:\\/\\/[^/]+)/);
        if (match) httpOrigin = match[1];
    }

    if (!httpOrigin) {
        console.warn('[YouTube Preview] Cannot determine HTTP origin for wrapper');
        return;
    }

    var basePath = '${basePath}';
    var wrapperBase = httpOrigin + basePath + '/app/common/youtube-preview.html';

    // YouTube URL patterns to extract video ID
    var youtubePatterns = [
        /(?:youtube\\.com\\/embed\\/|youtube-nocookie\\.com\\/embed\\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/
    ];

    function extractVideoId(src) {
        if (!src) return null;
        for (var i = 0; i < youtubePatterns.length; i++) {
            var match = src.match(youtubePatterns[i]);
            if (match) return match[1];
        }
        return null;
    }

    function extractParams(src) {
        var params = {};
        try {
            // Handle protocol-relative URLs
            var fullUrl = src;
            if (src.startsWith('//')) fullUrl = 'https:' + src;
            var url = new URL(fullUrl);
            url.searchParams.forEach(function(value, key) {
                params[key] = value;
            });
        } catch (e) {
            // Try to extract from query string manually
            var qIdx = src.indexOf('?');
            if (qIdx !== -1) {
                var qs = src.substring(qIdx + 1);
                qs.split('&').forEach(function(part) {
                    var kv = part.split('=');
                    if (kv.length === 2) params[kv[0]] = kv[1];
                });
            }
        }
        return params;
    }

    function transformYouTubeIframe(iframe) {
        var src = iframe.getAttribute('src') || '';
        var videoId = extractVideoId(src);

        if (!videoId) return false;

        // Check if already transformed
        if (iframe.dataset.youtubeTransformed === 'true') return false;

        // Build wrapper URL preserving original parameters
        var params = extractParams(src);
        var wrapperUrl = wrapperBase + '?v=' + videoId;

        // Pass through relevant YouTube parameters
        var passParams = ['autoplay', 'start', 'end', 'mute', 'loop', 'controls', 'cc_load_policy'];
        passParams.forEach(function(p) {
            if (params[p] !== undefined) wrapperUrl += '&' + p + '=' + params[p];
        });

        // Preserve iframe dimensions
        var width = iframe.getAttribute('width');
        var height = iframe.getAttribute('height');
        if (width) wrapperUrl += '&w=' + width;
        if (height) wrapperUrl += '&h=' + height;

        // Transform the iframe
        iframe.dataset.originalSrc = src;
        iframe.dataset.youtubeTransformed = 'true';
        iframe.src = wrapperUrl;

        console.log('[YouTube Preview] Transformed embed:', videoId);
        return true;
    }

    function isYouTubeIframe(iframe) {
        var src = iframe.getAttribute('src') || '';
        return src.includes('youtube.com') ||
               src.includes('youtube-nocookie.com') ||
               src.includes('youtu.be');
    }

    function transformAllYouTubeIframes() {
        var iframes = document.querySelectorAll('iframe');
        var count = 0;
        iframes.forEach(function(iframe) {
            if (isYouTubeIframe(iframe) && transformYouTubeIframe(iframe)) {
                count++;
            }
        });
        if (count > 0) {
            console.log('[YouTube Preview] Transformed ' + count + ' YouTube embed(s)');
        }
    }

    // Transform existing iframes
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', transformAllYouTubeIframes);
    } else {
        transformAllYouTubeIframes();
    }

    // Watch for dynamically added iframes (some iDevices add content after load)
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType !== 1) return; // Not an element

                // Check if the added node is an iframe
                if (node.tagName === 'IFRAME' && isYouTubeIframe(node)) {
                    transformYouTubeIframe(node);
                }

                // Check children of added node
                if (node.querySelectorAll) {
                    var childIframes = node.querySelectorAll('iframe');
                    childIframes.forEach(function(iframe) {
                        if (isYouTubeIframe(iframe)) {
                            transformYouTubeIframe(iframe);
                        }
                    });
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();`;
    }
    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
      const escapes = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return text.replace(/[&<>"']/g, (char) => escapes[char] || char);
    }
    /**
     * Escape string for use in HTML attributes
     */
    escapeAttr(text) {
      return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    /**
     * Render search box container (without data-pages attribute)
     * The data is provided via window.exeSearchData inline script
     * The form is created dynamically by exe_export.js
     */
    renderSearchBox() {
      return `<div id="exe-client-search"
    data-block-order-string="Caja %e"
    data-no-results-string="Sin resultados.">
</div>`;
    }
    /**
     * Generate inline script for search data
     * This avoids bloating each page with large JSON in attributes
     */
    generateSearchDataScript(searchDataJson) {
      const safeJson = searchDataJson.replace(/<\//g, "<\\/");
      return `<script>window.exeSearchData = ${safeJson};<\/script>`;
    }
    /**
     * Generate search data JSON for client-side search functionality
     * For SPA preview, uses anchor links (#page-{id}) instead of file URLs
     * @param pages - All pages in the project
     * @param options - Preview options for URL generation
     * @returns JSON string with page structure
     */
    generateSearchData(pages, _options) {
      const pagesData = {};
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const isIndex = i === 0;
        const prevPage = i > 0 ? pages[i - 1] : null;
        const nextPage = i < pages.length - 1 ? pages[i + 1] : null;
        const fileName = `#page-${page.id}`;
        const fileUrl = `#page-${page.id}`;
        const blocksData = {};
        for (const block of page.blocks || []) {
          const idevicesData = {};
          for (let j = 0; j < (block.components || []).length; j++) {
            const component = block.components[j];
            idevicesData[component.id] = {
              order: j + 1,
              htmlView: component.content || "",
              jsonProperties: JSON.stringify(component.properties || {})
            };
          }
          blocksData[block.id] = {
            name: block.name || "",
            order: block.order || 1,
            idevices: idevicesData
          };
        }
        pagesData[page.id] = {
          name: page.title,
          isIndex,
          fileName,
          fileUrl,
          prePageId: prevPage?.id || null,
          nextPageId: nextPage?.id || null,
          blocks: blocksData
        };
      }
      return JSON.stringify(pagesData);
    }
    /**
     * Generate inline script for preview that uses postMessage to request ELPX download
     * This is simpler than embedding the full manifest with contentXml
     */
    generatePreviewDownloadScript() {
      return `<script>
// Preview mode: request ELPX download from parent app via postMessage
window.downloadElpx = function(options) {
    options = options || {};
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'exe-download-elpx',
            filename: options.filename
        }, '*');
    } else {
        alert('Download is only available when viewing from the eXeLearning editor.');
    }
};
<\/script>`;
    }
  };

  // src/shared/export/exporters/PrintPreviewExporter.ts
  var PrintPreviewExporter = class _PrintPreviewExporter {
    /**
     * Create a PrintPreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     */
    constructor(document2, resourceProvider) {
      this.document = document2;
      this.ideviceRenderer = new IdeviceRenderer(resourceProvider);
    }
    /**
     * Generate print preview HTML
     * @param options - Preview options
     * @returns Preview result with HTML string
     */
    async generatePreview(options = {}) {
      try {
        const pages = this.document.getNavigation();
        const meta = this.document.getMetadata();
        if (pages.length === 0) {
          return { success: false, error: "No pages to preview" };
        }
        const usedIdevices = this.getUsedIdevices(pages);
        const html = await this.generateSinglePageHtml(pages, meta, usedIdevices, options);
        return { success: true, html };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }
    }
    /**
     * Get all unique iDevice types used in pages
     */
    getUsedIdevices(pages) {
      const types = /* @__PURE__ */ new Set();
      for (const page of pages) {
        for (const block of page.blocks) {
          for (const component of block.components) {
            if (component.type) {
              types.add(component.type);
            }
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get versioned asset path for server resources
     */
    getVersionedPath(path, options) {
      const baseUrl = options.baseUrl || "";
      const basePath = options.basePath || "";
      const version = options.version || "v1.0.0";
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      const cleanBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
      return `${baseUrl}${cleanBasePath}/${version}/${cleanPath}`;
    }
    static {
      /**
       * Libraries that are located in /libs/ instead of /app/common/
       */
      this.LIBS_FOLDER_LIBRARIES = /* @__PURE__ */ new Set(["jquery-ui", "fflate", "exe_atools", "exe_elpx_download"]);
    }
    /**
     * Get the correct server path for a detected library file
     */
    getLibraryServerPath(file, options) {
      const firstPart = file.split("/")[0];
      if (_PrintPreviewExporter.LIBS_FOLDER_LIBRARIES.has(firstPart) || _PrintPreviewExporter.LIBS_FOLDER_LIBRARIES.has(file)) {
        return this.getVersionedPath(`/libs/${file}`, options);
      }
      return this.getVersionedPath(`/app/common/${file}`, options);
    }
    /**
     * Check if a page is visible in export
     */
    isPageVisible(page, allPages) {
      if (page.id === allPages[0]?.id) {
        return true;
      }
      const visibility = page.properties?.visibility;
      if (visibility === false || visibility === "false") {
        return false;
      }
      if (page.parentId) {
        const parent = allPages.find((p) => p.id === page.parentId);
        if (parent && !this.isPageVisible(parent, allPages)) {
          return false;
        }
      }
      return true;
    }
    /**
     * Check if a page has highlight property enabled
     */
    isPageHighlighted(page) {
      const highlight = page.properties?.highlight;
      return highlight === true || highlight === "true";
    }
    /**
     * Check if a page's title should be hidden
     */
    shouldHidePageTitle(page) {
      const hideTitle = page.properties?.hidePageTitle;
      return hideTitle === true || hideTitle === "true";
    }
    /**
     * Get effective page title
     */
    getEffectivePageTitle(page) {
      const editableInPage = page.properties?.editableInPage;
      if (editableInPage === true || editableInPage === "true") {
        const titlePage = page.properties?.titlePage;
        if (titlePage) return titlePage;
      }
      return page.title;
    }
    /**
     * Generate complete single-page HTML for printing
     */
    async generateSinglePageHtml(pages, meta, usedIdevices, options) {
      const lang = meta.language || "en";
      const projectTitle = meta.title || "eXeLearning";
      const customStyles = meta.customStyles || "";
      const license = meta.license || "CC-BY-SA";
      const themeName = meta.theme || "base";
      const userFooterContent = meta.footer || "";
      const addExeLink = meta.addExeLink ?? true;
      const addAccessibilityToolbar = meta.addAccessibilityToolbar ?? false;
      const visiblePages = pages.filter((page) => this.isPageVisible(page, pages));
      let sectionsHtml = "";
      for (const page of visiblePages) {
        sectionsHtml += this.renderPageSection(page, options, themeName);
      }
      const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe(lang) : "";
      const bodyContent = `<div class="exe-content exe-export pre-js">
${this.renderSinglePageNav(pages)}
<main class="single-page-content">
<header class="package-header package-node"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1></header>
${sectionsHtml}
</main>
${this.renderFooterSection({ license, userFooterContent })}
</div>
${madeWithExeHtml}`;
      let finalBodyContent = bodyContent;
      let latexWasRendered = false;
      let mermaidWasRendered = false;
      if (!meta.addMathJax) {
        if (options.preRenderDataGameLatex) {
          try {
            const result = await options.preRenderDataGameLatex(bodyContent);
            if (result.count > 0) {
              finalBodyContent = result.html;
              latexWasRendered = true;
            }
          } catch (error) {
            console.warn("[PrintPreview] DataGame LaTeX pre-render failed:", error);
          }
        }
        if (options.preRenderLatex) {
          try {
            const result = await options.preRenderLatex(finalBodyContent);
            if (result.latexRendered) {
              finalBodyContent = result.html;
              latexWasRendered = true;
            }
          } catch (error) {
            console.warn("[PrintPreview] LaTeX pre-render failed:", error);
          }
        }
      }
      if (options.preRenderMermaid) {
        try {
          const result = await options.preRenderMermaid(finalBodyContent);
          if (result.mermaidRendered) {
            finalBodyContent = result.html;
            mermaidWasRendered = true;
            console.log(`[PrintPreview] Pre-rendered ${result.count} Mermaid diagram(s) to SVG`);
          }
        } catch (error) {
          console.warn("[PrintPreview] Mermaid pre-render failed:", error);
        }
      }
      const libraryDetector = new LibraryDetector();
      const detectedLibraries = libraryDetector.detectLibraries(finalBodyContent, {
        includeAccessibilityToolbar: addAccessibilityToolbar,
        includeMathJax: meta.addMathJax === true,
        skipMathJax: latexWasRendered && !meta.addMathJax,
        skipMermaid: mermaidWasRendered
      });
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generateHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar, detectedLibraries)}
</head>
<body class="exe-web-site exe-export exe-single-page exe-preview" lang="${lang}">
<script>document.body.className+=" js"<\/script>
${finalBodyContent}
${this.generateScripts(themeName, usedIdevices, options, addAccessibilityToolbar, detectedLibraries)}
</body>
</html>`;
    }
    /**
     * Render a page as a section (for single-page layout)
     */
    renderPageSection(page, options, themeName = "base") {
      const hideTitle = this.shouldHidePageTitle(page);
      const effectiveTitle = this.getEffectivePageTitle(page);
      const headerStyle = hideTitle ? ' style="display:none"' : "";
      const ideviceBasePath = this.getVersionedPath("/files/perm/idevices/base/", options);
      const themeBase = options.themeUrl ? options.themeUrl.replace(/\/$/, "") : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
      const themeIconBasePath = `${themeBase}/icons/`;
      let blockHtml = "";
      for (const block of page.blocks || []) {
        blockHtml += this.ideviceRenderer.renderBlock(block, {
          basePath: ideviceBasePath,
          includeDataAttributes: true,
          themeIconBasePath
        });
      }
      return `<section id="section-${page.id}" class="single-page-section">
<header class="page-header"${headerStyle}>
<h2 class="page-title">${this.escapeHtml(effectiveTitle)}</h2>
</header>
<div class="page-content">
${blockHtml}
</div>
</section>
`;
    }
    /**
     * Render navigation for single-page (anchor links)
     */
    renderSinglePageNav(pages) {
      const rootPages = pages.filter((p) => !p.parentId);
      let html = '<nav id="siteNav" class="single-page-nav">\n<ul>\n';
      for (const page of rootPages) {
        html += this.renderNavItem(page, pages);
      }
      html += "</ul>\n</nav>";
      return html;
    }
    /**
     * Render a navigation item for single-page (anchor links)
     */
    renderNavItem(page, allPages) {
      if (!this.isPageVisible(page, allPages)) {
        return "";
      }
      const children = allPages.filter((p) => p.parentId === page.id && this.isPageVisible(p, allPages));
      const hasChildren = children.length > 0;
      const linkClasses = [];
      linkClasses.push(hasChildren ? "daddy" : "no-ch");
      if (this.isPageHighlighted(page)) {
        linkClasses.push("highlighted-link");
      }
      let html = "<li>";
      html += ` <a href="#section-${page.id}" class="${linkClasses.join(" ")}">${this.escapeHtml(page.title)}</a>
`;
      if (hasChildren) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
          html += this.renderNavItem(child, allPages);
        }
        html += "</ul>\n";
      }
      html += "</li>\n";
      return html;
    }
    /**
     * Render footer section
     */
    renderFooterSection(options) {
      const { license, licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/", userFooterContent } = options;
      let userFooterHtml = "";
      if (userFooterContent) {
        userFooterHtml = `<div id="siteUserFooter"><div>${userFooterContent}</div></div>`;
      }
      return `<footer id="siteFooter"><div id="siteFooterContent"><div id="packageLicense" class="cc cc-by-sa"><p><span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${this.escapeHtml(license)}</a></p>
</div>
${userFooterHtml}</div></footer>`;
    }
    static {
      /**
       * Translations for "Made with eXeLearning" text
       */
      this.MADE_WITH_TRANSLATIONS = {
        en: "Made with eXeLearning",
        es: "Creado con eXeLearning",
        ca: "Creat amb eXeLearning",
        eu: "eXeLearning-ekin egina",
        gl: "Creado con eXeLearning",
        pt: "Criado com eXeLearning",
        va: "Creat amb eXeLearning",
        ro: "Creat cu eXeLearning",
        eo: "Kreita per eXeLearning"
      };
    }
    /**
     * Render "Made with eXeLearning" credit
     */
    renderMadeWithEXe(lang) {
      const text = _PrintPreviewExporter.MADE_WITH_TRANSLATIONS[lang] || _PrintPreviewExporter.MADE_WITH_TRANSLATIONS["en"];
      return `<p id="made-with-eXe"><a href="https://exelearning.net/" target="_blank" rel="noopener"><span>${this.escapeHtml(text)} </span></a></p>`;
    }
    /**
     * Generate <head> content
     */
    generateHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar = false, detectedLibraries = {
      libraries: [],
      files: [],
      count: 0
    }) {
      const bootstrapCss = this.getVersionedPath("/libs/bootstrap/bootstrap.min.css", options);
      const themeBasePath = options.themeUrl ? options.themeUrl.replace(/\/$/, "") : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
      const themeCss = `${themeBasePath}/style.css`;
      const fallbackCss = this.getVersionedPath("/style/content.css", options);
      const jqueryUiRequiredTypes = /* @__PURE__ */ new Set([
        "ordena",
        "sort",
        "clasifica",
        "classify",
        "relaciona",
        "relate",
        "dragdrop",
        "complete",
        "completa"
      ]);
      let needsJqueryUiCss = false;
      for (const idevice of usedIdevices) {
        const typeName = idevice.toLowerCase().replace(/idevice$/i, "").replace(/-idevice$/i, "");
        if (jqueryUiRequiredTypes.has(typeName)) {
          needsJqueryUiCss = true;
          break;
        }
      }
      let jqueryUiCssLink = "";
      if (needsJqueryUiCss) {
        const jqueryUiCss = this.getVersionedPath("/libs/jquery-ui/jquery-ui.min.css", options);
        jqueryUiCssLink = `
<link rel="stylesheet" href="${jqueryUiCss}">`;
      }
      let detectedLibraryCss = "";
      for (const file of detectedLibraries.files) {
        if (file.endsWith(".css")) {
          const serverPath = this.getLibraryServerPath(file, options);
          detectedLibraryCss += `
<link rel="stylesheet" href="${serverPath}" onerror="this.remove()">`;
        }
      }
      let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Print Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Print</title>
<script>document.querySelector("html").classList.add("js");<\/script>

<!-- Server-hosted libraries -->
<link rel="stylesheet" href="${bootstrapCss}">${jqueryUiCssLink}${detectedLibraryCss}

<!-- Print-specific CSS -->
<style>
${this.getPrintPreviewCss(options)}
</style>

<!-- Theme from server -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">`;
      const seen = /* @__PURE__ */ new Set();
      for (const idevice of usedIdevices) {
        const typeName = normalizeIdeviceType(idevice);
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const cssFiles = getIdeviceExportFiles(typeName, ".css");
          for (const cssFile of cssFiles) {
            const ideviceCss = this.getVersionedPath(
              `/files/perm/idevices/base/${typeName}/export/${cssFile}`,
              options
            );
            head += `
<link rel="stylesheet" href="${ideviceCss}" onerror="this.remove()">`;
          }
        }
      }
      if (customStyles) {
        head += `
<style>
${customStyles}
</style>`;
      }
      if (addAccessibilityToolbar) {
        const atoolsCss = this.getVersionedPath("/libs/exe_atools/exe_atools.css", options);
        head += `
<link rel="stylesheet" href="${atoolsCss}">`;
      }
      head += `
<style>
${this.getMadeWithExeCss(options)}
</style>`;
      return head;
    }
    /**
     * Get print preview specific CSS
     */
    getPrintPreviewCss(options) {
      return `/* Single-page Print Preview Styles */

/* All sections visible */
.single-page-section {
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 40px;
    margin-bottom: 40px;
}

.single-page-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

/* Navigation styling */
.single-page-nav {
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
}

.single-page-content {
    padding: 20px 30px;
}

/* Smooth scrolling for anchor links */
html {
    scroll-behavior: smooth;
}

/* Section target offset */
.single-page-section:target {
    scroll-margin-top: 20px;
}

/* JavaScript visibility classes */
.js-hidden { display: none; }
.exe-hidden, .js-required, .js .js-hidden, .exe-mindmap-code { display: none; }
.js .js-required { display: block; }

/* Teacher mode - hide teacher-only content */
html:not(.mode-teacher) .js .teacher-only {
    display: none !important;
}

/* Block minimized - hide content */
.exe-export article.minimized .box-content {
    display: none;
}

/* Block/iDevice novisible */
.exe-export article.novisible.box {
    display: none !important;
}
.exe-export article.box .idevice_node.novisible {
    display: none !important;
}

/* Pre-rendered LaTeX */
.exe-math-rendered { display: inline-block; vertical-align: middle; }
.exe-math-rendered[data-display="block"] { display: block; text-align: center; margin: 1em 0; }
.exe-math-rendered svg { vertical-align: middle; max-width: 100%; height: auto; }
.exe-math-rendered svg line.mjx-solid { stroke-width: 60 !important; }
.exe-math-rendered svg rect[data-frame="true"] { fill: none; stroke-width: 60 !important; }
.exe-math-rendered math { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* Print-specific styles */
@media print {
    .single-page-nav {
        display: none;
    }
    .single-page-section {
        page-break-inside: avoid;
        border-bottom: none;
    }
    #made-with-eXe {
        display: none;
    }
    .nav-buttons {
        display: none;
    }
}`;
    }
    /**
     * Get Made-with-eXe CSS
     */
    getMadeWithExeCss(options) {
      const logoUrl = this.getVersionedPath("/app/common/exe_powered_logo/exe_powered_logo.png", options);
      return `/* Made with eXeLearning */
#made-with-eXe {
    margin: 0;
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 9999;
}
#made-with-eXe a {
    text-decoration: none;
    box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
    border-top-left-radius: 4px;
    color: #222;
    font-size: 11px;
    font-family: Arial, sans-serif;
    line-height: 35px;
    width: 35px;
    height: 35px;
    background: #fff url(${logoUrl}) no-repeat 3px 50%;
    display: block;
    background-size: auto 20px;
    transition: .5s;
    opacity: .8;
    overflow: hidden;
}
#made-with-eXe span {
    padding-left: 35px;
    padding-right: 5px;
    white-space: nowrap;
}
#made-with-eXe a:hover {
    width: auto;
    padding: 0 5px;
    background-position: 5px 50%;
    opacity: 1;
}
@media print {
    #made-with-eXe { display: none; }
}`;
    }
    /**
     * Generate scripts section
     */
    generateScripts(themeName, usedIdevices, options, addAccessibilityToolbar = false, detectedLibraries = {
      libraries: [],
      files: [],
      count: 0
    }) {
      const jqueryJs = this.getVersionedPath("/libs/jquery/jquery.min.js", options);
      const bootstrapJs = this.getVersionedPath("/libs/bootstrap/bootstrap.bundle.min.js", options);
      const commonJs = this.getVersionedPath("/app/common/common.js", options);
      const commonI18nJs = this.getVersionedPath("/app/common/common_i18n.js", options);
      const exeExportJs = this.getVersionedPath("/app/common/exe_export.js", options);
      const themeJsBasePath = options.themeUrl ? options.themeUrl.replace(/\/$/, "") : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
      const themeJs = `${themeJsBasePath}/style.js`;
      const jqueryUiRequiredTypes = /* @__PURE__ */ new Set([
        "ordena",
        "sort",
        "clasifica",
        "classify",
        "relaciona",
        "relate",
        "dragdrop",
        "complete",
        "completa"
      ]);
      let needsJqueryUi = false;
      for (const idevice of usedIdevices) {
        const typeName = idevice.toLowerCase().replace(/idevice$/i, "").replace(/-idevice$/i, "");
        if (jqueryUiRequiredTypes.has(typeName)) {
          needsJqueryUi = true;
          break;
        }
      }
      let jqueryUiScript = "";
      if (needsJqueryUi) {
        const jqueryUiJs = this.getVersionedPath("/libs/jquery-ui/jquery-ui.min.js", options);
        jqueryUiScript = `
<script src="${jqueryUiJs}"><\/script>`;
      }
      const needsMathJax = detectedLibraries.libraries.some(
        (lib) => lib.name === "exe_math" || lib.name === "exe_math_datagame"
      );
      let mathJaxScripts = "";
      if (needsMathJax) {
        const mathJaxJs = this.getVersionedPath("/app/common/exe_math/tex-mml-svg.js", options);
        mathJaxScripts = `
<script>
window.MathJax = {
    startup: {
        typeset: true
    }
};
<\/script>
<script src="${mathJaxJs}"><\/script>`;
      }
      let detectedLibraryScripts = "";
      for (const file of detectedLibraries.files) {
        if (file.endsWith(".js")) {
          const serverPath = this.getLibraryServerPath(file, options);
          detectedLibraryScripts += `
<script src="${serverPath}" onerror="this.remove()"><\/script>`;
        }
      }
      let ideviceScripts = "";
      const seenJs = /* @__PURE__ */ new Set();
      for (const idevice of usedIdevices) {
        const typeName = normalizeIdeviceType(idevice);
        if (!seenJs.has(typeName)) {
          seenJs.add(typeName);
          const jsFiles = getIdeviceExportFiles(typeName, ".js");
          for (const jsFile of jsFiles) {
            const ideviceJs = this.getVersionedPath(
              `/files/perm/idevices/base/${typeName}/export/${jsFile}`,
              options
            );
            ideviceScripts += `
<script src="${ideviceJs}" onerror="this.remove()"><\/script>`;
          }
        }
      }
      let atoolsScript = "";
      if (addAccessibilityToolbar) {
        const atoolsJs = this.getVersionedPath("/libs/exe_atools/exe_atools.js", options);
        atoolsScript = `
<script src="${atoolsJs}"><\/script>`;
      }
      return `<script src="${jqueryJs}"><\/script>
<script src="${bootstrapJs}"><\/script>${jqueryUiScript}
<script src="${commonJs}"><\/script>
<script src="${commonI18nJs}"><\/script>
<script src="${exeExportJs}"><\/script>${mathJaxScripts}${detectedLibraryScripts}${ideviceScripts}${atoolsScript}
<script src="${themeJs}" onerror="this.remove()"><\/script>
<script>
// Initialize iDevices after DOM is ready
if (typeof $exeExport !== 'undefined' && $exeExport.init) {
    $exeExport.init();
}
<\/script>`;
    }
    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
      const escapes = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return text.replace(/[&<>"']/g, (char) => escapes[char] || char);
    }
  };

  // src/shared/export/exporters/ComponentExporter.ts
  var ComponentExporter = class extends BaseExporter {
    /**
     * Get file extension for component export
     */
    getFileExtension() {
      return ".elp";
    }
    /**
     * Get file suffix for component export
     */
    getFileSuffix() {
      return "";
    }
    /**
     * Standard export method (not typically used for components)
     * Use exportComponent() instead for targeted exports
     */
    async export(options) {
      const componentOptions = options;
      if (!componentOptions?.blockId) {
        return {
          success: false,
          error: "blockId is required for component export"
        };
      }
      return this.exportComponent(componentOptions.blockId, componentOptions.ideviceId);
    }
    /**
     * Export a single component (iDevice) or entire block
     * @param blockId - Block ID to export
     * @param ideviceId - iDevice ID (null or 'null' = export whole block)
     * @returns Export result with data buffer
     */
    async exportComponent(blockId, ideviceId) {
      const isIdevice = ideviceId && ideviceId !== "null";
      const filename = isIdevice ? `${ideviceId}.idevice` : `${blockId}.block`;
      console.log(`[ComponentExporter] Exporting ${isIdevice ? "iDevice" : "block"}: ${filename}`);
      try {
        const { block, component, pageId } = this.findComponent(blockId, ideviceId);
        if (!block) {
          console.log(`[ComponentExporter] Block not found: ${blockId}`);
          return { success: false, error: "Block not found" };
        }
        if (isIdevice && !component) {
          console.log(`[ComponentExporter] Component not found: ${ideviceId}`);
          return { success: false, error: "Component not found" };
        }
        const contentXml = this.generateComponentExportXml(block, component, pageId);
        this.zip.addFile("content.xml", new TextEncoder().encode(contentXml));
        await this.addComponentAssetsToZip(block, component);
        const data = await this.zip.generate();
        console.log(`[ComponentExporter] Export complete: ${filename}`);
        return { success: true, data, filename };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[ComponentExporter] Export failed:", error);
        return { success: false, error: message };
      }
    }
    /**
     * Export and trigger browser download
     * @param blockId - Block ID to export
     * @param ideviceId - iDevice ID (null = export whole block)
     * @returns Export result
     */
    async exportAndDownload(blockId, ideviceId) {
      const result = await this.exportComponent(blockId, ideviceId);
      if (result.success && result.data && result.filename) {
        this.downloadBlob(result.data, result.filename);
      }
      return result;
    }
    /**
     * Find block and component in document navigation structure
     * @param blockId - Block ID to find
     * @param ideviceId - Optional iDevice ID to find within block
     */
    findComponent(blockId, ideviceId) {
      const pages = this.buildPageList();
      for (const page of pages) {
        for (const block of page.blocks || []) {
          if (block.id === blockId) {
            if (ideviceId && ideviceId !== "null") {
              const component = (block.components || []).find((c) => c.id === ideviceId);
              return { block, component: component || null, pageId: page.id };
            }
            return { block, component: null, pageId: page.id };
          }
        }
      }
      return { block: null, component: null, pageId: null };
    }
    /**
     * Generate XML for component export (ODE format)
     * @param block - Block data
     * @param component - Single component to export (null = all components in block)
     * @param pageId - Page ID containing the block
     */
    generateComponentExportXml(block, component, pageId) {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
      xml += "<odeResources>\n";
      xml += "  <odeResource>\n";
      xml += "    <key>odeComponentsResources</key>\n";
      xml += "    <value>true</value>\n";
      xml += "  </odeResource>\n";
      xml += "</odeResources>\n";
      xml += "<odePagStructures>\n";
      xml += this.generateBlockExportXml(block, component, pageId);
      xml += "</odePagStructures>\n";
      xml += "</ode>";
      return xml;
    }
    /**
     * Generate XML for the block structure
     * @param block - Block data
     * @param singleComponent - Single component to include (null = all)
     * @param pageId - Page ID
     */
    generateBlockExportXml(block, singleComponent, pageId) {
      let xml = "  <odePagStructure>\n";
      xml += `    <odeBlockId>${this.escapeXml(block.id)}</odeBlockId>
`;
      xml += `    <blockName>${this.escapeXml(block.name || "Block")}</blockName>
`;
      xml += `    <iconName></iconName>
`;
      xml += `    <odePagStructureOrder>0</odePagStructureOrder>
`;
      xml += `    <odePagStructureProperties>${this.escapeXml(JSON.stringify(block.properties || {}))}</odePagStructureProperties>
`;
      xml += "    <odeComponents>\n";
      const components = singleComponent ? [singleComponent] : block.components || [];
      for (const comp of components) {
        xml += this.generateIdeviceExportXml(comp, block.id, pageId);
      }
      xml += "    </odeComponents>\n";
      xml += "  </odePagStructure>\n";
      return xml;
    }
    /**
     * Generate XML for a single iDevice/component
     * @param comp - Component data
     * @param blockId - Parent block ID
     * @param pageId - Parent page ID
     */
    generateIdeviceExportXml(comp, blockId, pageId) {
      let xml = "      <odeComponent>\n";
      xml += `        <odeIdeviceId>${this.escapeXml(comp.id)}</odeIdeviceId>
`;
      xml += `        <odePageId>${this.escapeXml(pageId)}</odePageId>
`;
      xml += `        <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>
`;
      xml += `        <odeIdeviceTypeName>${this.escapeXml(comp.type || "FreeTextIdevice")}</odeIdeviceTypeName>
`;
      xml += `        <ideviceSrcType>json</ideviceSrcType>
`;
      xml += `        <userIdevice>0</userIdevice>
`;
      xml += `        <htmlView><![CDATA[${this.escapeCdata(comp.content || "")}]]></htmlView>
`;
      xml += `        <jsonProperties><![CDATA[${this.escapeCdata(JSON.stringify(comp.properties || {}))}]]></jsonProperties>
`;
      xml += `        <odeComponentsOrder>${comp.order || 0}</odeComponentsOrder>
`;
      xml += `        <odeComponentsProperties></odeComponentsProperties>
`;
      xml += "      </odeComponent>\n";
      return xml;
    }
    /**
     * Add only assets used by this component to ZIP
     * Scans component content for asset:// URLs and includes only those assets
     * @param block - Block data
     * @param singleComponent - Single component (null = all in block)
     */
    async addComponentAssetsToZip(block, singleComponent) {
      try {
        const allAssets = await this.assets.getAllAssets();
        const components = singleComponent ? [singleComponent] : block.components || [];
        const usedAssetIds = /* @__PURE__ */ new Set();
        for (const comp of components) {
          const content = comp.content || "";
          const matches = content.matchAll(/asset:\/\/([a-f0-9-]+)/gi);
          for (const match of matches) {
            usedAssetIds.add(match[1]);
          }
        }
        console.log(`[ComponentExporter] Found ${usedAssetIds.size} referenced assets`);
        let addedCount = 0;
        for (const asset of allAssets) {
          const assetId = asset.id;
          if (usedAssetIds.has(assetId)) {
            const filename = asset.filename || `asset-${assetId}`;
            const originalPath = asset.originalPath || `content/resources/${assetId}/${filename}`;
            this.zip.addFile(originalPath, asset.data);
            console.log(`[ComponentExporter] Added asset: ${originalPath}`);
            addedCount++;
          }
        }
        console.log(`[ComponentExporter] Added ${addedCount} assets to ZIP`);
      } catch (e) {
        console.warn("[ComponentExporter] Failed to add assets:", e);
      }
    }
    /**
     * Trigger browser download of blob data
     * @param data - ZIP data buffer
     * @param filename - Download filename
     */
    downloadBlob(data, filename) {
      if (typeof window === "undefined" || typeof document === "undefined") {
        console.warn("[ComponentExporter] downloadBlob only works in browser environment");
        return;
      }
      const blob = new Blob([data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // src/shared/export/browser/index.ts
  function createNullResourceProvider() {
    return {
      fetchTheme: async () => /* @__PURE__ */ new Map(),
      fetchIdeviceResources: async () => /* @__PURE__ */ new Map(),
      fetchBaseLibraries: async () => /* @__PURE__ */ new Map(),
      fetchScormFiles: async () => /* @__PURE__ */ new Map(),
      fetchLibraryFiles: async () => /* @__PURE__ */ new Map(),
      fetchLibraryDirectory: async () => /* @__PURE__ */ new Map(),
      fetchSchemas: async () => /* @__PURE__ */ new Map(),
      normalizeIdeviceType: (type) => type.toLowerCase().replace(/idevice$/i, "") || "text"
    };
  }
  function createNullAssetProvider() {
    return {
      getAsset: async () => null,
      hasAsset: async () => false,
      listAssets: async () => [],
      getAllAssets: async () => [],
      resolveAssetUrl: async () => null,
      getProjectAssets: async () => []
    };
  }
  function createExporter(format, documentManager, assetCache, resourceFetcher, assetManager) {
    if (!documentManager) {
      throw new Error("[SharedExporters] documentManager is required for export");
    }
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    const assets = assetCache || assetManager ? new BrowserAssetProvider(
      assetCache,
      assetManager
    ) : createNullAssetProvider();
    const zip2 = new FflateZipProvider();
    const normalizedFormat = format.toLowerCase().replace("-", "");
    switch (normalizedFormat) {
      case "html5":
      case "web":
        return new Html5Exporter(document2, resources, assets, zip2);
      case "html5sp":
      case "page":
        return new PageExporter(document2, resources, assets, zip2);
      case "scorm12":
      case "scorm":
        return new Scorm12Exporter(document2, resources, assets, zip2);
      case "scorm2004":
        return new Scorm2004Exporter(document2, resources, assets, zip2);
      case "ims":
      case "imscp":
        return new ImsExporter(document2, resources, assets, zip2);
      case "epub3":
      case "epub":
        return new Epub3Exporter(document2, resources, assets, zip2);
      case "elpx":
      case "elp":
        return new ElpxExporter(document2, resources, assets, zip2);
      case "component":
      case "block":
      case "idevice":
        return new ComponentExporter(document2, resources, assets, zip2);
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }
  function getLatexPreRendererHooks() {
    if (typeof window === "undefined") return void 0;
    const windowLatexPreRenderer = window.LatexPreRenderer;
    const windowMathJax = window.MathJax;
    if (windowLatexPreRenderer && windowMathJax) {
      return {
        preRenderLatex: windowLatexPreRenderer.preRender.bind(windowLatexPreRenderer),
        preRenderDataGameLatex: windowLatexPreRenderer.preRenderDataGameLatex.bind(windowLatexPreRenderer)
      };
    }
    return void 0;
  }
  function getMermaidPreRendererHooks() {
    if (typeof window === "undefined") return void 0;
    const windowMermaidPreRenderer = window.MermaidPreRenderer;
    if (windowMermaidPreRenderer) {
      return {
        preRenderMermaid: windowMermaidPreRenderer.preRender.bind(windowMermaidPreRenderer)
      };
    }
    return void 0;
  }
  async function quickExport(format, documentManager, assetCache, resourceFetcher, options, assetManager) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher, assetManager);
    const latexHooks = getLatexPreRendererHooks();
    const mermaidHooks = getMermaidPreRendererHooks();
    const exportOptions = { ...options, ...latexHooks, ...mermaidHooks };
    return exporter.export(exportOptions);
  }
  async function exportAndDownload(format, documentManager, assetCache, resourceFetcher, filename, options, assetManager) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher, assetManager);
    const latexHooks = getLatexPreRendererHooks();
    const mermaidHooks = getMermaidPreRendererHooks();
    const exportOptions = { ...options, ...latexHooks, ...mermaidHooks };
    const result = await exporter.export(exportOptions);
    if (!result.success || !result.data) {
      throw new Error(result.error || "Export failed");
    }
    const extension = exporter.getFileExtension();
    const fullFilename = filename.endsWith(extension) ? filename : `${filename}${extension}`;
    const blob = new Blob([result.data], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fullFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return result;
  }
  async function generatePreview(documentManager, resourceFetcher, options) {
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    const exporter = new WebsitePreviewExporter(document2, resources);
    const latexHooks = getLatexPreRendererHooks();
    const mermaidHooks = getMermaidPreRendererHooks();
    options = {
      ...options,
      ...latexHooks,
      ...mermaidHooks
    };
    return exporter.generatePreview(options);
  }
  async function openPreviewWindow(documentManager, resourceFetcher, options) {
    const result = await generatePreview(documentManager, resourceFetcher, options);
    if (!result.success || !result.html) {
      console.error("[SharedExporters] Preview generation failed:", result.error);
      return null;
    }
    let html = result.html;
    const resolveAssetUrlsAsync = window.resolveAssetUrlsAsync;
    if (typeof resolveAssetUrlsAsync === "function") {
      try {
        html = await resolveAssetUrlsAsync(html);
      } catch (error) {
        console.warn("[SharedExporters] Failed to resolve asset URLs:", error);
      }
    }
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      console.error("[SharedExporters] Could not open preview window (popup blocked?)");
      return null;
    }
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
    return previewWindow;
  }
  function createPreviewExporter(documentManager, resourceFetcher) {
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    return new WebsitePreviewExporter(document2, resources);
  }
  async function generatePrintPreview(documentManager, resourceFetcher, options) {
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    const exporter = new PrintPreviewExporter(document2, resources);
    const latexHooks = getLatexPreRendererHooks();
    const mermaidHooks = getMermaidPreRendererHooks();
    options = {
      ...options,
      ...latexHooks,
      ...mermaidHooks
    };
    return exporter.generatePreview(options);
  }
  function createPrintPreviewExporter(documentManager, resourceFetcher) {
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    return new PrintPreviewExporter(document2, resources);
  }
  if (typeof window !== "undefined") {
    const windowExports = {
      // Factory functions
      createExporter,
      quickExport,
      exportAndDownload,
      // Preview functions
      generatePreview,
      openPreviewWindow,
      createPreviewExporter,
      // Print preview functions
      generatePrintPreview,
      createPrintPreviewExporter,
      // Adapters
      YjsDocumentAdapter,
      BrowserResourceProvider,
      BrowserAssetProvider,
      ExportAssetResolver,
      PreviewAssetResolver,
      // Providers
      FflateZipProvider,
      // Exporters
      Html5Exporter,
      PageExporter,
      Scorm12Exporter,
      Scorm2004Exporter,
      ImsExporter,
      Epub3Exporter,
      ElpxExporter,
      WebsitePreviewExporter,
      PrintPreviewExporter,
      ComponentExporter,
      // Renderers
      IdeviceRenderer,
      PageRenderer,
      // Generators
      Scorm12ManifestGenerator,
      Scorm2004ManifestGenerator,
      ImsManifestGenerator,
      LomMetadataGenerator,
      // Utilities
      LibraryDetector
    };
    window.PrintPreviewExporter = PrintPreviewExporter;
    window.generatePrintPreview = generatePrintPreview;
    window.SharedExporters = windowExports;
    window.createSharedExporter = createExporter;
    window.createExporter = createExporter;
    console.log("[SharedExporters] Browser export system loaded");
  }
})();
