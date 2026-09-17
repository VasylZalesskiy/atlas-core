import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import dict from "./data/translations";

const zh={
  ...dict.en,
  profile:"能力护照",
  h1:"您想实现什么目标？",
  h2:"Atlas 将寻找机会并构建解决方案路径。",
  task:"描述您的目标",
  taskPh:"例如：我想建一个温室",
  where:"需要在哪里实现？",
  wherePh:"城市、区或地区（可选）",
  build:"寻找解决方案",
  create:"创建能力护照",
  principle:"你的能力，是别人任务的一部分。",
  examples:"尝试示例",
  thinkingSteps:["分析您的目标","确定所需能力","寻找匹配资源","构建最佳路径","准备解决方案"],
  found:"解决方案已准备好",
  sub:"Atlas 已构建可用机会链。",
  back:"返回",
  goal:"目标",
  location:"位置",
  notSpecified:"未指定",
  people:"找到的机会",
  expand:"扩大搜索",
  missing:"缺失环节",
  alternatives:"其他选择",
  noAlternatives:"未找到其他相关选项。",
  contact:"联系方式",
  save:"保存资料",
  saving:"保存中…",
  saved:"资料已保存"
};

const hi={
  ...dict.en,
  profile:"क्षमता पासपोर्ट",
  h1:"आप कौन सा लक्ष्य हासिल करना चाहते हैं?",
  h2:"Atlas अवसर खोजेगा और समाधान की श्रृंखला बनाएगा।",
  task:"अपना लक्ष्य बताएं",
  taskPh:"उदाहरण: मैं ग्रीनहाउस बनाना चाहता हूं",
  where:"यह कहाँ चाहिए?",
  wherePh:"शहर, जिला या क्षेत्र (वैकल्पिक)",
  build:"समाधान खोजें",
  create:"क्षमता पासपोर्ट बनाएं",
  principle:"आपकी क्षमताएँ किसी और के कार्य का हिस्सा हैं।",
  examples:"उदाहरण आज़माएं",
  thinkingSteps:["आपके लक्ष्य का विश्लेषण","आवश्यक क्षमताओं की पहचान","उपयुक्त संसाधनों की खोज","सर्वोत्तम श्रृंखला बनाना","समाधान तैयार करना"],
  found:"समाधान तैयार है",
  sub:"Atlas ने उपलब्ध अवसरों की श्रृंखला बनाई है।",
  back:"वापस",
  goal:"लक्ष्य",
  location:"स्थान",
  notSpecified:"निर्दिष्ट नहीं",
  people:"मिले अवसर",
  expand:"खोज बढ़ाएं",
  missing:"गुम कड़ी",
  alternatives:"वैकल्पिक विकल्प",
  noAlternatives:"कोई अन्य प्रासंगिक विकल्प नहीं मिला।",
  contact:"संपर्क",
  save:"प्रोफ़ाइल सहेजें",
  saving:"सहेजा जा रहा है…",
  saved:"प्रोफ़ाइल सहेजी गई"
};

const resources={
  uk:{translation:dict.uk},
  en:{translation:dict.en},
  zh:{translation:zh},
  hi:{translation:hi}
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs:["uk","en","zh","hi"],
    fallbackLng:"uk",
    load:"languageOnly",
    detection:{
      order:["localStorage","navigator"],
      lookupLocalStorage:"atlas-language",
      caches:["localStorage"]
    },
    interpolation:{escapeValue:false}
  });

export default i18n;
