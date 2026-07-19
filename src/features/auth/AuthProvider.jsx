import {createContext,useEffect,useState} from "react";
import supabase from "../../services/supabase";

export const AuthContext=createContext(null);

export function AuthProvider({children}){
  const [session,setSession]=useState(null);const [loading,setLoading]=useState(Boolean(supabase));
  useEffect(()=>{if(!supabase){setLoading(false);return}let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false)}});const {data}=supabase.auth.onAuthStateChange((_event,nextSession)=>{if(mounted)setSession(nextSession)});return()=>{mounted=false;data.subscription.unsubscribe()}},[]);
  return <AuthContext.Provider value={{session,user:session?.user||null,loading,configured:Boolean(supabase)}}>{children}</AuthContext.Provider>;
}
