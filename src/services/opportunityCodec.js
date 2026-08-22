const metadataMarker="\n\u2063ATLAS_META:";

export const opportunityGroups=[
  {value:"have",label:"Я маю"},
  {value:"professional",label:"Фахові здібності"},
  {value:"help",label:"Можу надати допомогу"},
  {value:"additional",label:"Додаткові знання та вміння"},
  {value:"hobby",label:"Хобі"},
  {value:"free_use",label:"Безкоштовно дам покористуватися"},
  {value:"rent",label:"Дам в оренду"}
];

const legacyGroupByKind={help:"help",share:"have",sell:"have",give:"have",lend:"free_use",rent:"rent",other:"additional"};
const dbKindByGroup={have:"share",professional:"help",help:"help",additional:"other",hobby:"other",free_use:"lend",rent:"rent"};

export function databaseKindForGroup(group){return dbKindByGroup[group]||"other"}

export function decodeOpportunityText(value,kind="other"){
  const raw=String(value||"");
  const markerIndex=raw.lastIndexOf(metadataMarker);
  if(markerIndex<0)return {
    text:raw,
    group:legacyGroupByKind[kind]||"additional",
    duration:"month",
    place:"",
    radiusValue:"",
    radiusUnit:"км",
    online:false,
    paymentType:"free",
    priceValue:"",
    priceUnit:"шт.",
    currency:"UAH",
    minimumQuantity:"",
    deliveryIncluded:false
  };

  const text=raw.slice(0,markerIndex).trim();
  try{
    const metadata=JSON.parse(decodeURIComponent(raw.slice(markerIndex+metadataMarker.length)));
    return {
      text,
      group:opportunityGroups.some(item=>item.value===metadata.group)?metadata.group:(legacyGroupByKind[kind]||"additional"),
      duration:["hour","day","month","year"].includes(metadata.duration)?metadata.duration:"month",
      place:String(metadata.place||""),
      radiusValue:metadata.radiusValue==null?"":String(metadata.radiusValue),
      radiusUnit:["км","м","см"].includes(metadata.radiusUnit)?metadata.radiusUnit:"км",
      online:Boolean(metadata.online),
      paymentType:["free","paid","exchange","negotiable"].includes(metadata.paymentType)?metadata.paymentType:"free",
      priceValue:metadata.priceValue==null?"":String(metadata.priceValue),
      priceUnit:["кг","шт.","година","консультація","послуга","день","поїздка","комплект"].includes(metadata.priceUnit)?metadata.priceUnit:"шт.",
      currency:["UAH","USD","EUR"].includes(metadata.currency)?metadata.currency:"UAH",
      minimumQuantity:metadata.minimumQuantity==null?"":String(metadata.minimumQuantity),
      deliveryIncluded:Boolean(metadata.deliveryIncluded)
    };
  }catch{
    return {text,group:legacyGroupByKind[kind]||"additional",duration:"month",place:"",radiusValue:"",radiusUnit:"км",online:false,paymentType:"free",priceValue:"",priceUnit:"шт.",currency:"UAH",minimumQuantity:"",deliveryIncluded:false};
  }
}

export function encodeOpportunityText(entry){
  const text=String(entry.text||"").trim().slice(0,1100);
  const metadata={
    group:opportunityGroups.some(item=>item.value===entry.group)?entry.group:"additional",
    duration:["hour","day","month","year"].includes(entry.duration)?entry.duration:"month",
    place:String(entry.place||"").trim().slice(0,120),
    radiusValue:String(entry.radiusValue||"").trim().slice(0,12),
    radiusUnit:["км","м","см"].includes(entry.radiusUnit)?entry.radiusUnit:"км",
    online:Boolean(entry.online),
    paymentType:["free","paid","exchange","negotiable"].includes(entry.paymentType)?entry.paymentType:"free",
    priceValue:String(entry.priceValue||"").trim().replace(",",".").slice(0,14),
    priceUnit:["кг","шт.","година","консультація","послуга","день","поїздка","комплект"].includes(entry.priceUnit)?entry.priceUnit:"шт.",
    currency:["UAH","USD","EUR"].includes(entry.currency)?entry.currency:"UAH",
    minimumQuantity:String(entry.minimumQuantity||"").trim().replace(",",".").slice(0,14),
    deliveryIncluded:Boolean(entry.deliveryIncluded)
  };
  if(metadata.paymentType!=="paid")metadata.priceValue="";
  const suffix=`${metadataMarker}${encodeURIComponent(JSON.stringify(metadata))}`;
  return `${text.slice(0,Math.max(2,1495-suffix.length))}${suffix}`;
}
