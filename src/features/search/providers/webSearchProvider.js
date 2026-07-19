import {buildWebSearchUrl} from "../externalSearchUrlBuilder.js";
export const webSearchProvider={id:"web",async search({query,location}){return {id:"web",type:"web",title:"web",status:"available_external",count:null,isRealData:false,message:"external-search-prepared",items:[],actions:[{id:"web-search",title:"web",kind:"external",externalUrl:buildWebSearchUrl(query,location)}]}}};
