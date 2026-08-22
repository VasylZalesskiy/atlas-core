import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
import {createChatRoom,decryptChatPacket,encryptChatPacket,importChatKey,randomHex} from "../src/services/chatCrypto.js";

const origin=process.argv[2]||"https://atlas-core-two.vercel.app";
const html=await (await fetch(origin)).text();
const asset=html.match(/src="([^"]+index-[^"]+\.js)"/)?.[1];
assert.ok(asset,"production bundle not found");
const bundle=await (await fetch(new URL(asset,origin))).text();
const supabaseUrl=bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
const publishableKey=bundle.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
assert.ok(supabaseUrl&&publishableKey,"public Supabase configuration not found");

const room=createChatRoom();
const key=await importChatKey(room.secret);
const first=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
const second=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
const topic=`atlas-chat:${room.roomId}`;
const firstId=randomHex(8);
let resolveReceived;
let rejectReceived;
const received=new Promise((resolve,reject)=>{resolveReceived=resolve;rejectReceived=reject});
const timeout=setTimeout(()=>rejectReceived(new Error("realtime broadcast timed out")),12000);

const receiver=second.channel(topic,{config:{broadcast:{ack:true,self:false}}})
  .on("broadcast",{event:"packet"},async event=>{
    const packet=await decryptChatPacket(key,event.payload);
    resolveReceived(packet);
  });
const sender=first.channel(topic,{config:{broadcast:{ack:true,self:false}}});

await Promise.all([
  new Promise((resolve,reject)=>receiver.subscribe((status,error)=>status==="SUBSCRIBED"?resolve():status==="CHANNEL_ERROR"?reject(error):undefined)),
  new Promise((resolve,reject)=>sender.subscribe((status,error)=>status==="SUBSCRIBED"?resolve():status==="CHANNEL_ERROR"?reject(error):undefined))
]);

const packet={type:"message",id:randomHex(8),name:"Smoke test",text:"encrypted-realtime-check",time:"00:00"};
const encrypted=await encryptChatPacket(key,packet);
const result=await sender.send({type:"broadcast",event:"packet",payload:{senderId:firstId,...encrypted}});
assert.equal(result,"ok");
assert.deepEqual(await received,packet);
clearTimeout(timeout);
await Promise.all([first.removeChannel(sender),second.removeChannel(receiver)]);
first.realtime.disconnect();
second.realtime.disconnect();
console.log("Realtime encrypted broadcast: OK");
