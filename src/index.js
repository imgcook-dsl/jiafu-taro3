const shouldRemoveStyleProp = ["lines", "type"];

module.exports = function(schema, option) {
  const { _ } = option;
  const renderData = {};
  const style = {};

  function parseProps(propValue, isXML) {
    if (/^\{\{.*\}\}$/.test(propValue)) {
      if (isXML) {
        return propValue.slice(2, -2);
      } else {
        return propValue.slice(1, -1);
      }
    }

    if (isXML) {
      return `'${propValue}'`;
    } else {
      return propValue;
    }
  }

  function transform(json) {
    var result = "";
    var comProps = {};

    if (Array.isArray(json)) {
      json.forEach(function(node) {
        const res = transform(node);
        result += res.result;
        Object.assign(comProps, res.props);
      });
    } else if (typeof json == "object") {
      var type = json.componentName && json.componentName.toLowerCase();
      var className = json.props && json.props.className;
      var classString = className ? ` className={styles.${className}}` : "";
      switch (type) {
        case "text":
          var innerText = parseProps(json.props.text);
          comProps[className] = innerText;
          result += `<Text${classString}>{props.${className}}</Text>`;
          break;

        case "image":
          var source = parseProps(json.props.src, true);
          comProps[`${className}Img`] = source;
          result += `<Image${classString} src={props.${className}Img}  />`;
          break;
        case "div":
        case "page":
        default:
          if (json.children && json.children.length > 0) {
            const res1 = transform(json.children);
            Object.assign(comProps, res1.props);
            result += `<View${classString}>${res1.result}</View>`;
          } else {
            result += `<View${classString} />`;
          }
          break;
      }

      if (className) {
        style[className] = {
          ...json.props.style,
          type,
        };
      }
    }

    return { result, props: comProps };
  }

  const { result, props } = transform(schema);
  // transform json
  var jsx = `${result}`;

  renderData.modClass = `
    const mockProps = ${JSON.stringify(props)}

    const Mod = (props = mockProps) => {
      return (
        ${jsx}
      );
    }
  `;

  renderData.exports = `export default Mod;`;

  const tsx = `
  import Taro from '@tarojs/taro';
  import { View, Image, Text } from '@tarojs/components';
  import * as styles from './index.module.scss';

  ${renderData.modClass}

  export default Mod;
`;

  const generateLess = (schema) => {
    let strLess = "";

    function walk(json) {
      if (json.props.className) {
        let className = json.props.className;
        strLess += `.${className} {`;

        for (let key in style[className]) {
          if (shouldRemoveStyleProp.indexOf(key) > -1) {
            strLess += "";
          } else {
            // console.log(style[className])
            strLess += `${_.kebabCase(key)}: ${style[className][key]};\n`;
          }
        }
      }

      if (json.children && json.children.length > 0) {
        json.children.forEach((child) => walk(child));
      }

      if (json.props.className) {
        strLess += "}";
      }
    }

    walk(schema);
    return strLess;
  };

  const prettierOpt = {
    parser: "babel",
    printWidth: 80,
    singleQuote: true,
  };

  return {
    panelDisplay: [
      {
        panelName: "index.tsx",
        panelValue: option.prettier.format(tsx, prettierOpt),
        panelType: "tsx",
      },
      {
        panelName: `index.module.scss`,
        panelValue: option.prettier.format(generateLess(schema), {
          parser: "scss",
        }),
        panelType: "scss",
      },
      {
        panelName: `index.config.ts`,
        panelValue: option.prettier.format(
          `export default {
          navigationBarTitleText: '',
        }`,
          prettierOpt
        ),
        panelType: "ts",
      },
    ],
    noTemplate: true,
    prettierOpt: prettierOpt,
  };
};
