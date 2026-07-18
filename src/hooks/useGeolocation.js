import {useCallback,useState} from "react";
import {getCurrentLocation} from "../services/geolocation";

export default function useGeolocation(initialLocation=null){
  const [location,setLocation]=useState(initialLocation);const [loading,setLoading]=useState(false);const [error,setError]=useState(null);const [permissionState,setPermissionState]=useState(initialLocation?"granted":"prompt");
  const requestLocation=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const nextLocation=await getCurrentLocation();setLocation(nextLocation);setPermissionState("granted");return nextLocation;
    }catch(nextError){setError(nextError.code||"unknown");if(nextError.code==="permission-denied")setPermissionState("denied");return null}
    finally{setLoading(false)}
  },[]);
  const refreshLocation=useCallback(()=>requestLocation(),[requestLocation]);
  return {location,loading,error,permissionState,requestLocation,refreshLocation};
}
