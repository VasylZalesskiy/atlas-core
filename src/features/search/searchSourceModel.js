export const SEARCH_SOURCE_TYPES=["passport","community","marketplace","classifieds","maps","web","summary"];
export const SEARCH_SOURCE_STATUSES=["searching","found","not_found","available_external","unavailable","disabled"];
export function createSearchSource(value={}){return {id:value.id||"unknown",type:value.type||"summary",title:value.title||"",status:value.status||"unavailable",count:value.count??null,isRealData:Boolean(value.isRealData),message:value.message??null,items:Array.isArray(value.items)?value.items:[],actions:Array.isArray(value.actions)?value.actions:[]}}
