export const ENTRY_TYPES=["can","have","share","need","ready"];
export const CATEGORIES=["agriculture","transport","construction","energy","education","medicine","information_technology","business","investments","legal","logistics","trade","manufacturing","household","volunteering","sports","tourism","arts","other"];
export const PROVISION_FORMATS=["free","paid","sell","rent","lend","gift","exchange","shared_use","partnership","volunteer"];
export const TERRITORY_MODES=["nearby","radius","city","region","country","remote","worldwide"];
export const AVAILABILITY_MODES=["now","today","this_week","weekends","always","custom"];
export const VISIBILITY_SCOPES=["private","family","community","all_communities","company","city","ukraine","atlas","internet"];
export const ENTRY_STATUSES=["active","paused","archived"];

export const FORMATS_BY_TYPE={
  can:["paid","free","volunteer","partnership","exchange"],
  have:["sell","rent","lend","gift","exchange","shared_use","free"],
  share:["sell","rent","lend","gift","exchange","shared_use","free"],
  need:["paid","rent","lend","free","partnership"],
  ready:["paid","free","volunteer","partnership","exchange"]
};

export function emptyPassportEntry(type="can"){
  return {id:"",ownerId:null,type,title:"",description:"",category:"",customCategory:null,provisionFormats:[],territory:{mode:"nearby",radiusKm:null,city:null,region:null,country:null},availability:{mode:"always",customText:null},visibility:{scope:"private",communityId:null},status:"active",createdAt:"",updatedAt:""};
}
