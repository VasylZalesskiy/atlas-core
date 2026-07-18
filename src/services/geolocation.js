const options={enableHighAccuracy:true,timeout:12000,maximumAge:30000};

function normalizePosition(position){
  return {latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp};
}

function normalizeError(error){
  if(error?.code===1)return {code:"permission-denied"};
  if(error?.code===2)return {code:"position-unavailable"};
  if(error?.code===3)return {code:"timeout"};
  return {code:"unknown"};
}

/** Запитує поточні координати лише після явного виклику користувачем. */
export function getCurrentLocation(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.navigator?.geolocation){reject({code:"unsupported"});return}
    navigator.geolocation.getCurrentPosition(position=>resolve(normalizePosition(position)),error=>reject(normalizeError(error)),options);
  });
}

/** Починає спостереження за координатами та повертає ідентифікатор браузера. */
export function watchCurrentLocation(onLocation,onError=()=>{}){
  if(!globalThis.navigator?.geolocation){onError({code:"unsupported"});return null}
  return navigator.geolocation.watchPosition(position=>onLocation(normalizePosition(position)),error=>onError(normalizeError(error)),options);
}

/** Зупиняє раніше запущене спостереження за координатами. */
export function clearLocationWatch(watchId){
  if(watchId!==null&&watchId!==undefined&&globalThis.navigator?.geolocation)navigator.geolocation.clearWatch(watchId);
}
